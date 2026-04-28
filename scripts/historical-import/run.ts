/**
 * Historical results import runner.
 *
 * Usage:
 *   TARGET_DATABASE_URL="postgresql://platinum:...@host:5432/platinum_cbd_cup" \
 *     pnpm tsx scripts/historical-import/run.ts            # dry-run (default)
 *   TARGET_DATABASE_URL="..." \
 *     pnpm tsx scripts/historical-import/run.ts --apply    # write to DB
 *
 * What it does (per cup in the plan, transactionally):
 *   1. Skip if a cup with the same `name` already exists (idempotent).
 *   2. Insert the cup row (status=completed, retroactive dates).
 *   3. Insert categories, labels.
 *   4. Resolve producers: LINK reuses existing, CREATE upserts a stub
 *      (user + producer) keyed by normalized companyName, SKIP drops the row.
 *      Stub creation is dedup'd across the whole run.
 *   5. Insert one registration per (cup, producer).
 *   6. Insert each product with synthetic score, label_id, anonymous_code,
 *      category_rank, and excluded_from_results=false.
 */

import { Pool, type PoolClient } from "pg";
import { customAlphabet } from "nanoid";
import {
  HISTORICAL_IMPORT_PLAN,
  SYNTHETIC_SCORE_BY_RANK,
  type CupImport,
  type ProducerMatch,
  type ProductImport,
} from "./plan";

const TARGET_DATABASE_URL = process.env.TARGET_DATABASE_URL;
const APPLY = process.argv.includes("--apply");

if (!TARGET_DATABASE_URL) {
  console.error("error: TARGET_DATABASE_URL is required");
  process.exit(1);
}

// nanoid alphabet that mirrors the rest of the app (URL-safe, 21 chars)
const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  21
);

const pool = new Pool({ connectionString: TARGET_DATABASE_URL });

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pickLabelId(
  score: number,
  labels: { id: string; minScore: number; maxScore: number | null }[]
): string | null {
  for (const l of labels) {
    if (score >= l.minScore && (l.maxScore == null || score <= l.maxScore)) {
      return l.id;
    }
  }
  return null;
}

// ─── Pre-flight: load existing producers, sanity-check LINKs ───────────────

interface ExistingProducer {
  id: string;
  companyName: string | null;
}

async function loadExistingProducers(client: PoolClient): Promise<Map<string, ExistingProducer>> {
  const { rows } = await client.query<{ id: string; company_name: string | null }>(
    "SELECT id, company_name FROM producers"
  );
  const byId = new Map<string, ExistingProducer>();
  for (const r of rows) {
    byId.set(r.id, { id: r.id, companyName: r.company_name });
  }
  return byId;
}

function validateLinks(plan: CupImport[], existingById: Map<string, ExistingProducer>): string[] {
  const errors: string[] = [];
  for (const cup of plan) {
    for (const p of cup.products) {
      if (p.producer.action === "LINK" && !existingById.has(p.producer.producerId)) {
        errors.push(
          `[${cup.name}] product "${p.productName}" → LINK to missing producer id ${p.producer.producerId}`
        );
      }
    }
  }
  return errors;
}

// ─── Producer resolution (with stub creation dedup) ─────────────────────────

interface ProducerResolver {
  /** companyName.normalized → producer id (existing or newly stubbed) */
  byNormalizedName: Map<string, string>;
}

async function resolveProducer(
  match: ProducerMatch,
  resolver: ProducerResolver,
  client: PoolClient,
  apply: boolean
): Promise<string | null> {
  if (match.action === "SKIP") return null;
  if (match.action === "LINK") return match.producerId;

  // CREATE
  const norm = normalizeName(match.companyName);
  const existing = resolver.byNormalizedName.get(norm);
  if (existing) return existing;

  // Stub user + producer
  const userId = nanoid();
  const producerId = nanoid();
  const slug = slugify(match.companyName);
  const email = `historic-${slug}@platinum-cbd-cup.local`;
  const brandName = match.brandName ?? match.companyName;

  if (apply) {
    await client.query(
      `INSERT INTO users (id, name, email, email_verified, role, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, false, 'producer', false, now(), now())`,
      [userId, match.companyName, email]
    );
    await client.query(
      `INSERT INTO producers (id, user_id, company_name, brand_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())`,
      [producerId, userId, match.companyName, brandName]
    );
  }

  resolver.byNormalizedName.set(norm, producerId);
  return producerId;
}

