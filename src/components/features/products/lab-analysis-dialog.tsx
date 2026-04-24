"use client";

/**
 * Lab analysis upload + review + confirm dialog.
 *
 * States:
 *   empty     → no analysis on record, organizer uploads a PDF
 *   uploading → POST to /api/upload/lab-analysis, waiting for parse
 *   preview   → parsed PDF shown, organizer reviews & confirms
 *   saved     → analysis already stored, shown as read-only with delete/re-upload
 *   error     → upload or parsing failed
 *
 * Data flow:
 *   1. Upload file → route.ts returns {pdfUrl, pdfFilename, parsed}
 *   2. Organizer clicks "Confirmer" → tRPC confirmLabAnalysis upserts the row
 *   3. Delete button → tRPC deleteLabAnalysis removes row and PDF from disk
 */

import { useState, useRef, useMemo, useId } from "react";
import { formatTerpeneAroma } from "~/lib/lab-analysis/terpene-sensory";
import {
  FlaskConical,
  Loader2,
  CheckCircle,
  XCircle,
  Upload,
  Trash2,
  FileText,
} from "lucide-react";
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
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

export interface LabAnalysisDialogProps {
  productId: string;
  productName: string;
  anonymousCode: string | null;
}

type CompoundRow = {
  abbreviation: string;
  name: string;
  percentage: number | null;
  flag: "ND" | "LOQ" | "value";
  uncertainty: number | null;
};

type Parsed = {
  metadata: {
    labName: string;
    analysisNumber: string | null;
    sfpCode: string | null;
    serial: string | null;
    productDescription: string | null;
    sampleType: string | null;
    methodName: string | null;
    receivedAt: string | null;
    approvedAt: string | null;
  };
  totals: {
    terpenesTotal: number | null;
  };
  terpenes: CompoundRow[];
  computedTerpeneSum: number;
};

type UploadResponse = {
  success: true;
  pdfUrl: string;
  pdfFilename: string;
  storedFilename: string;
  parsed: Parsed;
};

type DialogState =
  | { kind: "empty" }
  | { kind: "uploading" }
  | { kind: "preview"; data: UploadResponse }
  | { kind: "error"; message: string };

