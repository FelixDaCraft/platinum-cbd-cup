"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

const profileSchema = z.object({
  name: z.string().min(2, "Le nom doit faire au moins 2 caractères"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = api.useUtils();

  const { data: profile, isLoading } = api.profile.getProfile.useQuery();

  const updateProfile = api.profile.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profil mis à jour avec succès");
      void utils.profile.getProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      name: profile?.user.name ?? "",
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    setIsSubmitting(true);
    updateProfile.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-16 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Votre nom"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sauvegarder
      </Button>
    </form>
  );
}
