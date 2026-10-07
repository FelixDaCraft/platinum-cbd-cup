"use client";

import { Suspense, useState, useCallback, useEffect, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { signUp } from "~/lib/auth-client";
import { PASSWORD_CRITERIA } from "~/lib/validations/auth";
import {
  producerRegisterSchema,
  type ProducerRegisterInput,
} from "~/lib/validations/producer";
import { useOrganization } from "~/lib/portal/context";

/**
 * Portal Registration Page
 * - intent=jury: Creates user account only (jury profile created on code activation)
 * - default: Creates user account + producer profile
 */
export default function PortalRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="pg pg--form" role="status" style={{ alignItems: "center", paddingTop: 96 }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} aria-label="Chargement" />
        </div>
      }
    >
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organization = useOrganization();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors },
  } = useForm<ProducerRegisterInput>({
    resolver: zodResolver(producerRegisterSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
    },
  });

  // Watch password with debounce for criteria display
  const watchedPassword = watch("password");

  useEffect(() => {
    const timer = setTimeout(() => {
      setPasswordValue(watchedPassword ?? "");
    }, 150);
    return () => clearTimeout(timer);
  }, [watchedPassword]);

  // Focus first error field
  useEffect(() => {
    const firstError = Object.keys(errors)[0] as
      | keyof ProducerRegisterInput
      | undefined;
    if (firstError) {
      setFocus(firstError);
    }
  }, [errors, setFocus]);

  const onSubmit = useCallback(
    async (data: ProducerRegisterInput) => {
      setIsSubmittingForm(true);
      try {
        const result = await signUp.email({
          email: data.email,
          password: data.password,
          name: data.name,
        });

        if (result.error) {
          const errorCode = result.error.code?.toUpperCase() ?? "";
          const errorMessage = result.error.message?.toLowerCase() ?? "";

          if (
            errorCode.includes("USER_ALREADY_EXISTS") ||
            errorCode.includes("ALREADY_EXISTS") ||
            errorMessage.includes("already") ||
            errorMessage.includes("exists") ||
            errorMessage.includes("existe")
          ) {
            toast.error("Cet email est déjà utilisé. Connectez-vous à la place.");
          } else {
            toast.error("Une erreur est survenue. Veuillez réessayer.");
          }
          setIsSubmittingForm(false);
          return;
        }

        toast.success("Inscription réussie ! Vérifiez votre email.");
        const cb = searchParams.get("callbackUrl");
        const loginUrl = cb
          ? `/login?registered=true&callbackUrl=${encodeURIComponent(cb)}`
          : "/login?registered=true";
        router.push(loginUrl);
      } catch {
        toast.error("Erreur de connexion. Vérifiez votre connexion internet.");
        setIsSubmittingForm(false);
      }
    },
    [router, searchParams]
  );

  const checkCriteria = useCallback(
    (regex: RegExp) => regex.test(passwordValue),
    [passwordValue]
  );

  return (
    <div className="pg pg--form">
      <header className="pg-head">
        <h1 className="display">Créer un compte</h1>
        <p className="pg-lede">
          Rejoignez {organization.name} et participez aux compétitions.
        </p>
      </header>

      <div className="form-card">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="form-stack"
          noValidate
          aria-busy={isSubmittingForm}
        >
          <div className="field">
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="field-input"
              placeholder="vous@exemple.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-required="true"
              aria-describedby={errors.email ? "email-error" : undefined}
              style={errors.email ? errorBorder : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="field-error" style={{ margin: 0 }}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="name" className="field-label">
              Votre nom
            </label>
            <input
              id="name"
              type="text"
              className="field-input"
              placeholder="Jean Dupont"
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-required="true"
              aria-describedby={errors.name ? "name-error" : undefined}
              style={errors.name ? errorBorder : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="name-error" className="field-error" style={{ margin: 0 }}>
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="password" className="field-label">
              Mot de passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="field-input"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-required="true"
                aria-describedby="password-criteria password-error"
                style={{ paddingRight: 52, ...(errors.password ? errorBorder : {}) }}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                className="pw-toggle"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="field-error" style={{ margin: 0 }}>
                {errors.password.message}
              </p>
            )}

            {/* Critères du mot de passe */}
            <div
              id="password-criteria"
              className="pw-criteria"
              aria-live="polite"
              aria-atomic="true"
            >
              {PASSWORD_CRITERIA.map((criterion) => {
                const isValid = checkCriteria(criterion.regex);
                return (
                  <div
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
                      <Check className="h-4 w-4" style={{ flexShrink: 0, color: "var(--accent)" }} aria-hidden="true" />
                    ) : (
                      <X className="h-4 w-4" style={{ flexShrink: 0 }} aria-hidden="true" />
                    )}
                    <span>{criterion.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword" className="field-label">
              Confirmer le mot de passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                className="field-input"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-required="true"
                aria-describedby={
                  errors.confirmPassword ? "confirm-password-error" : undefined
                }
                style={{ paddingRight: 52, ...(errors.confirmPassword ? errorBorder : {}) }}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword
                    ? "Masquer la confirmation"
                    : "Afficher la confirmation"
                }
                className="pw-toggle"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="confirm-password-error" className="field-error" style={{ margin: 0 }}>
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="form-actions" style={{ paddingTop: 4 }}>
            <button
              type="submit"
              className="btn accent btn-lg"
              disabled={isSubmittingForm}
              style={{ width: "100%" }}
            >
              {isSubmittingForm ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Inscription en cours…
                </>
              ) : (
                "Créer mon compte"
              )}
            </button>
          </div>
        </form>

        <p className="form-foot">
          Déjà un compte ? <Link href="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}


const errorBorder: CSSProperties = { borderColor: "var(--danger)" };
