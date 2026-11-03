"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "~/i18n/navigation";
import { useServerError } from "~/i18n/server-error";
import { translateValidation } from "~/i18n/validation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { ProducerMediaFields } from "~/components/producer/producer-media-fields";
import { api } from "~/trpc/react";
import { GdprSettings } from "~/components/profile/gdpr-settings";
import { authClient } from "~/lib/auth-client";
import {
  formatPhone,
  producerProfileUpdateSchema,
  type ProducerProfileUpdateInput,
} from "~/lib/validations/producer";
export default function ProducerProfilePage() {
  const t = useTranslations("producerProfile");
  const tc = useTranslations("producerSpace");
  const tv = useTranslations("validation");
  const serverError = useServerError();
  const router = useRouter();
  const utils = api.useUtils();
  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = api.producer.getProfile.useQuery();

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
      toast.success(t("updated"));
    },
    onError: (error) => {
      toast.error(serverError(error, t("updateError")));
    },
  });

  const updateNotificationPreferences =
    api.producer.updateNotificationPreferences.useMutation({
      onSuccess: () => {
        void utils.producer.getProfile.invalidate();
        toast.success(t("notificationsUpdated"));
      },
      onError: (error) => {
        toast.error(serverError(error, t("updateError")));
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
      phone: "",
      siret: "",
      website: "",
      instagram: "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        companyName: profile.companyName,
        brandName: profile.brandName,
        phone: formatPhone(profile.phone),
        siret: profile.siret ?? "",
        website: profile.website ?? "",
        instagram: profile.instagram ? `@${profile.instagram}` : "",
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
        <span className="n-font-data text-sm tracking-widest">{tc("loading")}</span>
      </div>
    );
  }

  // Une requête en échec ne doit pas se confondre avec une liste vide :
  // « vous n'avez rien » est plausible et masquerait l'incident.
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <span role="alert" className="n-font-data text-sm tracking-widest" style={{ color: "var(--n-text-secondary)" }}>
          {t("error")}
        </span>
        <button type="button" className="n-btn-secondary text-xs" onClick={() => void refetch()}>
          {tc("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
          {t("eyebrow")}
        </div>
        <h1 className="n-font-data text-2xl font-bold" style={{ color: "var(--n-text-display)" }}>
          {t("title")}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--n-text-secondary)" }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Company Info — 2/3 */}
        <div className="lg:col-span-2">
          <div className="n-card">
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              {t("companyInfo")}
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--n-text-secondary)" }}>
              {t("companyInfoText")}
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
                    {t("required", { label: t("companyName") })}
                  </label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder={t("companyPlaceholder")}
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
                      {translateValidation(errors.companyName.message, tv)}
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
                    {t("required", { label: t("brandName") })}
                  </label>
                  <Input
                    id="brandName"
                    type="text"
                    placeholder={t("brandPlaceholder")}
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
                      {translateValidation(errors.brandName.message, tv)}
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
                    {t("siret")}
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
                      {translateValidation(errors.siret.message, tv)}
                    </p>
                  ) : (
                    <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                      {t("siretHint")}
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
                    {t("required", { label: t("phone") })}
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder={t("phonePlaceholder")}
                    className="n-font-data"
                    aria-invalid={!!errors.phone}
                    {...register("phone")}
                    style={{
                      backgroundColor: "var(--n-surface-raised)",
                      borderColor: errors.phone
                        ? "var(--n-accent)"
                        : "var(--n-border-visible)",
                      color: "var(--n-text-primary)",
                    }}
                  />
                  {errors.phone ? (
                    <p
                      className="n-font-data text-xs"
                      style={{ color: "var(--n-accent)" }}
                    >
                      {translateValidation(errors.phone.message, tv)}
                    </p>
                  ) : (
                    <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                      {t("phoneHintUpper")}
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
                    {t("website")}
                  </label>
                  <Input
                    id="website"
                    type="url"
                    placeholder={t("websitePlaceholder")}
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
                      {translateValidation(errors.website.message, tv)}
                    </p>
                  )}
                </div>

                {/* Instagram */}
                <div className="space-y-2">
                  <label
                    htmlFor="instagram"
                    className="n-label block"
                    style={{ color: "var(--n-text-secondary)" }}
                  >
                    {t("instagram")}
                  </label>
                  <Input
                    id="instagram"
                    type="text"
                    autoComplete="off"
                    placeholder={t("instagramPlaceholder")}
                    className="n-font-data"
                    aria-invalid={!!errors.instagram}
                    aria-describedby="instagram-hint"
                    {...register("instagram")}
                    style={{
                      backgroundColor: "var(--n-surface-raised)",
                      borderColor: errors.instagram
                        ? "var(--n-accent)"
                        : "var(--n-border-visible)",
                      color: "var(--n-text-primary)",
                    }}
                  />
                  {errors.instagram ? (
                    <p
                      className="n-font-data text-xs"
                      style={{ color: "var(--n-accent)" }}
                    >
                      {translateValidation(errors.instagram.message, tv)}
                    </p>
                  ) : (
                    <p id="instagram-hint" className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                      {t("instagramHint")}
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
                  {updateProfile.isPending ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </div>

          {/* Visuels repris sur les réseaux sociaux */}
          <div className="n-card mt-6">
            <div className="n-label mb-4" style={{ color: "var(--n-text-disabled)" }}>
              {t("socialVisuals")}
            </div>
            <ProducerMediaFields media={profile} />
          </div>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-6">
          {/* Notifications */}
          <div className="n-card">
            <div className="n-label mb-4" style={{ color: "var(--n-text-disabled)" }}>
              {t("notifications")}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-sm font-medium mb-0.5"
                  style={{ color: "var(--n-text-primary)" }}
                >
                  {t("productStatus")}
                </p>
                <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                  {t("productStatusHint")}
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
          {t("account")}
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              {t("email")}
            </div>
            <p className="n-font-data text-sm" style={{ color: "var(--n-text-primary)" }}>
              {profile?.email ?? "-"}
            </p>
          </div>
          <div>
            <div className="n-label mb-1" style={{ color: "var(--n-text-disabled)" }}>
              {t("name")}
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
          {t("accountShort")}
        </div>
        <h3
          className="text-sm font-medium mb-1"
          style={{ color: "var(--n-text-primary)" }}
        >
          {t("logoutTitle")}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--n-text-secondary)" }}>
          {t("logoutText")}
        </p>
        <button className="n-btn-destructive" onClick={handleLogout}>
          {t("logout")}
        </button>
      </div>

      {/*
        Export des données et suppression du compte (RGPD).
        Ce bloc n'était monté que dans l'espace organisateur : un producteur
        n'avait aucun moyen d'exercer son droit à l'effacement depuis
        l'interface, alors que les procédures serveur l'autorisent (elles sont
        `protected`, pas `organizer`). Pour une association qui collecte des
        données d'entreprise, ce n'était pas une option.
      */}
      <GdprSettings />
    </div>
  );
}
