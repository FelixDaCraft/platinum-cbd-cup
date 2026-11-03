import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { db } from "~/server/db";
import { env } from "~/env";
/**
 * Les emails d'authentification passent par le service email du serveur, pas
 * par un client Resend dédié : un second client signifiait un second endroit
 * où changer de fournisseur, et surtout un second `escapeHtml` et un second
 * gabarit HTML qui divergeaient de ceux des onze autres templates. Le `scope`
 * passé à `sendEmail` reste le préfixe grepable des logs d'échec.
 */
import {
  escapeHtml,
  renderButton,
  renderEmailLayout,
  renderParagraph,
  sendEmail,
} from "~/server/services/email";
import { passwordSchema } from "~/lib/validations/auth";
import { emailLocale, emailLocaleFromRequest } from "~/server/services/email/locale";
import { translatorFor } from "~/i18n/translator";
import * as schema from "~/server/db/schema";

/**
 * Origines autorisées pour les requêtes d'auth.
 *
 * L'application est mono-hôte : seul l'hôte de BETTER_AUTH_URL (et son alias
 * `www.`, servi par Cloudflare) sert le portail. On n'accepte donc plus le
 * wildcard `https://*.<domaine>` hérité du routage par sous-domaine
 * CupMetrics, qui faisait de tout sous-domaine (staging, outil tiers,
 * enregistrement DNS orphelin) une origine de confiance.
 */
function buildTrustedOrigins(): string[] {
  const appOrigin = new URL(env.BETTER_AUTH_URL).origin;
  const { protocol, host } = new URL(env.BETTER_AUTH_URL);
  const origins = new Set<string>([appOrigin]);

  if (!host.startsWith("www.")) {
    origins.add(`${protocol}//www.${host}`);
  }

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("https://localhost:3000");
  }

  return [...origins];
}

const trustedOrigins = buildTrustedOrigins();

/**
 * Chemins Better Auth qui fixent un nouveau mot de passe, et champ du corps de
 * requête qui le porte. `minPasswordLength` ne couvre que la longueur : la
 * politique complète (majuscule, chiffre, caractère spécial) que les
 * formulaires React appliquent déjà via `passwordSchema` doit être rejouée ici,
 * sinon un appel direct à l'API accepte n'importe quelle suite de 12
 * caractères.
 */
const PASSWORD_BODY_FIELD_BY_PATH: Record<string, string> = {
  "/sign-up/email": "password",
  "/reset-password": "newPassword",
  "/change-password": "newPassword",
};

/**
 * Refuse un mot de passe trop faible avant que Better Auth ne le hache.
 *
 * Le hook `before` est appelé sur TOUTES les routes d'auth : il doit rester
 * strictement passif hors de la liste ci-dessus, et ne rien retourner (un objet
 * retourné serait interprété par Better Auth comme une réponse à court-circuit).
 *
 * Il s'applique aussi aux appels serveur `auth.api.signUpEmail(...)`. En
 * revanche il ne voit RIEN d'un code qui appelle `hashPassword` de
 * better-auth/crypto et écrit lui-même la ligne `accounts` : ce chemin
 * contourne entièrement Better Auth et doit valider avec `passwordSchema` de
 * son côté.
 */
const enforcePasswordPolicy = createAuthMiddleware(async (ctx) => {
  const field = PASSWORD_BODY_FIELD_BY_PATH[ctx.path];
  if (!field) return;

  const body: unknown = ctx.body;
  if (typeof body !== "object" || body === null) return;

  const password = (body as Record<string, unknown>)[field];
  if (typeof password !== "string") return;

  const result = passwordSchema.safeParse(password);
  if (!result.success) {
    throw new APIError("BAD_REQUEST", {
      message: result.error.issues[0]?.message ?? "Mot de passe trop faible",
    });
  }
});

