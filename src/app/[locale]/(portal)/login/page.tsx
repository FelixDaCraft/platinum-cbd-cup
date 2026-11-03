"use client";

import { Suspense, useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "~/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { hrefFor, type Locale } from "~/i18n/locales";
import { translateValidation } from "~/i18n/validation";

import { sendVerificationEmail, signIn, useSession } from "~/lib/auth-client";
import { loginSchema, type LoginInput } from "~/lib/validations/auth";
import { useOrganization } from "~/lib/portal/context";

type SessionUserRole = "organizer" | "producer" | "jury" | string | null | undefined;

function getRedirectPathForRole(role: SessionUserRole, isAdmin: boolean): string {
  if (isAdmin || role === "organizer") return "/dashboard";
  if (role === "producer") return "/producer/dashboard";
  if (role === "jury") return "/jury/dashboard";
  return "/";
}

/**
 * Normalise le `callbackUrl` posé par le middleware ou par les liens d'email.
 *
 * Tout chemin relatif du site est accepté — y compris `/producer/...` et
 * `/dashboard/...`, jusqu'ici silencieusement ignorés, ce qui cassait les
 * liens profonds envoyés par email. Sont refusées les URL absolues et les
 * formes `//hôte` / `/\hôte`, qui sortiraient du domaine (open redirect).
 *
 * Trois précautions, chacune pour un contournement réel :
 *   1. `useSearchParams` rend déjà la valeur décodée : redécoder ici ouvrirait
 *      le double encodage (`%252F%252Fevil.com` → `//evil.com`).
 *   2. Les navigateurs suppriment TAB, LF et CR avant de résoudre une URL :
 *      `/<TAB>/evil.com` redevient `//evil.com`, donc un domaine externe. Ces
 *      caractères sont retirés avant tout contrôle, pas après.
 *   3. Filet final : on résout comme le fera le navigateur et on exige la même
 *      origine. Ce qui ressort est reconstruit à partir de l'URL analysée.
 */
function sanitizeCallbackUrl(raw: string | null): string | null {
  if (!raw) return null;

  const value = raw.replace(/[\u0000-\u001F\u007F]/g, "");

  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  try {
    const resolved = new URL(value, window.location.origin);
    if (resolved.origin !== window.location.origin) return null;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return null;
  }
}

export default function PortalLoginPage() {
  const t = useTranslations("auth.login");
  return (
    <div className="pg pg--form auth-page">
      <Suspense fallback={<LoginPending label={t("loading")} />}>
        <PortalLoginForm />
      </Suspense>
    </div>
  );
}

/** État d'attente : chargement de la session ou redirection. */
function LoginPending({ label }: { label: string }) {
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

function PortalLoginForm() {
  const t = useTranslations("auth.login");
  const tv = useTranslations("validation");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const organization = useOrganization();
  const { data: session, isPending: isSessionLoading } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  // Adresse dont la connexion a été refusée faute de vérification : sert à
  // proposer le renvoi du lien de confirmation.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const hasShownParamToast = useRef(false);
  const hasRedirected = useRef(false);

  // Session is determined when not loading and not undefined
  const isSessionDetermined = !isSessionLoading && session !== undefined;

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Redirect if already logged in
  useEffect(() => {
    // Only check once session is definitely determined
    if (!isSessionDetermined || hasRedirected.current) {
      return;
    }

    if (session?.user) {
      const sessionUser = session.user as {
        role?: SessionUserRole;
        isAdmin?: boolean;
      };
      let redirectPath = getRedirectPathForRole(
        sessionUser.role,
        sessionUser.isAdmin === true
      );

      const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
      if (callbackUrl) {
        redirectPath = callbackUrl;
      }

      // Fallback: check localStorage for pending jury activation code
      if (!callbackUrl || !redirectPath.startsWith("/activate")) {
        try {
          const pendingCode = localStorage.getItem("pendingActivationCode");
          if (pendingCode) {
            redirectPath = `/activate?code=${pendingCode}`;
          }
        } catch { /* ignore localStorage errors */ }
      }

      hasRedirected.current = true;
      // Chemin interne nu (rôle, callbackUrl) → dans la langue de la page ;
      // le back-office reste sans préfixe.
      window.location.href = hrefFor(redirectPath, locale);
    }
  }, [session, isSessionDetermined, searchParams, locale]);

  // Show toast for newly registered users
  useEffect(() => {
    if (hasShownParamToast.current) return;

    const registered = searchParams.get("registered");
    const logout = searchParams.get("logout");
    const reset = searchParams.get("reset");

    if (registered === "true" || logout === "true" || reset === "true") {
      hasShownParamToast.current = true;

      if (registered === "true") {
        const cb = searchParams.get("callbackUrl") ?? "";
        if (cb.startsWith("/jury-invite/") || cb.startsWith("/jury/")) {
          toast.success(t("toastRegisteredJury"));
        } else {
          toast.info(t("toastRegistered"));
        }
      }

      if (logout === "true") {
        toast.success(t("toastLogout"));
      }

      if (reset === "true") {
        toast.success(t("toastReset"));
      }

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("registered");
      url.searchParams.delete("logout");
      url.searchParams.delete("reset");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams, t]);

  // Focus first error field
  useEffect(() => {
    const firstError = Object.keys(errors)[0] as keyof LoginInput | undefined;
    if (firstError) {
      setFocus(firstError);
    }
  }, [errors, setFocus]);

  const onSubmit = useCallback(
    async (data: LoginInput) => {
      setIsLoggingIn(true);
      try {
        const result = await signIn.email({
          email: data.email,
          password: data.password,
        });

        if (result.error) {
          setIsLoggingIn(false);
          const errorCode = result.error.code ?? "";
          const errorCodeUpper = errorCode.toUpperCase();
          const errorMessage = result.error.message?.toLowerCase() ?? "";
          const status = result.error.status ?? 0;

          // Handle email not verified
          if (
            errorCode === "EMAIL_NOT_VERIFIED" ||
            errorCodeUpper.includes("NOT_VERIFIED") ||
            errorMessage.includes("verify") ||
            errorMessage.includes("verified")
          ) {
            // `emailVerification.sendOnSignIn` vient de renvoyer le lien ;
            // le panneau offre un second envoi si l'email n'arrive pas.
            setUnverifiedEmail(data.email);
            toast.warning(t("errorUnverified"));
            return;
          }

          setUnverifiedEmail(null);

          // Handle rate limiting
          if (
            status === 429 ||
            errorCode === "RATE_LIMIT_EXCEEDED" ||
            errorCode === "TOO_MANY_REQUESTS" ||
            errorCodeUpper.includes("RATE") ||
            errorCodeUpper.includes("LIMIT") ||
            errorMessage.includes("too many")
          ) {
            toast.error(t("errorRate"));
            return;
          }

          // Panne côté serveur (500, base indisponible, passerelle Cloudflare).
          // Longtemps confondue avec un mauvais mot de passe, ce qui envoyait
          // les utilisateurs réinitialiser un mot de passe pourtant valide.
          if (status >= 500 || status === 0) {
            toast.error(t("errorUnavailable"));
            return;
          }

          // Identifiants réellement refusés par Better Auth. Les comptes créés
          // par import n'ont aucun mot de passe et tombent ici : on rappelle le
          // chemin « Mot de passe oublié », sans révéler si le compte existe.
          if (status === 401 || errorCodeUpper.includes("INVALID_EMAIL_OR_PASSWORD")) {
            toast.error(t("errorCredentials"));
            return;
          }

          // Tout le reste (403 origine refusée, 400 requête invalide…) : ne pas
          // le déguiser en erreur d'identifiants.
          console.error("[Login] Erreur de connexion inattendue", result.error);
          toast.error(t("errorOther", { status: status || "?" }));
          return;
        }

        setUnverifiedEmail(null);

        // Login succeeded!
        toast.success(t("success"));
        setLoginSuccess(true);

        // Determine redirect path based on role (from the freshly-returned session)
        const signedInUser = (result.data?.user ?? null) as
          | { role?: SessionUserRole; isAdmin?: boolean }
          | null;
        let redirectPath = getRedirectPathForRole(
          signedInUser?.role,
          signedInUser?.isAdmin === true
        );

        const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
        if (callbackUrl) {
          redirectPath = callbackUrl;
        }

        // Fallback: check localStorage for pending jury activation code
        if (!callbackUrl || !redirectPath.startsWith("/activate")) {
          try {
            const pendingCode = localStorage.getItem("pendingActivationCode");
            if (pendingCode) {
              redirectPath = `/activate?code=${pendingCode}`;
            }
          } catch { /* ignore localStorage errors */ }
        }

        window.location.href = hrefFor(redirectPath, locale);
        return;
      } catch {
        setIsLoggingIn(false);
        toast.error(t("errorNetwork"));
      }
    },
    [searchParams, locale, t]
  );

  const handleResendVerification = useCallback(async () => {
    if (!unverifiedEmail) return;

    setIsResendingVerification(true);
    try {
      const result = await sendVerificationEmail({
        email: unverifiedEmail,
        callbackURL: hrefFor("/login", locale),
      });

      if (result.error) {
        if (result.error.status === 429) {
          toast.error(t("resendRate"));
        } else {
          toast.error(t("resendFailed"));
        }
        return;
      }

      toast.success(t("resendSuccess", { email: unverifiedEmail }));
    } catch {
      toast.error(t("errorNetwork"));
    } finally {
      setIsResendingVerification(false);
    }
  }, [unverifiedEmail, locale, t]);

  // Chargement de la session, connexion en cours ou redirection
  if (!isSessionDetermined || isLoggingIn || loginSuccess) {
    return <LoginPending label={loginSuccess ? t("redirecting") : t("loading")} />;
  }

  // Déjà connecté : la redirection part du useEffect ci-dessus
  if (session?.user) {
    return <LoginPending label={t("redirecting")} />;
  }

  const callbackUrl = searchParams.get("callbackUrl");

  return (
    <>
      <header className="pg-head">
        <h1 className="display">{t("title")}</h1>
        <p className="pg-lede">{t("lede", { name: organization.name })}</p>
      </header>

      <div className="form-card">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="form-stack"
          noValidate
          aria-busy={isSubmitting}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="email" className="field-label">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              className="field-input"
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-required="true"
              aria-describedby={errors.email ? "email-error" : undefined}
              style={errors.email ? { borderColor: "var(--danger)" } : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="field-error" style={{ margin: 0 }}>
                {translateValidation(errors.email.message, tv)}
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "4px 16px",
              }}
            >
              <label htmlFor="password" className="field-label">
                {t("password")}
              </label>
              <Link href="/forgot-password" className="pg-link auth-forgot" style={{ fontSize: 15 }}>
                {t("forgot")}
              </Link>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="field-input"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-required="true"
                aria-describedby={errors.password ? "password-error" : undefined}
                style={{
                  paddingRight: 52,
                  ...(errors.password ? { borderColor: "var(--danger)" } : {}),
                }}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
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
          </div>

          {/* Email non confirmé : renvoi du lien d'activation */}
          {unverifiedEmail && (
            <div
              className="notice is-info"
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                <MailWarning
                  className="h-5 w-5"
                  style={{ flexShrink: 0, marginTop: 2, color: "var(--accent-hi)" }}
                  aria-hidden="true"
                />
                <p style={{ margin: 0 }}>
                  {t.rich("unverified", { email: unverifiedEmail, b: (c) => <b>{c}</b> })}
                </p>
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={handleResendVerification}
                disabled={isResendingVerification}
                style={{ width: "100%" }}
              >
                {isResendingVerification ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t("resending")}
                  </>
                ) : (
                  t("resend")
                )}
              </button>
            </div>
          )}

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
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </button>
          </div>
        </form>

        <p className="form-foot" style={{ margin: 0, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
          {t("noAccount")}{" "}
          <Link
            href={
              callbackUrl?.startsWith("/jury-invite/")
                ? callbackUrl
                : "/register"
            }
          >
            {t("createAccount")}
          </Link>
        </p>
      </div>
    </>
  );
}

