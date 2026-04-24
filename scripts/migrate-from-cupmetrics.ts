/**
 * Migrate the "Platinum CBD Cup" organization data from the multi-tenant
 * CupMetrics v2 Neon database into the single-tenant Platinum CBD Cup
 * Postgres instance.
 *
 * Usage:
 *   SOURCE_DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" \
 *   TARGET_DATABASE_URL="postgresql://platinum:...@localhost:5432/platinum_cbd_cup" \
 *   PLATINUM_ORG_ID="<the organization id of Platinum CBD Cup in CupMetrics>" \
 *   pnpm migrate-from-cupmetrics
 *
 * Optional flags (set to "1" to enable):
 *   DRY_RUN=1         → print row counts only, don't write
 *   TRUNCATE_TARGET=1 → wipe target tables before inserting (destructive)
 *
 * The script:
 *  1. Connects to both DBs.
 *  2. Looks up the organization row to confirm the ID is valid.
 *  3. Copies users that are linked to the org (owners, members, producers, juries).
 *  4. Copies every org-scoped table in dependency order, stripping `organization_id`.
 *  5. Copies cascaded tables (categories, products, registrations, ratings, etc.)
 *     where the parent row's organization was Platinum.
 */

import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";

// Required for @neondatabase/serverless in Node.js
neonConfig.webSocketConstructor = ws;

const SOURCE_DATABASE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.TARGET_DATABASE_URL;
const PLATINUM_ORG_ID = process.env.PLATINUM_ORG_ID;
const DRY_RUN = process.env.DRY_RUN === "1";
const TRUNCATE_TARGET = process.env.TRUNCATE_TARGET === "1";

if (!SOURCE_DATABASE_URL) throw new Error("SOURCE_DATABASE_URL is required");
if (!TARGET_DATABASE_URL) throw new Error("TARGET_DATABASE_URL is required");
if (!PLATINUM_ORG_ID) throw new Error("PLATINUM_ORG_ID is required");

const source = new NeonPool({ connectionString: SOURCE_DATABASE_URL });
const target = new PgPool({ connectionString: TARGET_DATABASE_URL });

/**
 * Tables that live directly under an organization_id column.
 * Order matters: parents before children (FK cascade order).
 */
const ORG_SCOPED_TABLES = [
  "cups",
  "sponsors",
  "articles",
  "newsletter_subscribers",
  "portal_about_settings",
  "organization_about",
  "rs_templates",
  "contact_messages",
  "press_releases",
  "gallery_images",
  "press_settings",
  "activity_logs",
  "cupmetrics_historical_cups",
  "cupmetrics_historical_producers",
  "cupmetrics_historical_results",
  "producers",
  "jury_profiles",
] as const;

/**
 * Tables that reference cups / categories / registrations / etc.
 * These are copied by filtering on the parent primary keys that belong
 * to the Platinum organization. Order matters.
 */
const CHILD_TABLES_BY_CUP = [
  "categories",
  "cup_labels",
  "rating_criteria",
  "registrations",
  "cup_sponsors",
  "jury_invitations",
  "cup_juries",
  "public_jury_tokens",
  "jury_invitation_codes",
  "rs_generated_posts",
  "lab_analyses",
] as const;

const CHILD_TABLES_BY_REGISTRATION = ["products"] as const;
const CHILD_TABLES_BY_CATEGORY = ["jury_invitation_code_categories"] as const;
const CHILD_TABLES_BY_CUP_JURY = ["jury_category_assignments"] as const;
const CHILD_TABLES_BY_PRODUCT = [
  "product_ratings",
  "criterion_scores",
] as const;

async function fetchColumns(
  pool: NeonPool | PgPool,
  table: string,
): Promise<string[]> {
  const res = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  return res.rows.map((r: { column_name: string }) => r.column_name);
}

/**
 * Copy rows matching a given WHERE clause from source.table to target.table,
 * dropping `organization_id` from the column list if present.
 */
