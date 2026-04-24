"use client";

import { useState } from "react";
import { Package, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { CsvUpload } from "./csv-upload";
import { CsvFormatInfo } from "./csv-format-info";
import { CsvPreviewTable, type PreviewRow } from "./csv-preview-table";

interface ImportProductsProps {
  cupId: string;
}

const COLUMNS = [
  { name: "nom", required: true, description: "Nom du produit" },
  { name: "producteur_email", required: true, description: "Email du producteur (doit exister)" },
  { name: "categorie", required: true, description: "Nom de la catégorie (doit exister)" },
  { name: "description", required: false, description: "Description du produit" },
  { name: "thc", required: false, description: "Taux de THC (%)" },
  { name: "cbd", required: false, description: "Taux de CBD (%)" },
];

const EXAMPLE = ["Super Haze", "jean@example.com", "Fleurs Indoor", "Une variété exceptionnelle", "0.2", "18"];

export function ImportProducts({ cupId }: ImportProductsProps) {
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const utils = api.useUtils();

  // Get categories for validation info
  const { data: categories } = api.cupImport.getCategoriesForCup.useQuery({ cupId });

  // Get producers for validation info
  const { data: producers } = api.cupImport.getProducersForCup.useQuery({ cupId });

  const parseCSV = api.cupImport.parseProductsCSV.useMutation({
    onSuccess: (data) => {
      setPreviewRows(data.rows);
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'analyse du fichier");
      handleClear();
    },
  });

  const importProducts = api.cupImport.importProducts.useMutation({
    onSuccess: (data) => {
      setImportResult({ success: data.imported, errors: data.errors });
      toast.success(`${data.imported} produit(s) importé(s) avec succès`);
      // Invalidate related queries
      void utils.cup.invalidate();
      void utils.product.invalidate();
      void utils.category.invalidate();
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
    importProducts.mutate({
      cupId,
      products: validRows.map((r) => ({
        nom: r.data.nom!,
        producteur_email: r.data.producteur_email!,
        categorie: r.data.categorie!,
        description: r.data.description || null,
        thc: r.data.thc || null,
        cbd: r.data.cbd || null,
      })),
    });
  };

  const validCount = previewRows.filter((r) => r.status === "valid" || r.status === "warning").length;
  const columns = COLUMNS.map((c) => c.name);

  const hasCategories = categories && categories.length > 0;
  const hasProducers = producers && producers.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <CardTitle className="text-lg">Import Produits</CardTitle>
              <CardDescription>
                Importez les produits de vos participants. Chaque produit sera lié à son producteur et sa catégorie.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Prerequisites Check */}
      {(!hasCategories || !hasProducers) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Prérequis non remplis :</strong>
            <ul className="mt-1 ml-4 list-disc text-sm">
              {!hasCategories && <li>Aucune catégorie créée. Créez d&apos;abord vos catégories.</li>}
              {!hasProducers && <li>Aucun producteur importé. Importez d&apos;abord vos producteurs.</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Available data info */}
      {(hasCategories || hasProducers) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {hasCategories && (
            <div className="px-3 py-1.5 rounded-full" style={{ border: "1px solid var(--n-border)", background: "var(--n-surface)" }}>
              <span className="text-muted-foreground">Catégories disponibles : </span>
              <span className="font-medium">{categories?.map((c) => c.name).join(", ")}</span>
            </div>
          )}
          {hasProducers && (
            <div className="px-3 py-1.5 rounded-full" style={{ border: "1px solid var(--n-border)", background: "var(--n-surface)" }}>
              <span className="text-muted-foreground">Producteurs : </span>
              <span className="font-medium">{producers?.length}</span>
            </div>
          )}
        </div>
      )}

      {/* Format Info */}
      <CsvFormatInfo
        title="Format Produits"
        columns={COLUMNS}
        example={EXAMPLE}
        templateUrl="/templates/products-template.csv"
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
                  <strong>{validCount}</strong> produit(s) prêt(s) à être importé(s)
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
                  <>Importer {validCount} produit(s)</>
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
                {importResult.success} produit(s) importé(s)
                {importResult.errors > 0 && `, ${importResult.errors} erreur(s)`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
