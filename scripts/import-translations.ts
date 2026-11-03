/**
 * Injecte les traductions des contenus en base (site multilingue).
 *
 * Remplit la colonne `translations` (migration 0019_traductions) :
 *   - catégories : « Fleurs Indoor » → « Indoor Flowers », « Fiori Indoor »… ;
 *   - critères de notation : nom et description des grilles 2027 (jury pro
 *     et jury public) ;
 *   - labels : nom et condition (« Label OR », « Score supérieur à 17/20 ») ;
 *   - règlement (`legal_documents`, slug « reglement ») : corps TipTap traduit,
 *     seulement si le texte en base est bien celui que les traductions livrées
 *     couvrent (même empreinte). Sinon il est signalé et laissé au français.
 *
 * La correspondance se fait sur le libellé français (voir
 * src/i18n/content-translations.ts), jamais sur un identifiant : le script
 * vaut pour toutes les bases. Il n'écrase pas une traduction déjà présente
 * (saisie à la main, import précédent) sauf `--force`, et ne touche à aucune
 * autre colonne. Relancé, il ne change plus rien.
 *
 * Usage (DATABASE_URL de la base visée dans l'environnement) :
 *   pnpm tsx scripts/import-translations.ts                 # dry-run : liste les changements
 *   pnpm tsx scripts/import-translations.ts --apply         # écrit, en une transaction
 *   pnpm tsx scripts/import-translations.ts --apply --force # réécrit aussi l'existant
 *   pnpm tsx scripts/import-translations.ts --cup=<id>      # une seule cup
 *
 * Suppose la migration 0019 appliquée (le script s'arrête sinon).
 */

import { Pool, type PoolClient } from "pg";
import { config } from "dotenv";

import {
  categoryTranslations,
  criterionTranslations,
  labelTranslations,
  mergeTranslations,
} from "../src/i18n/content-translations";
import { locales, type Locale, type Translations } from "../src/i18n/locales";
import { REGLEMENT_TRANSLATIONS } from "../src/lib/legal/reglement-translations";
import {
  tiptapFingerprint,
  translateTiptap,
  type TipTapNode,
} from "../src/lib/legal/tiptap-translate";

config();

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const CUP_ID = process.argv.find((a) => a.startsWith("--cup="))?.split("=")[1];

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL est requis (base visée par l'import).");
  process.exit(1);
}

/** Hôte et base, sans identifiants : ce qu'on affiche avant d'agir. */
function describeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(URL illisible)";
  }
}

type Row = { id: string; name: string; translations: Translations | null };

interface Change {
  table: string;
  id: string;
  label: string;
  translations: Translations;
}

