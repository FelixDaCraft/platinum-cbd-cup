"use client";

import { useState, useCallback } from "react";
import { Link } from "~/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { localizePath, type Locale } from "~/i18n/locales";
import { translateValidation } from "~/i18n/validation";

import { forgetPassword } from "~/lib/auth-client";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "~/lib/validations/auth";

/**
 * Where Better Auth sends the user once it has validated the reset token.
 * The `/api/auth/reset-password/:token` callback redirects here with
 * `?token=…` on success, or `?error=INVALID_TOKEN` when it has expired.
 */
const RESET_REDIRECT_PATH = "/reset-password";

export default function ForgotPasswordPage() {
  return (
    <div className="pg pg--form auth-page">
      <ForgotPasswordForm />
    </div>
  );
}

function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const tv = useTranslations("validation");
  const tl = useTranslations("auth.login");
  const locale = useLocale() as Locale;
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = useCallback(async (data: ForgotPasswordInput) => {
    try {
      const result = await forgetPassword({
        email: data.email,
        // Préfixé de la langue : la page de réinitialisation et l'e-mail
        // suivent la langue de cette page.
        redirectTo: localizePath(RESET_REDIRECT_PATH, locale),
      });

      if (result.error) {
        const code = (result.error.code ?? "").toUpperCase();
        if (code.includes("RATE") || code.includes("LIMIT")) {
          toast.error(t("errorRate"));
          return;
        }
        toast.error(t("errorSend"));
        return;
      }

      // Better Auth answers identically whether or not the account exists,
      // so the confirmation screen must stay generic too.
      setSubmittedEmail(data.email);
    } catch {
      toast.error(tl("errorNetwork"));
    }
  }, [locale, t, tl]);

  return (
    <>
      <header className="pg-head">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="display">{t("title")}</h1>
        <p className="pg-lede">{submittedEmail ? t("checkInbox") : t("lede")}</p>
      </header>

      <div className="form-card">
        {submittedEmail ? (
          <>
            <div className="notice is-info" role="status" aria-live="polite">
              <p style={{ margin: 0 }}>
                {t.rich("sent", { email: submittedEmail, b: (c) => <b>{c}</b> })}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--fg-2)" }}>
                {t("expiry")}
              </p>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  void onSubmit({ email: getValues("email") });
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t("sending")}
                  </>
                ) : (
                  t("resend")
                )}
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="form-stack"
            noValidate
            aria-busy={isSubmitting}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label htmlFor="email" className="field-label">
                {t("emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                placeholder={tl("emailPlaceholder")}
                autoComplete="email"
                autoFocus
                aria-invalid={!!errors.email}
                aria-required="true"
                aria-describedby={errors.email ? "email-error" : undefined}
                className="field-input"
                style={errors.email ? { borderColor: "var(--danger)" } : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="field-error" style={{ margin: 0 }}>
                  {translateValidation(errors.email.message, tv)}
                </p>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn accent" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t("sending")}
                  </>
                ) : (
                  t("submit")
                )}
              </button>
            </div>
          </form>
        )}

        <p className="form-foot" style={{ margin: 0 }}>
          <Link href="/login">{t("back")}</Link>
        </p>
      </div>
    </>
  );
}