// ─── Single-cup importer ───────────────────────────────────────────────────

async function importCup(
  cup: CupImport,
  resolver: ProducerResolver,
  client: PoolClient,
  apply: boolean
): Promise<void> {
  // Idempotence: skip if a cup with this name already exists.
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM cups WHERE name = $1 LIMIT 1",
    [cup.name]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    console.log(`  ⏭️  skip — cup "${cup.name}" already exists (id=${existing.rows[0]!.id})`);
    return;
  }

  console.log(`  ▸ importing "${cup.name}" (type=${cup.juryKind}, ${cup.products.length} products)`);

  const cupId = nanoid();

  if (apply) {
    await client.query(
      `INSERT INTO cups (
         id, name, type, description, status, currency, rating_scale,
         registration_open_at, registration_close_at,
         rating_start_at, rating_end_at,
         results_published_at, event_date, event_location,
         results_visibility,
         anonymization_prefix, default_price_per_product,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, 'completed', 'EUR', '0-20',
         $5, $6, $7, $8, $9, $10, $11,
         $12,
         'A', 0,
         $13, now()
       )`,
      [
        cupId,
        cup.name,
        cup.juryKind,
        cup.description ?? null,
        new Date(cup.registrationOpenAt),
        new Date(cup.registrationCloseAt),
        new Date(cup.ratingStartAt),
        new Date(cup.ratingEndAt),
        new Date(cup.resultsPublishedAt),
        new Date(cup.eventDate),
        cup.eventLocation,
        cup.resultsVisibility,
        new Date(cup.eventDate), // created_at = event date for clean ordering
      ]
    );
  }

  // Categories (id + code lookups, both keyed by category.key)
  const categoryIdByKey = new Map<string, string>();
  const categoryCodeByKey = new Map<string, string>();
  for (let i = 0; i < cup.categories.length; i++) {
    const cat = cup.categories[i]!;
    const id = nanoid();
    categoryIdByKey.set(cat.key, id);
    categoryCodeByKey.set(cat.key, cat.code);
    if (apply) {
      await client.query(
        `INSERT INTO categories (id, cup_id, name, sort_order, rating_scale_min, rating_scale_max, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, 20, now(), now())`,
        [id, cupId, cat.name, i]
      );
    }
  }

  // Labels
  interface InsertedLabel {
    id: string;
    minScore: number;
    maxScore: number | null;
  }
  const labels: InsertedLabel[] = [];
  for (let i = 0; i < cup.labels.length; i++) {
    const l = cup.labels[i]!;
    const id = nanoid();
    labels.push({ id, minScore: l.minScore, maxScore: l.maxScore ?? null });
    if (apply) {
      await client.query(
        `INSERT INTO cup_labels (id, cup_id, name, min_score, max_score, sort_order, color, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, now(), now())`,
        [id, cupId, l.name, l.minScore, l.maxScore ?? null, i, l.color]
      );
    }
  }

  // Products — group by producer to upsert one registration each
  const registrationByProducerId = new Map<string, string>();
  // Track count per category for anonymous code numbering
  const codeCounter = new Map<string, number>();

  for (const product of cup.products) {
    await importProduct(
      product,
      cup,
      cupId,
      categoryIdByKey,
      categoryCodeByKey,
      labels,
      registrationByProducerId,
      codeCounter,
      resolver,
      client,
      apply
    );
  }
}

