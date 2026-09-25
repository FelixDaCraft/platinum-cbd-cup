"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { changePassword } from "~/lib/auth-client";
import { PASSWORD_CRITERIA, passwordSchema } from "~/lib/validations/auth";
import { cn } from "~/lib/utils";

/**
 * Les règles (12 caractères, majuscule, chiffre, caractère spécial) sont
 * appliquées côté serveur : ce schéma ne fait que les rejouer à la saisie,
 * pour éviter un aller-retour réseau qui revient en erreur générique.
 */
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Entrez votre mot de passe actuel"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmez le nouveau mot de passe"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel",
    path: ["newPassword"],
  });

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Changement de mot de passe depuis l'espace compte.
 *
 * L'écran manquait : la seule façon de changer son mot de passe était de
 * demander un lien de réinitialisation par email, donc de passer par sa
 * boîte mail — et, pour un organisateur qui soupçonne une fuite, d'attendre
 * la réception du lien pendant que la session compromise reste ouverte.
 *
 * Le champ « mot de passe actuel » n'est pas une formalité : sans lui, un
 * navigateur laissé ouvert suffirait à verrouiller le compte de son
 * propriétaire.
 */
export function PasswordChangeForm() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const newPasswordValue = watch("newPassword") ?? "";

  const onSubmit = async (data: ChangePasswordInput) => {
    try {
      const result = await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        // Un mot de passe que l'on change parce qu'il a fuité doit fermer
        // les sessions ouvertes ailleurs, sinon l'intrus garde son accès :
        // le cookie déjà émis resterait valable jusqu'à son expiration.
        revokeOtherSessions: true,
      });

      if (result.error) {
        const status = result.error.status ?? 0;
        const message = (result.error.message ?? "").toLowerCase();

        // Better Auth 1.4.22 ne renvoie PAS de champ `code` sur cette route :
        // `changePassword` lève `APIError("BAD_REQUEST", { message:
        // BASE_ERROR_CODES.INVALID_PASSWORD })`, que better-call sérialise
        // verbatim en `{"message":"Invalid password"}` avec un statut 400.
        // Se fier à `error.code` ne déclenchait donc jamais cette branche, et
        // le 401 qu'elle testait signifie tout autre chose (voir plus bas).
        // Le mot de passe actuel est faux : l'erreur appartient au champ, pas
        // à un bandeau qui disparaît au premier défilement.
        if (status === 400 && message.includes("invalid password")) {
          setError("currentPassword", {
            message: "Mot de passe actuel incorrect",
          });
          return;
        }

        // 401 vient de `sensitiveSessionMiddleware`, qui lève UNAUTHORIZED sans
        // corps quand la session n'est plus assez fraîche pour une opération
        // sensible. Rien à voir avec le mot de passe saisi.
        if (status === 401) {
          toast.error(
            "Votre session a expiré. Reconnectez-vous, puis changez votre mot de passe."
          );
          return;
        }

        if (status === 429) {
          toast.error("Trop de tentatives. Réessayez dans quelques minutes.");
          return;
        }

        // Ne jamais afficher `result.error.message` : Better Auth renvoie des
        // libellés techniques en anglais.
        console.error("[PasswordChange] Échec du changement", result.error);
        toast.error("Impossible de changer le mot de passe. Réessayez.");
        return;
      }

      reset();
      toast.success(
        "Mot de passe mis à jour. Vos autres sessions ont été déconnectées."
      );
    } catch {
      toast.error("Erreur réseau. Vérifiez votre connexion internet.");
    }
  };

  const toggleClass =
    "absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Mot de passe actuel</Label>
        <div className="relative">
          <Input
            id="currentPassword"
            type={showCurrent ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={!!errors.currentPassword}
            aria-describedby={
              errors.currentPassword ? "current-password-error" : undefined
            }
            className="pr-10"
            disabled={isSubmitting}
            {...register("currentPassword")}
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className={toggleClass}
            aria-label={
              showCurrent ? "Masquer le mot de passe" : "Afficher le mot de passe"
            }
          >
            {showCurrent ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.currentPassword && (
          <p id="current-password-error" className="text-sm text-destructive">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showNew ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword}
            aria-describedby="password-criteria new-password-error"
            className="pr-10"
            disabled={isSubmitting}
            {...register("newPassword")}
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className={toggleClass}
            aria-label={
              showNew ? "Masquer le mot de passe" : "Afficher le mot de passe"
            }
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.newPassword && (
          <p id="new-password-error" className="text-sm text-destructive">
            {errors.newPassword.message}
          </p>
        )}

        {/* Mêmes critères, au même endroit et avec le même rendu que sur
            /reset-password : un utilisateur qui a déjà choisi un mot de passe
            via le lien de réinitialisation retrouve la liste qu'il connaît.
            `aria-live` la fait relire à chaque critère satisfait, sinon un
            lecteur d'écran ne perçoit rien du tout de cette validation. */}
        <div
          id="password-criteria"
          className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5"
          aria-live="polite"
          aria-atomic="true"
        >
          {PASSWORD_CRITERIA.map((criterion) => {
            const isValid = criterion.regex.test(newPasswordValue);
            return (
              <div
                key={criterion.label}
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors duration-200",
                  isValid ? "text-green-600" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full",
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

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={
            errors.confirmPassword ? "confirm-password-error" : undefined
          }
          disabled={isSubmitting}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="confirm-password-error" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Par sécurité, le changement déconnecte toutes vos autres sessions —
        les appareils encore connectés devront se reconnecter.
      </p>

      <Button type="submit" variant="outline" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Changer le mot de passe
      </Button>
    </form>
  );
}
