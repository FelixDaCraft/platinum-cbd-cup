"use client";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { User, Ban, RotateCcw } from "lucide-react";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { QRCodeDisplay } from "./qr-code-display";
import { MarkReceivedDialog } from "./mark-received-dialog";
import { EditProductNameDialog } from "./edit-product-name-dialog";
import { LabAnalysisDialog } from "./lab-analysis-dialog";
import { api } from "~/trpc/react";

export interface ProductListItemProps {
  id: string;
  name: string;
  description: string | null;
  status: string;
  anonymousCode: string | null;
  excludedFromResults?: boolean;
  producer: {
    id: string;
    companyName: string;
    userName: string | null;
  };
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "En attente",
    className: "bg-secondary text-secondary-foreground",
  },
  received: {
    label: "Recu",
    className: "bg-blue-500 text-white",
  },
  rating: {
    label: "En notation",
    className: "bg-amber-500 text-white",
  },
  rated: {
    label: "Note",
    className: "bg-green-500 text-white",
  },
};

export function ProductListItem({
  id,
  name,
  status,
  anonymousCode,
  excludedFromResults = false,
  producer,
}: ProductListItemProps) {
  const statusInfo = statusConfig[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
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
    <div className={cn("flex items-center gap-4 border-b px-4 py-3 last:border-b-0 hover:bg-muted/50 transition-colors", excludedFromResults && "opacity-50")}>
      {/* Anonymous code */}
      <div className="w-16 shrink-0">
        {anonymousCode ? (
          <span className="font-mono text-sm font-semibold text-primary">
            {anonymousCode}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>

      {/* Product name */}
      <div className="group min-w-0 flex-1 flex items-center gap-1">
        <span className="truncate font-medium">{name}</span>
        <EditProductNameDialog productId={id} productName={name} />
      </div>

      {/* Producer */}
      <div className="flex min-w-0 max-w-[200px] shrink-0 items-center gap-1 text-sm text-muted-foreground">
        <User className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {producer.companyName}
          {producer.userName && ` - ${producer.userName}`}
        </span>
      </div>

      {/* QR Code button */}
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

      {/* Exclude/include from results */}
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2 shrink-0", excludedFromResults ? "text-green-600" : "text-red-500")}
        disabled={toggleExclude.isPending}
        onClick={() => toggleExclude.mutate({ productId: id, excluded: !excludedFromResults })}
        title={excludedFromResults ? "Réintégrer au palmarès" : "Exclure du palmarès"}
      >
        {excludedFromResults ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
      </Button>

      {/* Mark as received button (only for pending products) */}
      {status === "pending" && (
        <MarkReceivedDialog
          productId={id}
          productName={name}
          anonymousCode={anonymousCode}
        />
      )}

      {/* Status badge */}
      {excludedFromResults ? (
        <Badge className="shrink-0 bg-red-500 text-white">Exclu</Badge>
      ) : (
        <Badge className={cn("shrink-0", statusInfo.className)}>
          {statusInfo.label}
        </Badge>
      )}
    </div>
  );
}
