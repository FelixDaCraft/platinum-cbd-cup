"use client";

import { Suspense, useState, useCallback, useEffect, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "~/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { localizePath, type Locale } from "~/i18n/locales";
import { translateValidation } from "~/i18n/validation";

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
  const t = useTranslations("auth.register");
  return (
    <Suspense
      fallback={
        <div className="pg pg--form auth-page" role="status" style={{ alignItems: "center", paddingTop: 96 }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} aria-label={t("loading")} />
        </div>
      }
    >
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const t = useTranslations("auth.register");
  const tv = useTranslations("validation");
  const tl = useTranslations("auth.login");
  const locale = useLocale() as Locale;
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
      companyName: "",
      brandName: "",
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
          // Vides : non transmis (la colonne reste nulle).
          pendingCompanyName: data.companyName?.trim() || undefined,
          pendingBrandName: data.brandName?.trim() || undefined,
          // Retour après confirmation de l'e-mail, dans la langue de la page :
          // c'est aussi ce qui fixe la langue de l'e-mail et du compte.
          callbackURL: localizePath("/", locale),
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
            toast.error(t("errorExists"));
          } else {
            toast.error(t("errorGeneric"));
          }
          setIsSubmittingForm(false);
          return;
        }

        toast.success(t("success"));
        const cb = searchParams.get("callbackUrl");
        const loginUrl = cb
          ? `/login?registered=true&callbackUrl=${encodeURIComponent(cb)}`
          : "/login?registered=true";
        router.push(loginUrl);
      } catch {
        toast.error(tl("errorNetwork"));
        setIsSubmittingForm(false);
      }
    },
    [router, searchParams, locale, t, tl]
  );

  const checkCriteria = useCallback(
    (regex: RegExp) => regex.test(passwordValue),
    [passwordValue]
  );

  return (
    <div className="pg pg--form auth-page">
      <header className="pg-head">
        <h1 className="display">{t("title")}</h1>
        <p className="pg-lede">{t("lede", { name: organization.name })}</p>
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
              {tl("email")}
            </label>
            <input
              id="email"
              type="email"
              className="field-input"
              placeholder={tl("emailPlaceholder")}
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-required="true"
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
              {t("name")}
            </label>
            <input
              id="name"
              type="text"
              className="field-input"
              placeholder={t("namePlaceholder")}
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-required="true"
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

          {/* Facultatifs : ils pré-remplissent « Compléter mon profil » après la
              confirmation de l'e-mail (gardés sur le compte, donc valables
              même si le lien est ouvert sur un autre appareil). */}
          <div className="form-row">
            <div className="field">
              <label htmlFor="companyName" className="field-label">
                {t("company")} <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>{t("optional")}</span>
              </label>
              <input
                id="companyName"
                type="text"
                className="field-input"
                placeholder={t("companyPlaceholder")}
                autoComplete="organization"
                maxLength={100}
                aria-invalid={!!errors.companyName}
                aria-describedby={errors.companyName ? "companyName-error" : undefined}
                style={errors.companyName ? errorBorder : undefined}
                {...register("companyName")}
              />
              {errors.companyName && (
                <p id="companyName-error" className="field-error" style={{ margin: 0 }}>
                  {translateValidation(errors.companyName.message, tv)}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="brandName" className="field-label">
                {t("brand")} <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>{t("optional")}</span>
              </label>
              <input
                id="brandName"
                type="text"
                className="field-input"
                placeholder="Val Green"
                maxLength={100}
                aria-invalid={!!errors.brandName}
                aria-describedby={errors.brandName ? "brandName-error" : undefined}
                style={errors.brandName ? errorBorder : undefined}
                {...register("brandName")}
              />
              {errors.brandName && (
                <p id="brandName-error" className="field-error" style={{ margin: 0 }}>
                  {translateValidation(errors.brandName.message, tv)}
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="password" className="field-label">
              {tl("password")}
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
              {t("confirmPassword")}
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
                aria-label={showConfirmPassword ? t("hideConfirm") : t("showConfirm")}
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
              disabled={isSubmittingForm}
              style={{ width: "100%" }}
            >
              {isSubmittingForm ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </button>
          </div>
        </form>

        <p className="form-foot">
          {t("haveAccount")} <Link href="/login">{tl("submit")}</Link>
        </p>
      </div>
    </div>
  );
}


const errorBorder: CSSProperties = { borderColor: "var(--danger)" };
