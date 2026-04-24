/**
 * Quick sanity check: confirm the lab_analyses table was created correctly
 * on the dev Neon branch.
 */

import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const host = new URL(databaseUrl).host;
console.log(`target: ${host}\n`);

const sql = neon(databaseUrl);

const columns = await sql`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'lab_analyses'
  ORDER BY ordinal_position
`;
console.log("columns:");
for (const c of columns) {
  console.log(
    `  ${(c.column_name as string).padEnd(22)} ${(c.data_type as string).padEnd(28)} null=${c.is_nullable}`,
  );
}

const indexes = await sql`
  SELECT indexname FROM pg_indexes WHERE tablename = 'lab_analyses'
`;
console.log("\nindexes:");
for (const i of indexes) console.log(`  ${i.indexname}`);

const count = await sql`SELECT count(*)::int AS n FROM lab_analyses`;
console.log(`\nrow count: ${count[0]?.n}`);
