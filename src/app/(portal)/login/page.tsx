"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { signIn, useSession } from "~/lib/auth-client";
import { loginSchema, type LoginInput } from "~/lib/validations/auth";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";
import { cn } from "~/lib/utils";

type SessionUserRole = "organizer" | "producer" | "jury" | string | null | undefined;

function getRedirectPathForRole(role: SessionUserRole, isAdmin: boolean): string {
  if (isAdmin || role === "organizer") return "/dashboard";
  if (role === "producer") return "/producer/dashboard";
  if (role === "jury") return "/jury/dashboard";
  return "/";
}

export default function PortalLoginPage() {
  const theme = usePortalTheme();

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden"
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

      <Suspense
        fallback={
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl shadow-black/5 p-8">
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </div>
          </motion.div>
        }
      >
        <PortalLoginForm />
      </Suspense>
    </div>
  );
}

function PortalLoginForm() {
  const searchParams = useSearchParams();
  const organization = useOrganization();
  const theme = usePortalTheme();
  const { data: session, isPending: isSessionLoading } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
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

      // Handle callbackUrl for redirects (decode in case of double-encoding from email verification)
      let callbackUrl = searchParams.get("callbackUrl");
      if (callbackUrl) {
        try {
          if (callbackUrl.startsWith("%2F") || callbackUrl.startsWith("%2f")) {
            callbackUrl = decodeURIComponent(callbackUrl);
          }
        } catch { /* ignore decode errors */ }
        if (
          callbackUrl.startsWith("/jury-invite/") ||
          callbackUrl.startsWith("/jury/") ||
          callbackUrl.startsWith("/activate")
        ) {
          redirectPath = callbackUrl;
        }
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

    if (registered === "true" || logout === "true") {
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

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("registered");
      url.searchParams.delete("logout");
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

          // Handle email not verified
          if (
            errorCode === "EMAIL_NOT_VERIFIED" ||
            errorCodeUpper.includes("NOT_VERIFIED") ||
            errorMessage.includes("verify") ||
            errorMessage.includes("verified")
          ) {
            toast.warning(
              "Veuillez vérifier votre email avant de vous connecter."
            );
            return;
          }

          // Handle rate limiting
          if (
            errorCode === "RATE_LIMIT_EXCEEDED" ||
            errorCode === "TOO_MANY_REQUESTS" ||
            errorCodeUpper.includes("RATE") ||
            errorCodeUpper.includes("LIMIT") ||
            errorMessage.includes("too many")
          ) {
            toast.error("Trop de tentatives. Veuillez réessayer plus tard.");
            return;
          }

          // Handle invalid credentials
          toast.error("Email ou mot de passe incorrect");
          return;
        }

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

        // Handle callbackUrl for redirects (decode in case of double-encoding from email verification)
        let callbackUrl = searchParams.get("callbackUrl");
        if (callbackUrl) {
          try {
            if (callbackUrl.startsWith("%2F") || callbackUrl.startsWith("%2f")) {
              callbackUrl = decodeURIComponent(callbackUrl);
            }
          } catch { /* ignore decode errors */ }
          if (
            callbackUrl.startsWith("/jury-invite/") ||
            callbackUrl.startsWith("/jury/") ||
            callbackUrl.startsWith("/activate")
          ) {
            redirectPath = callbackUrl;
          }
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

  // Show loading state
  if (!isSessionDetermined || isLoggingIn || loginSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl shadow-black/5 p-8">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-8 w-8 text-primary" />
            </motion.div>
            <p className="text-sm text-muted-foreground">
              {loginSuccess ? "Redirection en cours..." : "Chargement..."}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Don't render form if already logged in (will redirect via useEffect)
  if (session?.user) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl shadow-black/5 p-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </motion.div>
    );
  }

  const logoUrl = theme.logoUrl || organization.logo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md relative z-10"
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Bienvenue
            </h1>
            <p className="text-muted-foreground mt-2">
              Connectez-vous à votre espace {organization.name}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
            aria-busy={isSubmitting}
          >
            {/* Email Field */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className={cn(
                  "text-sm font-medium transition-colors duration-200",
                  focusedField === "email" && "text-primary"
                )}
              >
                Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-required="true"
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={cn(
                    "h-12 px-4 bg-background/50 border-border/50 rounded-xl transition-all duration-200",
                    "focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
                    errors.email && "border-destructive focus:border-destructive focus:ring-destructive/20"
                  )}
                  {...register("email")}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className={cn(
                    "text-sm font-medium transition-colors duration-200",
                    focusedField === "password" && "text-primary"
                  )}
                >
                  Mot de passe
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-required="true"
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={cn(
                    "h-12 px-4 pr-12 bg-background/50 border-border/50 rounded-xl transition-all duration-200",
                    "focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
                    errors.password && "border-destructive focus:border-destructive focus:ring-destructive/20"
                  )}
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
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-medium relative overflow-hidden group"
                disabled={isSubmitting}
                style={{
                  backgroundColor: theme.primaryColor,
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    <>
                      Se connecter
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
              Pas encore de compte ?{" "}
              <Link
                href={
                  searchParams.get("callbackUrl")?.startsWith("/jury-invite/")
                    ? searchParams.get("callbackUrl")!
                    : "/register"
                }
                className="font-medium transition-colors hover:underline"
                style={{ color: theme.primaryColor }}
              >
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </div>

    </motion.div>
  );
}