async function copyRows(
  table: string,
  whereClause: string,
  params: unknown[],
): Promise<number> {
  const [sourceCols, targetCols] = await Promise.all([
    fetchColumns(source, table),
    fetchColumns(target, table),
  ]);

  const commonCols = sourceCols.filter(
    (c) => targetCols.includes(c) && c !== "organization_id",
  );

  if (commonCols.length === 0) {
    console.warn(`  ⚠ ${table}: no common columns with target, skipping`);
    return 0;
  }

  const colList = commonCols.map((c) => `"${c}"`).join(", ");
  const selectSql = `SELECT ${colList} FROM "${table}" WHERE ${whereClause}`;
  const rows = (await source.query(selectSql, params)).rows;

  if (rows.length === 0) return 0;
  if (DRY_RUN) return rows.length;

  const placeholders = commonCols
    .map((_, i) => `$${i + 1}`)
    .join(", ");

  for (const row of rows) {
    const values = commonCols.map((c) => (row as Record<string, unknown>)[c]);
    await target.query(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})
         ON CONFLICT DO NOTHING`,
      values,
    );
  }
  return rows.length;
}

async function copyOrgScopedTable(table: string): Promise<number> {
  return copyRows(table, `organization_id = $1`, [PLATINUM_ORG_ID]);
}

async function copyTableByParentIds(
  table: string,
  parentColumn: string,
  parentIds: string[],
): Promise<number> {
  if (parentIds.length === 0) return 0;
  return copyRows(
    table,
    `"${parentColumn}" = ANY($1::text[])`,
    [parentIds],
  );
}

async function fetchIds(
  table: string,
  where: string,
  params: unknown[],
  column = "id",
): Promise<string[]> {
  const res = await source.query(
    `SELECT "${column}" AS id FROM "${table}" WHERE ${where}`,
    params,
  );
  return res.rows.map((r: { id: string }) => r.id);
}

async function migrateUsers() {
  // Users linked to the org via: owner (members.role='owner'), staff, producers, juries
  const userIdsRes = await source.query(
    `
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM members WHERE organization_id = $1
      UNION
      SELECT user_id FROM producers WHERE organization_id = $1
      UNION
      SELECT user_id FROM jury_profiles WHERE organization_id = $1
    ) u
    `,
    [PLATINUM_ORG_ID],
  );

  const userIds = userIdsRes.rows.map((r: { user_id: string }) => r.user_id);
  console.log(`  → found ${userIds.length} users linked to Platinum`);

  // Also pick up the organization owner's user via members table
  const ownerRes = await source.query(
    `SELECT user_id, role FROM members WHERE organization_id = $1`,
    [PLATINUM_ORG_ID],
  );
  const ownerByUser = new Map<string, string>();
  for (const row of ownerRes.rows as Array<{ user_id: string; role: string }>) {
    // The CupMetrics "owner" role maps to our "organizer" role + isAdmin=true
    ownerByUser.set(row.user_id, row.role);
  }

  // Copy users with role inferred from their role in CupMetrics
  const usersRes = await source.query(
    `SELECT * FROM users WHERE id = ANY($1::text[])`,
    [userIds],
  );

  console.log(`  → migrating ${usersRes.rows.length} users`);
  if (DRY_RUN) return userIds;

  const [sourceCols, targetCols] = await Promise.all([
    fetchColumns(source, "users"),
    fetchColumns(target, "users"),
  ]);
  // In target, we have `role` and `isAdmin`. We'll set them explicitly.
  const commonCols = sourceCols.filter(
    (c) =>
      targetCols.includes(c) &&
      c !== "role" && // we set role manually
      c !== "is_admin", // we set isAdmin manually
  );
  const colList = [...commonCols, "role", "is_admin"]
    .map((c) => `"${c}"`)
    .join(", ");
  const placeholders = [...commonCols, "role", "is_admin"]
    .map((_, i) => `$${i + 1}`)
    .join(", ");

  for (const user of usersRes.rows as Array<Record<string, unknown>>) {
    const cupmetricsRole = ownerByUser.get(user.id as string);
    const isOrgOwner = cupmetricsRole === "owner";
    const isAdminInSource = Boolean(user.is_admin);

    // Figure out Platinum role:
    //  - CupMetrics owner → organizer + isAdmin=true
    //  - Existing producer → producer
    //  - Existing jury → jury
    //  - Otherwise fall back to producer (least privilege)
    let role: "organizer" | "jury" | "producer" = "producer";
    if (cupmetricsRole === "owner" || cupmetricsRole === "admin") {
      role = "organizer";
    } else {
      // Check if user has a jury profile in the Platinum org
      const juryCheck = await source.query(
        `SELECT 1 FROM jury_profiles WHERE user_id = $1 AND organization_id = $2 LIMIT 1`,
        [user.id, PLATINUM_ORG_ID],
      );
      if (juryCheck.rows.length > 0) {
        role = "jury";
      } else {
        const producerCheck = await source.query(
          `SELECT 1 FROM producers WHERE user_id = $1 AND organization_id = $2 LIMIT 1`,
          [user.id, PLATINUM_ORG_ID],
        );
        if (producerCheck.rows.length > 0) role = "producer";
      }
    }

    const values = [
      ...commonCols.map((c) => user[c]),
      role,
      isOrgOwner || isAdminInSource,
    ];
    await target.query(
      `INSERT INTO "users" (${colList}) VALUES (${placeholders})
         ON CONFLICT (id) DO UPDATE SET
           "role" = EXCLUDED.role,
           "is_admin" = EXCLUDED.is_admin`,
      values,
    );
  }

  // Copy sessions/accounts/verifications for these users
  await copyRows(
    "accounts",
    `user_id = ANY($1::text[])`,
    [userIds],
  );

  return userIds;
}

async function truncateTargetIfRequested() {
  if (!TRUNCATE_TARGET) return;
  console.log("⚠ TRUNCATE_TARGET=1 — wiping target tables");
  const tables = [
    "criterion_scores",
    "product_ratings",
    "jury_category_assignments",
    "jury_invitation_code_categories",
    "products",
    "jury_invitation_codes",
    "public_jury_tokens",
    "cup_juries",
    "jury_invitations",
    "cup_sponsors",
    "registrations",
    "rating_criteria",
    "cup_labels",
    "categories",
    "lab_analyses",
    "rs_generated_posts",
    "cups",
    "sponsors",
    "articles",
    "newsletter_subscribers",
    "portal_about_settings",
    "organization_about",
    "rs_templates",
    "contact_messages",
    "press_releases",
    "gallery_images",
    "press_settings",
    "activity_logs",
    "cupmetrics_historical_cups",
    "cupmetrics_historical_producers",
    "cupmetrics_historical_results",
    "producers",
    "jury_profiles",
    "accounts",
    "sessions",
    "verifications",
    "users",
  ];
  for (const t of tables) {
    try {
      await target.query(`TRUNCATE TABLE "${t}" CASCADE`);
    } catch (e) {
      // table may not exist yet — not fatal
      console.warn(`  could not truncate ${t}:`, (e as Error).message);
    }
  }
}

async function main() {
  console.log(
    `[migrate] ${DRY_RUN ? "DRY RUN — " : ""}Platinum org id: ${PLATINUM_ORG_ID}`,
  );

  // 1. Sanity check: the org must exist on the source
  const orgCheck = await source.query(
    `SELECT id, name, slug FROM organizations WHERE id = $1`,
    [PLATINUM_ORG_ID],
  );
  if (orgCheck.rows.length === 0) {
    throw new Error(
      `Organization ${PLATINUM_ORG_ID} not found on source. Check PLATINUM_ORG_ID.`,
    );
  }
  console.log(`[migrate] Source org:`, orgCheck.rows[0]);

  await truncateTargetIfRequested();

  // 2. Users (with role mapping)
  console.log("[migrate] Copying users");
  await migrateUsers();

  // 3. Org-scoped tables
  console.log("[migrate] Copying organization-scoped tables");
  for (const table of ORG_SCOPED_TABLES) {
    try {
      const count = await copyOrgScopedTable(table);
      console.log(`  ${table}: ${count}`);
    } catch (e) {
      console.warn(`  ${table} failed:`, (e as Error).message);
    }
  }

  // 4. Get Platinum cup ids
  const cupIds = await fetchIds("cups", "organization_id = $1", [
    PLATINUM_ORG_ID,
  ]);
  console.log(`[migrate] Platinum has ${cupIds.length} cups`);

  // 5. Children of cups
  console.log("[migrate] Copying cup-scoped tables");
  for (const table of CHILD_TABLES_BY_CUP) {
    try {
      const count = await copyTableByParentIds(table, "cup_id", cupIds);
      console.log(`  ${table}: ${count}`);
    } catch (e) {
      console.warn(`  ${table} failed:`, (e as Error).message);
    }
  }

  // 6. Categories → children
  const categoryIds: string[] = [];
  for (const cupId of cupIds) {
    const ids = await fetchIds("categories", "cup_id = $1", [cupId]);
    categoryIds.push(...ids);
  }
  console.log(`[migrate] ${categoryIds.length} categories`);
  for (const table of CHILD_TABLES_BY_CATEGORY) {
    try {
      const count = await copyTableByParentIds(
        table,
        "category_id",
        categoryIds,
      );
      console.log(`  ${table}: ${count}`);
    } catch (e) {
      console.warn(`  ${table} failed:`, (e as Error).message);
    }
  }

  // 7. Registrations → products
  const registrationIds: string[] = [];
  for (const cupId of cupIds) {
    const ids = await fetchIds("registrations", "cup_id = $1", [cupId]);
    registrationIds.push(...ids);
  }
  console.log(`[migrate] ${registrationIds.length} registrations`);
  for (const table of CHILD_TABLES_BY_REGISTRATION) {
    try {
      const count = await copyTableByParentIds(
        table,
        "registration_id",
        registrationIds,
      );
      console.log(`  ${table}: ${count}`);
    } catch (e) {
      console.warn(`  ${table} failed:`, (e as Error).message);
    }
  }

  // 8. cup_juries → assignments
  const cupJuryIds: string[] = [];
  for (const cupId of cupIds) {
    const ids = await fetchIds("cup_juries", "cup_id = $1", [cupId]);
    cupJuryIds.push(...ids);
  }
  console.log(`[migrate] ${cupJuryIds.length} cup_juries`);
  for (const table of CHILD_TABLES_BY_CUP_JURY) {
    try {
      const count = await copyTableByParentIds(
        table,
        "cup_jury_id",
        cupJuryIds,
      );
      console.log(`  ${table}: ${count}`);
    } catch (e) {
      console.warn(`  ${table} failed:`, (e as Error).message);
    }
  }

  // 9. Products → ratings
  const productIds: string[] = [];
  for (const regId of registrationIds) {
    const ids = await fetchIds("products", "registration_id = $1", [regId]);
    productIds.push(...ids);
  }
  console.log(`[migrate] ${productIds.length} products`);
  for (const table of CHILD_TABLES_BY_PRODUCT) {
    try {
      const parentCol =
        table === "criterion_scores" ? "product_rating_id" : "product_id";
      if (table === "criterion_scores") {
        // criterion_scores references product_ratings.id — get those ids first
        const ratingIds: string[] = [];
        for (const pid of productIds) {
          const ids = await fetchIds("product_ratings", "product_id = $1", [
            pid,
          ]);
          ratingIds.push(...ids);
        }
        const count = await copyTableByParentIds(
          table,
          "product_rating_id",
          ratingIds,
        );
        console.log(`  ${table}: ${count}`);
      } else {
        const count = await copyTableByParentIds(table, parentCol, productIds);
        console.log(`  ${table}: ${count}`);
      }
    } catch (e) {
      console.warn(`  ${table} failed:`, (e as Error).message);
    }
  }

  console.log("[migrate] Done.");
}

main()
  .catch((err) => {
    console.error("[migrate] FATAL:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.end();
    await target.end();
  });
