"use client";

import { Suspense, useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";

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
  return (
    <div className="pg pg--form">
      <Suspense fallback={<LoginPending label="Chargement…" />}>
        <PortalLoginForm />
      </Suspense>
    </div>
  );
}

/** État d'attente : chargement de la session ou redirection. */
function LoginPending({ label }: { label: string }) {
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

function PortalLoginForm() {
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
      window.location.href = redirectPath;
    }
  }, [session, isSessionDetermined, searchParams]);

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
          toast.success("Compte créé ! Connectez-vous pour accéder au jury.");
        } else {
          toast.info("Compte créé ! Vérifiez votre email pour activer votre compte.");
        }
      }

      if (logout === "true") {
        toast.success("Vous avez été déconnecté avec succès.");
      }

      if (reset === "true") {
        toast.success(
          "Mot de passe modifié ! Connectez-vous avec votre nouveau mot de passe."
        );
      }

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("registered");
      url.searchParams.delete("logout");
      url.searchParams.delete("reset");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams]);

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
            toast.warning(
              "Votre email n'est pas encore confirmé. Un nouveau lien vient de vous être envoyé."
            );
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
            toast.error("Trop de tentatives. Veuillez réessayer plus tard.");
            return;
          }

          // Panne côté serveur (500, base indisponible, passerelle Cloudflare).
          // Longtemps confondue avec un mauvais mot de passe, ce qui envoyait
          // les utilisateurs réinitialiser un mot de passe pourtant valide.
          if (status >= 500 || status === 0) {
            toast.error(
              "Service momentanément indisponible. Réessayez dans quelques minutes."
            );
            return;
          }

          // Identifiants réellement refusés par Better Auth. Les comptes créés
          // par import n'ont aucun mot de passe et tombent ici : on rappelle le
          // chemin « Mot de passe oublié », sans révéler si le compte existe.
          if (status === 401 || errorCodeUpper.includes("INVALID_EMAIL_OR_PASSWORD")) {
            toast.error(
              "Email ou mot de passe incorrect. Si vous n'avez jamais défini de mot de passe, utilisez « Mot de passe oublié ? »."
            );
            return;
          }

          // Tout le reste (403 origine refusée, 400 requête invalide…) : ne pas
          // le déguiser en erreur d'identifiants.
          console.error("[Login] Erreur de connexion inattendue", result.error);
          toast.error(
            `Connexion impossible (erreur ${status || "inconnue"}). Contactez l'organisation si cela persiste.`
          );
          return;
        }

        setUnverifiedEmail(null);

        // Login succeeded!
        toast.success("Connexion réussie !");
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

        window.location.href = redirectPath;
        return;
      } catch {
        setIsLoggingIn(false);
        toast.error("Erreur de connexion. Vérifiez votre connexion internet.");
      }
    },
    [searchParams]
  );

  const handleResendVerification = useCallback(async () => {
    if (!unverifiedEmail) return;

    setIsResendingVerification(true);
    try {
      const result = await sendVerificationEmail({
        email: unverifiedEmail,
        callbackURL: "/login",
      });

      if (result.error) {
        if (result.error.status === 429) {
          toast.error(
            "Trop de demandes d'envoi. Patientez quelques minutes avant de réessayer."
          );
        } else {
          toast.error(
            "L'email n'a pas pu être renvoyé. Contactez l'organisation."
          );
        }
        return;
      }

      toast.success(
        `Email de confirmation renvoyé à ${unverifiedEmail}. Pensez à vérifier les spams.`
      );
    } catch {
      toast.error("Erreur réseau. Vérifiez votre connexion internet.");
    } finally {
      setIsResendingVerification(false);
    }
  }, [unverifiedEmail]);

  // Chargement de la session, connexion en cours ou redirection
  if (!isSessionDetermined || isLoggingIn || loginSuccess) {
    return <LoginPending label={loginSuccess ? "Redirection en cours…" : "Chargement…"} />;
  }

  // Déjà connecté : la redirection part du useEffect ci-dessus
  if (session?.user) {
    return <LoginPending label="Redirection en cours…" />;
  }

  const callbackUrl = searchParams.get("callbackUrl");

  return (
    <>
      <header className="pg-head">
        <h1 className="display">Connexion</h1>
        <p className="pg-lede">
          Connectez-vous à votre espace {organization.name}.
        </p>
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
              style={errors.email ? { borderColor: "var(--danger)" } : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="field-error" style={{ margin: 0 }}>
                {errors.email.message}
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
                Mot de passe
              </label>
              <Link href="/forgot-password" className="pg-link" style={{ fontSize: 15 }}>
                Mot de passe oublié ?
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
                  Votre adresse <b>{unverifiedEmail}</b> n&apos;est pas encore
                  confirmée. Ouvrez le lien reçu par email, ou demandez un nouvel
                  envoi.
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
                    Envoi en cours…
                  </>
                ) : (
                  "Renvoyer l'email de confirmation"
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
                  Connexion…
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </div>
        </form>

        <p className="form-foot" style={{ margin: 0, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
          Pas encore de compte ?{" "}
          <Link
            href={
              callbackUrl?.startsWith("/jury-invite/")
                ? callbackUrl
                : "/register"
            }
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </>
  );
}

