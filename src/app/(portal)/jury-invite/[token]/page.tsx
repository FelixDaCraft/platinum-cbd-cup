"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { useSession, signIn } from "~/lib/auth-client";
import { PASSWORD_CRITERIA, passwordSchema } from "~/lib/validations/auth";
import { api } from "~/trpc/react";
import { getErrorMessage } from "../../_lib/errors";

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
      <div className="pg pg--form">
        <div
          className="form-card"
          style={{ marginTop: 72, alignItems: "center", padding: "56px 24px" }}
          role="status"
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: 16, color: "var(--fg-2)" }}>
            Vérification de l&apos;invitation…
          </p>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (validationError || !invitation) {
    return (
      <div className="pg pg--form">
        <InviteHead title="Invitation invalide" />
        <div className="form-card">
          <div className="notice is-error" role="alert">
            Cette invitation n&apos;est plus valide. Elle a peut-être expiré ou a
            déjà été utilisée. Contactez l&apos;organisateur pour obtenir une
            nouvelle invitation.
          </div>
          <p className="form-foot" style={{ margin: 0 }}>
            <Link href="/">Retour à l&apos;accueil</Link>
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
  return (
    <header className="pg-head">
      <p className="eyebrow">Invitation jury</p>
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
  const [isAccepting, setIsAccepting] = useState(false);

  const acceptMutation = api.jury.acceptInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation acceptée ! Bienvenue dans le jury.");
      router.push("/jury/dashboard");
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Impossible d'accepter l'invitation pour le moment."),
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
    <div className="pg pg--form">
      <InviteHead
        title={
          <>
            Rejoindre le <em>jury</em>
          </>
        }
        lede={
          <>
            Vous êtes invité à rejoindre le jury de{" "}
            <strong style={{ color: "var(--fg)" }}>{invitation.cup.name}</strong>.
          </>
        }
      />
      <div className="form-card">
        <div className="notice is-info">
          Invitation adressée à{" "}
          {invitee ? (
            <>
              <b>{invitee}</b> ({invitation.email})
            </>
          ) : (
            <b>{invitation.email}</b>
          )}
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
                Acceptation…
              </>
            ) : (
              "Accepter l'invitation"
            )}
          </button>
        </div>

        <p className="form-foot" style={{ margin: 0 }}>
          <Link href="/">Retour à l&apos;accueil</Link>
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
        toast.info("Compte créé ! Connectez-vous pour accéder au jury.");
        router.push(`/login?callbackUrl=/jury/dashboard`);
        return;
      }
      toast.success("Bienvenue dans le jury !");
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
        toast.info("Ce compte existe déjà. Connectez-vous pour accepter l'invitation.");
        router.push(`/login?callbackUrl=/jury-invite/${token}`);
        return;
      }

      toast.error(
        getErrorMessage(error, "Une erreur est survenue. Veuillez réessayer."),
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
    <div className="pg pg--form">
      <InviteHead
        title={
          <>
            Rejoindre le <em>jury</em>
          </>
        }
        lede={
          <>
            Créez votre compte pour rejoindre le jury de{" "}
            <strong style={{ color: "var(--fg)" }}>{invitation.cup.name}</strong>.
          </>
        }
      />

      <div className="form-card">
        <form onSubmit={handleSubmit(onSubmit)} className="form-stack">
          {/* Email, prérempli depuis l'invitation */}
          <div className="field">
            <label htmlFor="email" className="field-label">
              Adresse email
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
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Nom */}
          <div className="field">
            <label htmlFor="name" className="field-label">
              Nom et prénom
            </label>
            <input
              id="name"
              type="text"
              placeholder="Jean Dupont"
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              className="field-input"
              style={errors.name ? errorBorder : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="name-error" className="field-error" style={{ margin: 0 }}>
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Expertise */}
          <div className="field">
            <label htmlFor="expertise" className="field-label">
              Expertise{" "}
              <span style={{ fontWeight: 400, color: "var(--fg-3)" }}>(facultatif)</span>
            </label>
            <input
              id="expertise"
              type="text"
              placeholder="Ex. : producteur, gérant de boutique, journaliste"
              aria-invalid={!!errors.expertise}
              aria-describedby={errors.expertise ? "expertise-error" : undefined}
              className="field-input"
              style={errors.expertise ? errorBorder : undefined}
              {...register("expertise")}
            />
            {errors.expertise && (
              <p id="expertise-error" className="field-error" style={{ margin: 0 }}>
                {errors.expertise.message}
              </p>
            )}
          </div>

          {/* Mot de passe */}
          <div className="field">
            <label htmlFor="password" className="field-label">
              Mot de passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Votre mot de passe"
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
          <div className="field">
            <label htmlFor="confirmPassword" className="field-label">
              Confirmer le mot de passe
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirmez votre mot de passe"
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
                    ? "Masquer la confirmation"
                    : "Afficher la confirmation"
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
                {errors.confirmPassword.message}
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
                  Inscription…
                </>
              ) : (
                "Créer mon compte jury"
              )}
            </button>
          </div>
        </form>

        <p className="form-foot" style={{ margin: 0 }}>
          Déjà un compte ?{" "}
          <Link href={`/login?callbackUrl=/jury-invite/${token}`}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
