"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import {
  carrierLabel,
  isCarrierMissing,
  isKnownCarrier,
  LATE_WARNING_DAYS,
  SHIPPING_CARRIERS,
  trackingUrl,
  type ParcelState,
} from "~/lib/parcel-shipment";
import { CARRIER_MAX, TRACKING_NUMBER_MAX } from "~/lib/validations/registration";

export interface RegistrationShipment {
  state: ParcelState;
  shippedAt: Date | null;
  carrier: string | null;
  trackingNumber: string | null;
}

export const parcelStateConfig: Record<
  ParcelState,
  { label: string; hint: string; color: string; bg: string }
> = {
  none: {
    label: "—",
    hint: "Pas encore expédié",
    color: "var(--n-text-disabled)",
    bg: "transparent",
  },
  shipped: {
    label: "Expédié",
    hint: "Le producteur a déclaré l'envoi de son colis",
    color: "#ffffff",
    bg: "var(--n-interactive)",
  },
  received: {
    label: "Reçu",
    hint: "Tous les échantillons de l'inscription sont reçus",
    color: "#ffffff",
    bg: "var(--n-success)",
  },
  late: {
    label: "En retard",
    hint: `Non expédié à ${LATE_WARNING_DAYS} jours de la date limite de réception, ou non reçu après`,
    color: "#ffffff",
    bg: "#ef4444",
  },
};

/** Filtre de la liste des inscrits par état du colis. */
export const parcelFilters: { value: string; label: string }[] = [
  { value: "all", label: "Tous les colis" },
  { value: "none", label: "Pas encore expédié" },
  { value: "shipped", label: "Expédié" },
  { value: "received", label: "Reçu" },
  { value: "late", label: "En retard" },
];

const badgeStyle = (state: ParcelState) => ({
  fontFamily: "'Space Mono', monospace",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: parcelStateConfig[state].color,
  background: parcelStateConfig[state].bg,
  borderRadius: "4px",
  padding: "1px 6px",
  whiteSpace: "nowrap" as const,
});

/** Transporteur et numéro, avec le lien de suivi quand il est connu. */
function TrackingLine({ shipment }: { shipment: RegistrationShipment }) {
  const carrier = carrierLabel(shipment.carrier);
  const url = trackingUrl(shipment.carrier, shipment.trackingNumber);
  if (!carrier && !shipment.trackingNumber) return null;
  return (
    <div className="n-label [overflow-wrap:anywhere]" style={{ color: "var(--n-text-secondary)", marginTop: "2px" }}>
      {carrier}
      {carrier && shipment.trackingNumber && " · "}
      {shipment.trackingNumber &&
        (url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--n-accent)" }}
            className="hover:underline"
          >
            {shipment.trackingNumber}
          </a>
        ) : (
          shipment.trackingNumber
        ))}
    </div>
  );
}

/** Cellule « Colis » de la liste des inscrits. */
export function ParcelCell({ shipment }: { shipment: RegistrationShipment }) {
  const { state, shippedAt } = shipment;
  if (state === "none") {
    return (
      <span title={parcelStateConfig.none.hint} style={{ color: "var(--n-text-disabled)" }}>
        —
      </span>
    );
  }

  const shippedLabel = shippedAt ? `Expédié le ${format(new Date(shippedAt), "dd/MM")}` : null;
  return (
    <div>
      <span title={parcelStateConfig[state].hint} style={badgeStyle(state)}>
        {state === "shipped" && shippedLabel ? shippedLabel : parcelStateConfig[state].label}
      </span>
      {/* En retard mais expédié : la date d'envoi reste utile pour relancer. */}
      {state === "late" && shippedLabel && (
        <div className="n-label" style={{ color: "var(--n-text-secondary)", marginTop: "2px" }}>
          {shippedLabel}
        </div>
      )}
      {state !== "received" && <TrackingLine shipment={shipment} />}
    </div>
  );
}

const OTHER = "other";
const NONE = "none";
const CARRIER_REQUIRED_HINT = "Précisez le transporteur : il est obligatoire avec un numéro de suivi.";

/**
 * Saisie de l'expédition par l'organisation, quand le producteur prévient
 * par téléphone. Sert aussi à corriger ou effacer une déclaration.
 */
