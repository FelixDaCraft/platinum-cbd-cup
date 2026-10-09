"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { Input } from "~/components/ui/input";
import { useSession } from "~/lib/auth-client";
import { api } from "~/trpc/react";

const completeProfileSchema = z.object({
  companyName: z
    .string()
    .min(1, "Le nom de l'entreprise est requis")
    .max(100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères"),
  brandName: z
    .string()
    .min(1, "Le nom de la marque est requis")
    .max(100, "Le nom de la marque ne peut pas dépasser 100 caractères"),
});

type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

export default function CompleteProfilePage() {
  const router = useRouter();
  const [pendingProfile, setPendingProfile] = useState<{
    companyName: string;
    brandName: string;
  } | null>(null);

  const utils = api.useUtils();
  const createProfile = api.producer.createProfile.useMutation({
    onSuccess: () => {
      void utils.producer.hasProfile.invalidate();
      toast.success("Profil producteur créé !");
      router.push("/producer/dashboard");
    },
    onError: (error) => {
      if (error.message.includes("existe deja")) {
        toast.error("Vous avez déjà un profil producteur");
        router.push("/producer/dashboard");
        return;
      }
      if (error.message.includes("organisateur")) {
        toast.error("Les organisateurs ne peuvent pas creer de profil producteur");
        router.push("/cups");
        return;
      }
      toast.error(error.message || "Erreur lors de la création du profil");
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      companyName: "",
      brandName: "",
    },
  });

  // Pré-remplissage : entreprise et marque saisies à l'inscription, gardées
  // sur le compte (pendingCompanyName / pendingBrandName) jusqu'à la création
  // du profil — donc retrouvées même si le lien de confirmation a été ouvert
  // sur un autre appareil. Rien de saisi : le formulaire part vide.
  const { data: session } = useSession();
  useEffect(() => {
    const user = session?.user;
    if (!user) return;
    const companyName = user.pendingCompanyName?.trim() ?? "";
    const brandName = user.pendingBrandName?.trim() ?? "";
    if (!companyName && !brandName) return;
    setPendingProfile({ companyName, brandName });
    if (companyName) setValue("companyName", companyName);
    if (brandName) setValue("brandName", brandName);
  }, [session?.user, setValue]);

  const onSubmit = (data: CompleteProfileInput) => {
    createProfile.mutate(data);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md n-card">
        {/* Header */}
        <div className="mb-6">
          <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
            PRODUCTEUR
          </div>
          <h1
            className="n-font-data text-xl font-bold"
            style={{ color: "var(--n-text-display)" }}
          >
            COMPLÉTEZ VOTRE PROFIL
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--n-text-secondary)" }}>
            {pendingProfile
              ? "Vérifiez et confirmez les informations saisies à l'inscription"
              : "Renseignez les informations de votre entreprise pour finaliser votre inscription"}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Company Name */}
          <div className="space-y-2">
            <label
              htmlFor="companyName"
              className="n-label block"
              style={{ color: "var(--n-text-secondary)" }}
            >
              NOM DE L&apos;ENTREPRISE
            </label>
            <Input
              id="companyName"
              type="text"
              placeholder="Ma Société SARL"
              className="n-font-data"
              aria-invalid={!!errors.companyName}
              {...register("companyName")}
              style={{
                backgroundColor: "var(--n-surface-raised)",
                borderColor: errors.companyName
                  ? "var(--n-accent)"
                  : "var(--n-border-visible)",
                color: "var(--n-text-primary)",
              }}
            />
            {errors.companyName && (
              <p className="n-font-data text-xs" style={{ color: "var(--n-accent)" }}>
                {errors.companyName.message}
              </p>
            )}
          </div>

          {/* Brand Name */}
          <div className="space-y-2">
            <label
              htmlFor="brandName"
              className="n-label block"
              style={{ color: "var(--n-text-secondary)" }}
            >
              NOM DE LA MARQUE
            </label>
            <Input
              id="brandName"
              type="text"
              placeholder="Ma Marque"
              className="n-font-data"
              aria-invalid={!!errors.brandName}
              {...register("brandName")}
              style={{
                backgroundColor: "var(--n-surface-raised)",
                borderColor: errors.brandName
                  ? "var(--n-accent)"
                  : "var(--n-border-visible)",
                color: "var(--n-text-primary)",
              }}
            />
            {errors.brandName && (
              <p className="n-font-data text-xs" style={{ color: "var(--n-accent)" }}>
                {errors.brandName.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <div
            className="pt-2 border-t"
            style={{ borderColor: "var(--n-border)" }}
          >
            <button
              type="submit"
              className="n-btn-primary w-full"
              disabled={isSubmitting || createProfile.isPending}
            >
              {isSubmitting || createProfile.isPending
                ? "[CREATION EN COURS...]"
                : "FINALISER MON INSCRIPTION"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
