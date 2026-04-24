"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Check, X, Loader2, Scale, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { cn } from "~/lib/utils";
import { useSession, signIn } from "~/lib/auth-client";
import { PASSWORD_CRITERIA, passwordSchema } from "~/lib/validations/auth";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";
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
  const organization = useOrganization();
  const theme = usePortalTheme();
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

  const logoUrl = theme.logoUrl || organization.logo;

  // Show loading while validating
  if (isValidating) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Verification de l&apos;invitation...</p>
        </CardContent>
      </Card>
    );
  }

  // Show error if token is invalid
  if (validationError || !invitation) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          {logoUrl && (
            <div className="flex justify-center mb-4">
              <Image
                src={logoUrl}
                alt={organization.name}
                width={120}
                height={60}
                className="object-contain"
              />
            </div>
          )}
          <CardTitle className="text-2xl">Invitation invalide</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              Cette invitation n&apos;est plus valide. Elle a peut-etre expire ou a deja ete utilisee.
              Contactez l&apos;organisateur pour obtenir une nouvelle invitation.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/" className="text-primary hover:underline">
            Retour a l&apos;accueil
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // If user is already logged in, show accept invitation button
  if (session) {
    return (
      <JuryAcceptInvitation
        token={token}
        invitation={invitation}
        organization={{ id: organization.id, name: organization.name }}
        logoUrl={logoUrl}
      />
    );
  }

  // Show registration form for new users
  return (
    <JuryRegisterForm
      token={token}
      invitation={invitation}
      organization={{ id: organization.id, name: organization.name, slug: organization.slug ?? "" }}
      logoUrl={logoUrl}
    />
  );
}

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
  organization,
  logoUrl,
}: {
  token: string;
  invitation: InvitationData;
  organization: { id: string; name: string };
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);

  const acceptMutation = api.jury.acceptInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation acceptee ! Bienvenue dans le jury.");
      router.push("/jury/dashboard");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'acceptation");
      setIsAccepting(false);
    },
  });

  const handleAccept = useCallback(() => {
    setIsAccepting(true);
    acceptMutation.mutate({ token });
  }, [acceptMutation, token]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        {logoUrl && (
          <div className="flex justify-center mb-4">
            <Image
              src={logoUrl}
              alt={organization.name}
              width={120}
              height={60}
              className="object-contain"
            />
          </div>
        )}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Scale className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl">Invitation Jury</CardTitle>
        </div>
        <CardDescription>
          Vous etes invite a rejoindre le jury pour{" "}
          <span className="font-semibold">{invitation.cup.name}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Scale className="h-4 w-4" />
          <AlertTitle>Invitation pour</AlertTitle>
          <AlertDescription>
            {invitation.firstName} {invitation.lastName} ({invitation.email})
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleAccept}
          className="w-full"
          disabled={isAccepting}
        >
          {isAccepting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Acceptation...
            </>
          ) : (
            "Accepter l'invitation"
          )}
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link href="/" className="text-muted-foreground hover:underline text-sm">
          Retour a l&apos;accueil
        </Link>
      </CardFooter>
    </Card>
  );
}

/**
 * Registration form for new jury members
 */
function JuryRegisterForm({
  token,
  invitation,
  organization,
  logoUrl,
}: {
  token: string;
  invitation: InvitationData;
  organization: { id: string; name: string; slug: string };
  logoUrl: string | null;
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
        toast.info("Compte cree ! Connectez-vous pour acceder au jury.");
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
        toast.info("Ce compte existe deja. Connectez-vous pour accepter l'invitation.");
        router.push(`/login?callbackUrl=/jury-invite/${token}`);
        return;
      }

      toast.error(error.message || "Une erreur est survenue. Veuillez reessayer.");
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
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          {logoUrl && (
            <div className="flex justify-center mb-4">
              <Image
                src={logoUrl}
                alt={organization.name}
                width={120}
                height={60}
                className="object-contain"
              />
            </div>
          )}
          <div className="flex items-center justify-center gap-2 mb-2">
            <Scale className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Inscription Jury</CardTitle>
          </div>
          <CardDescription>
            Creez votre compte pour rejoindre le jury de{" "}
            <span className="font-semibold">{invitation.cup.name}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field - pre-filled from invitation */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                disabled
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Votre nom</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jean Dupont"
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                {...register("name")}
              />
              {errors.name && (
                <p id="name-error" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Expertise Field */}
            <div className="space-y-2">
              <Label htmlFor="expertise">Expertise (optionnel)</Label>
              <Input
                id="expertise"
                type="text"
                placeholder="Sommelier, Expert vin, etc."
                aria-invalid={!!errors.expertise}
                aria-describedby={errors.expertise ? "expertise-error" : undefined}
                {...register("expertise")}
              />
              {errors.expertise && (
                <p id="expertise-error" className="text-sm text-destructive">
                  {errors.expertise.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Votre mot de passe"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  aria-describedby="password-criteria password-error"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                <p id="password-error" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}

              {/* Password Criteria */}
              <div id="password-criteria" className="mt-3 space-y-1.5">
                {PASSWORD_CRITERIA.map((criterion) => {
                  const isValid = checkCriteria(criterion.regex);
                  return (
                    <div
                      key={criterion.label}
                      className={cn(
                        "flex items-center gap-2 text-sm transition-colors",
                        isValid ? "text-green-600" : "text-muted-foreground"
                      )}
                    >
                      {isValid ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      <span>{criterion.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirmez votre mot de passe"
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={
                    errors.confirmPassword ? "confirm-password-error" : undefined
                  }
                  className="pr-10"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  className="text-sm text-destructive"
                >
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inscription...
                </>
              ) : (
                "Creer mon compte jury"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Deja un compte ?{" "}
            <Link
              href={`/login?callbackUrl=/jury-invite/${token}`}
              className="text-primary hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
