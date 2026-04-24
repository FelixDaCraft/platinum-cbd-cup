"use client";

import { useState } from "react";
import { Package, Loader2, CheckCircle, XCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export interface MarkReceivedDialogProps {
  productId: string;
  productName: string;
  anonymousCode: string | null;
  onSuccess?: () => void;
}

export function MarkReceivedDialog({
  productId,
  productName,
  anonymousCode,
  onSuccess,
}: MarkReceivedDialogProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const utils = api.useUtils();

  const updateStatusMutation = api.product.updateStatus.useMutation({
    onSuccess: () => {
      setStatus("success");
      // Invalidate queries to refresh the list
      void utils.product.listByCupGroupedByCategory.invalidate();
      // Close dialog after a short delay to show success state
      setTimeout(() => {
        setOpen(false);
        setNote("");
        setStatus("idle");
        onSuccess?.();
      }, 1500);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message);
    },
  });

  const handleMarkReceived = () => {
    updateStatusMutation.mutate({
      productId,
      status: "received",
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setStatus("idle");
      setErrorMessage("");
      setNote("");
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Package className="h-3 w-3" />
          Recu
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Success State */}
        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Reception confirmee</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {anonymousCode ?? productName} a ete marque comme recu.
            </p>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-red-100 p-3 mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-destructive">Erreur</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              {errorMessage || "Une erreur est survenue"}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setStatus("idle")}
            >
              Reessayer
            </Button>
          </div>
        )}

        {/* Idle State - Form */}
        {status === "idle" && (
          <>
            <DialogHeader>
              <DialogTitle>Marquer comme recu</DialogTitle>
              <DialogDescription>
                Confirmez la reception du produit {anonymousCode ?? productName}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="font-mono text-2xl font-bold text-primary">
                  {anonymousCode ?? "N/A"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{productName}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (optionnel)</Label>
                <Textarea
                  id="note"
                  placeholder="Ajoutez une note sur la reception..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleMarkReceived}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    En cours...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Confirmer reception
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
