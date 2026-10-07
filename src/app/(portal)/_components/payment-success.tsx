"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { api } from "~/trpc/react";

/**
 * Retour de Viva.com après un paiement réussi.
 *
 * Servie à deux adresses : `/paiement/succes`, l'URL fixe à déclarer sur la
 * source de paiement Viva (une commande ne porte pas ses propres URLs), et
 * l'ancienne `/cups/{cupId}/register/success`.
 *
 * Landing page for the Viva.com success redirect.
 *
 * Viva appends its own query parameters to the success URL configured on the
 * payment source: `t` is the transaction id and `s` the order code. The
 * webhook is what normally confirms the registration, but it can land after
 * the producer is already back here, so this page also asks the server to
 * settle the payment. Both paths are idempotent.
 */
export function PaymentSuccess({ cupId }: { cupId?: string }) {

  return (
    <Suspense fallback={<StatusBlock title="Vérification du paiement…" />}>
      <SuccessInner cupId={cupId} />
    </Suspense>
  );
}

function SuccessInner({ cupId: cupIdFromUrl }: { cupId?: string }) {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get("t");

  const [state, setState] = useState<
    "checking" | "confirmed" | "pending" | "error" | "missing"
  >(transactionId ? "checking" : "missing");

  // Retour par l'URL fixe de la source Viva : la cup se lit sur l'inscription
  // réglée, que le serveur renvoie.
  const [cupIdFromPayment, setCupIdFromPayment] = useState<string | null>(null);
  const cupId = cupIdFromUrl ?? cupIdFromPayment;

  const confirmPayment = api.registration.confirmVivaPayment.useMutation({
    onSuccess: (data) => {
      setCupIdFromPayment(data.cupId ?? null);
      setState(data.status === "confirmed" ? "confirmed" : "pending");
    },
    onError: () => setState("error"),
  });

  // React 18 StrictMode double-invokes effects in dev; guard so the mutation
  // only fires once per transaction.
  const hasRequested = useRef(false);

  useEffect(() => {
    if (!transactionId || hasRequested.current) return;
    hasRequested.current = true;
    confirmPayment.mutate({ transactionId });
  }, [transactionId, confirmPayment]);

  if (state === "missing") {
    return (
      <StatusBlock
        title="Paiement introuvable"
        message="Aucune référence de transaction n'a été transmise. Si vous avez été débité, votre inscription sera confirmée automatiquement d'ici quelques minutes."
        actions={
          <Link href="/producer/registrations" className="btn accent">
            Voir mes inscriptions
          </Link>
        }
      />
    );
  }

  if (state === "checking") {
    return <StatusBlock title="Vérification du paiement…" />;
  }

  if (state === "confirmed") {
    return (
      <StatusBlock
        title="Inscription confirmée"
        message="Votre paiement a bien été reçu. Votre facture vient de vous être envoyée par email ; vous recevrez prochainement les instructions pour l'envoi de vos échantillons."
        actions={
          <>
            <Link href="/producer/registrations" className="btn accent">
              Voir mes inscriptions <span className="btn-arrow">→</span>
            </Link>
            {cupId && (
              <Link href={`/cups/${cupId}`} className="btn ghost">
                Retour à la cup
              </Link>
            )}
          </>
        }
      />
    );
  }

  if (state === "pending") {
    return (
      <StatusBlock
        title="Paiement en cours de traitement"
        message="Votre paiement n'est pas encore finalisé par la banque. L'inscription sera confirmée automatiquement dès que Viva.com nous en informe ; vous recevrez alors un email."
        actions={
          <Link href="/producer/registrations" className="btn accent">
            Voir mes inscriptions
          </Link>
        }
      />
    );
  }

  return (
    <StatusBlock
      title="Vérification impossible"
      message="Nous n'avons pas pu vérifier votre paiement à l'instant. Si vous avez été débité, l'inscription sera confirmée automatiquement. Contactez-nous si ce n'est pas le cas d'ici une heure."
      actions={
        <>
          <Link href="/producer/registrations" className="btn accent">
            Voir mes inscriptions
          </Link>
          <Link href="/contact" className="btn ghost">
            Nous contacter
          </Link>
        </>
      }
    />
  );
}

function StatusBlock({
  title,
  message,
  actions,
}: {
  title: string;
  message?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="pg pg--narrow page-enter">
      <header className="pg-head">
        <p className="eyebrow">Paiement</p>
        <h1 className="display" aria-live="polite">
          {title}
        </h1>
        {message && <p className="pg-lede">{message}</p>}
      </header>
      {actions && <div className="form-actions">{actions}</div>}
    </div>
  );
}
