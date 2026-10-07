"use client";

import { useState, useCallback, useEffect, Suspense, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Check, X, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { signUp } from "~/lib/auth-client";
import { PASSWORD_CRITERIA, passwordSchema } from "~/lib/validations/auth";
import { useOrganization } from "~/lib/portal/context";
import { api } from "~/trpc/react";

// Le mot de passe reprend `passwordSchema`, la règle appliquée côté serveur
// par Better Auth : les valider différemment ferait échouer l'inscription
// après la saisie, avec un message technique en anglais.
const juryRegisterSchema = z
  .object({
    email: z.string().email("Email invalide"),
    password: passwordSchema,
    confirmPassword: z.string(),
    name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type JuryRegisterInput = z.infer<typeof juryRegisterSchema>;

function JuryRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organization = useOrganization();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  // Get code from URL
  const invitationCode = searchParams.get("code");
  const cupId = searchParams.get("cup");

  // Validate code on mount
  const { data: codeValidation, isLoading: isValidatingCode } = api.juryCodes.getByCode.useQuery(
    { code: invitationCode ?? "" },
    {
      enabled: !!invitationCode,
      retry: false,
    }
  );

  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<JuryRegisterInput>({
    resolver: zodResolver(juryRegisterSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
    },
  });

  // Watch password with debounce
  const watchedPassword = watch("password");

  useEffect(() => {
    const timer = setTimeout(() => {
      setPasswordValue(watchedPassword ?? "");
    }, 150);
    return () => clearTimeout(timer);
  }, [watchedPassword]);

  // Focus first error field
  useEffect(() => {
    const firstError = Object.keys(errors)[0] as keyof JuryRegisterInput | undefined;
    if (firstError) {
      setFocus(firstError);
    }
  }, [errors, setFocus]);

  const onSubmit = useCallback(
    async (data: JuryRegisterInput) => {
      if (!invitationCode || !codeValidation?.valid) {
        toast.error("Code d'invitation invalide");
        return;
      }

      try {
        // Store the pending invitation for after email verification.
        // `/login` reads this exact key to send the user to /activate once
        // they sign in, so it must stay in sync with login/page.tsx.
        if (typeof window !== "undefined") {
          localStorage.setItem("pendingActivationCode", invitationCode);
        }

        const result = await signUp.email({
          email: data.email,
          password: data.password,
          name: data.name,
        });

        if (result.error) {
          const errorCode = result.error.code?.toUpperCase() ?? "";
          const errorMessage = result.error.message?.toLowerCase() ?? "";

          // Handle duplicate email
          if (
            errorCode.includes("USER_ALREADY_EXISTS") ||
            errorCode.includes("ALREADY_EXISTS") ||
            errorMessage.includes("already") ||
            errorMessage.includes("exists")
          ) {
            toast.error("Cet email est déjà utilisé. Connectez-vous pour activer votre code.");
            router.push(
              `/login?callbackUrl=${encodeURIComponent(`/activate?code=${invitationCode}`)}`
            );
            return;
          }

          toast.error("Une erreur est survenue. Veuillez réessayer.");
          return;
        }

        toast.success("Inscription réussie ! Vérifiez votre email pour activer votre compte.");
        router.push("/login?registered=true&intent=jury");
      } catch {
        toast.error("Erreur de connexion. Vérifiez votre connexion internet.");
      }
    },
    [router, invitationCode, codeValidation]
  );

  const checkCriteria = useCallback(
    (regex: RegExp) => regex.test(passwordValue),
    [passwordValue]
  );

  // Code absent de l'URL
  if (!invitationCode) {
    return (
      <JuryCodeProblem title="Code manquant">
        Un code d&apos;invitation est nécessaire pour s&apos;inscrire en tant que
        juré.
      </JuryCodeProblem>
    );
  }

  // Validation du code en cours
  if (isValidatingCode) {
    return <JuryPending label="Validation du code…" />;
  }

  // Code refusé
  if (!codeValidation?.valid) {
    return (
      <JuryCodeProblem title="Code invalide">
        {codeValidation?.message ?? "Ce code d'invitation n'est pas valide ou a expiré."}
      </JuryCodeProblem>
    );
  }

  return (
    <div className="pg pg--form">
      <header className="pg-head">
        <p className="eyebrow">Jury</p>
        <h1 className="display">Inscription du jury</h1>
        <p className="pg-lede">
          Créez votre compte pour rejoindre{" "}
          {codeValidation.cup?.name ? (
            <strong style={{ color: "var(--fg)" }}>{codeValidation.cup.name}</strong>
          ) : (
            organization.name
          )}
          .
        </p>
      </header>

      <div className="form-card">
        {/* Rappel du code validé */}
        <div className="notice is-success" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            Code valide :{" "}
            <span style={{ fontFamily: "var(--mono)", letterSpacing: ".04em" }}>
              {invitationCode}
            </span>
          </p>
          {codeValidation.categories && codeValidation.categories.length > 0 && (
            <p style={{ margin: 0, fontSize: 15, color: "var(--fg-2)" }}>
              Catégories : {codeValidation.categories.map((c) => c.name).join(", ")}
            </p>
          )}
        </div>

        {/* `noValidate` : sans lui, les bulles de validation natives du
            navigateur (en anglais, hors charte) se superposent aux messages
            zod en français. `aria-busy` annonce l'envoi aux lecteurs
            d'écran, comme sur /login et /register. */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="form-stack"
          noValidate
          aria-busy={isSubmitting}
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
                placeholder="Votre mot de passe"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby="password-criteria password-error"
                style={{ paddingRight: 52, ...(errors.password ? errorBorder : {}) }}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
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
            <div id="password-criteria" className="pw-criteria">
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
                placeholder="Confirmez votre mot de passe"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                style={{ paddingRight: 52, ...(errors.confirmPassword ? errorBorder : {}) }}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"}
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
              disabled={isSubmitting}
              style={{ width: "100%" }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Inscription…
                </>
              ) : (
                "Créer mon compte de juré"
              )}
            </button>
          </div>
        </form>

        <p className="form-foot">
          Déjà un compte ?{" "}
          {/* La page /login lit `callbackUrl`, pas `redirect` : le lien
              renvoyait l'utilisateur au tableau de bord au lieu du code. */}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/activate?code=${invitationCode}`)}`}
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Code absent ou refusé : explication et retour à l'accueil. */
function JuryCodeProblem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pg pg--form">
      <header className="pg-head">
        <p className="eyebrow">Jury</p>
        <h1 className="display">{title}</h1>
      </header>
      <div className="notice is-error" role="alert" style={{ display: "flex", gap: 12 }}>
        <AlertCircle
          className="h-5 w-5"
          style={{ flexShrink: 0, marginTop: 2, color: "var(--danger)" }}
          aria-hidden="true"
        />
        <p style={{ margin: 0 }}>{children}</p>
      </div>
      <div className="form-actions" style={{ marginTop: 24 }}>
        <Link href="/" className="btn accent">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

function JuryPending({ label }: { label: string }) {
  return (
    <div className="pg pg--form">
      <div
        className="form-card"
        role="status"
        style={{ marginTop: 72, alignItems: "center", padding: "56px 24px" }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: 16, color: "var(--fg-2)" }}>{label}</p>
      </div>
    </div>
  );
}

/**
 * Portal Jury Registration Page
 * Creates a user account for jury participation with an invitation code
 */
export default function PortalJuryRegisterPage() {
  return (
    <Suspense fallback={<JuryPending label="Chargement…" />}>
      <JuryRegisterContent />
    </Suspense>
  );
}

const errorBorder: CSSProperties = { borderColor: "var(--danger)" };
