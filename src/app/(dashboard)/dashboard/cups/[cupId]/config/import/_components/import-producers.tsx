"use client";

import { useState } from "react";
import { Users, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { CsvUpload } from "./csv-upload";
import { CsvFormatInfo } from "./csv-format-info";
import { CsvPreviewTable, type PreviewRow } from "./csv-preview-table";

interface ImportProducersProps {
  cupId: string;
}

const COLUMNS = [
  { name: "nom", required: true, description: "Nom complet" },
  { name: "email", required: true, description: "Email unique" },
  { name: "entreprise", required: false, description: "Nom de l'entreprise" },
  { name: "telephone", required: false, description: "Numéro de téléphone" },
  { name: "adresse", required: false, description: "Adresse postale" },
];

const EXAMPLE = ["Jean Dupont", "jean@example.com", "CBD Farm", "0612345678", "123 rue du Chanvre"];

export function ImportProducers({ cupId }: ImportProducersProps) {
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const utils = api.useUtils();

  const parseCSV = api.cupImport.parseProducersCSV.useMutation({
    onSuccess: (data) => {
      setPreviewRows(data.rows);
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'analyse du fichier");
      handleClear();
    },
  });

  const importProducers = api.cupImport.importProducers.useMutation({
    onSuccess: (data) => {
      setImportResult({ success: data.imported, errors: data.errors });
      toast.success(`${data.imported} producteur(s) importé(s) avec succès`);
      // Invalidate related queries
      void utils.cup.invalidate();
      void utils.producer.invalidate();
      void utils.cupImport.getProducersForCup.invalidate();
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
    const validRows = previewRows.filter((r) => r.status === "valid" || r.status === "warning");
    if (validRows.length === 0) {
      toast.error("Aucune ligne valide à importer");
      return;
    }

    setIsImporting(true);
    importProducers.mutate({
      cupId,
      producers: validRows.map((r) => ({
        nom: r.data.nom!,
        email: r.data.email!,
        entreprise: r.data.entreprise || null,
        telephone: r.data.telephone || null,
        adresse: r.data.adresse || null,
      })),
    });
  };

  const validCount = previewRows.filter((r) => r.status === "valid" || r.status === "warning").length;
  const columns = COLUMNS.map((c) => c.name);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <CardTitle className="text-lg">Import Producteurs</CardTitle>
              <CardDescription>
                Importez vos producteurs existants. Un compte utilisateur sera créé pour chaque producteur.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Format Info */}
      <CsvFormatInfo
        title="Format Producteurs"
        columns={COLUMNS}
        example={EXAMPLE}
        templateUrl="/templates/producers-template.csv"
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

          {/* Import Actions */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg" style={{ border: "1px solid var(--n-border)", background: "var(--n-surface)" }}>
            <div className="text-sm text-muted-foreground">
              {validCount > 0 ? (
                <span>
                  <strong>{validCount}</strong> producteur(s) prêt(s) à être importé(s)
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
                ) : (
                  <>Importer {validCount} producteur(s)</>
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
                {importResult.success} producteur(s) importé(s)
                {importResult.errors > 0 && `, ${importResult.errors} erreur(s)`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
