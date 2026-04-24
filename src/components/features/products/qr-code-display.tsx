"use client";

import { useState } from "react";
import { Download, QrCode, Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";

export interface QRCodeDisplayProps {
  productId: string;
  productName: string;
  anonymousCode: string | null;
}

export function QRCodeDisplay({
  productId,
  productName,
  anonymousCode,
}: QRCodeDisplayProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = api.product.getQRCode.useQuery(
    { productId, type: "reception" },
    { enabled: open }
  );

  const handleDownload = () => {
    if (!data?.qrCodeDataUrl) return;

    const link = document.createElement("a");
    link.href = data.qrCodeDataUrl;
    link.download = `qr-${anonymousCode ?? productId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <QrCode className="h-4 w-4" />
          <span className="sr-only">Voir QR Code</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code - {anonymousCode ?? productName}</DialogTitle>
          <DialogDescription>
            Ce QR code permet d&apos;identifier le produit lors de la reception du colis.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {isLoading && (
            <div className="flex h-64 w-64 items-center justify-center rounded-lg border bg-muted">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex h-64 w-64 items-center justify-center rounded-lg border bg-destructive/10 text-destructive">
              <p className="text-sm">Erreur: {error.message}</p>
            </div>
          )}

          {data && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.qrCodeDataUrl}
                alt={`QR Code pour ${anonymousCode ?? productName}`}
                className="h-64 w-64 rounded-lg border bg-white p-2"
              />

              <div className="text-center">
                <p className="font-mono text-lg font-bold">
                  {anonymousCode ?? productName}
                </p>
                <p className="text-xs text-muted-foreground">{productName}</p>
              </div>

              <Button onClick={handleDownload} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Telecharger le QR Code
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
