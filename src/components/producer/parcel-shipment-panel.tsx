"use client";

import { useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { useServerError } from "~/i18n/server-error";
import { formatDate, type Locale } from "~/i18n/locales";
import { api } from "~/trpc/react";
import {
  carrierLabel,
  isKnownCarrier,
  isParcelInHands,
  SAMPLES_RECEPTION_DEADLINE,
  SHIPPING_CARRIERS,
  trackingUrl,
} from "~/lib/parcel-shipment";
import { CARRIER_MAX, TRACKING_NUMBER_MAX } from "~/lib/validations/registration";

export interface ParcelShipmentPanelProps {
  registrationId: string;
  shippedAt: Date | string | null;
  carrier: string | null;
  trackingNumber: string | null;
  productStatuses: string[];
  /** Appelé après un enregistrement ou une annulation. */
  onChanged: () => void;
}

const OTHER = "other";

// Champs soulignés, comme les formulaires de l'espace jury. 16 px : pas de
// zoom automatique d'iOS au focus.
const fieldStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--n-border-visible)",
  color: "var(--n-text-primary)",
  padding: "10px 0",
  fontSize: "16px",
  outline: "none",
  borderRadius: 0,
};

/** Date du jour au format des champs `date`, dans le fuseau du navigateur. */
function todayInput(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Colis d'échantillons d'une inscription payée : le producteur déclare son
 * envoi (transporteur et numéro de suivi facultatifs), puis peut corriger ou
 * annuler tant que l'organisation n'a rien reçu.
 */
export function ParcelShipmentPanel({
  registrationId,
  shippedAt,
  carrier,
  trackingNumber,
  productStatuses,
  onChanged,
}: ParcelShipmentPanelProps) {
  const t = useTranslations("producerRegistrations.parcel");
  const locale = useLocale() as Locale;
  const serverError = useServerError();

  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [carrierChoice, setCarrierChoice] = useState("");
  const [otherCarrier, setOtherCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [date, setDate] = useState(todayInput);

  const received = isParcelInHands(productStatuses);
  const deadline = formatDate(SAMPLES_RECEPTION_DEADLINE, locale);

  const declare = api.registration.declareShipment.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      setEditing(false);
      onChanged();
    },
    onError: (error) => toast.error(serverError(error)),
  });
  const clear = api.registration.clearShipment.useMutation({
    onSuccess: () => {
      toast.success(t("cleared"));
      setConfirmCancel(false);
      onChanged();
    },
    onError: (error) => toast.error(serverError(error)),
  });

  const openForm = () => {
    // Correction : le formulaire reprend la déclaration en cours.
    if (carrier && !isKnownCarrier(carrier)) {
      setCarrierChoice(OTHER);
      setOtherCarrier(carrier);
    } else {
      setCarrierChoice(carrier ?? "");
      setOtherCarrier("");
    }
    setTracking(trackingNumber ?? "");
    setDate(shippedAt ? new Date(shippedAt).toISOString().slice(0, 10) : todayInput());
    setConfirmCancel(false);
    setEditing(true);
  };

  const trackingValid = /^[A-Za-z0-9\s-]*$/.test(tracking) &&
    tracking.replace(/\s+/g, "").length <= TRACKING_NUMBER_MAX;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trackingValid) return;
    declare.mutate({
      registrationId,
      carrier: carrierChoice === OTHER ? otherCarrier : carrierChoice,
      trackingNumber: tracking,
      // Midi : la date choisie reste la même quel que soit le fuseau.
      shippedAt: new Date(`${date}T12:00:00`),
    });
  };

  const url = trackingUrl(carrier, trackingNumber);
  const busy = declare.isPending || clear.isPending;

  return (
    <section
      aria-label={t("title")}
      className="mt-4 pt-4"
      style={{ borderTop: "1px solid var(--n-border)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
        <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          {t("title")}
        </span>
        {!received && (
          <span className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            {t("deadline", { date: deadline })}
          </span>
        )}
      </div>

      {received ? (
        <div>
          <span className="n-tag" style={{ borderColor: "var(--n-success)", color: "var(--n-success)" }}>
            {t("received")}
          </span>
          <p className="text-xs mt-2" style={{ color: "var(--n-text-secondary)" }}>
            {t("receivedHint")}
          </p>
        </div>
      ) : editing ? (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
              {t("carrier")}
            </span>
            <select
              value={carrierChoice}
              onChange={(e) => setCarrierChoice(e.target.value)}
              className="n-font-data"
              style={fieldStyle}
            >
              <option value="">{t("carrierNone")}</option>
              {SHIPPING_CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {carrierLabel(c)}
                </option>
              ))}
              <option value={OTHER}>{t("carrierOther")}</option>
            </select>
          </label>
          {carrierChoice === OTHER && (
            <label className="block">
              <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                {t("carrierOtherName")}
              </span>
              <input
                value={otherCarrier}
                onChange={(e) => setOtherCarrier(e.target.value)}
                maxLength={CARRIER_MAX}
                className="n-font-data"
                style={fieldStyle}
              />
            </label>
          )}
          <label className="block">
            <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
              {t("tracking")}
            </span>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              maxLength={TRACKING_NUMBER_MAX + 10}
              autoComplete="off"
              aria-invalid={!trackingValid}
              className="n-font-data uppercase"
              style={fieldStyle}
            />
            {!trackingValid && (
              <span className="text-xs" role="alert" style={{ color: "var(--n-accent)" }}>
                {t("trackingInvalid", { max: TRACKING_NUMBER_MAX })}
              </span>
            )}
          </label>
          <label className="block">
            <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
              {t("shippedDate")}
            </span>
            <input
              type="date"
              value={date}
              max={todayInput()}
              required
              onChange={(e) => setDate(e.target.value)}
              className="n-font-data"
              style={fieldStyle}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="n-btn-primary text-xs" disabled={busy || !trackingValid}>
              {declare.isPending ? "[...]" : t("save")}
            </button>
            <button type="button" className="n-btn-ghost text-xs" onClick={() => setEditing(false)}>
              {t("close")}
            </button>
          </div>
        </form>
      ) : shippedAt ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="n-tag" style={{ borderColor: "var(--n-interactive)", color: "var(--n-interactive)" }}>
              {t("shippedOn", { date: formatDate(shippedAt, locale, { day: "2-digit", month: "2-digit" }) })}
            </span>
            {(carrier ?? trackingNumber) && (
              <p className="n-font-data text-xs mt-2 [overflow-wrap:anywhere]" style={{ color: "var(--n-text-secondary)" }}>
                {[carrierLabel(carrier), trackingNumber].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="n-btn-ghost text-xs" style={{ padding: "8px 12px" }}>
                {t("track")}
              </a>
            )}
            <button type="button" className="n-btn-secondary text-xs" style={{ padding: "8px 16px" }} onClick={openForm} disabled={busy}>
              {t("edit")}
            </button>
            {confirmCancel ? (
              <button
                type="button"
                className="n-btn-ghost text-xs"
                style={{ padding: "8px 12px", color: "var(--n-accent)" }}
                onClick={() => clear.mutate({ registrationId })}
                disabled={busy}
              >
                {clear.isPending ? "[...]" : t("cancelConfirm")}
              </button>
            ) : (
              <button
                type="button"
                className="n-btn-ghost text-xs"
                style={{ padding: "8px 12px" }}
                onClick={() => setConfirmCancel(true)}
                disabled={busy}
              >
                {t("cancel")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            <span style={{ color: "var(--n-warning)" }}>{t("notShipped")}</span> · {t("hint")}
          </p>
          <button type="button" className="n-btn-primary text-xs sm:shrink-0" onClick={openForm}>
            {t("declare")}
          </button>
        </div>
      )}
    </section>
  );
}
