"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, QrCode, KeyRound, LogIn, ArrowRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { InvitationCodeInput, type ValidCodeData } from "~/components/features/jury/invitation-code-input";
import { usePortal } from "~/lib/portal/context";
import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";

interface JurySpaceModalProps {
  children: React.ReactNode;
}

/**
 * Modal for jury access on the public portal
 * Handles: code entry, login redirect, registration flow
 */
export function JurySpaceModal({ children }: JurySpaceModalProps) {
  const router = useRouter();
  const { locale } = usePortal();
  const [open, setOpen] = useState(false);
  const [validatedCode, setValidatedCode] = useState<ValidCodeData | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Check if user is logged in
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  // Activate code mutation
  const activateMutation = api.juryCodes.activate.useMutation({
    onSuccess: (data) => {
      // Redirect to jury dashboard
      router.push(`/jury`);
      setOpen(false);
    },
    onError: (error) => {
      setActivationError(error.message ?? "Erreur lors de l'activation");
      setIsActivating(false);
    },
  });

  // Handle valid code received
  const handleValidCode = (data: ValidCodeData) => {
    setValidatedCode(data);
    setActivationError(null);
  };

  // Handle continue action (after code validation)
  const handleContinue = async () => {
    if (!validatedCode) return;

    if (isLoggedIn) {
      // User is logged in - activate code directly
      setIsActivating(true);
      activateMutation.mutate({ code: validatedCode.code });
    } else {
      // User not logged in - redirect to jury register page with code
      const registerUrl = `/register/jury?code=${validatedCode.code}&cup=${validatedCode.cup.id}`;
      router.push(registerUrl);
      setOpen(false);
    }
  };

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setValidatedCode(null);
      setActivationError(null);
    }
  };

  // Labels based on locale
  const labels = locale === "en" ? {
    title: "Jury Space",
    description: "Enter your invitation code to access your jury dashboard",
    qrHint: "Scanned a QR code? You should already be on the right page!",
    codeLabel: "I have an invitation code",
    alreadyRegistered: "Already registered?",
    login: "Log in",
    continue: "Continue",
    createAccount: "Create account & join",
    activating: "Joining...",
  } : {
    title: "Espace Jury",
    description: "Entrez votre code d'invitation pour accéder à votre espace jury",
    qrHint: "Vous avez scanné un QR code ? Vous devriez déjà être sur la bonne page !",
    codeLabel: "J'ai un code d'invitation",
    alreadyRegistered: "Déjà inscrit ?",
    login: "Se connecter",
    continue: "Continuer",
    createAccount: "Créer un compte & rejoindre",
    activating: "Inscription en cours...",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            {labels.title}
          </DialogTitle>
          <DialogDescription>
            {labels.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* QR Code hint */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
            <QrCode className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {labels.qrHint}
            </p>
          </div>

          {/* Invitation code section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{labels.codeLabel}</span>
            </div>

            <InvitationCodeInput
              onValidCode={handleValidCode}
              autoFocus
              disabled={isActivating}
            />

            {/* Activation error */}
            {activationError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive text-center"
              >
                {activationError}
              </motion.p>
            )}

            {/* Continue button (appears after valid code) */}
            <AnimatePresence>
              {validatedCode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Button
                    onClick={handleContinue}
                    disabled={isActivating}
                    className="w-full"
                    size="lg"
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {labels.activating}
                      </>
                    ) : isLoggedIn ? (
                      <>
                        {labels.continue}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        {labels.createAccount}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Already registered section */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {labels.alreadyRegistered}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                router.push("/login");
                setOpen(false);
              }}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {labels.login}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