export function OrganizerShipmentForm({
  registrationId,
  shipment,
  onSaved,
}: {
  registrationId: string;
  shipment: RegistrationShipment;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [carrierChoice, setCarrierChoice] = useState(NONE);
  const [otherCarrier, setOtherCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [date, setDate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const declare = api.registration.declareShipmentByOrganizer.useMutation({
    onSuccess: () => {
      toast.success("Expédition enregistrée");
      setEditing(false);
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });
  const clear = api.registration.clearShipmentByOrganizer.useMutation({
    onSuccess: () => {
      toast.success("Déclaration d'expédition effacée");
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  const openForm = () => {
    const carrier = shipment.carrier;
    if (carrier && !isKnownCarrier(carrier)) {
      setCarrierChoice(OTHER);
      setOtherCarrier(carrier);
    } else {
      setCarrierChoice(carrier ?? NONE);
      setOtherCarrier("");
    }
    setTracking(shipment.trackingNumber ?? "");
    setDate(format(shipment.shippedAt ? new Date(shipment.shippedAt) : new Date(), "yyyy-MM-dd"));
    setSubmitted(false);
    setEditing(true);
  };

  const busy = declare.isPending || clear.isPending;
  const chosenCarrier =
    carrierChoice === OTHER ? otherCarrier : carrierChoice === NONE ? null : carrierChoice;
  const carrierMissing = isCarrierMissing(chosenCarrier, tracking);
  const showCarrierError = submitted && carrierMissing;

  if (!editing) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={openForm} disabled={busy}>
          {shipment.shippedAt ? "Corriger l'expédition" : "Saisir l'expédition"}
        </Button>
        {shipment.shippedAt && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => clear.mutate({ registrationId })}
            style={{ color: "var(--n-text-secondary)" }}
          >
            {clear.isPending ? "Effacement…" : "Effacer"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (carrierMissing) return;
        declare.mutate({
          registrationId,
          carrier: chosenCarrier,
          trackingNumber: tracking,
          shippedAt: new Date(`${date}T12:00:00`),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>TRANSPORTEUR</span>
          <Select value={carrierChoice} onValueChange={setCarrierChoice}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Non précisé</SelectItem>
              {SHIPPING_CARRIERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {carrierLabel(c)}
                </SelectItem>
              ))}
              <SelectItem value={OTHER}>Autre</SelectItem>
            </SelectContent>
          </Select>
          {showCarrierError && carrierChoice !== OTHER && (
            <span className="n-label" role="alert" style={{ color: "#ef4444" }}>
              {CARRIER_REQUIRED_HINT}
            </span>
          )}
        </label>
        {carrierChoice === OTHER && (
          <label className="space-y-1">
            <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>NOM DU TRANSPORTEUR</span>
            <Input
              value={otherCarrier}
              maxLength={CARRIER_MAX}
              aria-invalid={showCarrierError}
              onChange={(e) => setOtherCarrier(e.target.value)}
            />
            {showCarrierError && (
              <span className="n-label" role="alert" style={{ color: "#ef4444" }}>
                {CARRIER_REQUIRED_HINT}
              </span>
            )}
          </label>
        )}
        <label className="space-y-1">
          <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>NUMÉRO DE SUIVI</span>
          <Input
            value={tracking}
            maxLength={TRACKING_NUMBER_MAX + 10}
            pattern="[A-Za-z0-9 \-]*"
            title="Lettres, chiffres et tirets"
            onChange={(e) => setTracking(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>DATE D&apos;ENVOI</span>
          <Input type="date" required value={date} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || showCarrierError}>
          {declare.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/**
 * Réception du colis entier par l'organisation, quand il arrive (déclaré ou
 * non) : tous les produits encore « à envoyer » passent « reçus ».
 * L'annulation ne remet « à envoyer » que les produits reçus dont la
 * notation n'a pas commencé (le serveur en décide).
 */
export function OrganizerParcelReceipt({
  registrationId,
  products,
  onSaved,
}: {
  registrationId: string;
  products: { status: string }[];
  onSaved: () => void;
}) {
  const pending = products.filter((p) => p.status === "pending").length;
  const received = products.filter((p) => p.status === "received").length;

  const markReceived = api.registration.markParcelReceived.useMutation({
    onSuccess: ({ changed }) => {
      toast.success(
        changed > 0
          ? `Colis reçu : ${changed} produit${changed > 1 ? "s" : ""} marqué${changed > 1 ? "s" : ""} reçu${changed > 1 ? "s" : ""}`
          : "Aucun produit à recevoir"
      );
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });
  const cancelReceipt = api.registration.cancelParcelReceipt.useMutation({
    onSuccess: ({ changed }) => {
      toast.success(
        changed > 0
          ? `Réception annulée : ${changed} produit${changed > 1 ? "s" : ""} remis « à envoyer »`
          : "Rien à annuler : la notation a commencé pour ces produits"
      );
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  const busy = markReceived.isPending || cancelReceipt.isPending;
  if (pending === 0 && received === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {pending > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={busy}>
              {markReceived.isPending ? "Enregistrement…" : "Marquer le colis comme reçu"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="n-font-body font-bold" style={{ color: "var(--n-text-display)" }}>
                Marquer le colis comme reçu ?
              </AlertDialogTitle>
              <AlertDialogDescription className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                {pending} produit{pending > 1 ? "s" : ""} « à envoyer » passer{pending > 1 ? "ont" : "a"} « reçu »,
                avec la date de réception d&apos;aujourd&apos;hui. Le producteur est prévenu par e-mail
                s&apos;il l&apos;a accepté. Aucune déclaration d&apos;expédition n&apos;est nécessaire.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => markReceived.mutate({ registrationId })}>
                Confirmer la réception
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {received > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy} style={{ color: "var(--n-text-secondary)" }}>
              {cancelReceipt.isPending ? "Annulation…" : "Annuler la réception"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="n-font-body font-bold" style={{ color: "var(--n-text-display)" }}>
                Annuler la réception du colis ?
              </AlertDialogTitle>
              <AlertDialogDescription className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                Les produits « reçus » repassent « à envoyer » et perdent leur date de réception. Les produits
                dont la notation a commencé ne sont pas touchés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="n-label">Garder la réception</AlertDialogCancel>
              <AlertDialogAction onClick={() => cancelReceipt.mutate({ registrationId })}>
                Annuler la réception
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
