/**
 * Apply a raw SQL file against the configured DATABASE_URL using the Neon
 * HTTP driver that the project already depends on (no psql needed).
 *
 * Usage:
 *   pnpm tsx scripts/apply-sql.ts scripts/sql/001-lab-analyses.sql
 *
 * This intentionally does the absolute minimum: reads the file, splits on
 * top-level statements, and runs each one. Keep it for small, reviewable
 * POC migrations only — use drizzle-kit for anything the regular pipeline
 * should own.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

// Safety: print the host we're about to hit so the user can sanity-check
// before anything runs. Prod vs dev Neon branches share the path, only the
// host and credentials differ.
const host = new URL(databaseUrl).host;
console.log(`▶  target host: ${host}`);

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/apply-sql.ts <file.sql>");
  process.exit(1);
}

const sqlText = await readFile(path.resolve(file), "utf8");

// Strip line comments, then split on bare semicolons. Not a real SQL parser
// — our migration files are small, hand-written, and don't use $$-quoted
// blocks or dollar-sign identifiers.
const statements = sqlText
  .split("\n")
  .map((l) => (l.trim().startsWith("--") ? "" : l))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !/^\s*(BEGIN|COMMIT)\s*$/i.test(s));

const sql = neon(databaseUrl);

console.log(`▶  ${statements.length} statement(s) to run from ${file}\n`);

for (const [i, stmt] of statements.entries()) {
  const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
  console.log(`[${i + 1}/${statements.length}] ${preview}${stmt.length > 80 ? "..." : ""}`);
  try {
    // neon() query tag template: using .query() method for raw strings.
    await sql.query(stmt);
    console.log(`          ✓ ok\n`);
  } catch (err) {
    console.error(`          ✗ failed:`, (err as Error).message);
    process.exit(1);
  }
}

console.log("✅  done");
