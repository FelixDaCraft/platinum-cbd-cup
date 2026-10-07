"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
    <div className="pg pg--form">
      <ForgotPasswordForm />
    </div>
  );
}

function ForgotPasswordForm() {
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
        redirectTo: RESET_REDIRECT_PATH,
      });

      if (result.error) {
        const code = (result.error.code ?? "").toUpperCase();
        if (code.includes("RATE") || code.includes("LIMIT")) {
          toast.error("Trop de demandes. Veuillez réessayer dans quelques minutes.");
          return;
        }
        toast.error("Impossible d'envoyer l'email. Veuillez réessayer.");
        return;
      }

      // Better Auth answers identically whether or not the account exists,
      // so the confirmation screen must stay generic too.
      setSubmittedEmail(data.email);
    } catch {
      toast.error("Erreur réseau. Vérifiez votre connexion internet.");
    }
  }, []);

  return (
    <>
      <header className="pg-head">
        <p className="eyebrow">Mon compte</p>
        <h1 className="display">Mot de passe oublié</h1>
        <p className="pg-lede">
          {submittedEmail
            ? "Vérifiez votre boîte mail."
            : "Indiquez votre adresse email : nous vous enverrons un lien pour choisir un nouveau mot de passe."}
        </p>
      </header>

      <div className="form-card">
        {submittedEmail ? (
          <>
            <div className="notice is-info" role="status" aria-live="polite">
              <p style={{ margin: 0 }}>
                Si un compte existe pour <b>{submittedEmail}</b>, un lien de
                réinitialisation vient d&apos;être envoyé.
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--fg-2)" }}>
                Le lien expire dans 1 heure. Pensez à regarder dans vos
                courriers indésirables.
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
                    Envoi…
                  </>
                ) : (
                  "Renvoyer l'email"
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
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
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
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn accent" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Envoi en cours…
                  </>
                ) : (
                  "Envoyer le lien"
                )}
              </button>
            </div>
          </form>
        )}

        <p className="form-foot" style={{ margin: 0 }}>
          <Link href="/login">Retour à la connexion</Link>
        </p>
      </div>
    </>
  );
}
