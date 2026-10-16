"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Input } from "~/components/ui/input";
import { ProducerMediaFields } from "~/components/producer/producer-media-fields";
import { useSession } from "~/lib/auth-client";
import {
  producerCreateProfileSchema as completeProfileSchema,
  type ProducerCreateProfileInput as CompleteProfileInput,
} from "~/lib/validations/producer";
import { api } from "~/trpc/react";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [pendingProfile, setPendingProfile] = useState<{
    companyName: string;
    brandName: string;
  } | null>(null);

  // Deux étapes : identité et téléphone (crée le profil), puis visuels pour
  // les réseaux sociaux. Les visuels viennent après la création : le dépôt
  // d'images exige un profil producteur.
  const [step, setStep] = useState<"identity" | "media">("identity");

  const utils = api.useUtils();
  const { data: profile } = api.producer.getProfile.useQuery(undefined, {
    enabled: step === "media",
  });
  const createProfile = api.producer.createProfile.useMutation({
    onSuccess: () => {
      void utils.producer.hasProfile.invalidate();
      void utils.producer.getProfile.invalidate();
      toast.success("Profil producteur créé !");
      setStep("media");
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
      phone: "",
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

  if (step === "media") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-2xl n-card">
          <div className="mb-6">
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              PRODUCTEUR · ÉTAPE 2/2
            </div>
            <h1
              className="n-font-data text-xl font-bold"
              style={{ color: "var(--n-text-display)" }}
            >
              VOS VISUELS
            </h1>
            <p className="text-sm mt-2" style={{ color: "var(--n-text-secondary)" }}>
              Ajoutez votre logo et une photo de vous ou de votre équipe : nous les
              utiliserons pour annoncer votre participation.
            </p>
          </div>

          <ProducerMediaFields media={profile} />

          <div
            className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-5 mt-6 border-t"
            style={{ borderColor: "var(--n-border)" }}
          >
            <button
              type="button"
              className="n-btn-ghost"
              onClick={() => router.push("/producer/dashboard")}
            >
              JE LE FERAI PLUS TARD
            </button>
            <button
              type="button"
              className="n-btn-primary"
              onClick={() => router.push("/producer/dashboard")}
            >
              TERMINER
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md n-card">
        {/* Header */}
        <div className="mb-6">
          <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
            PRODUCTEUR · ÉTAPE 1/2
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

          {/* Phone */}
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="n-label block"
              style={{ color: "var(--n-text-secondary)" }}
            >
              TÉLÉPHONE
            </label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78"
              className="n-font-data"
              aria-invalid={!!errors.phone}
              {...register("phone")}
              style={{
                backgroundColor: "var(--n-surface-raised)",
                borderColor: errors.phone ? "var(--n-accent)" : "var(--n-border-visible)",
                color: "var(--n-text-primary)",
              }}
            />
            {errors.phone ? (
              <p className="n-font-data text-xs" style={{ color: "var(--n-accent)" }}>
                {errors.phone.message}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--n-text-disabled)" }}>
                Pour vous joindre au sujet de vos échantillons.
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
                : "CONTINUER"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