async function assertMigrated(client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'translations'
        and table_name in ('categories', 'rating_criteria', 'cup_labels', 'legal_documents')`
  );
  if (rows.length < 4) {
    throw new Error(
      "Colonnes `translations` absentes : appliquez d'abord la migration 0019 (pnpm db:migrate)."
    );
  }
}

function cupFilter(column: string, offset: number): { sql: string; params: string[] } {
  return CUP_ID ? { sql: `where ${column} = $${offset}`, params: [CUP_ID] } : { sql: "", params: [] };
}

async function plannedChanges(client: PoolClient): Promise<{ changes: Change[]; untranslated: string[] }> {
  const changes: Change[] = [];
  const untranslated: string[] = [];

  const plan = (
    table: string,
    rows: (Row & { description?: string | null; condition?: string | null })[],
    compute: (row: Row & { description?: string | null; condition?: string | null }) => Translations | null
  ) => {
    for (const row of rows) {
      const computed = compute(row);
      if (!computed) {
        untranslated.push(`${table} « ${row.name} »`);
        continue;
      }
      const merged = mergeTranslations(row.translations, computed, FORCE);
      if (merged) changes.push({ table, id: row.id, label: row.name, translations: merged });
    }
  };

  const cats = cupFilter("cup_id", 1);
  const categories = await client.query<Row>(
    `select id, name, translations from categories ${cats.sql} order by cup_id, sort_order`,
    cats.params
  );
  plan("categories", categories.rows, categoryTranslations);

  const crit = cupFilter("c.cup_id", 1);
  const criteria = await client.query<Row & { description: string | null }>(
    `select r.id, r.name, r.description, r.translations
       from rating_criteria r join categories c on c.id = r.category_id
       ${crit.sql} order by c.cup_id, c.sort_order, r.sort_order`,
    crit.params
  );
  plan("rating_criteria", criteria.rows, criterionTranslations);

  const lab = cupFilter("cup_id", 1);
  const labels = await client.query<Row & { condition: string | null }>(
    `select id, name, condition, translations from cup_labels ${lab.sql} order by cup_id, sort_order`,
    lab.params
  );
  plan("cup_labels", labels.rows, labelTranslations);

  return { changes, untranslated };
}

/** Règlement : corps TipTap traduit par langue, avec l'empreinte du texte source. */
async function plannedReglement(client: PoolClient): Promise<Change | null | "stale" | "absent"> {
  const { rows } = await client.query<{
    slug: string;
    title: string;
    content: TipTapNode;
    translations: Record<string, Record<string, unknown>> | null;
  }>(`select slug, title, content, translations from legal_documents where slug = 'reglement'`);
  const doc = rows[0];
  // Pas de ligne : le portail sert le texte par défaut, déjà traduit dans le code.
  if (!doc) return "absent";

  const fingerprint = tiptapFingerprint(doc.content);
  const existing = doc.translations ?? {};
  const next: Record<string, Record<string, unknown>> = structuredClone(existing);
  let changed = false;
  let stale = false;

  for (const locale of locales.filter((l): l is Exclude<Locale, "fr"> => l !== "fr")) {
    const bundled = REGLEMENT_TRANSLATIONS[locale];
    if (bundled.sourceFingerprint !== fingerprint) {
      stale = true;
      continue;
    }
    const current = existing[locale];
    if (!FORCE && current?.sourceFingerprint === fingerprint && current.content) continue;
    const content = translateTiptap(doc.content, bundled.texts, locale);
    if (!content) {
      stale = true;
      continue;
    }
    next[locale] = { title: bundled.title, lede: bundled.lede, content, sourceFingerprint: fingerprint };
    changed = true;
  }

  if (stale && !changed) return "stale";
  return changed
    ? { table: "legal_documents", id: doc.slug, label: doc.title, translations: next as Translations }
    : null;
}

async function main(): Promise<void> {
  console.log(`Base visée : ${describeTarget(DATABASE_URL!)}${CUP_ID ? ` · cup ${CUP_ID}` : ""}`);
  console.log(APPLY ? `Mode : écriture${FORCE ? " (force)" : ""}` : "Mode : dry-run (ajoutez --apply pour écrire)");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await assertMigrated(client);
    const { changes, untranslated } = await plannedChanges(client);
    const reglement = await plannedReglement(client);
    if (reglement && typeof reglement === "object") changes.push(reglement);

    const byTable = new Map<string, number>();
    for (const change of changes) {
      byTable.set(change.table, (byTable.get(change.table) ?? 0) + 1);
      const en = (change.translations.en as { name?: string; title?: string } | undefined) ?? {};
      console.log(`  ${change.table.padEnd(16)} ${change.label} → ${en.name ?? en.title ?? "…"}`);
    }
    console.log(
      changes.length === 0
        ? "Rien à écrire : tout est déjà traduit."
        : `À écrire : ${[...byTable].map(([t, n]) => `${n} ${t}`).join(", ")}`
    );
    if (reglement === "stale") {
      console.warn(
        "Règlement : le texte en base n'est pas celui que couvrent les traductions livrées. " +
          "Laissé au français (la page le signale) : à retraduire."
      );
    } else if (reglement === "absent") {
      console.log("Règlement : aucune ligne en base, le texte par défaut (déjà traduit) est servi.");
    }
    if (untranslated.length > 0) {
      console.log(`Sans traduction connue (restent en français) : ${untranslated.length}`);
      for (const item of untranslated.slice(0, 20)) console.log(`  - ${item}`);
      if (untranslated.length > 20) console.log(`  … et ${untranslated.length - 20} autres`);
    }

    if (!APPLY || changes.length === 0) return;

    await client.query("begin");
    for (const change of changes) {
      const key = change.table === "legal_documents" ? "slug" : "id";
      // Seule la colonne `translations` est écrite.
      await client.query(`update ${change.table} set translations = $1::jsonb where ${key} = $2`, [
        JSON.stringify(change.translations),
        change.id,
      ]);
    }
    await client.query("commit");
    console.log(`Écrit : ${changes.length} ligne(s).`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[import-translations]", error instanceof Error ? error.message : error);
  process.exit(1);
});
