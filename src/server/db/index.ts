import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// Self-hosted Postgres (single-tenant Platinum CBD Cup deployment).
// Connection is resolved at runtime from DATABASE_URL so the module can be
// imported during `next build` when the env may be unset.

type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
};

const createDb = (): Database => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return new Proxy({} as Database, {
      get(_target, prop) {
        throw new Error(
          `Database not available (accessed "${String(prop)}"). DATABASE_URL is not set.`
        );
      },
    });
  }

  const pool =
    globalForDb.pool ??
    new Pool({
      connectionString: databaseUrl,
      max: 10,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.pool = pool;
  }

  return drizzle(pool, { schema });
};

export const db: Database = createDb();