/**
 * Better Auth configuration for the single-tenant Platinum CBD Cup app.
 *
 * No organization plugin: the app is single-tenant, all users belong to the
 * same implicit "Platinum CBD Cup" org. A user's access is determined by
 * their `role` field (organizer / jury / producer) and the `isAdmin` flag.
 * New sign-ups default to `producer` (the public sign-up flow).
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  hooks: {
    before: enforcePasswordPolicy,
  },
  advanced: {
    /**
     * Pas de `crossSubDomainCookies` : vestige du routage par sous-domaine
     * CupMetrics. L'application est mono-hôte (middleware.ts ne parse aucun
     * sous-domaine), et un cookie posé sur `.platinumcbdcup.eu` serait envoyé à
     * tout futur sous-domaine — staging, outil tiers, enregistrement DNS
     * orphelin — dont une XSS suffirait à voler la session.
     */
    ipAddress: {
      /**
       * Le conteneur n'est joignable que par le tunnel Cloudflare, qui pose
       * lui-même `cf-connecting-ip`. `x-forwarded-for` (le défaut de Better
       * Auth, qui ne lit que la première valeur) est en revanche fourni par
       * le client : Cloudflare y AJOUTE l'IP réelle sans écraser l'existant,
       * si bien qu'un attaquant choisissait sa propre clé de rate limit — ou
       * la supprimait complètement en envoyant une valeur non-IP.
       *
       * Contrepartie assumée : sans en-tête exploitable, Better Auth renonce
       * au comptage (`if (!ip) return` dans api/rate-limiter). Une requête qui
       * n'est pas passée par Cloudflare n'est donc pas limitée — d'où
       * l'exigence que le conteneur ne soit joignable QUE par le tunnel.
       */
      ipAddressHeaders: ["cf-connecting-ip"],
      /**
       * Explicite le regroupement par /64 (déjà le défaut depuis 1.4.17, qui
       * corrige GHSA-p6v2-xcpg-h6xw) : sans lui, un attaquant disposant d'un
       * préfixe IPv6 faisait tourner ses adresses pour repartir à zéro.
       */
      ipv6Subnet: 64,
    },
  },
  rateLimit: {
    // `enabled` reste au défaut (actif en production seulement).
    customRules: {
      // Chaque appel déclenche un envoi Resend : quota bien plus serré que
      // le défaut (100 requêtes / 10 s) pour éviter le relais de spam.
      "/send-verification-email": { window: 300, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "producer",
        input: false,
      },
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      // Saisis à l'inscription producteur, relus par « Compléter mon profil ».
      pendingCompanyName: {
        type: "string",
        required: false,
        input: true,
      },
      pendingBrandName: {
        type: "string",
        required: false,
        input: true,
      },
      // Langue des e-mails envoyés hors requête. Posée par le serveur
      // (databaseHooks ci-dessous, puis à chaque visite de l'espace
      // personnel), jamais par le client.
      locale: {
        type: "string",
        required: false,
        input: false,
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, newEmail, url }, request) => {
        if (env.NODE_ENV === "development") {
          console.log("\n[Auth] sendChangeEmailVerification CALLED");
          console.log("[Auth] User:", user.email);
          console.log("[Auth] New email:", newEmail);
          console.log("[Auth] URL:", url);
        }

        const locale = emailLocaleFromRequest(url, request, (user as { locale?: string | null }).locale);
        const t = translatorFor(locale, "emails.changeEmail");
        const result = await sendEmail({
          scope: "Auth Change Email",
          // Better Auth crée le jeton sur l'adresse ACTUELLE : c'est le
          // titulaire du compte qui doit approuver, pas le destinataire de
          // la nouvelle adresse. Envoyer au `newEmail` permettrait à une
          // session volée de rebinder le compte sans trace côté victime.
          to: user.email,
          subject: t("subject"),
          html: renderEmailLayout({
            locale,
            title: t("title"),
            body:
              renderParagraph(
                escapeHtml(t("intro", { email: "\u0000" })).replace(
                  "\u0000",
                  `<strong>${escapeHtml(newEmail)}</strong>`
                )
              ) +
              renderButton(url, t("button")) +
              renderParagraph(
                escapeHtml(t("warning", { strong: "\u0001" })).replace(
                  "\u0001",
                  `<strong>${escapeHtml(t("warningStrong"))}</strong>`
                )
              ),
          }),
        });

        if (!result.success) {
          if (env.NODE_ENV === "development") {
            console.warn("[Auth] Email non envoyé, mais URL disponible ci-dessus");
            return;
          }
          throw new Error(`Failed to send change email verification: ${result.error}`);
        }
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Le défaut Better Auth est 8 : un appel direct à /api/auth/sign-up/email
    // acceptait « password123 » alors que les formulaires exigent déjà 12
    // caractères. La complexité est vérifiée par `enforcePasswordPolicy`.
    minPasswordLength: 12,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }, request) => {
      if (env.NODE_ENV === "development") {
        console.log("\n[Auth] sendResetPassword CALLED");
        console.log("[Auth] User:", user.email);
        console.log("[Auth] URL:", url);
      }

      const locale = emailLocaleFromRequest(url, request, (user as { locale?: string | null }).locale);
      const t = translatorFor(locale, "emails.resetPassword");
      const result = await sendEmail({
        scope: "Auth Reset Password",
        to: user.email,
        subject: t("subject"),
        html: renderEmailLayout({
          locale,
          title: t("title"),
          body:
            renderParagraph(escapeHtml(t("intro"))) +
            renderButton(url, t("button")) +
            renderParagraph(escapeHtml(t("expiry"))),
        }),
      });

      if (!result.success) {
        if (env.NODE_ENV === "development") return;
        throw new Error(`Failed to send reset password email: ${result.error}`);
      }
    },
    async onPasswordReset(data) {
      try {
        const { eq } = await import("drizzle-orm");

        // Recevoir puis ouvrir le lien de réinitialisation prouve le contrôle
        // de la boîte mail : on marque l'adresse vérifiée. Sans cela, les
        // comptes créés par import CSV (email_verified = false, aucun mot de
        // passe) restaient bloqués par `requireEmailVerification` alors même
        // qu'ils venaient de définir leur mot de passe.
        if (!data.user.emailVerified) {
          await db
            .update(schema.users)
            .set({ emailVerified: true, updatedAt: new Date() })
            .where(eq(schema.users.id, data.user.id));
        }

        await db
          .delete(schema.sessions)
          .where(eq(schema.sessions.userId, data.user.id));
      } catch (error) {
        console.error("[Auth] Failed to finalize password reset:", error);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Une tentative de connexion sur un compte non vérifié renvoie le lien :
    // c'est le seul rattrapage pour les comptes importés dont l'email de
    // bienvenue s'est perdu. La page /login propose en plus un renvoi manuel.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) => {
      if (env.NODE_ENV === "development") {
        console.log("\n[Auth] sendVerificationEmail CALLED");
        console.log("[Auth] User:", user.email);
        console.log("[Auth] URL:", url);
      }

      const locale = emailLocaleFromRequest(url, request, (user as { locale?: string | null }).locale);
      const t = translatorFor(locale, "emails.verify");
      const result = await sendEmail({
        scope: "Auth Verification",
        to: user.email,
        subject: t("subject"),
        html: renderEmailLayout({
          locale,
          title: t("title"),
          body:
            renderParagraph(escapeHtml(t("intro"))) +
            renderButton(url, t("button")) +
            renderParagraph(escapeHtml(t("ignore"))),
        }),
      });

      if (!result.success) {
        if (env.NODE_ENV === "development") return;
        throw new Error(`Failed to send verification email: ${result.error}`);
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        /**
         * Langue du compte à sa création : celle de la page d'inscription
         * (callbackURL préfixé), sinon cookie ou navigateur. Sert aux
         * e-mails envoyés plus tard hors requête (résultats, rappels).
         */
        before: async (user, ctx) => {
          const callbackURL = (ctx?.body as { callbackURL?: unknown } | undefined)?.callbackURL;
          const headers = ctx?.headers ?? ctx?.request?.headers;
          const locale = emailLocale({
            url:
              typeof callbackURL === "string"
                ? `http://local/?callbackURL=${encodeURIComponent(callbackURL)}`
                : null,
            cookieHeader: headers?.get("cookie"),
            acceptLanguage: headers?.get("accept-language"),
          });
          return { data: { ...user, locale } };
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      // `onPasswordReset` et les retraits de rôle suppriment les sessions en
      // base, mais un cookie volé reste accepté tant que le cache tient : une
      // minute borne la fenêtre sans relancer une lecture SQL à chaque rendu.
      maxAge: 60,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
