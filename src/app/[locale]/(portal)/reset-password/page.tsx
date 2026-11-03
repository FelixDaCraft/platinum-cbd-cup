"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "~/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { localizePath, type Locale } from "~/i18n/locales";
import { translateValidation } from "~/i18n/validation";

import { resetPassword } from "~/lib/auth-client";
import {
  PASSWORD_CRITERIA,
  resetPasswordSchema,
  type ResetPasswordInput,
} from "~/lib/validations/auth";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.login");
  return (
    <div className="pg pg--form auth-page">
      <Suspense fallback={<ResetPending label={t("loading")} />}>
        <ResetPasswordCard />
      </Suspense>
    </div>
  );
}

/** État d'attente : chargement ou redirection. */
function ResetPending({ label }: { label: string }) {
  return (
    <div
      className="form-card auth-pending"
      role="status"
    >
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} aria-hidden="true" />
      <p style={{ margin: 0, fontSize: 16, color: "var(--fg-2)" }}>{label}</p>
    </div>
  );
}

function ResetPasswordCard() {
  const t = useTranslations("auth.reset");
  const tl = useTranslations("auth.login");
  const tf = useTranslations("auth.forgot");
  const tr = useTranslations("auth.register");
  const tv = useTranslations("validation");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const callbackError = searchParams.get("error");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const passwordValue = watch("password") ?? "";
  const checkCriteria = (regex: RegExp) => regex.test(passwordValue);

  // Focus first error field
  useEffect(() => {
    const firstError = Object.keys(errors)[0] as
      | keyof ResetPasswordInput
      | undefined;
    if (firstError) {
      setFocus(firstError);
    }
  }, [errors, setFocus]);

  const onSubmit = useCallback(
    async (data: ResetPasswordInput) => {
      if (!token) return;

      try {
        const result = await resetPassword({
          newPassword: data.password,
          token,
        });

        if (result.error) {
          const code = (result.error.code ?? "").toUpperCase();
          const status = result.error.status ?? 0;

          if (code.includes("TOKEN")) {
            toast.error(
              t("errorToken")
            );
            return;
          }

          if (code.includes("PASSWORD_TOO_SHORT") || code.includes("PASSWORD_TOO_LONG")) {
            toast.error(
              t("errorLength")
            );
            return;
          }

          if (status === 429) {
            toast.error(tl("errorRate"));
            return;
          }

          // Ne jamais afficher `result.error.message` : Better Auth renvoie
          // des libellés techniques en anglais.
          console.error("[ResetPassword] Échec de la réinitialisation", result.error);
          toast.error(
            t("errorGeneric")
          );
          return;
        }

        // Better Auth invalidates every existing session on reset, so the
        // user has to sign in again with the new password.
        setIsRedirecting(true);
        toast.success(t("success"));
        window.location.href = localizePath("/login?reset=true", locale);
      } catch {
        toast.error(tl("errorNetwork"));
      }
    },
    [token, locale, t, tl]
  );

  const header = (title: string, lede: string) => (
    <header className="pg-head">
      <p className="eyebrow">{tf("eyebrow")}</p>
      <h1 className="display">{title}</h1>
      <p className="pg-lede">{lede}</p>
    </header>
  );

  const backToLogin = (
    <p className="form-foot" style={{ margin: 0 }}>
      <Link href="/login">{tf("back")}</Link>
    </p>
  );

  // No token, or the auth callback rejected it (expired / already used).
  if (!token || callbackError) {
    return (
      <>
        {header(t("invalidTitle"), t("invalidLede"))}

        <div className="form-card">
          <div className="notice is-error" role="alert">
            {t("invalidText")}
          </div>

          <div className="form-actions">
            <Link href="/forgot-password" className="btn accent">
              {t("newLink")}
            </Link>
          </div>

          {backToLogin}
        </div>
      </>
    );
  }

  if (isRedirecting) {
    return <ResetPending label={tl("redirecting")} />;
  }

  const errorBorder = { borderColor: "var(--danger)" };

  return (
    <>
      {header(t("title"), t("lede"))}

      <div className="form-card">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="form-stack"
          noValidate
          aria-busy={isSubmitting}
        >
          {/* Mot de passe */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="password" className="field-label">
              {t("newPassword")}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                autoFocus
                aria-invalid={!!errors.password}
                aria-required="true"
                aria-describedby="password-criteria password-error"
                className="field-input"
                style={{ paddingRight: 48, ...(errors.password ? errorBorder : {}) }}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="pw-toggle"
                aria-label={
                  showPassword ? tl("hidePassword") : tl("showPassword")
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="field-error" style={{ margin: 0 }}>
                {translateValidation(errors.password.message, tv)}
              </p>
            )}

            {/* Critères du mot de passe */}
            <ul
              id="password-criteria"
              aria-live="polite"
              aria-atomic="true"
              style={{
                listStyle: "none",
                margin: "4px 0 0",
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "6px 16px",
              }}
            >
              {PASSWORD_CRITERIA.map((criterion) => {
                const isValid = checkCriteria(criterion.regex);
                return (
                  <li
                    key={criterion.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      color: isValid ? "var(--fg)" : "var(--fg-3)",
                    }}
                  >
                    {isValid ? (
                      <Check className="h-4 w-4" style={{ color: "var(--accent)" }} aria-hidden="true" />
                    ) : (
                      <X className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{tv(`criteria.${criterion.key}`)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Confirmation */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="confirmPassword" className="field-label">
              {tr("confirmPassword")}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-required="true"
                aria-describedby={
                  errors.confirmPassword ? "confirm-password-error" : undefined
                }
                className="field-input"
                style={{ paddingRight: 48, ...(errors.confirmPassword ? errorBorder : {}) }}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="pw-toggle"
                aria-label={
                  showConfirmPassword ? tl("hidePassword") : tl("showPassword")
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="confirm-password-error" className="field-error" style={{ margin: 0 }}>
                {translateValidation(errors.confirmPassword.message, tv)}
              </p>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn accent" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </button>
          </div>
        </form>

        {backToLogin}
      </div>
    </>
  );
}
