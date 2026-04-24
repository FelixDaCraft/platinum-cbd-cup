"use client";

import { useState } from "react";
import { UserCheck, Loader2, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { CsvUpload } from "./csv-upload";
import { CsvFormatInfo } from "./csv-format-info";
import { CsvPreviewTable, type PreviewRow } from "./csv-preview-table";

interface ImportJurysProps {
  cupId: string;
}

const COLUMNS = [
  { name: "nom", required: true, description: "Nom complet" },
  { name: "email", required: true, description: "Email unique" },
  { name: "specialite", required: false, description: "Domaine d'expertise" },
  { name: "bio", required: false, description: "Biographie courte" },
];

const EXAMPLE = ["Expert CBD", "expert@jury.com", "Fleurs", "Juge professionnel depuis 10 ans"];

export function ImportJurys({ cupId }: ImportJurysProps) {
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [sendInvites, setSendInvites] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: number;
    invitesSent: number;
  } | null>(null);

  const utils = api.useUtils();

  const parseCSV = api.cupImport.parseJurysCSV.useMutation({
    onSuccess: (data) => {
      setPreviewRows(data.rows);
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'analyse du fichier");
      handleClear();
    },
  });

  const importJurys = api.cupImport.importJurys.useMutation({
    onSuccess: (data) => {
      setImportResult({
        success: data.imported,
        errors: data.errors,
        invitesSent: data.invitesSent ?? 0
      });
      if (sendInvites) {
        toast.success(`${data.imported} jury(s) importé(s) et invité(s) par email`);
      } else {
        toast.success(`${data.imported} jury(s) importé(s)`);
      }
      // Invalidate related queries
      void utils.cup.invalidate();
      void utils.jury.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'import");
    },
    onSettled: () => {
      setIsImporting(false);
    },
  });

  const handleFileLoaded = (content: string, name: string) => {
    setCsvContent(content);
    setFileName(name);
    setImportResult(null);
    parseCSV.mutate({ cupId, csvContent: content });
  };

  const handleClear = () => {
    setCsvContent(null);
    setFileName(null);
    setPreviewRows([]);
    setImportResult(null);
  };

  const handleImport = () => {
    const validRows = previewRows.filter((r) => r.status === "valid");
    if (validRows.length === 0) {
      toast.error("Aucune ligne valide à importer");
      return;
    }

    setIsImporting(true);
    importJurys.mutate({
      cupId,
      jurys: validRows.map((r) => ({
        nom: r.data.nom!,
        email: r.data.email!,
        specialite: r.data.specialite || null,
        bio: r.data.bio || null,
      })),
      sendInvites,
    });
  };

  const validCount = previewRows.filter((r) => r.status === "valid").length;
  const columns = COLUMNS.map((c) => c.name);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <CardTitle className="text-lg">Import Jurys</CardTitle>
              <CardDescription>
                Importez et invitez vos jurys. Chaque jury recevra un email d&apos;invitation pour créer son compte.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Format Info */}
      <CsvFormatInfo
        title="Format Jurys"
        columns={COLUMNS}
        example={EXAMPLE}
        templateUrl="/templates/jurys-template.csv"
      />

      {/* Upload Zone */}
      <CsvUpload
        onFileLoaded={handleFileLoaded}
        onClear={handleClear}
        isLoading={parseCSV.isPending}
        currentFile={fileName}
      />

      {/* Preview */}
      {previewRows.length > 0 && (
        <>
          <CsvPreviewTable rows={previewRows} columns={columns} />

          {/* Send invites option */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="sendInvites"
                  checked={sendInvites}
                  onCheckedChange={(checked) => setSendInvites(checked === true)}
                  disabled={isImporting}
                />
                <div className="space-y-1">
                  <Label htmlFor="sendInvites" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                    Envoyer les invitations par email
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Chaque jury recevra un email avec un lien pour créer son compte et accéder à la notation.
                    {!sendInvites && " Les jurys devront être invités manuellement plus tard."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Import Actions */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg" style={{ border: "1px solid var(--n-border)", background: "var(--n-surface)" }}>
            <div className="text-sm text-muted-foreground">
              {validCount > 0 ? (
                <span>
                  <strong>{validCount}</strong> jury(s) prêt(s) à être importé(s)
                  {sendInvites && " et invité(s)"}
                </span>
              ) : (
                <span className="text-destructive">Aucune ligne valide à importer</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClear} disabled={isImporting}>
                Annuler
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0 || isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Import en cours...
                  </>
                ) : sendInvites ? (
                  <>Importer et inviter {validCount} jury(s)</>
                ) : (
                  <>Importer {validCount} jury(s)</>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div className="text-sm">
              <p className="font-medium text-green-500">Import terminé</p>
              <p className="text-muted-foreground">
                {importResult.success} jury(s) importé(s)
                {importResult.invitesSent > 0 && `, ${importResult.invitesSent} invitation(s) envoyée(s)`}
                {importResult.errors > 0 && `, ${importResult.errors} erreur(s)`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
