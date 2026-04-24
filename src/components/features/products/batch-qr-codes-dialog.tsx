"use client";

import { useState } from "react";
import { Download, QrCode, Loader2, FileArchive, Printer } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";

export type QRCodeType = "reception" | "notation";

export interface BatchQRCodesDialogProps {
  cupId: string;
  cupName: string;
  totalProducts: number;
  type?: QRCodeType;
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "secondary";
}

const TYPE_LABELS = {
  reception: {
    title: "QR Codes Reception",
    description: "Generez et telechargez les QR codes pour tous les produits inscrits. Les producteurs colleront ces QR codes sur leurs colis.",
    button: "QR Codes Reception",
    downloadPrefix: "reception",
  },
  notation: {
    title: "QR Codes Notation",
    description: "Generez les QR codes de notation pour les jurys. Chaque QR code permet au jury d'acceder directement a l'interface de notation du produit.",
    button: "QR Codes Notation",
    downloadPrefix: "notation",
  },
};

export function BatchQRCodesDialog({
  cupId,
  cupName,
  totalProducts,
  type = "reception",
  buttonLabel,
  buttonVariant = "outline",
}: BatchQRCodesDialogProps) {
  const [open, setOpen] = useState(false);
  const labels = TYPE_LABELS[type];

  const { data, isLoading, error } = api.product.generateBatchQRCodes.useQuery(
    { cupId, type },
    { enabled: open }
  );

  const handleDownloadAll = () => {
    if (!data?.qrCodes || data.qrCodes.length === 0) return;

    // Download each QR code individually
    // In production, this could be replaced with a ZIP generation on server
    data.qrCodes.forEach((qr, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = qr.dataUrl;
        link.download = `${labels.downloadPrefix}-${qr.anonymousCode ?? qr.productId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 100); // Small delay between downloads
    });
  };

  const handlePrint = () => {
    if (!data?.qrCodes || data.qrCodes.length === 0) return;

    // Create a printable HTML page
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - ${cupName}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .container {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              padding: 10px;
            }
            .qr-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              page-break-inside: avoid;
              border: 1px solid #e5e5e5;
              border-radius: 8px;
              padding: 10px;
            }
            .qr-item img {
              width: 150px;
              height: 150px;
            }
            .qr-code {
              font-family: monospace;
              font-size: 16px;
              font-weight: bold;
              margin: 8px 0 4px;
            }
            .qr-name {
              font-size: 11px;
              color: #666;
              text-align: center;
              max-width: 150px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .qr-category {
              font-size: 10px;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${data.qrCodes
              .map(
                (qr) => `
              <div class="qr-item">
                <img src="${qr.dataUrl}" alt="QR ${qr.anonymousCode ?? qr.productId}" />
                <div class="qr-code">${qr.anonymousCode ?? "N/A"}</div>
                <div class="qr-name">${qr.productName}</div>
                <div class="qr-category">${qr.categoryName}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // Group QR codes by category for display
  const qrCodesByCategory = data?.qrCodes.reduce(
    (acc, qr) => {
      const cat = qr.categoryName;
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(qr);
      return acc;
    },
    {} as Record<string, typeof data.qrCodes>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} className="gap-2" disabled={totalProducts === 0}>
          <QrCode className="h-4 w-4" />
          {buttonLabel ?? labels.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{labels.title} - {cupName}</DialogTitle>
          <DialogDescription>
            {labels.description}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              Generation de {totalProducts} QR codes...
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <p className="text-sm">Erreur: {error.message}</p>
          </div>
        )}

        {data && data.qrCodes.length > 0 && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleDownloadAll} className="gap-2">
                <FileArchive className="h-4 w-4" />
                Telecharger tout ({data.totalProducts})
              </Button>
              <Button onClick={handlePrint} variant="outline" className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimer
              </Button>
            </div>

            {/* QR Codes by category */}
            <Tabs defaultValue={Object.keys(qrCodesByCategory ?? {})[0]} className="w-full">
              <TabsList className="w-full flex-wrap h-auto gap-1">
                {Object.keys(qrCodesByCategory ?? {}).map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="flex-shrink-0">
                    {cat} ({qrCodesByCategory?.[cat]?.length ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(qrCodesByCategory ?? {}).map(([cat, qrs]) => (
                <TabsContent key={cat} value={cat} className="mt-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {qrs.map((qr) => (
                      <div
                        key={qr.productId}
                        className="flex flex-col items-center rounded-lg border bg-card p-3"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qr.dataUrl}
                          alt={`QR ${qr.anonymousCode}`}
                          className="h-24 w-24 rounded border bg-white p-1"
                        />
                        <p className="mt-2 font-mono text-sm font-bold">
                          {qr.anonymousCode ?? "N/A"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground max-w-[100px]">
                          {qr.productName}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 gap-1 text-xs"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = qr.dataUrl;
                            link.download = `${labels.downloadPrefix}-${qr.anonymousCode ?? qr.productId}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="h-3 w-3" />
                          PNG
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {data && data.qrCodes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <QrCode className="h-12 w-12" />
            <p className="mt-4 text-sm">Aucun produit inscrit</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
