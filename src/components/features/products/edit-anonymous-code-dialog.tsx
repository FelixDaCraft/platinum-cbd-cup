"use client";

import { useState } from "react";
import { Pencil, Loader2, CheckCircle, XCircle } from "lucide-react";

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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export interface EditAnonymousCodeDialogProps {
  productId: string;
  productName: string;
  anonymousCode: string | null;
}

export function EditAnonymousCodeDialog({
  productId,
  productName,
  anonymousCode,
}: EditAnonymousCodeDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(anonymousCode ?? "");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const utils = api.useUtils();

  const updateMutation = api.product.updateAnonymousCode.useMutation({
    onSuccess: () => {
      setStatus("success");
      void utils.product.listByCupGroupedByCategory.invalidate();
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1500);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      productId,
      anonymousCode: code === "" ? null : code,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStatus("idle");
      setErrorMessage("");
      setCode(anonymousCode ?? "");
    } else {
      setCode(anonymousCode ?? "");
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Success State */}
        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Code modifie</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Le code anonyme a ete mis a jour.
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
              <DialogTitle>Modifier le code anonyme</DialogTitle>
              <DialogDescription>
                Modifiez le code anonyme du produit {productName}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="anonymousCode">Code anonyme</Label>
                <Input
                  id="anonymousCode"
                  className="font-mono text-lg"
                  placeholder="CF23"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    En cours...
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
