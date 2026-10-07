"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { api } from "~/trpc/react";
import { getErrorMessage } from "../_lib/errors";

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

  return (
    <Suspense fallback={<StatusBlock title="Paiement non abouti" />}>
      <CancelInner cupId={cupId} />
    </Suspense>
  );
}

function CancelInner({ cupId }: { cupId?: string }) {
  const [retryError, setRetryError] = useState<string | null>(null);

  const { data: registrations, isLoading } =
    api.producer.getMyRegistrations.useQuery({ limit: 50 });

  // Viva ajoute `s` (code de commande) à l'URL d'échec : c'est le moyen le
  // plus sûr de retrouver le panier, l'URL fixe de la source ne portant pas
  // la cup. À défaut, la cup de l'URL, puis le seul panier en attente.
  const orderCode = useSearchParams().get("s");
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
    releaseReservation.mutate({ registrationId: pendingRegistrationId });
  }, [pendingRegistrationId, releaseReservation]);

  const handleRetry = async () => {
    if (!pendingRegistration) return;
    setRetryError(null);

    try {
      const session = await createCheckoutSession.mutateAsync({
        registrationId: pendingRegistration.id,
      });

      if (!session.checkoutUrl) {
        setRetryError(
          "Le paiement n'est pas disponible pour le moment. Réessayez dans quelques minutes."
        );
        return;
      }

      window.location.href = session.checkoutUrl;
    } catch (error) {
      setRetryError(
        getErrorMessage(error, "Impossible de relancer le paiement.")
      );
    }
  };

  const retrying = createCheckoutSession.isPending;

  return (
    <StatusBlock
      title="Paiement non abouti"
      message="Votre paiement a été annulé ou refusé : votre inscription est enregistrée mais pas encore validée. Aucun montant n'a été débité. Vos produits sont conservés et vous pouvez relancer le paiement."
      error={retryError}
      actions={
        <>
          {(isLoading || pendingRegistration) && (
            <button
              className="btn accent"
              onClick={() => void handleRetry()}
              disabled={isLoading || retrying || releaseReservation.isPending}
            >
              {retrying ? "Redirection…" : "Réessayer le paiement"}
              {!retrying && <span className="btn-arrow">→</span>}
            </button>
          )}
          <Link href="/producer/registrations" className="btn ghost">
            Voir mes inscriptions
          </Link>
          {returnCupId && (
            <Link href={`/cups/${returnCupId}`} className="btn ghost">
              Retour à la cup
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
  return (
    <div className="pg pg--narrow page-enter">
      <header className="pg-head">
        <p className="eyebrow">Paiement</p>
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
