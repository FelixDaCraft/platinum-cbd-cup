"use client";

import { toast } from "sonner";

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
  const utils = api.useUtils();
  const consented = !!media?.mediaConsentAt;

  const setConsent = api.producer.setMediaConsent.useMutation({
    onSuccess: (_data, { consent }) => {
      void utils.producer.getProfile.invalidate();
      toast.success(consent ? "Accord enregistré" : "Accord retiré");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMedia = api.producer.updateMedia.useMutation({
    onSuccess: (_data, { field, url }) => {
      void utils.producer.getProfile.invalidate();
      const label = field === "logo" ? "Logo" : "Photo";
      toast.success(url ? `${label} enregistré${field === "logo" ? "" : "e"}` : `${label} retiré${field === "logo" ? "" : "e"}`);
    },
    onError: (error) => toast.error(error.message),
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
          À quoi serviront ces visuels ?
        </p>
        <p>
          Votre logo et votre photo seront <strong>publiés sur les réseaux sociaux de la
          Platinum CBD Cup</strong> pour annoncer votre participation à la compétition.
        </p>
        <p>
          Pour la photo, vérifiez que chaque personne visible est d&apos;accord pour
          apparaître sur nos réseaux.
        </p>
        <p>
          Vous pouvez retirer votre accord à tout moment depuis votre profil : nous
          n&apos;utiliserons plus vos visuels pour de nouvelles publications.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={consented}
          disabled={setConsent.isPending}
          onCheckedChange={(checked) => setConsent.mutate({ consent: checked === true })}
          aria-label="Accepter la publication de mes visuels"
          className="mt-0.5"
        />
        <span className="text-sm" style={{ color: "var(--n-text-primary)" }}>
          J&apos;autorise la Platinum CBD Cup à publier mon logo et ma photo sur ses
          réseaux sociaux pour communiquer sur ma participation.
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            LOGO
          </div>
          <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            Format carré, 400×400 px minimum
          </p>
          <ImageUpload
            value={media?.logo ?? ""}
            onChange={(url) => updateMedia.mutate({ field: "logo", url })}
            folder="producer-logos"
            placeholder={consented ? "Glissez votre logo ici" : "Cochez la case ci-dessus d'abord"}
            aspectRatio="auto"
            objectFit="contain"
            maxSize={2}
            disabled={!consented || updateMedia.isPending}
          />
        </div>

        <div className="space-y-2">
          <div className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            PHOTO DE VOUS OU DE VOTRE ÉQUIPE
          </div>
          <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            Bien éclairée, format paysage de préférence
          </p>
          <ImageUpload
            value={media?.teamPhoto ?? ""}
            onChange={(url) => updateMedia.mutate({ field: "teamPhoto", url })}
            folder="producer-photos"
            placeholder={consented ? "Glissez votre photo ici" : "Cochez la case ci-dessus d'abord"}
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
