"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "~/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useServerError } from "~/i18n/server-error";
import { translateValidation } from "~/i18n/validation";
import { z } from "zod";

import { useSession, signIn } from "~/lib/auth-client";
import { PASSWORD_CRITERIA, passwordSchema } from "~/lib/validations/auth";
import { api } from "~/trpc/react";

/**
 * Jury invite registration schema
 */
const juryInviteRegisterSchema = z
  .object({
    email: z
      .string()
      .min(1, "L'email est requis")
      .email("Format d'email invalide"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmez votre mot de passe"),
    name: z.string().min(1, "Le nom est requis"),
    expertise: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type JuryInviteRegisterInput = z.infer<typeof juryInviteRegisterSchema>;

/**
 * Portal Jury Invitation Acceptance Page
 * Validates invitation token and allows jury to create account
 */
export default function PortalJuryInvitePage() {
  const params = useParams();
  const token = params.token as string;
  const { data: session } = useSession();
  const t = useTranslations("juryInvite");
  const tAct = useTranslations("activate");

  // Validate the invitation token
  const {
    data: invitationData,
    isLoading: isValidating,
    error: validationError,
  } = api.jury.getInvitationByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const invitation = invitationData?.invitation;

  // Show loading while validating
  if (isValidating) {
    return (
      <div className="pg pg--form auth-page">
        <div
          className="form-card auth-pending"
          role="status"
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: 16, color: "var(--fg-2)" }}>
            {t("checking")}
          </p>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (validationError || !invitation) {
    return (
      <div className="pg pg--form auth-page">
        <InviteHead title={t("invalidTitle")} />
        <div className="form-card">
          <div className="notice is-error" role="alert">
            {t("invalidText")}
          </div>
          <p className="form-foot" style={{ margin: 0 }}>
            <Link href="/">{tAct("backHome")}</Link>
          </p>
        </div>
      </div>
    );
  }

  // If user is already logged in, show accept invitation button
  if (session) {
    return <JuryAcceptInvitation token={token} invitation={invitation} />;
  }

  // Show registration form for new users
  return <JuryRegisterForm token={token} invitation={invitation} />;
}

/** En-tête commun aux états de la page. */
function InviteHead({
  title,
  lede,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
}) {
  const t = useTranslations("juryInvite");
  return (
    <header className="pg-head">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="display">{title}</h1>
      {lede && <p className="pg-lede">{lede}</p>}
    </header>
  );
}

const errorBorder: React.CSSProperties = { borderColor: "var(--danger)" };

/**
 * Invitation data from API
 */
interface InvitationData {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  cup: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
  };
}

/**
 * Component for logged-in users to accept invitation
 */
function JuryAcceptInvitation({
  token,
  invitation,
}: {
  token: string;
  invitation: InvitationData;
}) {
  const router = useRouter();
  const t = useTranslations("juryInvite");
  const tAct = useTranslations("activate");
  const serverError = useServerError();
  const [isAccepting, setIsAccepting] = useState(false);

  const acceptMutation = api.jury.acceptInvitation.useMutation({
    onSuccess: () => {
      toast.success(t("accepted"));
      router.push("/jury/dashboard");
    },
    onError: (error) => {
      toast.error(
        serverError(error, t("acceptFailed")),
      );
      setIsAccepting(false);
    },
  });

  const handleAccept = useCallback(() => {
    setIsAccepting(true);
    acceptMutation.mutate({ token });
  }, [acceptMutation, token]);

  const invitee = [invitation.firstName, invitation.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="pg pg--form auth-page">
      <InviteHead
        title={tAct.rich("joinTitle", { em: (c) => <em>{c}</em> })}
        lede={t.rich("acceptLede", {
          cup: invitation.cup.name,
          b: (c) => <strong style={{ color: "var(--fg)" }}>{c}</strong>,
        })}
      />
      <div className="form-card">
        <div className="notice is-info">
          {invitee
            ? t.rich("addressedToNamed", {
                name: invitee,
                email: invitation.email,
                b: (c) => <b>{c}</b>,
              })
            : t.rich("addressedTo", { email: invitation.email, b: (c) => <b>{c}</b> })}
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={handleAccept}
            className="btn accent"
            disabled={isAccepting}
          >
            {isAccepting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("accepting")}
              </>
            ) : (
              t("accept")
            )}
          </button>
        </div>

        <p className="form-foot" style={{ margin: 0 }}>
          <Link href="/">{tAct("backHome")}</Link>
        </p>
      </div>
    </div>
  );
}

/**
 * Registration form for new jury members
 */
