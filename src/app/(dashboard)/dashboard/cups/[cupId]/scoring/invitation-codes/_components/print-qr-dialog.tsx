"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { getActivationUrl, plural, type PrintableCode } from "./shared";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface PrintQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cupName: string;
  /** Ce que couvre la planche : une catégorie, une sélection, un lot généré… */
  scopeLabel: string;
  codes: PrintableCode[];
}

/**
 * Planche de QR codes à découper : un QR par juré, code lisible dessous (si la
 * caméra ne lit pas le QR) et catégorie(s) ouvertes.
 */
export function PrintQrDialog({ open, onOpenChange, cupName, scopeLabel, codes }: PrintQrDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression (bloqueur de fenêtres ?)");
      return;
    }

    const title = `${escapeHtml(cupName)} · QR codes jury public`;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>${title} · ${escapeHtml(scopeLabel)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #000; }
            h1 { text-align: center; font-size: 20px; }
            .scope { text-align: center; font-size: 13px; color: #444; margin: 4px 0 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .code-card {
              border: 1px dashed #999;
              border-radius: 8px;
              padding: 16px;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .qr-container { display: flex; justify-content: center; margin-bottom: 8px; }
            .code-text { font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 1px; }
            .categories { font-size: 12px; font-weight: 600; margin-top: 6px; }
            .hint { font-size: 10px; color: #555; margin-top: 4px; }
            @media print {
              body { padding: 10px; }
              .grid { gap: 10px; }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p class="scope">${escapeHtml(scopeLabel)} · ${codes.length} ${plural(codes.length, "code")}</p>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imprimer la planche</DialogTitle>
          <DialogDescription>
            {scopeLabel} · {codes.length} {plural(codes.length, "QR code")} en attente. Chaque QR
            ouvre une place de juré public et ne sert qu&apos;une fois.
          </DialogDescription>
        </DialogHeader>

        {codes.length === 0 ? (
          <p className="n-label py-8 text-center" style={{ color: "var(--n-text-disabled)" }}>
            Aucun QR code en attente à imprimer.
          </p>
        ) : (
          <div ref={printRef} className="py-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {codes.map((code) => (
                <div
                  key={code.code}
                  className="code-card rounded border border-[var(--n-border)] bg-white p-3 text-center text-black"
                >
                  <div className="qr-container mb-2 flex justify-center">
                    <QRCodeSVG value={getActivationUrl(code.code)} size={100} level="M" includeMargin={false} />
                  </div>
                  <p className="code-text font-mono text-base font-bold tracking-wider">{code.code}</p>
                  <p className="categories mt-1 text-xs font-semibold">{code.categories.join(" · ")}</p>
                  <p className="hint mt-1 text-[10px] text-neutral-600">
                    Scannez pour rejoindre le jury public
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={handlePrint} disabled={codes.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
