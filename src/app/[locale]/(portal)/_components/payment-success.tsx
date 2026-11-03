"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Link } from "~/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("payment");
  return (
    <Suspense fallback={<StatusBlock title={t("checking")} />}>
      <SuccessInner cupId={cupId} />
    </Suspense>
  );
}

function SuccessInner({ cupId: cupIdFromUrl }: { cupId?: string }) {
  const t = useTranslations("payment");
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
        title={t("missingTitle")}
        message={t("missingText")}
        actions={
          <Link href="/producer/registrations" className="btn accent">
            {t("myRegistrations")}
          </Link>
        }
      />
    );
  }

  if (state === "checking") {
    return <StatusBlock title={t("checking")} />;
  }

  if (state === "confirmed") {
    return (
      <StatusBlock
        title={t("confirmedTitle")}
        message={t("confirmedText")}
        actions={
          <>
            <Link href="/producer/registrations" className="btn accent">
              {t("myRegistrations")} <span className="btn-arrow">→</span>
            </Link>
            {cupId && (
              <Link href={`/cups/${cupId}`} className="btn ghost">
                {t("backToCup")}
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
        title={t("pendingTitle")}
        message={t("pendingText")}
        actions={
          <Link href="/producer/registrations" className="btn accent">
            {t("myRegistrations")}
          </Link>
        }
      />
    );
  }

  return (
    <StatusBlock
      title={t("errorTitle")}
      message={t("errorText")}
      actions={
        <>
          <Link href="/producer/registrations" className="btn accent">
            {t("myRegistrations")}
          </Link>
          <Link href="/contact" className="btn ghost">
            {t("contactUs")}
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
  const t = useTranslations("payment");
  return (
    <div className="pg pg--narrow page-enter">
      <header className="pg-head">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="display" aria-live="polite">
          {title}
        </h1>
        {message && <p className="pg-lede">{message}</p>}
      </header>
      {actions && <div className="form-actions">{actions}</div>}
    </div>
  );
}
