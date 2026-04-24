"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { ImageUpload } from "~/components/ui/image-upload";
import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";
import {
  producerProfileUpdateSchema,
  type ProducerProfileUpdateInput,
} from "~/lib/validations/producer";
export default function ProducerProfilePage() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: profile, isLoading } = api.producer.getProfile.useQuery();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  const updateProfile = api.producer.updateProfile.useMutation({
    onSuccess: () => {
      void utils.producer.getProfile.invalidate();
      toast.success("Profil mis a jour avec succes");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise a jour");
    },
  });

  const updateNotificationPreferences =
    api.producer.updateNotificationPreferences.useMutation({
      onSuccess: () => {
        void utils.producer.getProfile.invalidate();
        toast.success("Preferences de notification mises a jour");
      },
      onError: (error) => {
        toast.error(error.message || "Erreur lors de la mise a jour");
      },
    });

  const updateLogo = api.producer.updateLogo.useMutation({
    onSuccess: () => {
      void utils.producer.getProfile.invalidate();
      toast.success("Logo mis a jour avec succes");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise a jour du logo");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProducerProfileUpdateInput>({
    resolver: zodResolver(producerProfileUpdateSchema),
    defaultValues: {
      companyName: "",
      brandName: "",
      siret: "",
      website: "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        companyName: profile.companyName,
        brandName: profile.brandName,
        siret: profile.siret ?? "",
        website: profile.website ?? "",
      });
    }
  }, [profile, reset]);

  const onSubmit = (data: ProducerProfileUpdateInput) => {
    updateProfile.mutate(data);
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        style={{ color: "var(--n-text-disabled)" }}
      >
        <span className="n-font-data text-sm tracking-widest">[LOADING...]</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
          PRODUCTEUR
        </div>
        <h1 className="n-font-data text-2xl font-bold" style={{ color: "var(--n-text-display)" }}>
          MON PROFIL
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--n-text-secondary)" }}>
          Gerez les informations de votre entreprise
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Company Info — 2/3 */}
        <div className="lg:col-span-2">
          <div className="n-card">
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              INFORMATIONS ENTREPRISE
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--n-text-secondary)" }}>
              Ces informations seront affichees sur vos inscriptions
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Company Name */}
                <div className="space-y-2">
                  <label
                    htmlFor="companyName"
                    className="n-label block"
                    style={{ color: "var(--n-text-secondary)" }}
                  >
                    NOM DE L&apos;ENTREPRISE *
                  </label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Ma Societe SARL"
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
                    <p
                      className="n-font-data text-xs"
                      style={{ color: "var(--n-accent)" }}
                    >
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
                    NOM DE LA MARQUE *
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
                    <p
                      className="n-font-data text-xs"
                      style={{ color: "var(--n-accent)" }}
                    >
                      {errors.brandName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {/* SIRET */}
                <div className="space-y-2">
                  <label
                    htmlFor="siret"
                    className="n-label block"
                    style={{ color: "var(--n-text-secondary)" }}
                  >
                    SIRET (OPTIONNEL)
                  </label>
                  <Input
                    id="siret"
                    type="text"
                    placeholder="12345678901234"
                    maxLength={14}
                    className="n-font-data"
                    aria-invalid={!!errors.siret}
                    {...register("siret")}
                    style={{
                      backgroundColor: "var(--n-surface-raised)",
                      borderColor: errors.siret
                        ? "var(--n-accent)"
                        : "var(--n-border-visible)",
                      color: "var(--n-text-primary)",
                    }}
                  />
                  {errors.siret ? (
                    <p
                      className="n-font-data text-xs"
                      style={{ color: "var(--n-accent)" }}
                    >
                      {errors.siret.message}
                    </p>
                  ) : (
                    <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                      14 CHIFFRES (ENTREPRISES FRANCAISES)
                    </p>
                  )}
                </div>

                {/* Website */}
                <div className="space-y-2">
                  <label
                    htmlFor="website"
                    className="n-label block"
                    style={{ color: "var(--n-text-secondary)" }}
                  >
                    SITE WEB (OPTIONNEL)
                  </label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://www.exemple.com"
                    className="n-font-data"
                    aria-invalid={!!errors.website}
                    {...register("website")}
                    style={{
                      backgroundColor: "var(--n-surface-raised)",
                      borderColor: errors.website
                        ? "var(--n-accent)"
                        : "var(--n-border-visible)",
                      color: "var(--n-text-primary)",
                    }}
                  />
                  {errors.website && (
                    <p
                      className="n-font-data text-xs"
                      style={{ color: "var(--n-accent)" }}
                    >
                      {errors.website.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="n-btn-primary"
                  disabled={!isDirty || updateProfile.isPending}
                >
                  {updateProfile.isPending ? "[ENREGISTREMENT...]" : "ENREGISTRER"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-6">
          {/* Logo */}
          <div className="n-card">
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              LOGO ENTREPRISE
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--n-text-secondary)" }}>
              Format carre, 400x400px minimum
            </p>
            <ImageUpload
              value={profile?.logo ?? ""}
              onChange={(url) => updateLogo.mutate({ logo: url })}
              folder="producer-logos"
              placeholder="Glissez votre logo ici"
              aspectRatio="auto"
              objectFit="contain"
              maxSize={2}
              disabled={updateLogo.isPending}
            />
          </div>

          {/* Notifications */}
          <div className="n-card">
            <div className="n-label mb-4" style={{ color: "var(--n-text-disabled)" }}>
              NOTIFICATIONS
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-sm font-medium mb-0.5"
                  style={{ color: "var(--n-text-primary)" }}
                >
                  Statut des produits
                </p>
                <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                  EMAIL LORS DES CHANGEMENTS DE STATUT
                </p>
              </div>
              <Switch
                id="notify-product-status"
                checked={profile?.notifyOnProductStatusChange ?? true}
                disabled={updateNotificationPreferences.isPending}
                onCheckedChange={(checked) => {
                  updateNotificationPreferences.mutate({
                    notifyOnProductStatusChange: checked,
                  });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="n-card">
        <div className="n-label mb-4" style={{ color: "var(--n-text-disabled)" }}>
          INFORMATIONS DU COMPTE
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              EMAIL
            </div>
            <p className="n-font-data text-sm" style={{ color: "var(--n-text-primary)" }}>
              {profile?.email ?? "-"}
            </p>
          </div>
          <div>
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              NOM
            </div>
            <p className="n-font-data text-sm" style={{ color: "var(--n-text-primary)" }}>
              {profile?.name ?? "-"}
            </p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div
        className="n-card"
        style={{ borderColor: "var(--n-accent)", borderWidth: "1px" }}
      >
        <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
          COMPTE
        </div>
        <h3
          className="text-sm font-medium mb-1"
          style={{ color: "var(--n-text-primary)" }}
        >
          Deconnexion
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--n-text-secondary)" }}>
          Se deconnecter de votre compte
        </p>
        <button className="n-btn-destructive" onClick={handleLogout}>
          SE DECONNECTER
        </button>
      </div>
    </div>
  );
}
