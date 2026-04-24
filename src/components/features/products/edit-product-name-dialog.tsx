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

export interface EditProductNameDialogProps {
  productId: string;
  productName: string;
}

export function EditProductNameDialog({
  productId,
  productName,
}: EditProductNameDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(productName);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const utils = api.useUtils();

  const updateMutation = api.product.updateName.useMutation({
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
    const trimmed = name.trim();
    if (!trimmed) return;
    updateMutation.mutate({ productId, name: trimmed });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStatus("idle");
      setErrorMessage("");
      setName(productName);
    } else {
      setName(productName);
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Nom modifie</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Le nom du produit a ete mis a jour.
            </p>
          </div>
        )}

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

        {status === "idle" && (
          <>
            <DialogHeader>
              <DialogTitle>Modifier le nom du produit</DialogTitle>
              <DialogDescription>
                Nouveau nom pour &quot;{productName}&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Nom du produit</Label>
                <Input
                  id="productName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || !name.trim() || name.trim() === productName}
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