export function LabAnalysisDialog({
  productId,
  productName,
  anonymousCode,
}: LabAnalysisDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DialogState>({ kind: "empty" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Stable unique id for the <label htmlFor>/<input id> pair. The native
  // label pattern is the most reliable way to open the file picker from
  // inside a Radix Dialog — programmatic `input.click()` on a display:none
  // input is unreliable in Chrome under some conditions.
  const fileInputId = useId();

  const utils = api.useUtils();
  const existingQuery = api.product.getLabAnalysis.useQuery(
    { productId },
    { enabled: open },
  );
  const existing = existingQuery.data?.analysis ?? null;

  const confirmMutation = api.product.confirmLabAnalysis.useMutation({
    onSuccess: () => {
      void utils.product.getLabAnalysis.invalidate({ productId });
      void utils.product.listByCupGroupedByCategory.invalidate();
      setState({ kind: "empty" });
      setOpen(false);
    },
    onError: (err) => {
      setState({ kind: "error", message: err.message });
    },
  });

  const deleteMutation = api.product.deleteLabAnalysis.useMutation({
    onSuccess: () => {
      void utils.product.getLabAnalysis.invalidate({ productId });
      void utils.product.listByCupGroupedByCategory.invalidate();
    },
  });

  const handleFileChosen = async (file: File) => {
    setState({ kind: "uploading" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", productId);
      const res = await fetch("/api/upload/lab-analysis", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as
        | UploadResponse
        | { error: string };
      if (!res.ok || "error" in json) {
        setState({
          kind: "error",
          message: "error" in json ? json.error : "Erreur réseau",
        });
        return;
      }
      setState({ kind: "preview", data: json });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inattendue",
      });
    }
  };

  const handleConfirm = () => {
    if (state.kind !== "preview") return;
    confirmMutation.mutate({
      productId,
      pdfUrl: state.data.pdfUrl,
      pdfFilename: state.data.pdfFilename,
      parsed: state.data.parsed,
    });
  };

  const handleDelete = () => {
    if (!confirm("Supprimer l'analyse ? Le PDF sera retiré.")) return;
    deleteMutation.mutate({ productId });
  };

  const handleReset = () => {
    setState({ kind: "empty" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) handleReset();
    setOpen(next);
  };

  // A badge next to the trigger button when an analysis already exists.
  const hasExisting = !!existing;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <FlaskConical className="h-3 w-3" />
          Labo
          {hasExisting && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              ✓
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Analyse de laboratoire</DialogTitle>
          <DialogDescription>
            {anonymousCode ? `${anonymousCode} — ` : ""}
            {productName}
          </DialogDescription>
        </DialogHeader>

        {existingQuery.isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Chargement...
          </div>
        ) : state.kind === "empty" && existing ? (
          <ExistingAnalysisView
            analysis={existing}
            onDelete={handleDelete}
            fileInputId={fileInputId}
            isDeleting={deleteMutation.isPending}
          />
        ) : state.kind === "empty" ? (
          <EmptyView fileInputId={fileInputId} />
        ) : state.kind === "uploading" ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Lecture du PDF...
            </p>
          </div>
        ) : state.kind === "preview" ? (
          <PreviewView parsed={state.data.parsed} />
        ) : (
          <ErrorView message={state.message} onRetry={handleReset} />
        )}

        {/* Native file input. Kept visually hidden (sr-only, NOT display:none)
            so labels with htmlFor can open it reliably across browsers. */}
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFileChosen(f);
            // Reset so the same file can be re-selected later.
            e.target.value = "";
          }}
        />

        <DialogFooter>
          {state.kind === "preview" ? (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={confirmMutation.isPending}
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {existing ? "Remplacer l'analyse" : "Confirmer et enregistrer"}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-views                                                                  */
/* -------------------------------------------------------------------------- */

function EmptyView({ fileInputId }: { fileInputId: string }) {
  return (
    <label
      htmlFor={fileInputId}
      className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-muted/50"
    >
      <Upload className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="font-medium">Importer un certificat d&apos;analyse (PDF)</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Format SpectralFingerprints (cannabinoïdes + terpènes)
        </p>
      </div>
    </label>
  );
}

function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 rounded-full bg-red-100 p-3">
        <XCircle className="h-8 w-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-destructive">
        Échec du traitement
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

type PreviewProps = { parsed: Parsed };

function PreviewView({ parsed }: PreviewProps) {
  const sortedTerpenes = useMemo(
    () =>
      [...parsed.terpenes].sort(
        (a, b) => (b.percentage ?? 0) - (a.percentage ?? 0),
      ),
    [parsed.terpenes],
  );

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4" /> Informations labo
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          <MetaRow label="Labo" value={parsed.metadata.labName} />
          <MetaRow label="N° d'analyse" value={parsed.metadata.analysisNumber} />
          <MetaRow label="Code SFP" value={parsed.metadata.sfpCode} />
          <MetaRow label="Série" value={parsed.metadata.serial} />
          <MetaRow label="Méthode" value={parsed.metadata.methodName} />
          <MetaRow label="Échantillon" value={parsed.metadata.sampleType} />
          <MetaRow label="Reçu le" value={parsed.metadata.receivedAt} />
          <MetaRow label="Approuvé le" value={parsed.metadata.approvedAt} />
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TotalCard
          label="Terpènes total (labo)"
          value={parsed.totals.terpenesTotal}
          highlight
        />
        <TotalCard
          label="Σ calculée sur lignes"
          value={parsed.computedTerpeneSum}
        />
      </div>

      <CompoundTable
        title={`Profil terpénique (${parsed.terpenes.length} composés)`}
        rows={sortedTerpenes}
      />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="truncate font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function TotalCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border p-3 text-center " +
        (highlight ? "border-primary bg-primary/5" : "bg-muted/30")
      }
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-bold">
        {value === null ? "—" : `${value.toFixed(2)}%`}
      </p>
    </div>
  );
}

function CompoundTable({
  title,
  rows,
}: {
  title: string;
  rows: CompoundRow[];
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
        {title}
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/20 text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left font-normal">Abr.</th>
              <th className="px-2 py-1 text-left font-normal">Composé</th>
              <th className="px-2 py-1 text-right font-normal">%</th>
              <th className="px-2 py-1 text-left font-normal">Arômes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const aroma = formatTerpeneAroma(r.abbreviation);
              return (
                <tr key={r.abbreviation} className="border-t">
                  <td className="px-2 py-1 font-mono">{r.abbreviation}</td>
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 py-1 text-right font-mono">
                    {r.flag === "value"
                      ? `${r.percentage}%`
                      : r.flag === "LOQ"
                        ? "<LOQ"
                        : "ND"}
                  </td>
                  <td className="px-2 py-1 italic text-muted-foreground">
                    {aroma || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ExistingAnalysis = {
  labName: string;
  analysisNumber: string | null;
  pdfUrl: string;
  terpenesTotal: string | null;
  uploadedAt: Date | string;
};

function ExistingAnalysisView({
  analysis,
  onDelete,
  fileInputId,
  isDeleting,
}: {
  analysis: ExistingAnalysis;
  onDelete: () => void;
  fileInputId: string;
  isDeleting: boolean;
}) {
  const uploaded =
    typeof analysis.uploadedAt === "string"
      ? new Date(analysis.uploadedAt)
      : analysis.uploadedAt;

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">Analyse enregistrée</p>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <MetaRow label="Labo" value={analysis.labName} />
          <MetaRow label="N° d'analyse" value={analysis.analysisNumber} />
          <MetaRow
            label="Terpènes total"
            value={
              analysis.terpenesTotal ? `${analysis.terpenesTotal}%` : null
            }
          />
          <MetaRow
            label="Importée le"
            value={uploaded.toLocaleString("fr-FR")}
          />
        </dl>
        <div className="mt-4">
          <a
            href={analysis.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            Voir le PDF source
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <label htmlFor={fileInputId} className="cursor-pointer">
            <Upload className="mr-2 h-4 w-4" />
            Remplacer le PDF
          </label>
        </Button>
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Supprimer
        </Button>
      </div>
    </div>
  );
}
