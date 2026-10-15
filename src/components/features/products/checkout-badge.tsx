"use client";

import {
  checkoutStateConfig,
  paymentFailureLabel,
  type CheckoutState,
} from "~/lib/registration-checkout";

export interface ProductCheckout {
  state: CheckoutState;
  failureCode: string | null;
  failureAt: Date | null;
  lastAttemptAt: Date | null;
  paymentAttempts: number;
  registrationCreatedAt: Date;
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Détail affiché à côté du badge : motif du refus ou date de la dernière étape. */
function checkoutDetail(checkout: ProductCheckout): string | null {
  switch (checkout.state) {
    case "declined": {
      const reason = paymentFailureLabel(checkout.failureCode);
      const when = checkout.failureAt ? dateFormat.format(checkout.failureAt) : null;
      return [reason, when].filter(Boolean).join(" · ");
    }
    case "abandoned":
      return [
        checkout.lastAttemptAt ? `le ${dateFormat.format(checkout.lastAttemptAt)}` : null,
        checkout.paymentAttempts > 1 ? `${checkout.paymentAttempts} tentatives` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;
    case "cart":
    case "empty":
      return `commencée le ${dateFormat.format(checkout.registrationCreatedAt)}`;
    default:
      return null;
  }
}

/**
 * Où en est l'inscription d'un produit. Rien pour un produit payé : c'est le
 * cas normal, seul l'écart mérite d'être signalé.
 */
export function CheckoutBadge({ checkout }: { checkout?: ProductCheckout }) {
  if (!checkout || checkout.state === "paid") return null;

  const config = checkoutStateConfig[checkout.state];
  const detail = checkoutDetail(checkout);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0" title={config.hint}>
      <span
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: config.color,
          background: config.bg,
          borderRadius: "4px",
          padding: "1px 6px",
          whiteSpace: "nowrap",
        }}
      >
        {config.label}
      </span>
      {detail && (
        <span style={{ fontSize: "11px", color: "var(--n-text-secondary)" }}>{detail}</span>
      )}
    </div>
  );
}
