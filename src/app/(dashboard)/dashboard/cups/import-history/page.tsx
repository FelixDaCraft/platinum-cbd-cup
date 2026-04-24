"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Check,
  FileSpreadsheet,
  Trophy,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";

// Step 1: Edition info schema
const editionSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  year: z.coerce.number().min(1900).max(new Date().getFullYear()),
  edition: z.string().optional(),
  description: z.string().optional(),
});

type EditionFormData = z.infer<typeof editionSchema>;

// Steps configuration
const steps = [
  { id: 1, title: "Edition", description: "Informations de l'edition" },
  { id: 2, title: "Fichier", description: "Import du fichier CSV" },
  { id: 3, title: "Apercu", description: "Verification des donnees" },
  { id: 4, title: "Import", description: "Confirmation et import" },
];

type ParsedRow = {
  index: number;
  data: {
    producerName: string;
    productName: string;
    email?: string;
    category?: string;
    medal: string;
    rank?: number;
    score?: number;
  };
  status: "valid" | "invalid" | "warning";
  error?: string;
};

type ParseResult = {
  rows: ParsedRow[];
  detectedColumns: {
    producer: boolean;
    product: boolean;
    email: boolean;
    category: boolean;
    medal: boolean;
    rank: boolean;
    score: boolean;
  };
};

