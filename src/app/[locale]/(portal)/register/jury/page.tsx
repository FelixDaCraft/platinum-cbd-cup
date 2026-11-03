"use client";

import { useState, useCallback, useEffect, Suspense, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "~/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Check, X, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { localizePath, type Locale } from "~/i18n/locales";
import { translateValidation, registerValidationMessages } from "~/i18n/validation";
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

registerValidationMessages({
  "Email invalide": "emailInvalid",
  "Le nom doit contenir au moins 2 caractères": "nameMin2",
});

function JuryRegisterContent() {
  const t = useTranslations("juryRegister");
  const ta = useTranslations("activate");
  const tl = useTranslations("auth.login");
  const tr = useTranslations("auth.register");
  const tj = useTranslations("juryInvite");
  const tv = useTranslations("validation");
  const locale = useLocale() as Locale;
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
        toast.error(ta("invalidText"));
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
          callbackURL: localizePath("/", locale),
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
            toast.error(t("exists"));
            router.push(
              `/login?callbackUrl=${encodeURIComponent(`/activate?code=${invitationCode}`)}`
            );
            return;
          }

          toast.error(tr("errorGeneric"));
          return;
        }

        toast.success(t("success"));
        router.push("/login?registered=true&intent=jury");
      } catch {
        toast.error(tl("errorNetwork"));
      }
    },
    [router, invitationCode, codeValidation, locale, t, ta, tl, tr]
  );

  const checkCriteria = useCallback(
    (regex: RegExp) => regex.test(passwordValue),
    [passwordValue]
  );

  // Code absent de l'URL
  if (!invitationCode) {
    return (
      <JuryCodeProblem title={t("missingTitle")}>{t("missingText")}</JuryCodeProblem>
    );
  }

  // Validation du code en cours
  if (isValidatingCode) {
    return <JuryPending label={ta("checking")} />;
  }

  // Code refusé
  if (!codeValidation?.valid) {
    return (
      <JuryCodeProblem title={ta("invalidTitle")}>
        {codeValidation?.reason === "expired"
          ? ta("expiredText")
          : codeValidation?.reason === "already_activated"
            ? ta("usedText")
            : codeValidation?.reason === "revoked"
              ? ta("revokedText")
              : t("invalidText")}
      </JuryCodeProblem>
    );
  }

  return (
    <div className="pg pg--form auth-page">
      <header className="pg-head">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="display">{t("title")}</h1>
        <p className="pg-lede">
          {t.rich("lede", {
            name: codeValidation.cup?.name ?? organization.name,
            b: (c) => <strong style={{ color: "var(--fg)" }}>{c}</strong>,
          })}
        </p>
      </header>

      <div className="form-card">
        {/* Rappel du code validé */}
        <div className="notice is-success" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {t("validCode")}{" "}
            <span style={{ fontFamily: "var(--mono)", letterSpacing: ".04em" }}>
              {invitationCode}
            </span>
          </p>
          {codeValidation.categories && codeValidation.categories.length > 0 && (
            <p style={{ margin: 0, fontSize: 15, color: "var(--fg-2)" }}>
              {t("categoriesList", { list: codeValidation.categories.map((c) => c.name).join(", ") })}
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
              {tl("email")}
            </label>
            <input
              id="email"
              type="email"
              className="field-input"
              placeholder={tl("emailPlaceholder")}
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              style={errors.email ? errorBorder : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="field-error" style={{ margin: 0 }}>
                {translateValidation(errors.email.message, tv)}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="name" className="field-label">
              {tr("name")}
            </label>
            <input
              id="name"
              type="text"
              className="field-input"
              placeholder={tr("namePlaceholder")}
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              style={errors.name ? errorBorder : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="name-error" className="field-error" style={{ margin: 0 }}>
                {translateValidation(errors.name.message, tv)}
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
                placeholder={tj("passwordPlaceholder")}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby="password-criteria password-error"
                style={{ paddingRight: 52, ...(errors.password ? errorBorder : {}) }}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? tl("hidePassword") : tl("showPassword")}
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
                {translateValidation(errors.password.message, tv)}
              </p>
            )}

            {/* Critères du mot de passe */}
            <div id="password-criteria" className="pw-criteria">
              {PASSWORD_CRITERIA.map((criterion) => {
                const isValid = checkCriteria(criterion.regex);
                return (
                  <div
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
                      <Check className="h-4 w-4" style={{ flexShrink: 0, color: "var(--accent)" }} aria-hidden="true" />
                    ) : (
                      <X className="h-4 w-4" style={{ flexShrink: 0 }} aria-hidden="true" />
                    )}
                    <span>{tv(`criteria.${criterion.key}`)}</span>
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
                placeholder={tv("confirmRequired")}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                style={{ paddingRight: 52, ...(errors.confirmPassword ? errorBorder : {}) }}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? tr("hideConfirm") : tr("showConfirm")}
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
                {translateValidation(errors.confirmPassword.message, tv)}
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
                  {tr("submitting")}
                </>
              ) : (
                tj("submit")
              )}
            </button>
          </div>
        </form>

        <p className="form-foot">
          {tr("haveAccount")}{" "}
          {/* La page /login lit `callbackUrl`, pas `redirect` : le lien
              renvoyait l'utilisateur au tableau de bord au lieu du code. */}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/activate?code=${invitationCode}`)}`}
          >
            {tl("submit")}
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Code absent ou refusé : explication et retour à l'accueil. */
function JuryCodeProblem({ title, children }: { title: string; children: ReactNode }) {
  const t = useTranslations("juryRegister");
  const ta = useTranslations("activate");
  return (
    <div className="pg pg--form auth-page">
      <header className="pg-head">
        <p className="eyebrow">{t("eyebrow")}</p>
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
          {ta("backHome")}
        </Link>
      </div>
    </div>
  );
}

function JuryPending({ label }: { label: string }) {
  return (
    <div className="pg pg--form auth-page">
      <div
        className="form-card auth-pending"
        role="status"
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
  const t = useTranslations("activate");
  return (
    <Suspense fallback={<JuryPending label={t("loading")} />}>
      <JuryRegisterContent />
    </Suspense>
  );
}

const errorBorder: CSSProperties = { borderColor: "var(--danger)" };
