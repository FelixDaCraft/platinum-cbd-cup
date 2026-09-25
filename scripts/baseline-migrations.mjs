/**
 * Marque une migration comme « déjà appliquée » sans l'exécuter.
 *
 * Pourquoi : la base de production a été construite par `drizzle-kit push`,
 * sans aucun fichier de migration ni table de suivi. En basculant sur
 * `drizzle-kit migrate`, la première migration (la ligne de base, qui décrit
 * le schéma tel qu'il existe déjà) échouerait — elle tenterait de recréer des
 * types et des tables présents. Il faut donc l'enregistrer comme appliquée,
 * une seule fois, avant le premier déploiement par migrations.
 *
 * Le script est idempotent : relancé, il ne réinsère rien.
 *
 * Usage :
 *   node scripts/baseline-migrations.mjs                    # simulation
 *   node scripts/baseline-migrations.mjs --apply            # écrit
 *   node scripts/baseline-migrations.mjs --apply --through=0000_baseline_production
 *
 * DANGER — `--through` marque comme appliquées TOUTES les migrations jusqu'au
 * tag inclus, SANS exécuter leur SQL. Sur la base de production, la seule
 * valeur correcte est `0000_baseline_production`, qui est aussi la valeur par
 * défaut : c'est la seule migration dont le contenu est déjà en place. Passer
 * un tag plus avancé ferait sauter le DDL des migrations intermédiaires, et
 * l'écart ne se verrait qu'à l'exécution, longtemps après. N'utilisez un autre
 * tag que si vous savez précisément pourquoi le schéma décrit par ces
 * migrations est déjà en base.
 *
 * Le signe « = » est obligatoire : l'analyse ne lit que `--through=<tag>`. La
 * forme séparée par une espace, telle qu'elle était documentée ici, n'était
 * jamais reconnue — le script retombait en silence sur la valeur par défaut et
 * marquait donc un jeu de migrations différent de celui demandé, sur une base
 * qu'on croyait alignée. D'où le garde-fou ci-dessous.
 *
 * DATABASE_URL doit pointer sur la base à marquer.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const args = process.argv.slice(2);
const apply = args.includes("--apply");

// `--through 0000_x` (sans « = ») serait ignoré et la valeur par défaut
// appliquée : on refuse plutôt que d'écrire un jeu de migrations que
// l'opérateur n'a pas demandé.
if (args.includes("--through")) {
  console.error("--through attend la forme --through=<tag>, sans espace.");
  process.exit(1);
}

const through =
  args.find((a) => a.startsWith("--through="))?.split("=")[1] ??
  "0000_baseline_production";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL est requis");
  process.exit(1);
}

const folder = path.resolve(process.cwd(), "drizzle");
const journal = JSON.parse(
  readFileSync(path.join(folder, "meta", "_journal.json"), "utf8")
);

// Même calcul que drizzle-orm/migrator.js : sha256 du contenu brut du fichier.
const entries = journal.entries.map((entry) => {
  const sql = readFileSync(path.join(folder, `${entry.tag}.sql`), "utf8");
  return {
    tag: entry.tag,
    when: entry.when,
    hash: createHash("sha256").update(sql).digest("hex"),
  };
});

const cutoff = entries.findIndex((e) => e.tag === through);
if (cutoff === -1) {
  console.error(`Migration « ${through} » introuvable dans le journal.`);
  process.exit(1);
}
const toMark = entries.slice(0, cutoff + 1);

console.log(`▶  base   : ${new URL(databaseUrl).host}`);
console.log(`▶  mode   : ${apply ? "APPLY (écriture)" : "simulation"}`);
console.log(`▶  à marquer comme appliquées :`);
for (const e of toMark) console.log(`     ${e.tag}`);

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: existing } = await pool.query(
    `SELECT hash FROM "drizzle"."__drizzle_migrations"`
  );
  const known = new Set(existing.map((r) => r.hash));

  const missing = toMark.filter((e) => !known.has(e.hash));

  if (missing.length === 0) {
    console.log("\n✓ Rien à faire : toutes ces migrations sont déjà enregistrées.");
  } else if (!apply) {
    console.log(`\n${missing.length} migration(s) seraient enregistrées. Relancez avec --apply.`);
  } else {
    for (const e of missing) {
      await pool.query(
        `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
        [e.hash, e.when]
      );
      console.log(`  ✓ ${e.tag} enregistrée`);
    }
  }

  const { rows: after } = await pool.query(
    `SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"`
  );
  console.log(`\nmigrations enregistrées en base : ${after[0].n}`);
} finally {
  await pool.end();
}
