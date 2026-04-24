import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";

import { db } from "~/server/db";
import { env } from "~/env";
import * as schema from "~/server/db/schema";

const resend = new Resend(env.RESEND_API_KEY);

/**
 * Extrait le domaine de base depuis une URL pour les cookies cross-subdomain.
 * Ex: "http://lvh.me:3000" → ".lvh.me"
 * Ex: "https://platinum-cbd-cup.fr" → ".platinum-cbd-cup.fr"
 */
function extractBaseDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      return "." + parts.slice(-2).join(".");
    }
    return hostname;
  } catch {
    return ".lvh.me"; // Fallback développement
  }
}

/**
 * Construit un pattern regex pour accepter tous les sous-domaines du domaine de base.
 */
function buildOriginPattern(baseDomain: string): RegExp {
  const domain = baseDomain.replace(/^\./, "").replace(/\./g, "\\.");
  return new RegExp(`^https?:\\/\\/([\\w-]+\\.)?${domain}(:\\d+)?$`);
}

const baseDomain = extractBaseDomain(env.BETTER_AUTH_URL);
const originPattern = buildOriginPattern(baseDomain);

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
  trustedOrigins: (request) => {
    const origins = [
      "http://localhost:3000",
      "https://localhost:3000",
      `https://*.${baseDomain.replace(/^\./, "")}`,
      `https://${baseDomain.replace(/^\./, "")}`,
    ];

    if (request) {
      const origin = request.headers.get("origin");
      if (origin && originPattern.test(origin)) {
        origins.push(origin);
      }
    }

    return origins;
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: baseDomain,
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
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, newEmail, url }) => {
        if (env.NODE_ENV === "development") {
          console.log("\n[Auth] sendChangeEmailVerification CALLED");
          console.log("[Auth] User:", user.email);
          console.log("[Auth] New email:", newEmail);
          console.log("[Auth] URL:", url);
        }

        try {
          const result = await resend.emails.send({
            from: env.EMAIL_FROM,
            to: newEmail,
            subject: "Confirmez votre nouvelle adresse email - Platinum CBD Cup",
            html: `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #d4af37; font-size: 32px; margin: 0;">Platinum CBD Cup</h1>
                </div>
                <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">Confirmez votre nouvelle adresse email</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                  Vous avez demandé à changer votre adresse email.
                  Cliquez sur le bouton ci-dessous pour confirmer ce changement :
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${url}" style="display: inline-block; background-color: #d4af37; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Confirmer le changement
                  </a>
                </div>
                <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-top: 32px;">
                  Si vous n'avez pas demandé ce changement, vous pouvez ignorer cet email en toute sécurité.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">Platinum CBD Cup</p>
              </div>
            `,
          });

          if (result.error) {
            console.error("[Auth] Resend API error:", result.error);
            if (env.NODE_ENV === "development") {
              console.warn("[Auth] Email non envoyé, mais URL disponible ci-dessus");
              return;
            }
            throw new Error(`Failed to send change email verification: ${result.error.message}`);
          }
        } catch (error) {
          console.error("[Auth] Failed to send change email verification:", error);
          if (env.NODE_ENV === "development") return;
          throw error;
        }
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      if (env.NODE_ENV === "development") {
        console.log("\n[Auth] sendResetPassword CALLED");
        console.log("[Auth] User:", user.email);
        console.log("[Auth] URL:", url);
      }

      try {
        const result = await resend.emails.send({
          from: env.EMAIL_FROM,
          to: user.email,
          subject: "Réinitialisez votre mot de passe - Platinum CBD Cup",
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #d4af37; font-size: 32px; margin: 0;">Platinum CBD Cup</h1>
              </div>
              <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">Réinitialisation de mot de passe</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${url}" style="display: inline-block; background-color: #d4af37; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-top: 32px;">
                Ce lien expire dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">Platinum CBD Cup</p>
            </div>
          `,
        });

        if (result.error) {
          console.error("[Auth] Resend API error:", result.error);
          if (env.NODE_ENV === "development") return;
          throw new Error(`Failed to send reset password email: ${result.error.message}`);
        }
      } catch (error) {
        console.error("[Auth] Failed to send reset password email:", error);
        if (env.NODE_ENV === "development") return;
        throw error;
      }
    },
    async onPasswordReset(data) {
      try {
        const { eq } = await import("drizzle-orm");
        await db
          .delete(schema.sessions)
          .where(eq(schema.sessions.userId, data.user.id));
      } catch (error) {
        console.error("[Auth] Failed to invalidate sessions:", error);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (env.NODE_ENV === "development") {
        console.log("\n[Auth] sendVerificationEmail CALLED");
        console.log("[Auth] User:", user.email);
        console.log("[Auth] URL:", url);
      }

      try {
        const result = await resend.emails.send({
          from: env.EMAIL_FROM,
          to: user.email,
          subject: "Confirmez votre inscription - Platinum CBD Cup",
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #d4af37; font-size: 32px; margin: 0;">Platinum CBD Cup</h1>
              </div>
              <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">Bienvenue sur Platinum CBD Cup !</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Merci de vous être inscrit. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte :
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${url}" style="display: inline-block; background-color: #d4af37; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Confirmer mon email
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-top: 32px;">
                Si vous n'avez pas créé de compte sur Platinum CBD Cup, vous pouvez ignorer cet email en toute sécurité.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">Platinum CBD Cup</p>
            </div>
          `,
        });

        if (result.error) {
          console.error("[Auth] Resend API error:", result.error);
          if (env.NODE_ENV === "development") return;
          throw new Error(`Failed to send verification email: ${result.error.message}`);
        }
      } catch (error) {
        console.error("[Auth] Failed to send verification email:", error);
        if (env.NODE_ENV === "development") return;
        throw error;
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
});

export type Session = typeof auth.$Infer.Session;