export default function ImportHistoryPage() {
  const router = useRouter();
  const utils = api.useUtils();

  const [currentStep, setCurrentStep] = useState(1);
  const [historicalCupId, setHistoricalCupId] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [importStats, setImportStats] = useState<{
    producersCreated: number;
    resultsCreated: number;
    errors: string[];
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditionFormData>({
    resolver: zodResolver(editionSchema),
    defaultValues: {
      year: new Date().getFullYear() - 1,
    },
  });

  const createEdition = api.historicalImport.create.useMutation({
    onSuccess: (cup) => {
      if (cup) {
        setHistoricalCupId(cup.id);
        setCurrentStep(2);
        toast.success("Edition creee avec succes");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const parseCSV = api.historicalImport.parseResultsCSV.useMutation({
    onSuccess: (result) => {
      setParseResult(result);
      setCurrentStep(3);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const importResults = api.historicalImport.importResults.useMutation({
    onSuccess: (stats) => {
      setImportStats(stats);
      setImportComplete(true);
      setCurrentStep(4);
      void utils.historicalImport.list.invalidate();
      toast.success(`${stats.resultsCreated} resultats importes avec succes`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onEditionSubmit = (data: EditionFormData) => {
    createEdition.mutate(data);
  };

  const handleFileDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) readFile(file);
    },
    []
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file);
  };

  const handleParseCSV = () => {
    if (!historicalCupId || !csvContent) return;
    parseCSV.mutate({ historicalCupId, csvContent });
  };

  const handleImport = () => {
    if (!historicalCupId || !parseResult) return;
    const validResults = parseResult.rows
      .filter((r) => r.status !== "invalid")
      .map((r) => ({
        productName: r.data.productName,
        producerName: r.data.producerName,
        producerEmail: r.data.email,
        category: r.data.category,
        medal: r.data.medal as "gold" | "silver" | "bronze" | "mention" | "none",
        rank: r.data.rank,
        score: r.data.score,
      }));
    importResults.mutate({ historicalCupId, results: validResults });
  };

  const getMedalBadge = (medal: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      gold: { color: "var(--n-warning)", label: "Or" },
      silver: { color: "var(--n-text-secondary)", label: "Argent" },
      bronze: { color: "var(--n-text-secondary)", label: "Bronze" },
      mention: { color: "var(--n-interactive)", label: "Mention" },
      none: { color: "var(--n-text-disabled)", label: "-" },
    };
    const config = configs[medal] ?? configs.none!;
    return (
      <span
        className="n-label"
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "4px",
          border: `1px solid ${config.color}`,
          color: config.color,
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/cups")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="n-font-body text-2xl font-semibold">Importer un historique</h1>
          <p className="n-label mt-1" style={{ color: "var(--n-text-secondary)" }}>
            Importez les résultats d&apos;une édition passée
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="n-card p-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                      border: `1px solid ${isComplete ? "var(--n-text-display)" : isActive ? "var(--n-text-display)" : "var(--n-border-visible)"}`,
                      background: isComplete ? "var(--n-text-display)" : "transparent",
                      color: isComplete ? "var(--n-surface)" : isActive ? "var(--n-text-display)" : "var(--n-text-disabled)",
                    }}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="n-font-data text-xs font-bold">{step.id}</span>
                    )}
                  </div>
                  <span
                    className="mt-2 n-label text-xs"
                    style={{
                      color: isActive ? "var(--n-text-primary)" : "var(--n-text-secondary)",
                      fontWeight: isActive ? 600 : undefined,
                    }}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    style={{
                      height: "1px",
                      flex: 1,
                      margin: "0 8px",
                      background: currentStep > step.id ? "var(--n-text-display)" : "var(--n-border-visible)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Edition Info */}
      {currentStep === 1 && (
        <div className="n-card p-6">
          <h2 className="n-font-body text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Informations de l&apos;édition
          </h2>
          <form onSubmit={handleSubmit(onEditionSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="n-label">Nom de la cup *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Concours des Miels de France"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="n-label" style={{ color: "var(--n-accent)" }}>{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="year" className="n-label">Année *</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="2023"
                  {...register("year")}
                />
                {errors.year && (
                  <p className="n-label" style={{ color: "var(--n-accent)" }}>{errors.year.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edition" className="n-label">Édition (optionnel)</Label>
              <Input
                id="edition"
                placeholder="Ex: 5eme edition"
                {...register("edition")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="n-label">Description (optionnel)</Label>
              <Textarea
                id="description"
                placeholder="Notes sur cette edition..."
                {...register("description")}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={createEdition.isPending}>
                {createEdition.isPending ? "[...]" : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Continuer
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: File Upload */}
      {currentStep === 2 && (
        <div className="n-card p-6">
          <h2 className="n-font-body text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import du fichier CSV
          </h2>

          <div className="mb-4 p-4 rounded-sm text-sm space-y-2" style={{ background: "var(--n-surface-raised)", border: "1px solid var(--n-border)" }}>
            <p className="n-label font-medium" style={{ color: "var(--n-text-primary)" }}>Format attendu :</p>
            <ul className="list-disc list-inside n-label space-y-1" style={{ color: "var(--n-text-secondary)" }}>
              <li>Colonnes requises : <code>producteur</code>, <code>produit</code></li>
              <li>Colonnes optionnelles : <code>email</code>, <code>categorie</code>, <code>medaille</code>, <code>rang</code>, <code>score</code></li>
              <li>Séparateur : virgule (,) ou point-virgule (;)</li>
            </ul>
          </div>

          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: `2px dashed ${csvContent ? "var(--n-text-display)" : "var(--n-border-visible)"}`,
              borderRadius: "4px",
              padding: "48px",
              textAlign: "center",
              transition: "colors 0.2s",
              background: csvContent ? "color-mix(in srgb, var(--n-surface-raised) 50%, transparent)" : "transparent",
            }}
          >
            {csvContent ? (
              <div className="space-y-3">
                <CheckCircle className="h-10 w-10 mx-auto" style={{ color: "var(--n-text-display)" }} />
                <p className="n-label font-medium" style={{ color: "var(--n-text-primary)" }}>Fichier chargé</p>
                <p className="n-font-data text-xs" style={{ color: "var(--n-text-secondary)" }}>
                  {csvContent.split("\n").length - 1} lignes détectées
                </p>
                <Button variant="ghost" size="sm" onClick={() => setCsvContent("")}>
                  <X className="mr-1 h-3 w-3" />
                  Changer de fichier
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <FileSpreadsheet className="h-10 w-10 mx-auto" style={{ color: "var(--n-text-disabled)" }} />
                <div>
                  <p className="n-label font-medium" style={{ color: "var(--n-text-primary)" }}>Glissez votre fichier CSV ici</p>
                  <p className="n-font-data text-xs" style={{ color: "var(--n-text-secondary)" }}>ou cliquez pour parcourir</p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    Parcourir
                  </label>
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <Button
              onClick={handleParseCSV}
              disabled={!csvContent || parseCSV.isPending}
            >
              {parseCSV.isPending ? "[...]" : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Analyser
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {currentStep === 3 && parseResult && (
        <div className="n-card p-6">
          <h2 className="n-font-body text-lg font-semibold mb-4 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Aperçu des données
          </h2>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="n-card p-3 text-center">
              <p className="n-font-data text-2xl font-bold" style={{ color: "var(--n-text-display)" }}>{parseResult.rows.length}</p>
              <p className="n-label text-xs" style={{ color: "var(--n-text-secondary)" }}>Total lignes</p>
            </div>
            <div className="n-card p-3 text-center">
              <p className="n-font-data text-2xl font-bold" style={{ color: "var(--n-success)" }}>
                {parseResult.rows.filter((r) => r.status === "valid").length}
              </p>
              <p className="n-label text-xs" style={{ color: "var(--n-text-secondary)" }}>Valides</p>
            </div>
            <div className="n-card p-3 text-center">
              <p className="n-font-data text-2xl font-bold" style={{ color: "var(--n-accent)" }}>
                {parseResult.rows.filter((r) => r.status === "invalid").length}
              </p>
              <p className="n-label text-xs" style={{ color: "var(--n-text-secondary)" }}>Invalides</p>
            </div>
          </div>

          {/* Detected columns */}
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <span className="n-label text-xs" style={{ color: "var(--n-text-secondary)" }}>Colonnes détectées :</span>
            {parseResult.detectedColumns.producer && <span className="n-tag">Producteur</span>}
            {parseResult.detectedColumns.product && <span className="n-tag">Produit</span>}
            {parseResult.detectedColumns.email && <span className="n-tag">Email</span>}
            {parseResult.detectedColumns.category && <span className="n-tag">Catégorie</span>}
            {parseResult.detectedColumns.medal && <span className="n-tag">Médaille</span>}
            {parseResult.detectedColumns.rank && <span className="n-tag">Rang</span>}
            {parseResult.detectedColumns.score && <span className="n-tag">Score</span>}
          </div>

          {/* Preview table */}
          <div className="max-h-[400px] overflow-auto rounded-sm border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"><span className="n-label">#</span></TableHead>
                  <TableHead><span className="n-label">Producteur</span></TableHead>
                  <TableHead><span className="n-label">Produit</span></TableHead>
                  <TableHead><span className="n-label">Catégorie</span></TableHead>
                  <TableHead><span className="n-label">Médaille</span></TableHead>
                  <TableHead><span className="n-label">Rang</span></TableHead>
                  <TableHead><span className="n-label">Statut</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parseResult.rows.slice(0, 50).map((row) => (
                  <TableRow
                    key={row.index}
                    style={row.status === "invalid" ? { background: "color-mix(in srgb, var(--n-accent) 5%, transparent)" } : undefined}
                  >
                    <TableCell className="n-font-data" style={{ color: "var(--n-text-secondary)" }}>
                      {row.index + 1}
                    </TableCell>
                    <TableCell className="n-label font-medium" style={{ color: "var(--n-text-primary)" }}>
                      {row.data.producerName || "-"}
                    </TableCell>
                    <TableCell className="n-label" style={{ color: "var(--n-text-primary)" }}>{row.data.productName || "-"}</TableCell>
                    <TableCell className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                      {row.data.category || "-"}
                    </TableCell>
                    <TableCell>{getMedalBadge(row.data.medal)}</TableCell>
                    <TableCell className="n-font-data" style={{ color: "var(--n-text-secondary)" }}>
                      {row.data.rank ?? "-"}
                    </TableCell>
                    <TableCell>
                      {row.status === "valid" ? (
                        <CheckCircle className="h-4 w-4" style={{ color: "var(--n-success)" }} />
                      ) : (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" style={{ color: "var(--n-accent)" }} />
                          <span className="n-label text-xs" style={{ color: "var(--n-accent)" }}>{row.error}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {parseResult.rows.length > 50 && (
            <p className="n-font-data text-xs mt-2 text-center" style={{ color: "var(--n-text-secondary)" }}>
              Affichage des 50 premières lignes sur {parseResult.rows.length}
            </p>
          )}

          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                importResults.isPending ||
                parseResult.rows.filter((r) => r.status === "valid").length === 0
              }
            >
              {importResults.isPending ? "[...]" : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Importer{" "}
                  <span className="n-font-data ml-1">
                    {parseResult.rows.filter((r) => r.status === "valid").length}
                  </span>{" "}
                  résultats
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {currentStep === 4 && importComplete && importStats && (
        <div className="n-card p-8 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--n-success)" }} />
          <h2 className="n-font-body text-2xl font-semibold mb-2" style={{ color: "var(--n-text-display)" }}>Import terminé</h2>
          <p className="n-label mb-6" style={{ color: "var(--n-text-secondary)" }}>
            L&apos;édition historique a été importée avec succès.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-6">
            <div className="n-card p-4">
              <p className="n-font-data text-3xl font-bold" style={{ color: "var(--n-text-display)" }}>
                {importStats.resultsCreated}
              </p>
              <p className="n-label text-xs" style={{ color: "var(--n-text-secondary)" }}>Résultats</p>
            </div>
            <div className="n-card p-4">
              <p className="n-font-data text-3xl font-bold" style={{ color: "var(--n-text-display)" }}>
                {importStats.producersCreated}
              </p>
              <p className="n-label text-xs" style={{ color: "var(--n-text-secondary)" }}>Nouveaux producteurs</p>
            </div>
          </div>

          {importStats.errors.length > 0 && (
            <div className="mb-6 p-4 rounded-sm text-left max-w-md mx-auto" style={{ border: "1px solid var(--n-border-visible)" }}>
              <p className="n-label font-medium mb-2" style={{ color: "var(--n-warning)" }}>
                {importStats.errors.length} avertissement(s) :
              </p>
              <ul className="n-font-data text-xs space-y-1" style={{ color: "var(--n-text-secondary)" }}>
                {importStats.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>— {err}</li>
                ))}
                {importStats.errors.length > 5 && (
                  <li>...et {importStats.errors.length - 5} autres</li>
                )}
              </ul>
            </div>
          )}

          <Button onClick={() => router.push("/dashboard/cups")}>
            Retour aux cups
          </Button>
        </div>
      )}
    </div>
  );
}