function JuryRegisterForm({
  token,
  invitation,
}: {
  token: string;
  invitation: InvitationData;
}) {
  const router = useRouter();
  const t = useTranslations("juryInvite");
  const tAct = useTranslations("activate");
  const tl = useTranslations("auth.login");
  const tr = useTranslations("auth.register");
  const tv = useTranslations("validation");
  const serverError = useServerError();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  const defaultName = [invitation.firstName, invitation.lastName]
    .filter(Boolean)
    .join(" ");

  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors },
  } = useForm<JuryInviteRegisterInput>({
    resolver: zodResolver(juryInviteRegisterSchema),
    defaultValues: {
      email: invitation.email,
      password: "",
      confirmPassword: "",
      name: defaultName || "",
      expertise: "",
    },
  });

  // Registration mutation - skips email verification for invited juries
  const registerMutation = api.jury.registerAndAcceptInvitation.useMutation({
    onSuccess: async (_data, variables) => {
      const result = await signIn.email({
        email: variables.email,
        password: variables.password,
      });
      if (result.error) {
        toast.info(tl("toastRegisteredJury"));
        router.push(`/login?callbackUrl=/jury/dashboard`);
        return;
      }
      toast.success(t("welcome"));
      router.push("/jury/dashboard");
    },
    onError: (error) => {
      const errorMessage = error.message?.toLowerCase() ?? "";

      // Handle duplicate email - user should login instead
      if (
        errorMessage.includes("existe deja") ||
        errorMessage.includes("already") ||
        errorMessage.includes("exists")
      ) {
        toast.info(t("exists"));
        router.push(`/login?callbackUrl=/jury-invite/${token}`);
        return;
      }

      toast.error(
        serverError(error, tr("errorGeneric")),
      );
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
      | keyof JuryInviteRegisterInput
      | undefined;
    if (firstError) {
      setFocus(firstError);
    }
  }, [errors, setFocus]);

  const onSubmit = useCallback(
    (data: JuryInviteRegisterInput) => {
      registerMutation.mutate({
        token,
        email: data.email,
        password: data.password,
        name: data.name,
        expertise: data.expertise,
      });
    },
    [registerMutation, token]
  );

  const checkCriteria = useCallback(
    (regex: RegExp) => regex.test(passwordValue),
    [passwordValue]
  );

  return (
    <div className="pg pg--form auth-page">
      <InviteHead
        title={tAct.rich("joinTitle", { em: (c) => <em>{c}</em> })}
        lede={t.rich("registerLede", {
          cup: invitation.cup.name,
          b: (c) => <strong style={{ color: "var(--fg)" }}>{c}</strong>,
        })}
      />

      <div className="form-card">
        <form onSubmit={handleSubmit(onSubmit)} className="form-stack">
          {/* Email, prérempli depuis l'invitation */}
          <div className="field">
            <label htmlFor="email" className="field-label">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              disabled
              className="field-input"
              style={{ opacity: 0.7, cursor: "not-allowed" }}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="field-error" style={{ margin: 0 }}>
                {translateValidation(errors.email.message, tv)}
              </p>
            )}
          </div>

          {/* Nom */}
          <div className="field">
            <label htmlFor="name" className="field-label">
              {t("fullName")}
            </label>
            <input
              id="name"
              type="text"
              placeholder={tr("namePlaceholder")}
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              className="field-input"
              style={errors.name ? errorBorder : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="name-error" className="field-error" style={{ margin: 0 }}>
                {translateValidation(errors.name.message, tv)}
              </p>
            )}
          </div>

          {/* Expertise */}
          <div className="field">
            <label htmlFor="expertise" className="field-label">
              {t("expertise")}{" "}
              <span style={{ fontWeight: 400, color: "var(--fg-3)" }}>{tr("optional")}</span>
            </label>
            <input
              id="expertise"
              type="text"
              placeholder={t("expertisePlaceholder")}
              aria-invalid={!!errors.expertise}
              aria-describedby={errors.expertise ? "expertise-error" : undefined}
              className="field-input"
              style={errors.expertise ? errorBorder : undefined}
              {...register("expertise")}
            />
            {errors.expertise && (
              <p id="expertise-error" className="field-error" style={{ margin: 0 }}>
                {translateValidation(errors.expertise.message, tv)}
              </p>
            )}
          </div>

          {/* Mot de passe */}
          <div className="field">
            <label htmlFor="password" className="field-label">
              {tl("password")}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("passwordPlaceholder")}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
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
                    ? tl("hidePassword")
                    : tl("showPassword")
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
          <div className="field">
            <label htmlFor="confirmPassword" className="field-label">
              {tr("confirmPassword")}
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder={tv("confirmRequired")}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
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
                    ? tr("hideConfirm")
                    : tr("showConfirm")
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
              <p
                id="confirm-password-error"
                className="field-error"
                style={{ margin: 0 }}
              >
                {translateValidation(errors.confirmPassword.message, tv)}
              </p>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn accent"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {tr("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </button>
          </div>
        </form>

        <p className="form-foot" style={{ margin: 0 }}>
          {tr("haveAccount")}{" "}
          <Link href={`/login?callbackUrl=/jury-invite/${token}`}>{tl("submit")}</Link>
        </p>
      </div>
    </div>
  );
}
