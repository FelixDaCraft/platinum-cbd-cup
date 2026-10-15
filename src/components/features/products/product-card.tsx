"use client";

import { Button } from "~/components/ui/button";
import { User, Ban, RotateCcw } from "lucide-react";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { QRCodeDisplay } from "./qr-code-display";
import { MarkReceivedDialog } from "./mark-received-dialog";
import { EditAnonymousCodeDialog } from "./edit-anonymous-code-dialog";
import { EditProductNameDialog } from "./edit-product-name-dialog";
import { LabAnalysisDialog } from "./lab-analysis-dialog";
import { api } from "~/trpc/react";
import { formatPanelCodes } from "~/lib/panel-codes";
import { CheckoutBadge, type ProductCheckout } from "./checkout-badge";

export interface ProductCardProps {
  id: string;
  name: string;
  description: string | null;
  status: string;
  anonymousCodePro: string | null;
  anonymousCodePublic: string | null;
  excludedFromResults?: boolean;
  producer: {
    id: string;
    companyName: string;
    userName: string | null;
  };
  checkout?: ProductCheckout;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "En attente",
    color: "var(--n-text-secondary)",
    bg: "var(--n-border)",
  },
  received: {
    label: "Reçu",
    color: "#ffffff",
    bg: "#3b82f6",
  },
  rating: {
    label: "En notation",
    color: "#ffffff",
    bg: "#f59e0b",
  },
  rated: {
    label: "Noté",
    color: "#ffffff",
    bg: "var(--n-success)",
  },
};

const badgeStyle = {
  fontFamily: "'Space Mono', monospace",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  borderRadius: "4px",
  padding: "2px 8px",
  whiteSpace: "nowrap",
  flexShrink: 0,
} as const;

export function ProductCard({
  id,
  name,
  description,
  status,
  anonymousCodePro,
  anonymousCodePublic,
  excludedFromResults = false,
  producer,
  checkout,
}: ProductCardProps) {
  const anonymousCode = formatPanelCodes(anonymousCodePro, anonymousCodePublic);
  const statusInfo = statusConfig[status] ?? {
    label: status,
    color: "var(--n-text-secondary)",
    bg: "var(--n-border)",
  };

  const utils = api.useUtils();
  const toggleExclude = api.product.toggleExcludeFromResults.useMutation({
    onSuccess: (data) => {
      toast.success(data.excluded ? "Produit exclu du palmarès" : "Produit réintégré au palmarès");
      void utils.product.listByCupGroupedByCategory.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div
      style={{
        background: "var(--n-surface)",
        border: excludedFromResults
          ? "1px solid rgba(239,68,68,0.3)"
          : "1px solid var(--n-border)",
        borderRadius: "12px",
        opacity: excludedFromResults ? 0.6 : 1,
        transition: "opacity 0.15s, border-color 0.15s",
      }}
    >
      <div style={{ padding: "14px 16px" }}>
        {/* Codes anonymes (un par jury : pro, puis public) + statut */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            {(
              [
                ["pro", "PRO", anonymousCodePro],
                ["public", "PUB", anonymousCodePublic],
              ] as const
            ).map(([panel, tag, code]) => (
              <div key={panel} className="flex items-center gap-1">
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "0.06em",
                    color: "var(--n-text-disabled)",
                  }}
                >
                  {tag}
                </span>
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: code ? "var(--n-accent)" : "var(--n-text-disabled)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {code ?? "—"}
                </span>
                <EditAnonymousCodeDialog
                  productId={id}
                  productName={name}
                  panel={panel}
                  anonymousCode={code}
                />
              </div>
            ))}
          </div>
          {excludedFromResults ? (
            <span style={{ ...badgeStyle, color: "#ffffff", background: "#ef4444" }}>
              Exclu
            </span>
          ) : (
            <span style={{ ...badgeStyle, color: statusInfo.color, background: statusInfo.bg }}>
              {statusInfo.label}
            </span>
          )}
        </div>

        {/* Nom du produit */}
        <div className="group flex items-center gap-1 min-w-0" style={{ marginTop: "8px" }}>
          <h3
            className="truncate"
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--n-text-primary)",
            }}
          >
            {name}
          </h3>
          <EditProductNameDialog productId={id} productName={name} />
        </div>

        {/* Description */}
        {description && (
          <p
            className="truncate"
            style={{
              fontSize: "12px",
              color: "var(--n-text-secondary)",
              marginTop: "4px",
            }}
          >
            {description}
          </p>
        )}

        {/* Producer info */}
        <div
          className="flex items-center gap-1 min-w-0"
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "var(--n-text-secondary)",
          }}
        >
          <User style={{ width: "12px", height: "12px", flexShrink: 0 }} />
          <span className="truncate">
            {producer.companyName}
            {producer.userName && ` - ${producer.userName}`}
          </span>
        </div>

        {/* Parcours d'inscription, si elle n'est pas payée */}
        {checkout && checkout.state !== "paid" && (
          <div style={{ marginTop: "8px" }}>
            <CheckoutBadge checkout={checkout} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex flex-wrap items-center gap-2"
        style={{ borderTop: "1px solid var(--n-border)", padding: "8px 12px" }}
      >
        <QRCodeDisplay
          productId={id}
          productName={name}
          anonymousCode={anonymousCode}
        />
        {/* Lab analysis upload + review */}
        <LabAnalysisDialog
          productId={id}
          productName={name}
          anonymousCode={anonymousCode}
        />
        {/* Mark as received button (only for pending products) */}
        {status === "pending" && (
          <MarkReceivedDialog
            productId={id}
            productName={name}
            anonymousCode={anonymousCode}
          />
        )}
        {/* Exclude/include from results */}
        <Button
          variant={excludedFromResults ? "outline" : "ghost"}
          size="sm"
          className={cn(
            "ml-auto h-8 px-2",
            excludedFromResults
              ? "border-green-500/50 text-green-600 hover:bg-green-50"
              : "text-red-500 hover:bg-red-50"
          )}
          disabled={toggleExclude.isPending}
          onClick={() => toggleExclude.mutate({ productId: id, excluded: !excludedFromResults })}
          title={excludedFromResults ? "Réintégrer au palmarès" : "Exclure du palmarès"}
        >
          {excludedFromResults ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
