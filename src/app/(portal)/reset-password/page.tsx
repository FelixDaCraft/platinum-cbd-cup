"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { resetPassword } from "~/lib/auth-client";
import {
  PASSWORD_CRITERIA,
  resetPasswordSchema,
  type ResetPasswordInput,
} from "~/lib/validations/auth";

export default function ResetPasswordPage() {
  return (
    <div className="pg pg--form">
      <Suspense fallback={<ResetPending label="Chargement…" />}>
        <ResetPasswordCard />
      </Suspense>
    </div>
  );
}

/** État d'attente : chargement ou redirection. */
function ResetPending({ label }: { label: string }) {
  return (
    <div
      className="form-card"
      style={{ marginTop: 72, alignItems: "center", padding: "56px 24px" }}
      role="status"
    >
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} aria-hidden="true" />
      <p style={{ margin: 0, fontSize: 16, color: "var(--fg-2)" }}>{label}</p>
    </div>
  );
}

function ResetPasswordCard() {
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
              "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau."
            );
            return;
          }

          if (code.includes("PASSWORD_TOO_SHORT") || code.includes("PASSWORD_TOO_LONG")) {
            toast.error(
              "Ce mot de passe ne respecte pas les règles de longueur attendues."
            );
            return;
          }

          if (status === 429) {
            toast.error("Trop de tentatives. Veuillez réessayer plus tard.");
            return;
          }

          // Ne jamais afficher `result.error.message` : Better Auth renvoie
          // des libellés techniques en anglais.
          console.error("[ResetPassword] Échec de la réinitialisation", result.error);
          toast.error(
            "Impossible de réinitialiser le mot de passe. Veuillez réessayer."
          );
          return;
        }

        // Better Auth invalidates every existing session on reset, so the
        // user has to sign in again with the new password.
        setIsRedirecting(true);
        toast.success("Mot de passe mis à jour !");
        window.location.href = "/login?reset=true";
      } catch {
        toast.error("Erreur réseau. Vérifiez votre connexion internet.");
      }
    },
    [token]
  );

  const header = (title: string, lede: string) => (
    <header className="pg-head">
      <p className="eyebrow">Mon compte</p>
      <h1 className="display">{title}</h1>
      <p className="pg-lede">{lede}</p>
    </header>
  );

  const backToLogin = (
    <p className="form-foot" style={{ margin: 0 }}>
      <Link href="/login">Retour à la connexion</Link>
    </p>
  );

  // No token, or the auth callback rejected it (expired / already used).
  if (!token || callbackError) {
    return (
      <>
        {header("Lien invalide", "Ce lien de réinitialisation n'est plus valable.")}

        <div className="form-card">
          <div className="notice is-error" role="alert">
            Les liens de réinitialisation expirent au bout d&apos;une heure et ne
            servent qu&apos;une fois. Demandez-en un nouveau pour continuer.
          </div>

          <div className="form-actions">
            <Link href="/forgot-password" className="btn accent">
              Demander un nouveau lien
            </Link>
          </div>

          {backToLogin}
        </div>
      </>
    );
  }

  if (isRedirecting) {
    return <ResetPending label="Redirection en cours…" />;
  }

  const errorBorder = { borderColor: "var(--danger)" };

  return (
    <>
      {header("Nouveau mot de passe", "Choisissez un mot de passe sûr pour votre compte.")}

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
              Nouveau mot de passe
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
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
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
                {errors.password.message}
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
                    key={criterion.label}
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
                    <span>{criterion.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Confirmation */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="confirmPassword" className="field-label">
              Confirmer le mot de passe
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
                  showConfirmPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
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
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn accent" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Mise à jour…
                </>
              ) : (
                "Enregistrer le mot de passe"
              )}
            </button>
          </div>
        </form>

        {backToLogin}
      </div>
    </>
  );
}
