"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { resetPassword } from "~/lib/auth-client";
import {
  PASSWORD_CRITERIA,
  resetPasswordSchema,
  type ResetPasswordInput,
} from "~/lib/validations/auth";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";
import { cn } from "~/lib/utils";

export default function ResetPasswordPage() {
  const theme = usePortalTheme();

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 py-8 relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at top, ${theme.primaryColor}08 0%, transparent 50%),
                     radial-gradient(ellipse at bottom right, ${theme.primaryColor}05 0%, transparent 50%),
                     linear-gradient(to bottom, hsl(var(--background)), hsl(var(--background)))`,
      }}
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(${theme.primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${theme.primaryColor} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating orbs for depth */}
      <div
        className="absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl opacity-[0.03]"
        style={{ backgroundColor: theme.primaryColor }}
      />
      <div
        className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl opacity-[0.03]"
        style={{ backgroundColor: theme.primaryColor }}
      />

      <Suspense
        fallback={
          <div className="w-full max-w-md relative z-10">
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl shadow-black/5 p-8">
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </div>
          </div>
        }
      >
        <ResetPasswordCard />
      </Suspense>
    </div>
  );
}

function ResetPasswordCard() {
  const searchParams = useSearchParams();
  const organization = useOrganization();
  const theme = usePortalTheme();

  const token = searchParams.get("token");
  const callbackError = searchParams.get("error");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const passwordValue = watch("password") ?? "";
  const checkCriteria = (regex: RegExp) => regex.test(passwordValue);

  // Focus first error field
  useEffect(() => {
    const firstError = Object.keys(errors)[0] as
      | keyof ResetPasswordInput
      | undefined;
    if (firstError) {
      setFocus(firstError);
    }
  }, [errors, setFocus]);

  const onSubmit = useCallback(
    async (data: ResetPasswordInput) => {
      if (!token) return;

      try {
        const result = await resetPassword({
          newPassword: data.password,
          token,
        });

        if (result.error) {
          const code = (result.error.code ?? "").toUpperCase();
          if (code.includes("TOKEN")) {
            toast.error(
              "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau."
            );
            return;
          }
          toast.error(
            result.error.message ??
              "Impossible de réinitialiser le mot de passe. Veuillez réessayer."
          );
          return;
        }

        // Better Auth invalidates every existing session on reset, so the
        // user has to sign in again with the new password.
        setIsRedirecting(true);
        toast.success("Mot de passe mis à jour !");
        window.location.href = "/login?reset=true";
      } catch {
        toast.error("Erreur réseau. Vérifiez votre connexion internet.");
      }
    },
    [token]
  );

  const logoUrl = theme.logoUrl || organization.logo;

  const inputClass = cn(
    "h-12 px-4 bg-background/50 border-border/50 rounded-xl transition-all duration-200",
    "focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
  );
  const inputErrorClass =
    "border-destructive focus:border-destructive focus:ring-destructive/20";

  const card = (children: React.ReactNode) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md relative z-10"
    >
      <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl shadow-black/5 overflow-hidden">
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.primaryColor}, transparent)`,
          }}
        />
        <div className="p-8 sm:p-10">{children}</div>
      </div>
    </motion.div>
  );

  const header = (title: string, subtitle: string) => (
    <div className="text-center mb-8">
      {logoUrl && (
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Image
              src={logoUrl}
              alt={organization.name}
              width={140}
              height={70}
              className="object-contain"
            />
            <div
              className="absolute inset-0 blur-2xl opacity-20 -z-10"
              style={{ backgroundColor: theme.primaryColor }}
            />
          </div>
        </div>
      )}
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2">{subtitle}</p>
    </div>
  );

  // No token, or the auth callback rejected it (expired / already used).
  if (!token || callbackError) {
    return card(
      <>
        {header("Lien invalide", "Ce lien de réinitialisation n'est plus valable")}

        <div
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
          role="alert"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Les liens de réinitialisation expirent au bout d&apos;une heure et ne
            servent qu&apos;une fois. Demandez-en un nouveau pour continuer.
          </p>
        </div>

        <div className="pt-6">
          <Button
            asChild
            className="w-full h-12 rounded-xl text-base font-medium"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <Link href="/forgot-password">Demander un nouveau lien</Link>
          </Button>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la connexion
          </Link>
        </div>
      </>
    );
  }

  if (isRedirecting) {
    return card(
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Redirection en cours...</p>
      </div>
    );
  }

  return card(
    <>
      {header("Nouveau mot de passe", "Choisissez un mot de passe sécurisé")}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
        aria-busy={isSubmitting}
      >
        {/* Password */}
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className={cn(
              "text-sm font-medium transition-colors duration-200",
              focusedField === "password" && "text-primary"
            )}
          >
            Mot de passe
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              autoFocus
              aria-invalid={!!errors.password}
              aria-required="true"
              aria-describedby="password-criteria password-error"
              className={cn(inputClass, "pr-12", errors.password && inputErrorClass)}
              {...register("password")}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div
            id="password-criteria"
            className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5"
            aria-live="polite"
            aria-atomic="true"
          >
            {PASSWORD_CRITERIA.map((criterion) => {
              const isValid = checkCriteria(criterion.regex);
              return (
                <div
                  key={criterion.label}
                  className={cn(
                    "flex items-center gap-2 text-xs transition-all duration-200",
                    isValid ? "text-green-600" : "text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200",
                      isValid ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                    )}
                  >
                    {isValid ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : (
                      <X className="h-2.5 w-2.5" />
                    )}
                  </div>
                  <span>{criterion.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm password */}
        <div className="space-y-2">
          <Label
            htmlFor="confirmPassword"
            className={cn(
              "text-sm font-medium transition-colors duration-200",
              focusedField === "confirmPassword" && "text-primary"
            )}
          >
            Confirmer le mot de passe
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-required="true"
              aria-describedby={
                errors.confirmPassword ? "confirm-password-error" : undefined
              }
              className={cn(
                inputClass,
                "pr-12",
                errors.confirmPassword && inputErrorClass
              )}
              {...register("confirmPassword")}
              onFocus={() => setFocusedField("confirmPassword")}
              onBlur={() => setFocusedField(null)}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={
                showConfirmPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
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
            <p id="confirm-password-error" className="text-sm text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-base font-medium relative overflow-hidden group"
            disabled={isSubmitting}
            style={{ backgroundColor: theme.primaryColor }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                <>
                  Réinitialiser mon mot de passe
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </span>
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: `linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent)`,
              }}
            />
          </Button>
        </div>
      </form>

      <div className="mt-8 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour à la connexion
        </Link>
      </div>
    </>
  );
}
