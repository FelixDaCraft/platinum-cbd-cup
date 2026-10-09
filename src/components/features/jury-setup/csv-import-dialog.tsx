"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { api } from "~/trpc/react";
import { useInvalidateJury } from "./shared";

type CsvRow = { email: string; firstName?: string; lastName?: string };

interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  errors: string[];
}

function downloadCsvTemplate() {
  const csvContent = "email,prenom,nom\njure1@exemple.fr,Jean,Dupont\njure2@exemple.fr,Marie,Martin";
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "modele-jures.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Invitation e-mail en masse (jury pro) depuis un fichier CSV. */
export function CsvImportDialog({
  cupId,
  open,
  onOpenChange,
}: {
  cupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useInvalidateJury(cupId);
  const [parsed, setParsed] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setParsed([]);
    setParseError(null);
    setResult(null);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const inviteBulkMutation = api.jury.inviteBulk.useMutation({
    onSuccess: (data) => {
      setResult({
        success: data.success,
        failed: data.failed,
        duplicates: data.alreadyInvited,
        errors: data.results.filter((r) => !r.success && r.error).map((r) => `${r.email} : ${r.error}`),
      });
      invalidate();
      toast.success(`${data.success} invitation${data.success > 1 ? "s" : ""} envoyée${data.success > 1 ? "s" : ""}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const parseCsvFile = async (file: File) => {
    reset();
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);

    if (lines.length < 2) {
      setParseError("Le fichier CSV doit contenir une ligne d'en-tête et au moins une ligne de données");
      return;
    }

    const header = lines[0]!.toLowerCase().split(/[,;]/).map((h) => h.trim());
    const emailIndex = header.findIndex((h) => h === "email" || h === "e-mail");
    const prenomIndex = header.findIndex((h) => h === "prenom" || h === "prénom" || h === "firstname");
    const nomIndex = header.findIndex((h) => h === "nom" || h === "lastname");

    if (emailIndex === -1) {
      setParseError("La colonne « email » est requise dans le fichier CSV");
      return;
    }

    const data: CsvRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;
      const cols = line.split(/[,;]/);
      const email = cols[emailIndex]?.trim();
      if (!email) {
        errors.push(`Ligne ${i + 1} : e-mail manquant`);
        continue;
      }
      if (!email.includes("@") || !email.includes(".")) {
        errors.push(`Ligne ${i + 1} : e-mail invalide (${email})`);
        continue;
      }
      data.push({
        email,
        firstName: prenomIndex !== -1 ? cols[prenomIndex]?.trim() || undefined : undefined,
        lastName: nomIndex !== -1 ? cols[nomIndex]?.trim() || undefined : undefined,
      });
    }

    if (errors.length > 0) setParseError(`Lignes ignorées :\n${errors.join("\n")}`);
    setParsed(data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des jurés pro (CSV)</DialogTitle>
          <DialogDescription className="n-label">
            Chaque ligne reçoit une invitation par e-mail au jury professionnel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-3 rounded border border-[var(--n-border)] bg-[var(--n-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-[var(--n-text-secondary)]" aria-hidden />
              <div>
                <p className="n-font-body font-medium text-[var(--n-text-primary)]">Format attendu</p>
                <p className="n-label">Colonnes : email (requis), prenom, nom</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="n-label">
              <Download className="mr-2 h-4 w-4" />
              Modèle
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-file" className="n-label">FICHIER CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void parseCsvFile(file);
              }}
              className="cursor-pointer"
            />
          </div>

          {parseError && (
            <div style={{ borderRadius: 6, border: "1px solid var(--n-accent)", background: "color-mix(in srgb, var(--n-accent) 10%, transparent)", padding: 16 }}>
              <p className="n-label whitespace-pre-wrap" style={{ color: "var(--n-accent)" }}>{parseError}</p>
            </div>
          )}

          {parsed.length > 0 && !result && (
            <div className="space-y-2">
              <p className="n-font-body font-medium text-[var(--n-text-primary)]">
                {parsed.length} juré{parsed.length > 1 ? "s" : ""} détecté{parsed.length > 1 ? "s" : ""}
              </p>
              <div className="max-h-48 overflow-auto rounded border border-[var(--n-border)]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[var(--n-border-visible)]">
                      <TableHead className="n-label">E-MAIL</TableHead>
                      <TableHead className="n-label">PRÉNOM</TableHead>
                      <TableHead className="n-label">NOM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.slice(0, 10).map((row, idx) => (
                      <TableRow key={idx} className="border-b border-[var(--n-border)]">
                        <TableCell className="n-font-body text-[var(--n-text-primary)]">{row.email}</TableCell>
                        <TableCell className="n-font-body text-[var(--n-text-secondary)]">{row.firstName ?? "-"}</TableCell>
                        <TableCell className="n-font-body text-[var(--n-text-secondary)]">{row.lastName ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                    {parsed.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center n-label">… et {parsed.length - 10} autres</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded border border-[var(--n-success)]/30 bg-[var(--n-success)]/10 p-3 text-center">
                  <p className="n-font-data text-2xl font-bold text-[var(--n-success)]">{result.success}</p>
                  <p className="n-label">Envoyées</p>
                </div>
                <div className="rounded border border-[var(--n-warning)]/30 bg-[var(--n-warning)]/10 p-3 text-center">
                  <p className="n-font-data text-2xl font-bold text-[var(--n-warning)]">{result.duplicates}</p>
                  <p className="n-label">Doublons</p>
                </div>
                <div style={{ borderRadius: 6, border: "1px solid color-mix(in srgb, var(--n-accent) 30%, transparent)", background: "color-mix(in srgb, var(--n-accent) 10%, transparent)", padding: 12, textAlign: "center" }}>
                  <p className="n-font-data text-2xl font-bold" style={{ color: "var(--n-accent)" }}>{result.failed}</p>
                  <p className="n-label">Échecs</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div style={{ borderRadius: 6, border: "1px solid color-mix(in srgb, var(--n-accent) 50%, transparent)", background: "color-mix(in srgb, var(--n-accent) 10%, transparent)", padding: 16 }}>
                  <p className="n-label font-medium mb-2" style={{ color: "var(--n-accent)" }}>ERREURS :</p>
                  <ul className="n-label list-disc list-inside" style={{ color: "var(--n-accent)", textTransform: "none" }}>
                    {result.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {result.errors.length > 5 && <li>… et {result.errors.length - 5} autres erreurs</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} className="n-label">
            {result ? "Fermer" : "Annuler"}
          </Button>
          {!result && (
            <Button
              onClick={() => parsed.length > 0 && inviteBulkMutation.mutate({ cupId, juries: parsed })}
              disabled={parsed.length === 0 || inviteBulkMutation.isPending}
              className="n-label"
            >
              {inviteBulkMutation.isPending ? "[...]" : <Send className="mr-2 h-4 w-4" />}
              Inviter {parsed.length > 0 && `(${parsed.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
