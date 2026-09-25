import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    RESEND_API_KEY: z.string().min(1),
    // Le domaine de l'expéditeur doit être vérifié chez Resend au caractère
    // près : un sous-domaine d'un domaine vérifié reste non vérifié. Sinon
    // Resend répond 403 et Better Auth étouffe l'erreur — les emails
    // disparaissent en silence, sans aucun signal côté client.
    // platinumcbdcup.eu : vérifié le 23/09/2026 (DKIM + CNAME send.).
    EMAIL_FROM: z.string().min(1).default("Platinum CBD Cup <noreply@platinumcbdcup.eu>"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Secret partagé avec le déclencheur cron des transitions de phase
    // (`phaseAutomation.checkPhaseTransitions`). Optionnel : sans lui, les
    // transitions automatiques sont simplement inactives.
    CRON_SECRET: z.string().min(1).optional(),
    // Viva.com (Viva Wallet) — producer registration payments.
    // Optional so the app still boots before the credentials are filled in;
    // `assertVivaConfigured()` in ~/lib/viva raises a clear error at checkout
    // time when something is missing.
    VIVA_ENV: z.enum(["demo", "production"]).default("production"),
    VIVA_CLIENT_ID: z.string().min(1).optional(),
    VIVA_CLIENT_SECRET: z.string().min(1).optional(),
    VIVA_SOURCE_CODE: z.string().min(1).optional(),
    VIVA_MERCHANT_ID: z.string().min(1).optional(),
    VIVA_API_KEY: z.string().min(1).optional(),
    // Renonciation explicite au paiement : à "true", le contrôle de démarrage
    // cesse de signaler les VIVA_* manquants. Le démarrage n'est jamais bloqué
    // dans un cas comme dans l'autre (voir `assertProductionEnv`).
    PAYMENTS_DISABLED: z
      .enum(["true", "false"])
      .default("false"),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NODE_ENV: process.env.NODE_ENV,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VIVA_ENV: process.env.VIVA_ENV,
    VIVA_CLIENT_ID: process.env.VIVA_CLIENT_ID,
    VIVA_CLIENT_SECRET: process.env.VIVA_CLIENT_SECRET,
    VIVA_SOURCE_CODE: process.env.VIVA_SOURCE_CODE,
    VIVA_MERCHANT_ID: process.env.VIVA_MERCHANT_ID,
    VIVA_API_KEY: process.env.VIVA_API_KEY,
    PAYMENTS_DISABLED: process.env.PAYMENTS_DISABLED,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

/**
 * Contrôles de cohérence en production.
 *
 * `createEnv` (@t3-oss/env-nextjs 0.12) ne valide qu'une variable à la fois :
 * il ne sait ni refuser un placeholder de `.env.example`, ni exiger un groupe
 * de variables selon la valeur d'une autre. Ces deux angles morts ont déjà
 * coûté cher : une clé Resend « re_... » est restée des mois en production,
 * acceptée par `z.string().min(1)`, pendant que tous les emails partaient à la
 * poubelle sans le moindre signal.
 *
 * Volontairement limité à `NODE_ENV=production` : le build Docker
 * (`SKIP_ENV_VALIDATION=1`), le `drizzle-kit migrate` du workflow de
 * déploiement et le développement local travaillent avec des valeurs factices
 * assumées.
 */

/** Valeurs de `.env.example` qui ne doivent jamais atteindre la production. */
const PLACEHOLDER_FRAGMENTS = ["change-me", "replace-with", "re_..."];

/**
 * @param {string} name
 * @param {string | undefined} value
 * @param {string[]} errors
 */
function rejectPlaceholder(name, value, errors) {
  if (!value) return;
  const lowered = value.toLowerCase();
  const hit = PLACEHOLDER_FRAGMENTS.find((fragment) => lowered.includes(fragment));
  if (hit) {
    errors.push(`${name} contient encore le placeholder « ${hit} » de .env.example`);
  }
}

function assertProductionEnv() {
  /** @type {string[]} */
  const errors = [];

  rejectPlaceholder("DATABASE_URL", env.DATABASE_URL, errors);
  rejectPlaceholder("BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET, errors);
  rejectPlaceholder("BETTER_AUTH_URL", env.BETTER_AUTH_URL, errors);
  rejectPlaceholder("EMAIL_FROM", env.EMAIL_FROM, errors);
  rejectPlaceholder("NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL, errors);
  // Les secrets optionnels sont contrôlés de la même manière : renseignés avec
  // une valeur d'exemple, ils échouent silencieusement au premier paiement ou
  // à la première transition de phase, loin du démarrage.
  rejectPlaceholder("CRON_SECRET", env.CRON_SECRET, errors);
  rejectPlaceholder("VIVA_CLIENT_ID", env.VIVA_CLIENT_ID, errors);
  rejectPlaceholder("VIVA_CLIENT_SECRET", env.VIVA_CLIENT_SECRET, errors);
  rejectPlaceholder("VIVA_SOURCE_CODE", env.VIVA_SOURCE_CODE, errors);
  rejectPlaceholder("VIVA_MERCHANT_ID", env.VIVA_MERCHANT_ID, errors);
  rejectPlaceholder("VIVA_API_KEY", env.VIVA_API_KEY, errors);

  // Une clé Resend réelle est de la forme `re_` + identifiant alphanumérique.
  if (!/^re_[A-Za-z0-9_-]{20,}$/.test(env.RESEND_API_KEY)) {
    errors.push(
      "RESEND_API_KEY ne ressemble pas à une clé Resend (attendu : re_ suivi d'au moins 20 caractères)"
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration de production invalide :\n  - ${errors.join("\n  - ")}`
    );
  }

  // Non bloquant, et délibérément : le paiement est une fonctionnalité parmi
  // d'autres. Une production qui tourne sans identifiants Viva sert le
  // palmarès, les inscriptions gratuites et tous les espaces ; seul le
  // paiement échoue, avec le message explicite d'assertVivaConfigured().
  // Refuser de démarrer priverait le site entier d'une option absente.
  if (env.PAYMENTS_DISABLED !== "true") {
    const missingViva = /** @type {string[]} */ ([]);
    if (!env.VIVA_CLIENT_ID) missingViva.push("VIVA_CLIENT_ID");
    if (!env.VIVA_CLIENT_SECRET) missingViva.push("VIVA_CLIENT_SECRET");
    if (!env.VIVA_SOURCE_CODE) missingViva.push("VIVA_SOURCE_CODE");
    if (!env.VIVA_MERCHANT_ID) missingViva.push("VIVA_MERCHANT_ID");
    if (!env.VIVA_API_KEY) missingViva.push("VIVA_API_KEY");
    if (missingViva.length > 0) {
      console.warn(
        `[env] paiement non configuré : ${missingViva.join(", ")} manquant(s). ` +
          "Les inscriptions payantes échoueront au moment du règlement."
      );
    }
  }

  // Non bloquant : sans secret, les transitions de phase restent manuelles.
  if (!env.CRON_SECRET) {
    console.warn(
      "[env] CRON_SECRET absent : les transitions automatiques de phase sont inactives."
    );
  }
}

// `typeof window` est remplacé à la compilation : ce bloc disparaît du bundle
// client, où les variables serveur sont de toute façon inaccessibles.
if (typeof window === "undefined" && !process.env.SKIP_ENV_VALIDATION) {
  if (env.NODE_ENV === "production") {
    assertProductionEnv();
  }
}
