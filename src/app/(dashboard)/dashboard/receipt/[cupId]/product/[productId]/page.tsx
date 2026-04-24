"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Package,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

type ReceptionState = "loading" | "ready" | "confirming" | "success" | "error" | "already_received";

const statusConfig = {
  pending: { label: "En attente", color: "bg-amber-500" },
  received: { label: "Recu", color: "bg-blue-500" },
  rating: { label: "En notation", color: "bg-purple-500" },
  rated: { label: "Note", color: "bg-green-500" },
} as const;

export default function ProductReceiptPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const productId = params.productId as string;

  const [state, setState] = useState<ReceptionState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const { data: productData, isLoading: isLoadingProduct, error: productError } =
    api.product.getQRCode.useQuery(
      { productId, type: "reception" },
      { retry: false }
    );

  const { data: productDetails } = api.product.getProductForReceipt.useQuery(
    { productId, cupId },
    { enabled: !!productData }
  );

  const updateStatusMutation = api.product.updateStatus.useMutation({
    onSuccess: () => {
      setState("success");
    },
    onError: (error) => {
      setState("error");
      setErrorMessage(error.message);
    },
  });

  useEffect(() => {
    if (productError) {
      setState("error");
      setErrorMessage(productError.message);
      return;
    }
    if (productDetails) {
      if (
        productDetails.status === "received" ||
        productDetails.status === "rating" ||
        productDetails.status === "rated"
      ) {
        setState("already_received");
      } else {
        setState("ready");
      }
    }
  }, [productDetails, productError]);

  const handleConfirmReception = () => {
    setState("confirming");
    updateStatusMutation.mutate({ productId, status: "received" });
  };

  if (isLoadingProduct) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="n-font-data text-muted-foreground">[LOADING...]</span>
      </div>
    );
  }

  return (
    <div className="container max-w-lg mx-auto py-8 px-4">
      {/* Success State */}
      {state === "success" && (
        <div className="n-card overflow-hidden">
          <div className="p-8 border-b border-border text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3" />
            <h1 className="n-font-body text-2xl font-semibold">Réception confirmée</h1>
          </div>
          <div className="p-6 text-center space-y-4">
            <div className="p-4 bg-muted rounded-sm">
              <p className="n-font-data text-2xl font-bold">
                {productData?.anonymousCode ?? "N/A"}
              </p>
              <p className="n-label text-sm text-muted-foreground mt-1">
                {productData?.productName}
              </p>
            </div>
            <p className="n-label text-muted-foreground">
              Le produit a été marqué comme reçu avec succès.
            </p>
            <div className="flex flex-col gap-2 pt-4">
              <Link href={`/dashboard/cups/${cupId}/products`}>
                <Button className="w-full n-btn-primary">
                  Voir tous les produits
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.reload()}
              >
                Scanner un autre produit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Already Received State */}
      {state === "already_received" && (
        <div className="n-card overflow-hidden">
          <div className="p-8 border-b border-border text-center">
            <Package className="h-12 w-12 mx-auto mb-3" />
            <h1 className="n-font-body text-2xl font-semibold">Déjà reçu</h1>
          </div>
          <div className="p-6 text-center space-y-4">
            <div className="p-4 bg-muted rounded-sm">
              <p className="n-font-data text-2xl font-bold">
                {productData?.anonymousCode ?? "N/A"}
              </p>
              <p className="n-label text-sm text-muted-foreground mt-1">
                {productData?.productName}
              </p>
            </div>
            <Badge className={statusConfig[productDetails?.status as keyof typeof statusConfig]?.color ?? "bg-gray-500"}>
              {statusConfig[productDetails?.status as keyof typeof statusConfig]?.label ?? productDetails?.status}
            </Badge>
            <p className="n-label text-muted-foreground">
              Ce produit a déjà été reçu et traité.
            </p>
            <div className="flex flex-col gap-2 pt-4">
              <Link href={`/dashboard/cups/${cupId}/products`}>
                <Button className="w-full">
                  Voir tous les produits
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === "error" && (
        <div className="n-card overflow-hidden">
          <div className="p-8 border-b border-destructive/30 bg-destructive/5 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <h1 className="n-font-body text-2xl font-semibold">Erreur</h1>
          </div>
          <div className="p-6 text-center space-y-4">
            <p className="n-label text-destructive font-medium">
              {errorMessage || "Une erreur est survenue"}
            </p>
            <p className="n-label text-muted-foreground">
              Vérifiez que le QR code est valide et que vous avez les droits d&apos;accès.
            </p>
            <div className="flex flex-col gap-2 pt-4">
              <Link href={`/dashboard/cups/${cupId}/products`}>
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Retour aux produits
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Ready / Confirming State */}
      {(state === "ready" || state === "confirming") && (
        <div className="n-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="n-font-body text-xl font-semibold">Réception de produit</h2>
            <p className="n-label text-muted-foreground mt-1">Confirmez la réception du colis</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Product Info */}
            <div className="p-4 bg-muted rounded-sm text-center">
              <p className="n-font-data text-3xl font-bold">
                {productData?.anonymousCode ?? "N/A"}
              </p>
              <p className="n-label text-sm text-muted-foreground mt-2">
                {productData?.productName}
              </p>
              {productDetails && (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  <p className="n-label text-sm">
                    <span className="text-muted-foreground">Catégorie: </span>
                    <span className="font-medium">{productDetails.categoryName}</span>
                  </p>
                  <p className="n-label text-sm">
                    <span className="text-muted-foreground">Producteur: </span>
                    <span className="font-medium">{productDetails.producerName}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 border border-border rounded-sm bg-muted/50">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
              <div>
                <p className="n-label font-medium">Vérification importante</p>
                <p className="n-label text-sm text-muted-foreground">
                  Vérifiez que le code anonyme correspond au code sur le colis avant de confirmer.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={handleConfirmReception}
              disabled={state === "confirming"}
              className="w-full h-14 text-lg n-btn-primary"
              size="lg"
            >
              {state === "confirming" ? (
                <span className="n-font-data">[CONFIRMATION EN COURS...]</span>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Confirmer la réception
                </>
              )}
            </Button>

            <Link href={`/dashboard/cups/${cupId}/products`}>
              <Button variant="ghost" className="w-full">
                Annuler
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
