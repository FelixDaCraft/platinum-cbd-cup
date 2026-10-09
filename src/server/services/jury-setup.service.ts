/**
 * Lectures du back-office « mise en place des jurys » : couverture des
 * catégories par les deux panels et vivier de jurés.
 *
 * Les comptes d'avancement suivent `jury.getCompletionStats` : seuls les
 * produits d'inscriptions confirmées comptent, un juré ne note jamais ses
 * propres produits, et seules les notes soumises dans une catégorie assignée
 * sont prises en compte.
 */

import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { db as dbType } from "~/server/db";
import * as schema from "~/server/db/schema";
import type { JuryPanel } from "~/server/db/schema/juries";
import {
  computeCoverageStatus,
  effectiveCodeStatus,
  type CoverageStatus,
} from "~/lib/jury-coverage";

type DB = typeof dbType;

// =====================================================
// Couverture
// =====================================================

export interface RatingProgress {
  /** Notes soumises. */
  submitted: number;
  /** Notes attendues (produits à noter, hors produits du juré). */
  expected: number;
}

export interface CoverageProJuror {
  cupJuryId: string;
  userId: string;
  name: string;
  email: string;
  samplesReceived: boolean;
  samplesReceivedAt: Date | null;
  ratedCount: number;
  toRateCount: number;
}

export interface CoverageCodeStats {
  /** Codes rattachés à la catégorie, tous statuts confondus. */
  generated: number;
  pending: number;
  activated: number;
  revoked: number;
  /** Statut « expired » ou en attente passé leur date. */
  expired: number;
  /** Dont codes « échantillons inclus ». */
  samplesIncluded: number;
}

export interface CategoryCoverage {
  categoryId: string;
  name: string;
  sortOrder: number;
  /** Produits à noter (inscriptions confirmées). */
  productsCount: number;
  targets: { pro: number | null; public: number | null };
  status: CoverageStatus;
  pro: {
    activeCount: number;
    samplesReceivedCount: number;
    ratings: RatingProgress;
    jurors: CoverageProJuror[];
  };
  public: {
    activeCount: number;
    samplesReceivedCount: number;
    ratings: RatingProgress;
    codes: CoverageCodeStats;
  };
}

export interface UnassignedJuror {
  cupJuryId: string;
  userId: string;
  name: string;
  email: string;
  panel: JuryPanel;
  samplesReceived: boolean;
}

export interface JuryCoverage {
  cup: { id: string; name: string; ratingsLockedAt: Date | null };
  categories: CategoryCoverage[];
  /** Jurés actifs de la cup sans aucune catégorie assignée. */
  unassignedJurors: UnassignedJuror[];
  totals: {
    pro: { activeJurors: number; inactiveJurors: number; samplesReceived: number };
    public: { activeJurors: number; inactiveJurors: number; samplesReceived: number };
    /** Codes de la cup (comptés une fois chacun, quelles que soient leurs catégories). */
    codes: CoverageCodeStats;
  };
}

const emptyCodeStats = (): CoverageCodeStats => ({
  generated: 0,
  pending: 0,
  activated: 0,
  revoked: 0,
  expired: 0,
  samplesIncluded: 0,
});

function addCode(
  stats: CoverageCodeStats,
  status: ReturnType<typeof effectiveCodeStatus>,
  samplesIncluded: boolean
) {
  stats.generated++;
  stats[status]++;
  if (samplesIncluded) stats.samplesIncluded++;
}

