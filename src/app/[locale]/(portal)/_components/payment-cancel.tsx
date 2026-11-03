"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "~/i18n/navigation";

import { api } from "~/trpc/react";
import { useTranslations } from "next-intl";
import { useServerError } from "~/i18n/server-error";

/**
 * Landing page for the Viva.com failure / cancel redirect.
 *
 * Pendant de `register/success`. La failure URL se configure sur la source de
 * paiement (VIVA_SOURCE_CODE) dans le back-office Viva ; sans cette page, un
 * paiement abandonné retombait sur la page de succès sans paramètre `t` et
 * affichait « Paiement introuvable ».
 *
 * Rien n'est confirmé ici : l'inscription reste `pending_payment`. La seule
 * action proposée est de relancer une commande de paiement sur l'inscription
 * existante — surtout pas de repasser par le formulaire, qui ajouterait un
 * second produit.
 */
export function PaymentCancel({ cupId }: { cupId?: string }) {
  const t = useTranslations("payment");
  return (
    <Suspense fallback={<StatusBlock title={t("cancelTitle")} />}>
      <CancelInner cupId={cupId} />
    </Suspense>
  );
}

function CancelInner({ cupId }: { cupId?: string }) {
  const t = useTranslations("payment");
  const serverError = useServerError();
  const [retryError, setRetryError] = useState<string | null>(null);

  const { data: registrations, isLoading } =
    api.producer.getMyRegistrations.useQuery({ limit: 50 });

  // Viva ajoute `s` (code de commande) à l'URL d'échec : c'est le moyen le
  // plus sûr de retrouver le panier, l'URL fixe de la source ne portant pas
  // la cup. À défaut, la cup de l'URL, puis le seul panier en attente.
  const searchParams = useSearchParams();
  const orderCode = searchParams.get("s");
  // Motif du refus (EventId Viva), transmis pour que l'organisation sache
  // pourquoi l'inscription n'a pas abouti.
  const failureEventId = searchParams.get("eventId") ?? undefined;
  const pending = (registrations ?? []).filter(
    (registration) =>
      registration.status === "pending_payment" && registration.productsCount > 0
  );
  const pendingRegistration =
    (orderCode && pending.find((r) => r.paymentOrderCode === orderCode)) ||
    (cupId && pending.find((r) => r.cupId === cupId)) ||
    (pending.length === 1 ? pending[0] : undefined);
  const returnCupId = cupId ?? pendingRegistration?.cupId;

  const createCheckoutSession =
    api.registration.createCheckoutSession.useMutation();

  // Le paiement n'a pas abouti : la place réservée à son ouverture est rendue
  // tout de suite, pour qu'un autre producteur puisse la prendre. « Réessayer »
  // la reprend si elle est toujours libre.
  const releaseReservation =
    api.registration.releasePaymentReservation.useMutation();
  const releasedFor = useRef<string | null>(null);
  const pendingRegistrationId = pendingRegistration?.id;

  useEffect(() => {
    if (!pendingRegistrationId || releasedFor.current === pendingRegistrationId) return;
    releasedFor.current = pendingRegistrationId;
    releaseReservation.mutate({ registrationId: pendingRegistrationId, failureEventId });
  }, [pendingRegistrationId, releaseReservation, failureEventId]);

  const handleRetry = async () => {
    if (!pendingRegistration) return;
    setRetryError(null);

    try {
      const session = await createCheckoutSession.mutateAsync({
        registrationId: pendingRegistration.id,
      });

      if (!session.checkoutUrl) {
        setRetryError(t("unavailable"));
        return;
      }

      window.location.href = session.checkoutUrl;
    } catch (error) {
      setRetryError(serverError(error, t("retryFailed")));
    }
  };

  const retrying = createCheckoutSession.isPending;

  return (
    <StatusBlock
      title={t("cancelTitle")}
      message={t("cancelText")}
      error={retryError}
      actions={
        <>
          {(isLoading || pendingRegistration) && (
            <button
              className="btn accent"
              onClick={() => void handleRetry()}
              disabled={isLoading || retrying || releaseReservation.isPending}
            >
              {retrying ? t("redirecting") : t("retry")}
              {!retrying && <span className="btn-arrow">→</span>}
            </button>
          )}
          <Link href="/producer/registrations" className="btn ghost">
            {t("myRegistrations")}
          </Link>
          {returnCupId && (
            <Link href={`/cups/${returnCupId}`} className="btn ghost">
              {t("backToCup")}
            </Link>
          )}
        </>
      }
    />
  );
}

function StatusBlock({
  title,
  message,
  error,
  actions,
}: {
  title: string;
  message?: string;
  error?: string | null;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("payment");
  return (
    <div className="pg pg--narrow page-enter">
      <header className="pg-head">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="display">{title}</h1>
        {message && <p className="pg-lede">{message}</p>}
      </header>
      {error && (
        <div className="notice is-error" role="alert" style={{ marginBottom: 24 }}>
          {error}
        </div>
      )}
      {actions && <div className="form-actions">{actions}</div>}
    </div>
  );
}
