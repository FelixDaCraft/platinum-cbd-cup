"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Check, X, Loader2, ArrowRight, Building2, User, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { signUp } from "~/lib/auth-client";
import { PASSWORD_CRITERIA } from "~/lib/validations/auth";
import {
  producerRegisterSchema,
  type ProducerRegisterInput,
} from "~/lib/validations/producer";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";

/**
 * Portal Registration Page
 * - intent=jury: Creates user account only (jury profile created on code activation)
 * - default: Creates user account + producer profile
 */
export default function PortalRegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organization = useOrganization();
  const theme = usePortalTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
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
            toast.error("Cet email est déjà utilisé. Connectez-vous à la place.");
          } else {
            toast.error("Une erreur est survenue. Veuillez réessayer.");
          }
          setIsSubmittingForm(false);
          return;
        }

        toast.success("Inscription réussie ! Vérifiez votre email.");
        const cb = searchParams.get("callbackUrl");
        const loginUrl = cb
          ? `/login?registered=true&callbackUrl=${encodeURIComponent(cb)}`
          : "/login?registered=true";
        router.push(loginUrl);
      } catch {
        toast.error("Erreur de connexion. Vérifiez votre connexion internet.");
        setIsSubmittingForm(false);
      }
    },
    [router, searchParams]
  );

  const checkCriteria = useCallback(
    (regex: RegExp) => regex.test(passwordValue),
    [passwordValue]
  );

  const logoUrl = theme.logoUrl || organization.logo;

  // Common input class
  const inputClass = cn(
    "h-12 px-4 bg-background/50 border-border/50 rounded-xl transition-all duration-200",
    "focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
  );

  const inputErrorClass = "border-destructive focus:border-destructive focus:ring-destructive/20";

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
          backgroundSize: '60px 60px',
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Premium Card */}
        <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl shadow-black/5 overflow-hidden">
          {/* Accent line at top */}
          <div
            className="h-1 w-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${theme.primaryColor}, transparent)`
            }}
          />

          <div className="p-8 sm:p-10">
            {/* Header */}
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
                    {/* Subtle glow behind logo */}
                    <div
                      className="absolute inset-0 blur-2xl opacity-20 -z-10"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mb-2">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: `${theme.primaryColor}15` }}
                >
                  <Building2 className="h-5 w-5" style={{ color: theme.primaryColor }} />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Créer un compte
              </h1>
              <p className="text-muted-foreground mt-2">
                Rejoignez {organization.name} et participez aux compétitions
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className={cn(
                    "text-sm font-medium transition-colors duration-200 flex items-center gap-2",
                    focusedField === "email" && "text-primary"
                  )}
                >
                  <Mail className="h-3.5 w-3.5 opacity-50" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={cn(inputClass, errors.email && inputErrorClass)}
                  {...register("email")}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Name Field */}
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className={cn(
                    "text-sm font-medium transition-colors duration-200 flex items-center gap-2",
                    focusedField === "name" && "text-primary"
                  )}
                >
                  <User className="h-3.5 w-3.5 opacity-50" />
                  Votre nom
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jean Dupont"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  className={cn(inputClass, errors.name && inputErrorClass)}
                  {...register("name")}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className={cn(
                    "text-sm font-medium transition-colors duration-200 flex items-center gap-2",
                    focusedField === "password" && "text-primary"
                  )}
                >
                  <Lock className="h-3.5 w-3.5 opacity-50" />
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                    aria-describedby="password-criteria password-error"
                    className={cn(inputClass, "pr-12", errors.password && inputErrorClass)}
                    {...register("password")}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
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
                <div id="password-criteria" className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
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

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className={cn(
                    "text-sm font-medium transition-colors duration-200 flex items-center gap-2",
                    focusedField === "confirmPassword" && "text-primary"
                  )}
                >
                  <Lock className="h-3.5 w-3.5 opacity-50" />
                  Confirmer le mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={!!errors.confirmPassword}
                    aria-describedby={
                      errors.confirmPassword ? "confirm-password-error" : undefined
                    }
                    className={cn(inputClass, "pr-12", errors.confirmPassword && inputErrorClass)}
                    {...register("confirmPassword")}
                    onFocus={() => setFocusedField("confirmPassword")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
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
                  <p id="confirm-password-error" className="text-sm text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base font-medium relative overflow-hidden group"
                  disabled={isSubmittingForm}
                  style={{
                    backgroundColor: theme.primaryColor,
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmittingForm ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Inscription en cours...
                      </>
                    ) : (
                      <>
                        Créer mon compte
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                  {/* Hover glow effect */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent)`,
                    }}
                  />
                </Button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link
                  href="/login"
                  className="font-medium transition-colors hover:underline"
                  style={{ color: theme.primaryColor }}
                >
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Propulsé par CupMetrics
        </p>
      </motion.div>
    </div>
  );
}
