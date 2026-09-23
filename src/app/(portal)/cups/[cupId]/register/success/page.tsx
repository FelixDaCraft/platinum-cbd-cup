"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { api } from "~/trpc/react";

/**
 * Landing page for the Viva.com success redirect.
 *
 * Viva appends its own query parameters to the success URL configured on the
 * payment source: `t` is the transaction id and `s` the order code. The
 * webhook is what normally confirms the registration, but it can land after
 * the producer is already back here, so this page also asks the server to
 * settle the payment. Both paths are idempotent.
 */
export default function RegistrationSuccessPage({
  params,
}: {
  params: Promise<{ cupId: string }>;
}) {
  const { cupId } = use(params);

  return (
    <Suspense fallback={<StatusBlock title="Vérification du paiement…" />}>
      <SuccessInner cupId={cupId} />
    </Suspense>
  );
}

function SuccessInner({ cupId }: { cupId: string }) {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get("t");

  const [state, setState] = useState<
    "checking" | "confirmed" | "pending" | "error" | "missing"
  >(transactionId ? "checking" : "missing");

  const confirmPayment = api.registration.confirmVivaPayment.useMutation({
    onSuccess: (data) => setState(data.status === "confirmed" ? "confirmed" : "pending"),
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
          <Link href="/producer/registrations">
            <button className="btn">Voir mes inscriptions</button>
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
        message="Votre paiement a bien été reçu. Une facture vient de vous être envoyée par email, et vous recevrez prochainement les instructions pour l'envoi de vos échantillons."
        actions={
          <>
            <Link href="/producer/registrations">
              <button className="btn accent">Voir mes inscriptions →</button>
            </Link>
            <Link href={`/cups/${cupId}`}>
              <button className="btn">Retour à la cup</button>
            </Link>
          </>
        }
      />
    );
  }

  if (state === "pending") {
    return (
      <StatusBlock
        title="Paiement en cours de traitement"
        message="Votre paiement n'est pas encore finalisé côté banque. L'inscription sera confirmée automatiquement dès que Viva nous le notifie — vous recevrez un email à ce moment-là."
        actions={
          <Link href="/producer/registrations">
            <button className="btn">Voir mes inscriptions</button>
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
          <Link href="/producer/registrations">
            <button className="btn accent">Voir mes inscriptions</button>
          </Link>
          <Link href="/contact">
            <button className="btn">Nous contacter</button>
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
    <div className="page-enter" style={{ paddingTop: 80, paddingBottom: 96, textAlign: "center" }}>
      <h1 className="display" style={{ marginBottom: 20 }}>
        {title}
        <em>.</em>
      </h1>
      {message && (
        <p className="lede" style={{ maxWidth: 520, margin: "0 auto 32px" }}>
          {message}
        </p>
      )}
      {actions && (
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
