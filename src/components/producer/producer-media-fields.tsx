"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useServerError } from "~/i18n/server-error";

import { Checkbox } from "~/components/ui/checkbox";
import { ImageUpload } from "~/components/ui/image-upload";
import { api } from "~/trpc/react";

export interface ProducerMedia {
  logo: string | null;
  teamPhoto: string | null;
  mediaConsentAt: Date | null;
}

/**
 * Logo et photo du producteur (ou de son équipe), repris sur les réseaux
 * sociaux de la cup pour annoncer sa participation.
 *
 * Le producteur doit savoir à quoi serviront ses visuels avant de les
 * envoyer : l'usage est expliqué en tête, et les dépôts restent fermés tant
 * que la case de consentement n'est pas cochée (le serveur refuse aussi).
 */
export function ProducerMediaFields({ media }: { media: ProducerMedia | null | undefined }) {
  const t = useTranslations("producerComponents.media");
  const serverError = useServerError();
  const utils = api.useUtils();
  const consented = !!media?.mediaConsentAt;

  const setConsent = api.producer.setMediaConsent.useMutation({
    onSuccess: (_data, { consent }) => {
      void utils.producer.getProfile.invalidate();
      toast.success(consent ? t("consentSaved") : t("consentRemoved"));
    },
    onError: (error) => toast.error(serverError(error)),
  });

  const updateMedia = api.producer.updateMedia.useMutation({
    onSuccess: (_data, { field, url }) => {
      void utils.producer.getProfile.invalidate();
      if (field === "logo") toast.success(url ? t("logoSaved") : t("logoRemoved"));
      else toast.success(url ? t("photoSaved") : t("photoRemoved"));
    },
    onError: (error) => toast.error(serverError(error)),
  });

  return (
    <div className="space-y-5">
      {/* Usage des visuels, à lire avant tout dépôt */}
      <div
        className="text-sm space-y-2"
        style={{
          background: "var(--n-surface-raised)",
          border: "1px solid var(--n-border-visible)",
          borderRadius: "8px",
          padding: "12px 14px",
          color: "var(--n-text-secondary)",
        }}
      >
        <p style={{ color: "var(--n-text-primary)", fontWeight: 500 }}>
          {t("usageTitle")}
        </p>
        <p>{t.rich("usage1", { b: (chunks) => <strong>{chunks}</strong> })}</p>
        <p>{t("usage2")}</p>
        <p>{t("usage3")}</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={consented}
          disabled={setConsent.isPending}
          onCheckedChange={(checked) => setConsent.mutate({ consent: checked === true })}
          aria-label={t("consentAria")}
          className="mt-0.5"
        />
        <span className="text-sm" style={{ color: "var(--n-text-primary)" }}>
          {t("consent")}
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            {t("logo")}
          </div>
          <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            {t("logoHint")}
          </p>
          <ImageUpload
            value={media?.logo ?? ""}
            onChange={(url) => updateMedia.mutate({ field: "logo", url })}
            folder="producer-logos"
            placeholder={consented ? t("logoDrop") : t("checkFirst")}
            aspectRatio="auto"
            objectFit="contain"
            maxSize={2}
            disabled={!consented || updateMedia.isPending}
          />
        </div>

        <div className="space-y-2">
          <div className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            {t("photo")}
          </div>
          <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            {t("photoHint")}
          </p>
          <ImageUpload
            value={media?.teamPhoto ?? ""}
            onChange={(url) => updateMedia.mutate({ field: "teamPhoto", url })}
            folder="producer-photos"
            placeholder={consented ? t("photoDrop") : t("checkFirst")}
            aspectRatio="auto"
            objectFit="contain"
            maxSize={8}
            disabled={!consented || updateMedia.isPending}
          />
        </div>
      </div>
    </div>
  );
}
