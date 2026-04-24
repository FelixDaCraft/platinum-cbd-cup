"use client";

import { Download, Info } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

interface Column {
  name: string;
  required: boolean;
  description?: string;
}

interface CsvFormatInfoProps {
  title: string;
  columns: Column[];
  example: string[];
  templateUrl: string;
}

export function CsvFormatInfo({ title, columns, example, templateUrl }: CsvFormatInfoProps) {
  const requiredCols = columns.filter((c) => c.required);
  const optionalCols = columns.filter((c) => !c.required);

  const handleDownload = () => {
    // Create CSV content with headers and example
    const headers = columns.map((c) => c.name).join(",");
    const exampleRow = example.join(",");
    const content = `${headers}\n${exampleRow}`;

    // Create blob and download
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = templateUrl.split("/").pop() || "template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Example format */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            Format attendu du fichier CSV
          </div>
          <div className="rounded-lg p-3 font-mono text-xs overflow-x-auto" style={{ background: "var(--n-surface-raised)" }}>
            <div className="text-muted-foreground">
              {columns.map((c) => c.name).join(",")}
            </div>
            <div className="text-foreground">
              {example.map((val, i) => (
                <span key={i}>
                  {i > 0 && ","}
                  {val.includes(",") || val.includes(" ") ? `"${val}"` : val}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Download template button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" />
          Télécharger le modèle CSV
        </Button>

        {/* Columns info */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Required columns */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Colonnes obligatoires
            </p>
            <ul className="space-y-1">
              {requiredCols.map((col) => (
                <li key={col.name} className="text-sm flex items-start gap-2">
                  <span className="font-mono text-foreground">{col.name}</span>
                  {col.description && (
                    <span className="text-muted-foreground text-xs">- {col.description}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Optional columns */}
          {optionalCols.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Colonnes optionnelles
              </p>
              <ul className="space-y-1">
                {optionalCols.map((col) => (
                  <li key={col.name} className="text-sm flex items-start gap-2">
                    <span className="font-mono text-muted-foreground">{col.name}</span>
                    {col.description && (
                      <span className="text-muted-foreground text-xs">- {col.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
