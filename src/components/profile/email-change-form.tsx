"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";

const emailSchema = z.object({
  newEmail: z.string().email("Email invalide"),
});

type EmailFormData = z.infer<typeof emailSchema>;

export function EmailChangeForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: profile, isLoading } = api.profile.getProfile.useQuery();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const onSubmit = async (data: EmailFormData) => {
    if (data.newEmail === profile?.user.email) {
      toast.error("Le nouvel email doit être différent de l'actuel");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authClient.changeEmail({
        newEmail: data.newEmail,
        callbackURL: "/settings",
      });

      if (result.error) {
        toast.error(result.error.message || "Erreur lors du changement d'email");
      } else {
        toast.info(
          `Un email de confirmation a été envoyé à ${data.newEmail}. Vérifiez votre boîte de réception.`
        );
        reset();
      }
    } catch (error) {
      toast.error("Erreur lors du changement d'email");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4" />
        <span>Email actuel: {profile?.user.email}</span>
        {profile?.user.emailVerified && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            Vérifié
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newEmail">Nouvel email</Label>
          <Input
            id="newEmail"
            type="email"
            {...register("newEmail")}
            placeholder="nouveau@email.com"
            disabled={isSubmitting}
          />
          {errors.newEmail && (
            <p className="text-sm text-red-500">{errors.newEmail.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Un email de confirmation sera envoyé à la nouvelle adresse. Le
            changement ne sera effectif qu&apos;après confirmation.
          </p>
        </div>

        <Button type="submit" variant="outline" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Changer l&apos;email
        </Button>
      </form>
    </div>
  );
}
