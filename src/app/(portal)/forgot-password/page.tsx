"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { forgetPassword } from "~/lib/auth-client";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "~/lib/validations/auth";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";
import { cn } from "~/lib/utils";

/**
 * Where Better Auth sends the user once it has validated the reset token.
 * The `/api/auth/reset-password/:token` callback redirects here with
 * `?token=…` on success, or `?error=INVALID_TOKEN` when it has expired.
 */
const RESET_REDIRECT_PATH = "/reset-password";

export default function ForgotPasswordPage() {
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

      <ForgotPasswordForm />
    </div>
  );
}

function ForgotPasswordForm() {
  const organization = useOrganization();
  const theme = usePortalTheme();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = useCallback(async (data: ForgotPasswordInput) => {
    try {
      const result = await forgetPassword({
        email: data.email,
        redirectTo: RESET_REDIRECT_PATH,
      });

      if (result.error) {
        const code = (result.error.code ?? "").toUpperCase();
        if (code.includes("RATE") || code.includes("LIMIT")) {
          toast.error("Trop de demandes. Veuillez réessayer dans quelques minutes.");
          return;
        }
        toast.error("Impossible d'envoyer l'email. Veuillez réessayer.");
        return;
      }

      // Better Auth answers identically whether or not the account exists,
      // so the confirmation screen must stay generic too.
      setSubmittedEmail(data.email);
    } catch {
      toast.error("Erreur réseau. Vérifiez votre connexion internet.");
    }
  }, []);

  const logoUrl = theme.logoUrl || organization.logo;

  const inputClass = cn(
    "h-12 px-4 bg-background/50 border-border/50 rounded-xl transition-all duration-200",
    "focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md relative z-10"
    >
      <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl shadow-black/5 overflow-hidden">
        {/* Accent line at top */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.primaryColor}, transparent)`,
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
                  <div
                    className="absolute inset-0 blur-2xl opacity-20 -z-10"
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                </div>
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Mot de passe oublié
            </h1>
            <p className="text-muted-foreground mt-2">
              {submittedEmail
                ? "Vérifiez votre boîte mail"
                : "Recevez un lien pour choisir un nouveau mot de passe"}
            </p>
          </div>

          {submittedEmail ? (
            <div className="space-y-6">
              <div
                className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/50 p-4"
                role="status"
                aria-live="polite"
              >
                <MailCheck
                  className="h-5 w-5 shrink-0 mt-0.5"
                  style={{ color: theme.primaryColor }}
                />
                <div className="space-y-1">
                  <p className="text-sm">
                    Si un compte existe pour{" "}
                    <strong className="font-medium">{submittedEmail}</strong>, un
                    lien de réinitialisation vient d&apos;être envoyé.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Le lien expire dans 1 heure. Pensez à regarder vos spams.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl"
                onClick={() => {
                  void onSubmit({ email: getValues("email") });
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Renvoyer l'email"
                )}
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
              noValidate
              aria-busy={isSubmitting}
            >
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
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!errors.email}
                  aria-required="true"
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={cn(
                    inputClass,
                    errors.email &&
                      "border-destructive focus:border-destructive focus:ring-destructive/20"
                  )}
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
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        Envoyer le lien
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
          )}

          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
