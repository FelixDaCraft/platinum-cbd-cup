/**
 * Results Computation Service — calcul des notes finales, rangs et labels.
 *
 * Ce calcul vivait dans le routeur tRPC `results.ts`, d'où `cup.ts` l'importait
 * en traversant la couche transport pour atteindre une règle métier. Un routeur
 * qui exporte du métier ne peut être ni appelé hors requête (script de reprise,
 * tâche planifiée, test unitaire) ni lu sans charger tout le contexte tRPC ;
 * l'implémentation vit désormais ici, le routeur n'en garde que la réexportation.
 *
 * Une cup réunit deux panels de jury (pro et public) : chacun a son propre
 * classement, calculé sur les seules notes de ses jurés (`cup_juries.panel`).
 * Seul le jury public décerne des labels ; le jury pro donne une note et un
 * rang.
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
import { cupJuries, juryPanelEnum, type JuryPanel } from "~/server/db/schema/juries";
import { ratingCriteria } from "~/server/db/schema/rating-criteria";
import { registrations } from "~/server/db/schema/registrations";

type DbClient = typeof import("~/server/db").db;

export interface ComputeResultsSummary {
  productsProcessed: number;
  labelsAttributed: number;
}

/** Résultat d'un produit dans un panel. */
interface PanelResult {
  finalScore: string | null;
  categoryRank: number | null;
}

type ProductUpdate = {
  id: string;
  pro: PanelResult;
  public: PanelResult;
  labelId: string | null;
};

const EMPTY_RESULT: PanelResult = { finalScore: null, categoryRank: null };

/**
 * Recalcule, pour chaque panel, note finale et rang de catégorie de tous les
 * produits d'une cup, attribue les labels d'après le classement public, puis
 * écrit le tout en une transaction.
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

  // Somme pondérée et somme des coefficients par note déposée, avec le panel
  // du juré : la moyenne d'un produit dans un panel est la moyenne des
  // moyennes des jurés de ce panel.
  const ratingAggregates = await db
    .select({
      productId: productRatings.productId,
      ratingId: productRatings.id,
      panel: cupJuries.panel,
      weightedSum: sql<string>`sum(${criterionScores.score} * ${ratingCriteria.coefficient})`,
      coefficientSum: sql<string>`sum(${ratingCriteria.coefficient})`,
    })
    .from(criterionScores)
    .innerJoin(productRatings, eq(criterionScores.productRatingId, productRatings.id))
    .innerJoin(cupJuries, eq(productRatings.juryId, cupJuries.id))
    .innerJoin(ratingCriteria, eq(criterionScores.criterionId, ratingCriteria.id))
    .innerJoin(products, eq(productRatings.productId, products.id))
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.cupId, cupId),
        isNotNull(productRatings.submittedAt)
      )
    )
    .groupBy(productRatings.productId, productRatings.id, cupJuries.panel);

  // Nombre de notes déposées par produit et par panel — y compris celles sans
  // score, qui n'entrent pas dans la moyenne mais comptent dans le départage.
  const ratingCounts = await db
    .select({
      productId: productRatings.productId,
      panel: cupJuries.panel,
      juryCount: sql<string>`count(*)`,
    })
    .from(productRatings)
    .innerJoin(cupJuries, eq(productRatings.juryId, cupJuries.id))
    .innerJoin(products, eq(productRatings.productId, products.id))
    .innerJoin(registrations, eq(products.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.cupId, cupId),
        isNotNull(productRatings.submittedAt)
      )
    )
    .groupBy(productRatings.productId, cupJuries.panel);

  const key = (panel: JuryPanel, productId: string) => `${panel}:${productId}`;

  const juryCountByProduct = new Map(
    ratingCounts.map((r) => [key(r.panel, r.productId), Number(r.juryCount)])
  );

  const averagesByProduct = new Map<string, number[]>();
  for (const row of ratingAggregates) {
    const coefficientSum = Number(row.coefficientSum);
    if (coefficientSum <= 0) continue;

    const k = key(row.panel, row.productId);
    const averages = averagesByProduct.get(k) ?? [];
    averages.push(Number(row.weightedSum) / coefficientSum);
    averagesByProduct.set(k, averages);
  }

  const updatesById = new Map<string, ProductUpdate>(
    eligibleProducts.map((p) => [
      p.id,
      { id: p.id, pro: EMPTY_RESULT, public: EMPTY_RESULT, labelId: null },
    ])
  );
  const scoredProducts = new Set<string>();
  let labelsAttributed = 0;

  for (const panel of juryPanelEnum) {
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
        const averages = averagesByProduct.get(key(panel, product.id));

        // Aucune note exploitable dans ce panel : le résultat reste vide, ce
        // qui efface un éventuel rang ou score antérieur.
        if (!averages || averages.length === 0) continue;

        const finalScore = averages.reduce((a, b) => a + b, 0) / averages.length;
        scoredProducts.add(product.id);

        // Un disqualifié garde sa note — le palmarès public l'affiche au bas de
        // sa catégorie avec un badge « DISQUALIFIÉ ». Mais il ne prend ni rang
        // ni label : sans cela il consommait une place de podium et le vrai
        // premier s'affichait « 2e ».
        if (product.disqualified) {
          updatesById.get(product.id)![panel] = {
            finalScore: finalScore.toFixed(2),
            categoryRank: null,
          };
          continue;
        }

        productScores.push({
          id: product.id,
          finalScore,
          juryCount: juryCountByProduct.get(key(panel, product.id)) ?? averages.length,
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
        const update = updatesById.get(id)!;

        update[panel] = { finalScore: finalScore.toFixed(2), categoryRank: i + 1 };

        // Le label se lit sur le score du jury public, et sur lui seul.
        if (panel === "public") {
          for (const label of labels) {
            const minOk = finalScore >= label.minScore;
            const maxOk = label.maxScore === null || finalScore <= label.maxScore;
            if (minOk && maxOk) {
              update.labelId = label.id;
              labelsAttributed++;
              break;
            }
          }
        }
      }
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
          ...CLEARED_RESULTS,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            products.id,
            excludedProducts.map((p) => p.id)
          )
        );
    }

    for (const update of updatesById.values()) {
      await tx
        .update(products)
        .set({
          finalScorePro: update.pro.finalScore,
          categoryRankPro: update.pro.categoryRank,
          finalScorePublic: update.public.finalScore,
          categoryRankPublic: update.public.categoryRank,
          labelId: update.labelId,
          updatedAt: new Date(),
        })
        .where(eq(products.id, update.id));
    }
  });

  return { productsProcessed: scoredProducts.size, labelsAttributed };
}

/** Valeurs qui effacent tous les résultats d'un produit, des deux panels. */
export const CLEARED_RESULTS = {
  finalScorePro: null,
  categoryRankPro: null,
  finalScorePublic: null,
  categoryRankPublic: null,
  labelId: null,
} as const;