export async function getJuryCoverage(
  db: DB,
  cup: { id: string; name: string; ratingsLockedAt: Date | null }
): Promise<JuryCoverage> {
  const cupId = cup.id;

  const [categories, cupProducts, juries, codes] = await Promise.all([
    db.query.categories.findMany({
      where: eq(schema.categories.cupId, cupId),
      orderBy: [asc(schema.categories.sortOrder), asc(schema.categories.name)],
    }),
    db
      .select({
        id: schema.products.id,
        categoryId: schema.products.categoryId,
        ownerUserId: schema.producers.userId,
      })
      .from(schema.products)
      .innerJoin(schema.registrations, eq(schema.products.registrationId, schema.registrations.id))
      .innerJoin(schema.producers, eq(schema.registrations.producerId, schema.producers.id))
      .where(
        and(eq(schema.registrations.cupId, cupId), eq(schema.registrations.status, "confirmed"))
      ),
    db.query.cupJuries.findMany({
      where: eq(schema.cupJuries.cupId, cupId),
      columns: {
        id: true,
        userId: true,
        panel: true,
        isActive: true,
        samplesReceivedAt: true,
      },
      with: {
        user: { columns: { name: true, email: true } },
        categoryAssignments: { columns: { categoryId: true } },
      },
    }),
    db.query.juryInvitationCodes.findMany({
      where: eq(schema.juryInvitationCodes.cupId, cupId),
      columns: { id: true, status: true, expiresAt: true, samplesIncluded: true },
      with: { categories: { columns: { categoryId: true } } },
    }),
  ]);

  const activeJuries = juries.filter((j) => j.isActive);
  const activeIds = activeJuries.map((j) => j.id);

  // Notes soumises des jurés actifs, sur les produits confirmés de la cup.
  const productById = new Map(cupProducts.map((p) => [p.id, p]));
  const submittedRatings =
    activeIds.length > 0
      ? await db
          .select({
            juryId: schema.productRatings.juryId,
            productId: schema.productRatings.productId,
          })
          .from(schema.productRatings)
          .where(
            and(
              inArray(schema.productRatings.juryId, activeIds),
              isNotNull(schema.productRatings.submittedAt)
            )
          )
      : [];

  // juryId -> categoryId -> notes soumises
  const ratedByJury = new Map<string, Map<string, number>>();
  for (const rating of submittedRatings) {
    const product = productById.get(rating.productId);
    if (!product) continue;
    const byCategory = ratedByJury.get(rating.juryId) ?? new Map<string, number>();
    byCategory.set(product.categoryId, (byCategory.get(product.categoryId) ?? 0) + 1);
    ratedByJury.set(rating.juryId, byCategory);
  }

  // categoryId -> produits (avec propriétaire, pour exclure les siens)
  const productsByCategory = new Map<string, Array<{ ownerUserId: string }>>();
  for (const p of cupProducts) {
    const list = productsByCategory.get(p.categoryId) ?? [];
    list.push({ ownerUserId: p.ownerUserId });
    productsByCategory.set(p.categoryId, list);
  }

  const toRateFor = (categoryId: string, userId: string) =>
    (productsByCategory.get(categoryId) ?? []).filter((p) => p.ownerUserId !== userId).length;

  // Codes par catégorie, et total de la cup.
  const now = new Date();
  const codesByCategory = new Map<string, CoverageCodeStats>();
  const codeTotals = emptyCodeStats();
  for (const code of codes) {
    const status = effectiveCodeStatus(code, now);
    addCode(codeTotals, status, code.samplesIncluded);
    for (const { categoryId } of code.categories) {
      const stats = codesByCategory.get(categoryId) ?? emptyCodeStats();
      addCode(stats, status, code.samplesIncluded);
      codesByCategory.set(categoryId, stats);
    }
  }

  const categoryCoverage: CategoryCoverage[] = categories.map((category) => {
    const assigned = activeJuries.filter((j) =>
      j.categoryAssignments.some((a) => a.categoryId === category.id)
    );

    const panelStats = (panel: JuryPanel) => {
      const members = assigned.filter((j) => j.panel === panel);
      const jurors = members.map((j) => ({
        cupJuryId: j.id,
        userId: j.userId,
        name: j.user.name,
        email: j.user.email,
        samplesReceived: j.samplesReceivedAt !== null,
        samplesReceivedAt: j.samplesReceivedAt,
        ratedCount: ratedByJury.get(j.id)?.get(category.id) ?? 0,
        toRateCount: toRateFor(category.id, j.userId),
      }));
      return {
        activeCount: members.length,
        samplesReceivedCount: jurors.filter((j) => j.samplesReceived).length,
        ratings: {
          submitted: jurors.reduce((sum, j) => sum + j.ratedCount, 0),
          expected: jurors.reduce((sum, j) => sum + j.toRateCount, 0),
        },
        jurors,
      };
    };

    const pro = panelStats("pro");
    // Le panel public se lit en effectifs : pas de liste nominative.
    const pub = panelStats("public");

    return {
      categoryId: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      productsCount: productsByCategory.get(category.id)?.length ?? 0,
      targets: { pro: category.targetProJurors, public: category.targetPublicJurors },
      status: computeCoverageStatus({
        activePro: pro.activeCount,
        activePublic: pub.activeCount,
        targetPro: category.targetProJurors,
        targetPublic: category.targetPublicJurors,
      }),
      pro: {
        ...pro,
        jurors: pro.jurors.sort((a, b) => a.name.localeCompare(b.name, "fr")),
      },
      public: {
        activeCount: pub.activeCount,
        samplesReceivedCount: pub.samplesReceivedCount,
        ratings: pub.ratings,
        codes: codesByCategory.get(category.id) ?? emptyCodeStats(),
      },
    };
  });

  const panelTotals = (panel: JuryPanel) => {
    const members = juries.filter((j) => j.panel === panel);
    const active = members.filter((j) => j.isActive);
    return {
      activeJurors: active.length,
      inactiveJurors: members.length - active.length,
      samplesReceived: active.filter((j) => j.samplesReceivedAt !== null).length,
    };
  };

  return {
    cup: { id: cup.id, name: cup.name, ratingsLockedAt: cup.ratingsLockedAt },
    categories: categoryCoverage,
    unassignedJurors: activeJuries
      .filter((j) => j.categoryAssignments.length === 0)
      .map((j) => ({
        cupJuryId: j.id,
        userId: j.userId,
        name: j.user.name,
        email: j.user.email,
        panel: j.panel,
        samplesReceived: j.samplesReceivedAt !== null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    totals: {
      pro: panelTotals("pro"),
      public: panelTotals("public"),
      codes: codeTotals,
    },
  };
}

// =====================================================
// Vivier de jurés
// =====================================================

export interface DirectoryCupEntry {
  cupId: string;
  cupName: string;
  /** Année de la cup : date d'événement, sinon début de notation, sinon création. */
  year: number;
  cupJuryId: string;
  panel: JuryPanel;
  isActive: boolean;
  ratings: RatingProgress;
  /** Pourcentage arrondi, null si rien à noter. */
  completionRate: number | null;
}

export interface DirectoryEntry {
  userId: string;
  name: string;
  email: string;
  juryProfileId: string | null;
  juryType: "pro" | "public" | null;
  expertise: string | null;
  /** Cups du juré, de la plus récente à la plus ancienne. */
  cups: DirectoryCupEntry[];
  /** Présence dans la cup passée en paramètre (`null` : absent ou pas de cupId). */
  inCup: { cupJuryId: string; panel: JuryPanel; isActive: boolean } | null;
}

export interface JuryDirectoryPage {
  items: DirectoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** Échappe les jokers de LIKE (backslash = caractère d'échappement par défaut). */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listJuryDirectory(
  db: DB,
  input: { search?: string; cupId?: string; limit: number; offset: number }
): Promise<JuryDirectoryPage> {
  const search = input.search?.trim();
  const pattern = search ? `%${escapeLike(search)}%` : null;

  // Vivier : tout compte ayant un profil juré ou ayant siégé dans une cup.
  const page = await db.execute<{
    id: string;
    name: string;
    email: string;
    profile_id: string | null;
    jury_type: "pro" | "public" | null;
    expertise: string | null;
    total: number;
  }>(sql`
    SELECT u.id, u.name, u.email,
           jp.id AS profile_id, jp.jury_type, jp.expertise,
           count(*) OVER ()::int AS total
    FROM users u
    LEFT JOIN jury_profiles jp ON jp.user_id = u.id
    WHERE (jp.id IS NOT NULL OR EXISTS (SELECT 1 FROM cup_juries cj WHERE cj.user_id = u.id))
      ${
        pattern
          ? sql`AND (u.name ILIKE ${pattern} OR u.email ILIKE ${pattern} OR jp.expertise ILIKE ${pattern})`
          : sql``
      }
    ORDER BY lower(u.name), u.id
    LIMIT ${input.limit} OFFSET ${input.offset}
  `);

  const rows = page.rows;
  const total = rows[0] ? Number(rows[0].total) : await countDirectory(db, pattern);

  if (rows.length === 0) {
    return { items: [], total, limit: input.limit, offset: input.offset };
  }

  const userIds = rows.map((r) => r.id);
  const memberships = await db.query.cupJuries.findMany({
    where: inArray(schema.cupJuries.userId, userIds),
    columns: { id: true, userId: true, cupId: true, panel: true, isActive: true },
    with: {
      cup: {
        columns: { id: true, name: true, eventDate: true, ratingStartAt: true, createdAt: true },
      },
    },
  });

  const progress = await ratingProgressByCupJury(
    db,
    memberships.map((m) => m.id)
  );

  const cupsByUser = new Map<string, DirectoryCupEntry[]>();
  const inCupByUser = new Map<string, DirectoryEntry["inCup"]>();
  for (const m of memberships) {
    const ratings = progress.get(m.id) ?? { submitted: 0, expected: 0 };
    const date = m.cup.eventDate ?? m.cup.ratingStartAt ?? m.cup.createdAt;
    const list = cupsByUser.get(m.userId) ?? [];
    list.push({
      cupId: m.cup.id,
      cupName: m.cup.name,
      year: date.getFullYear(),
      cupJuryId: m.id,
      panel: m.panel,
      isActive: m.isActive,
      ratings,
      completionRate:
        ratings.expected > 0
          ? Math.min(100, Math.round((ratings.submitted / ratings.expected) * 100))
          : null,
    });
    cupsByUser.set(m.userId, list);
    if (input.cupId && m.cupId === input.cupId) {
      inCupByUser.set(m.userId, { cupJuryId: m.id, panel: m.panel, isActive: m.isActive });
    }
  }

  const items: DirectoryEntry[] = rows.map((r) => ({
    userId: r.id,
    name: r.name,
    email: r.email,
    juryProfileId: r.profile_id,
    juryType: r.jury_type,
    expertise: r.expertise,
    cups: (cupsByUser.get(r.id) ?? []).sort(
      (a, b) => b.year - a.year || a.cupName.localeCompare(b.cupName, "fr")
    ),
    inCup: inCupByUser.get(r.id) ?? null,
  }));

  return { items, total, limit: input.limit, offset: input.offset };
}

/** Total du vivier quand la page demandée est vide (offset au-delà de la fin). */
async function countDirectory(db: DB, pattern: string | null): Promise<number> {
  const result = await db.execute<{ total: number }>(sql`
    SELECT count(*)::int AS total
    FROM users u
    LEFT JOIN jury_profiles jp ON jp.user_id = u.id
    WHERE (jp.id IS NOT NULL OR EXISTS (SELECT 1 FROM cup_juries cj WHERE cj.user_id = u.id))
      ${
        pattern
          ? sql`AND (u.name ILIKE ${pattern} OR u.email ILIKE ${pattern} OR jp.expertise ILIKE ${pattern})`
          : sql``
      }
  `);
  return Number(result.rows[0]?.total ?? 0);
}

/**
 * Avancement de notation de chaque ligne `cup_juries` : notes attendues
 * (produits confirmés des catégories assignées, hors les siens) et notes
 * soumises dans ces catégories. Une requête pour tout le lot.
 */
export async function ratingProgressByCupJury(
  db: DB,
  cupJuryIds: string[]
): Promise<Map<string, RatingProgress>> {
  if (cupJuryIds.length === 0) return new Map();

  const result = await db.execute<{ id: string; expected: number; submitted: number }>(sql`
    SELECT cup_juries.id,
      (SELECT count(*)
         FROM jury_category_assignments a
         JOIN products p ON p.category_id = a.category_id
         JOIN registrations r ON r.id = p.registration_id
           AND r.status = 'confirmed' AND r.cup_id = cup_juries.cup_id
         JOIN producers pr ON pr.id = r.producer_id
        WHERE a.cup_jury_id = cup_juries.id AND pr.user_id <> cup_juries.user_id
      )::int AS expected,
      (SELECT count(*)
         FROM product_ratings rt
         JOIN products p ON p.id = rt.product_id
         JOIN registrations r ON r.id = p.registration_id AND r.status = 'confirmed'
         JOIN jury_category_assignments a
           ON a.cup_jury_id = cup_juries.id AND a.category_id = p.category_id
        WHERE rt.jury_id = cup_juries.id AND rt.submitted_at IS NOT NULL
      )::int AS submitted
    FROM cup_juries
    WHERE ${inArray(schema.cupJuries.id, cupJuryIds)}
  `);

  return new Map(
    result.rows.map((row) => [
      row.id,
      { expected: Number(row.expected), submitted: Number(row.submitted) },
    ])
  );
}
