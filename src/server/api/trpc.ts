/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "~/server/db";
import { auth } from "~/lib/auth";
import { ERROR_MESSAGES } from "~/lib/errors";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // En production, le message d'une exception non maîtrisée (pg, Viva, fetch)
    // remonterait tel quel au navigateur : on le remplace par un texte neutre.
    const leaksInternals =
      process.env.NODE_ENV === "production" &&
      error.code === "INTERNAL_SERVER_ERROR";

    return {
      ...shape,
      message: leaksInternals ? ERROR_MESSAGES.INTERNAL_ERROR : shape.message,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  // Le délai est désormais opt-in : sur un tableau de bord qui monte une
  // vingtaine de requêtes, 100-500 ms ajoutées à chacune font percevoir
  // l'application cinq à dix fois plus lente qu'en production et faussent
  // toute mesure locale. `TRPC_DEV_DELAY=1` le rallume pour la chasse aux
  // cascades de requêtes, son usage d'origine.
  // `isDev` est vrai sous vitest (NODE_ENV !== production) : le délai
  // artificiel rendrait chaque test de routeur lent et non déterministe.
  const simulateLatency =
    t._config.isDev && !process.env.VITEST && process.env.TRPC_DEV_DELAY === "1";

  if (simulateLatency) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  if (simulateLatency) {
    console.log(`[TRPC] ${path} took ${end - start}ms to execute`);
  }

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Limitation de débit en mémoire (une seule instance Node derrière le tunnel).
 * Destinée aux procédures publiques coûteuses ou énumérables : validation de
 * code d'invitation, envoi d'email, création de compte.
 */
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
// Volontairement large : les jurés d'un même événement partagent souvent une
// seule IP publique. Suffisant pour rendre toute énumération hors de portée.
const RATE_LIMIT_MAX_REQUESTS = 60;

/**
 * Renvoie `null` quand aucune IP ne peut être déterminée. Une clé de repli
 * partagée du type « unknown » ferait tomber TOUS les appelants dans un même
 * seau : si Cloudflare cessait d'envoyer `cf-connecting-ip`, la limite se
 * transformerait en déni de service auto-infligé. On préfère ne pas limiter
 * une requête dont on ignore l'origine — derrière le tunnel, l'en-tête est
 * toujours présent pour le trafic public.
 */
const clientKey = (headers: Headers, path: string): string | null => {
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? `${ip}:${path}` : null;
};

/**
 * Limite le débit par (IP, procédure). Composable avec n'importe quelle
 * procédure : `publicProcedure.use(rateLimitMiddleware)`, ou sur une
 * procédure authentifiée dont l'entrée est devinable.
 *
 * `max` permet de resserrer le plafond sur un endpoint qui envoie un email
 * ou écrit en base à chaque appel.
 */
export const makeRateLimitMiddleware = (max: number = RATE_LIMIT_MAX_REQUESTS) =>
  t.middleware(async ({ ctx, path, next }) => {
  const key = clientKey(ctx.headers, path);
  if (!key) return next();

  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (bucket.count >= max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Trop de requêtes, réessayez dans une minute",
    });
  } else {
    bucket.count++;
  }

  // Purge opportuniste : sans elle la Map croît avec chaque IP rencontrée.
  if (rateLimitBuckets.size > 5000) {
    for (const [k, b] of rateLimitBuckets) {
      if (now > b.resetAt) rateLimitBuckets.delete(k);
    }
  }

  return next();
});

export const rateLimitMiddleware = makeRateLimitMiddleware();

/**
 * Procédure publique soumise à une limitation de débit par IP.
 * À utiliser pour tout endpoint non authentifié qui envoie un email,
 * crée un compte, ou expose une ressource énumérable.
 */
export const rateLimitedPublicProcedure = publicProcedure.use(rateLimitMiddleware);

/**
 * Variante resserrée pour les endpoints qui envoient un email à chaque appel.
 * 60/min laisserait passer 86 400 messages par jour depuis une seule IP.
 */
export const strictRateLimitedPublicProcedure = publicProcedure.use(
  makeRateLimitMiddleware(5)
);

// ============================================
// ROLE-BASED PROCEDURES (single-tenant)
// ============================================

/**
 * Contexte d'une procédure authentifiée, tel que le reçoivent les helpers
 * des routeurs. Évite de redéclarer un `ProtectedContext` par fichier.
 */
export type AuthedContext = {
  db: typeof db;
  userId: string;
};

/**
 * Règle unique « cet utilisateur est organisateur ».
 * Un seul endroit pour la définition, quelle que soit la source de la ligne
 * (session Better Auth ou table `users`).
 */
export const isOrganizerUser = (
  user: { isAdmin?: boolean | null; role?: string | null } | null | undefined
) => user?.isAdmin === true || user?.role === "organizer";

/**
 * Indique si l'appelant est organisateur, en interrogeant la table `users`.
 * À utiliser dans les procédures ouvertes à la fois à l'organisateur et au
 * propriétaire de la ressource, où `organizerProcedure` serait trop strict.
 */
export const callerIsOrganizer = async (ctx: AuthedContext) => {
  const user = await ctx.db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, ctx.userId),
    columns: { isAdmin: true, role: true },
  });

  return isOrganizerUser(user);
};

/**
 * Protected procedure - requires an authenticated session.
 * Adds `session` and `userId` to the context.
 */
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: ctx.headers });

  if (!session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ERROR_MESSAGES.UNAUTHORIZED,
    });
  }

  return next({
    ctx: {
      ...ctx,
      session,
      userId: session.user.id,
    },
  });
});

/**
 * Organizer procedure - requires an authenticated user that is either
 * flagged as `isAdmin` or whose role is `"organizer"`.
 * This is the staff-level procedure used by management routes.
 */
export const organizerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Source : la table `users` et non la session, dont le cookie est mis en
  // cache 5 minutes — une révocation de rôle doit prendre effet immédiatement.
  if (!(await callerIsOrganizer(ctx))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ERROR_MESSAGES.FORBIDDEN,
    });
  }

  return next({ ctx: { ...ctx, isOrganizer: true as const } });
});

/**
 * Jury procedure - requires an authenticated user that has a
 * `jury_profiles` row. Attaches `ctx.juryProfile`.
 */
export const juryProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const juryProfile = await ctx.db.query.juryProfiles.findFirst({
    where: (juryProfiles, { eq }) => eq(juryProfiles.userId, ctx.userId),
  });

  if (!juryProfile) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ERROR_MESSAGES.UNAUTHORIZED,
    });
  }

  return next({
    ctx: {
      ...ctx,
      juryProfile,
    },
  });
});

/**
 * Producer procedure - requires an authenticated user that has a
 * `producers` row. Attaches `ctx.producer`.
 *
 * FORBIDDEN et non UNAUTHORIZED : l'appelant est authentifié, il lui manque
 * seulement le profil. Renvoyer UNAUTHORIZED pousserait le client à le
 * déconnecter alors qu'il doit être invité à créer son profil producteur.
 */
export const producerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const producer = await ctx.db.query.producers.findFirst({
    where: (producers, { eq }) => eq(producers.userId, ctx.userId),
  });

  if (!producer) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous devez avoir un profil producteur",
    });
  }

  return next({
    ctx: {
      ...ctx,
      producer,
    },
  });
});
