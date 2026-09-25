import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// Self-hosted Postgres (single-tenant Platinum CBD Cup deployment).
// Connection is resolved at runtime from DATABASE_URL so the module can be
// imported during `next build` when the env may be unset.

type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  dbShutdownHooked?: boolean;
};

/**
 * Coupe proprement le pool quand le conteneur reçoit un signal d'arrêt
 * (redéploiement `docker compose up -d`). `pool.end()` attend que les clients
 * actifs soient rendus, donc les requêtes en cours se terminent. On sort
 * explicitement du process : poser un handler sur SIGTERM supprime le
 * comportement par défaut de Node (arrêt immédiat), et sans `exit` le
 * conteneur resterait bloqué jusqu'au SIGKILL de Docker.
 */
const registerShutdownHooks = (pool: Pool): void => {
  if (globalForDb.dbShutdownHooked) return;
  globalForDb.dbShutdownHooked = true;

  const shutdown = () => {
    void (async () => {
      try {
        // Plafond de 5 s : une requête bloquée ne doit pas retarder l'arrêt.
        await Promise.race([
          pool.end(),
          new Promise((resolve) => setTimeout(resolve, 5_000)),
        ]);
      } catch (error) {
        console.error("[db] erreur pendant la fermeture du pool", error);
      } finally {
        process.exit(0);
      }
    })();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
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
      // Recycle les connexions inactives : évite de garder ouvertes des
      // sockets qu'un redémarrage de Postgres a déjà invalidées.
      idleTimeoutMillis: 30_000,
      // Sans plafond, une base injoignable fait pendre la requête HTTP
      // jusqu'au timeout TCP du noyau.
      connectionTimeoutMillis: 10_000,
      // Une requête pathologique (calcul de résultats, export PDF de masse)
      // ne doit pas monopoliser indéfiniment l'une des 10 connexions.
      statement_timeout: 60_000,
    });

  // node-postgres émet 'error' sur le pool quand un client *inactif* tombe
  // (redémarrage de platinum-postgres, coupure réseau). Sans listener, Node
  // lève une exception non interceptée et le process meurt en coupant toutes
  // les requêtes en cours. Le client fautif est retiré du pool par pg lui-même.
  pool.on("error", (error) => {
    console.error("[db] erreur sur un client inactif du pool pg", error);
  });

  globalForDb.pool = pool;
  registerShutdownHooks(pool);

  return drizzle(pool, { schema });
};

export const db: Database = createDb();
