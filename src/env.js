import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    RESEND_API_KEY: z.string().min(1),
    // NE PAS basculer sur @platinumcbdcup.eu tant que Resend n'a pas vérifié
    // ce domaine (DKIM + SPF dans Cloudflare). Cette valeur s'applique dès que
    // EMAIL_FROM est absent ou vide du .env : la changer prématurément fait
    // répondre 403 « domain is not verified » à Resend, et Better Auth étouffe
    // l'erreur — tous les emails disparaissent en silence.
    EMAIL_FROM: z.string().min(1).default("Platinum CBD Cup <noreply@platinum.aynn.fr>"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
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
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VIVA_ENV: process.env.VIVA_ENV,
    VIVA_CLIENT_ID: process.env.VIVA_CLIENT_ID,
    VIVA_CLIENT_SECRET: process.env.VIVA_CLIENT_SECRET,
    VIVA_SOURCE_CODE: process.env.VIVA_SOURCE_CODE,
    VIVA_MERCHANT_ID: process.env.VIVA_MERCHANT_ID,
    VIVA_API_KEY: process.env.VIVA_API_KEY,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
