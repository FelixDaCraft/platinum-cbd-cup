/**
 * Results Computation Service — calcul des notes finales, rangs et labels.
 *
 * Ce calcul vivait dans le routeur tRPC `results.ts`, d'où `cup.ts` l'importait
 * en traversant la couche transport pour atteindre une règle métier. Un routeur
 * qui exporte du métier ne peut être ni appelé hors requête (script de reprise,
 * tâche planifiée, test unitaire) ni lu sans charger tout le contexte tRPC ;
 * l'implémentation vit désormais ici, le routeur n'en garde que la réexportation.
 *
 * Toutes les lectures sont agrégées en amont (une poignée de requêtes pour
 * toute la cup, au lieu d'une par note) et toutes les écritures sont commitées
 * en une transaction : pendant le calcul, le palmarès public et le widget ne
 * doivent jamais voir un classement à moitié réécrit.
 */

import { eq, and, sql, desc, isNotNull, inArray } from "drizzle-orm";
import { products } from "~/server/db/schema/products";
import { categories } from "~/server/db/schema/categories";
import { cupLabels } from "~/server/db/schema/cup-labels";
import { productRatings, criterionScores } from "~/server/db/schema/ratings";
import { ratingCriteria } from "~/server/db/schema/rating-criteria";
import { registrations } from "~/server/db/schema/registrations";

type DbClient = typeof import("~/server/db").db;

export interface ComputeResultsSummary {
  productsProcessed: number;
  labelsAttributed: number;
}

/**
 * Recalcule note finale, rang de catégorie et label de tous les produits d'une
 * cup, puis écrit le tout en une transaction.
 *
 * @param _cup Conservé pour les appelants (cup.publishResults) : les scores
 *   restent exprimés dans l'échelle d'origine, le calcul n'a pas besoin de la lire.
 */
