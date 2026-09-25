import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    // Toujours journaliser, y compris en production : sans cela, une exception
    // levée dans un routeur remonte au client en INTERNAL_SERVER_ERROR et ne
    // laisse aucune trace dans `docker logs` — c'est exactement ce qui a rendu
    // la panne d'envoi d'emails invisible pendant des mois.
    onError: ({ path, error, type, input }) => {
      if (env.NODE_ENV === "development") {
        console.error(
          `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
        );
        return;
      }

      // Une ligne JSON par erreur : lisible par `docker logs` et directement
      // exploitable par un collecteur. L'input n'est jamais journalisé (il
      // peut contenir un mot de passe ou des données personnelles).
      console.error(
        JSON.stringify({
          level: "error",
          source: "trpc",
          path: path ?? "<no-path>",
          type,
          code: error.code,
          message: error.message,
          // La pile n'a d'intérêt que pour les bugs serveur ; les erreurs
          // métier (UNAUTHORIZED, BAD_REQUEST…) n'en ont pas besoin.
          stack:
            error.code === "INTERNAL_SERVER_ERROR" ? error.stack : undefined,
          hasInput: input !== undefined,
          at: new Date().toISOString(),
        })
      );
    },
  });

export { handler as GET, handler as POST };
