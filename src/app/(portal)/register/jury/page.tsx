"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { cn } from "~/lib/utils";
import { signUp } from "~/lib/auth-client";
import { PASSWORD_CRITERIA } from "~/lib/validations/auth";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";
import { api } from "~/trpc/react";

// Jury registration schema (simpler than producer)
const juryRegisterSchema = z
  .object({
    email: z.string().email("Email invalide"),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
      .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
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
  const theme = usePortalTheme();

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

  const logoUrl = theme.logoUrl || organization.logo;

  // Show error if no code provided
  if (!invitationCode) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 text-destructive mb-2">
              <AlertCircle className="h-6 w-6" />
              <CardTitle className="text-xl">Code manquant</CardTitle>
            </div>
            <CardDescription>
              Un code d&apos;invitation est nécessaire pour s&apos;inscrire en tant que jury.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while validating code
  if (isValidatingCode) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Validation du code...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if code is invalid
  if (!codeValidation?.valid) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 text-destructive mb-2">
              <AlertCircle className="h-6 w-6" />
              <CardTitle className="text-xl">Code invalide</CardTitle>
            </div>
            <CardDescription>
              {codeValidation?.message ?? "Ce code d'invitation n'est pas valide ou a expiré."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            Créez votre compte pour rejoindre <strong>{codeValidation.cup?.name}</strong>
          </CardDescription>

          {/* Code validation badge */}
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              Code valide : {invitationCode}
            </p>
            {codeValidation.categories && codeValidation.categories.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Catégories: {codeValidation.categories.map((c) => c.name).join(", ")}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
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
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                      {isValid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
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
                  aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                  className="pr-10"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p id="confirm-password-error" className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inscription...
                </>
              ) : (
                "Créer mon compte jury"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link
              href={`/login?redirect=/jury&code=${invitationCode}`}
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

/**
 * Portal Jury Registration Page
 * Creates a user account for jury participation with an invitation code
 */
export default function PortalJuryRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">Chargement...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <JuryRegisterContent />
    </Suspense>
  );
}