async function importProduct(
  product: ProductImport,
  cup: CupImport,
  cupId: string,
  categoryIdByKey: Map<string, string>,
  categoryCodeByKey: Map<string, string>,
  labels: { id: string; minScore: number; maxScore: number | null }[],
  registrationByProducerId: Map<string, string>,
  codeCounter: Map<string, number>,
  resolver: ProducerResolver,
  client: PoolClient,
  apply: boolean
): Promise<void> {
  const producerId = await resolveProducer(product.producer, resolver, client, apply);
  if (!producerId) {
    console.log(`    ⏭️  skip product "${product.productName}" — producer SKIP'd`);
    return;
  }

  const categoryId = categoryIdByKey.get(product.categoryKey);
  const categoryCode = categoryCodeByKey.get(product.categoryKey);
  if (!categoryId || !categoryCode) {
    throw new Error(
      `unknown categoryKey "${product.categoryKey}" for product "${product.productName}" in "${cup.name}"`
    );
  }

  // Registration
  let registrationId = registrationByProducerId.get(producerId);
  if (!registrationId) {
    registrationId = nanoid();
    registrationByProducerId.set(producerId, registrationId);
    if (apply) {
      await client.query(
        `INSERT INTO registrations (id, cup_id, producer_id, status, total_amount, currency, created_at, updated_at)
         VALUES ($1, $2, $3, 'paid', 0, 'EUR', now(), now())`,
        [registrationId, cupId, producerId]
      );
    }
  }

  const score = SYNTHETIC_SCORE_BY_RANK[product.rank]!;
  const labelId = pickLabelId(score, labels);

  // Anonymous code: <CODE>-<NNN> per (cup, category) — e.g. "OUT-001"
  const counterKey = `${cupId}|${product.categoryKey}`;
  const next = (codeCounter.get(counterKey) ?? 0) + 1;
  codeCounter.set(counterKey, next);
  const anonymousCode = `${categoryCode}-${String(next).padStart(3, "0")}`;

  const productId = nanoid();
  if (apply) {
    await client.query(
      `INSERT INTO products (
         id, registration_id, category_id, name, price_at_registration,
         status, anonymous_code, final_score, label_id, category_rank,
         excluded_from_results, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, 0,
         'rated', $5, $6, $7, $8,
         false, now(), now()
       )`,
      [productId, registrationId, categoryId, product.productName, anonymousCode, score, labelId, product.rank]
    );
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Historical results import ===`);
  console.log(`mode    : ${APPLY ? "APPLY (writes will be committed)" : "DRY-RUN (no writes)"}`);
  console.log(`target  : ${TARGET_DATABASE_URL!.replace(/:[^@]+@/, ":***@")}`);
  console.log(`cups    : ${HISTORICAL_IMPORT_PLAN.length}`);
  console.log(
    `products: ${HISTORICAL_IMPORT_PLAN.reduce((s, c) => s + c.products.length, 0)}\n`
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pre-flight checks
    const existingProducers = await loadExistingProducers(client);
    console.log(`  loaded ${existingProducers.size} existing producers from DB`);

    const linkErrors = validateLinks(HISTORICAL_IMPORT_PLAN, existingProducers);
    if (linkErrors.length > 0) {
      console.error(`\n  ✖ LINK validation failed:`);
      for (const e of linkErrors) console.error(`    - ${e}`);
      throw new Error("aborting");
    }
    console.log(`  ✓ all LINK references resolve to existing producers\n`);

    const resolver: ProducerResolver = { byNormalizedName: new Map() };

    for (const cup of HISTORICAL_IMPORT_PLAN) {
      await importCup(cup, resolver, client, APPLY);
    }

    if (APPLY) {
      await client.query("COMMIT");
      console.log(`\n✓ committed`);
    } else {
      await client.query("ROLLBACK");
      console.log(`\n✓ dry-run complete (rolled back). Re-run with --apply to write.`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`\n✖ rolled back due to error:`, err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