export async function computeResults(
  db: DbClient,
  cupId: string,
  _cup: { ratingScale: string }
): Promise<ComputeResultsSummary> {
  const cupCategories = await db.query.categories.findMany({
    where: eq(categories.cupId, cupId),
  });

  if (cupCategories.length === 0) {
    return { productsProcessed: 0, labelsAttributed: 0 };
  }

  const categoryIds = cupCategories.map((c) => c.id);

  const labels = await db.query.cupLabels.findMany({
    where: eq(cupLabels.cupId, cupId),
    orderBy: [desc(cupLabels.minScore)],
  });

  // Produits éligibles au classement de la cup, avec la date d'inscription
  // qui sert de dernier départage.
  const eligibleProducts = await db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      registrationId: products.registrationId,
      registeredAt: registrations.createdAt,
      disqualified: products.disqualified,
    })
    .from(products)
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        inArray(products.categoryId, categoryIds),
        eq(registrations.cupId, cupId),
        eq(registrations.status, "confirmed"),
        // Les produits exclus disparaissent de tout affichage ; les
        // disqualifiés restent notés (le palmarès les montre avec un badge
        // « DISQUALIFIÉ ») mais sont sortis du classement plus bas.
        eq(products.excludedFromResults, false)
      )
    );

  // Somme pondérée et somme des coefficients par note déposée : la moyenne
  // d'un produit est la moyenne des moyennes de ses jurés.
  const ratingAggregates = await db
    .select({
      productId: productRatings.productId,
      ratingId: productRatings.id,
      weightedSum: sql<string>`sum(${criterionScores.score} * ${ratingCriteria.coefficient})`,
      coefficientSum: sql<string>`sum(${ratingCriteria.coefficient})`,
    })
    .from(criterionScores)
    .innerJoin(productRatings, eq(criterionScores.productRatingId, productRatings.id))
    .innerJoin(ratingCriteria, eq(criterionScores.criterionId, ratingCriteria.id))
    .innerJoin(products, eq(productRatings.productId, products.id))
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.cupId, cupId),
        isNotNull(productRatings.submittedAt)
      )
    )
    .groupBy(productRatings.productId, productRatings.id);

  // Nombre de notes déposées par produit — y compris celles sans score, qui
  // n'entrent pas dans la moyenne mais comptent dans le départage.
  const ratingCounts = await db
    .select({
      productId: productRatings.productId,
      juryCount: sql<string>`count(*)`,
    })
    .from(productRatings)
    .innerJoin(products, eq(productRatings.productId, products.id))
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.cupId, cupId),
        isNotNull(productRatings.submittedAt)
      )
    )
    .groupBy(productRatings.productId);

  const juryCountByProduct = new Map(
    ratingCounts.map((r) => [r.productId, Number(r.juryCount)])
  );

  const averagesByProduct = new Map<string, number[]>();
  for (const row of ratingAggregates) {
    const coefficientSum = Number(row.coefficientSum);
    if (coefficientSum <= 0) continue;

    const averages = averagesByProduct.get(row.productId) ?? [];
    averages.push(Number(row.weightedSum) / coefficientSum);
    averagesByProduct.set(row.productId, averages);
  }

  type ProductUpdate = {
    id: string;
    finalScore: string | null;
    labelId: string | null;
    categoryRank: number | null;
  };

  const updates: ProductUpdate[] = [];
  let productsProcessed = 0;
  let labelsAttributed = 0;

  for (const category of cupCategories) {
    const categoryProducts = eligibleProducts.filter(
      (p) => p.categoryId === category.id
    );

    const productScores: {
      id: string;
      finalScore: number;
      juryCount: number;
      registeredAt: Date;
    }[] = [];

    for (const product of categoryProducts) {
      const averages = averagesByProduct.get(product.id);

      // Aucune note exploitable : on efface un éventuel résultat antérieur
      // plutôt que de laisser un rang ou un label périmé.
      if (!averages || averages.length === 0) {
        updates.push({
          id: product.id,
          finalScore: null,
          labelId: null,
          categoryRank: null,
        });
        continue;
      }

      const finalScore = averages.reduce((a, b) => a + b, 0) / averages.length;
      productsProcessed++;

      // Un disqualifié garde sa note — le palmarès public l'affiche au bas de
      // sa catégorie avec un badge « DISQUALIFIÉ », et la requête de la page
      // écarte les produits sans finalScore. Mais il ne prend ni rang ni
      // label : sans cela il consommait une place de podium et le vrai premier
      // s'affichait « 2e ».
      if (product.disqualified) {
        updates.push({
          id: product.id,
          finalScore: finalScore.toFixed(2),
          labelId: null,
          categoryRank: null,
        });
        continue;
      }

      productScores.push({
        id: product.id,
        finalScore,
        juryCount: juryCountByProduct.get(product.id) ?? averages.length,
        registeredAt: product.registeredAt,
      });
    }

    productScores.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      if (b.juryCount !== a.juryCount) {
        return b.juryCount - a.juryCount;
      }
      return a.registeredAt.getTime() - b.registeredAt.getTime();
    });

    for (let i = 0; i < productScores.length; i++) {
      const { id, finalScore } = productScores[i]!;

      let matchedLabelId: string | null = null;
      for (const label of labels) {
        const minOk = finalScore >= label.minScore;
        const maxOk = label.maxScore === null || finalScore <= label.maxScore;
        if (minOk && maxOk) {
          matchedLabelId = label.id;
          labelsAttributed++;
          break;
        }
      }

      updates.push({
        id,
        finalScore: finalScore.toFixed(2),
        labelId: matchedLabelId,
        categoryRank: i + 1,
      });
    }
  }

  // Produits exclus des résultats : ils ne doivent conserver ni note, ni rang,
  // ni label d'un calcul antérieur. Résolus par identifiant et via la jointure
  // sur l'inscription, pour que le recalcul d'une cup ne puisse jamais toucher
  // un produit d'une autre cup.
  const excludedProducts = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.cupId, cupId),
        eq(products.excludedFromResults, true)
      )
    );

  await db.transaction(async (tx) => {
    if (excludedProducts.length > 0) {
      await tx
        .update(products)
        .set({
          finalScore: null,
          labelId: null,
          categoryRank: null,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            products.id,
            excludedProducts.map((p) => p.id)
          )
        );
    }

    for (const update of updates) {
      await tx
        .update(products)
        .set({
          finalScore: update.finalScore,
          labelId: update.labelId,
          categoryRank: update.categoryRank,
          updatedAt: new Date(),
        })
        .where(eq(products.id, update.id));
    }
  });

  return { productsProcessed, labelsAttributed };
}
