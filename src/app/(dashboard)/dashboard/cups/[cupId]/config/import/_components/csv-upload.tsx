"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, AlertCircle } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface CsvUploadProps {
  onFileLoaded: (content: string, fileName: string) => void;
  onClear: () => void;
  isLoading?: boolean;
  currentFile?: string | null;
}

export function CsvUpload({ onFileLoaded, onClear, isLoading, currentFile }: CsvUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      const file = acceptedFiles[0];

      if (!file) return;

      if (!file.name.endsWith(".csv")) {
        setError("Le fichier doit être au format CSV");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Le fichier ne doit pas dépasser 5 Mo");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Detect garbled characters (replacement char) = wrong encoding
        if (content.includes("\uFFFD")) {
          // Re-read with Windows-1252 (Excel default on Windows)
          const fallbackReader = new FileReader();
          fallbackReader.onload = (e2) => {
            onFileLoaded(e2.target?.result as string, file.name);
          };
          fallbackReader.onerror = () => {
            setError("Erreur lors de la lecture du fichier");
          };
          fallbackReader.readAsText(file, "windows-1252");
          return;
        }
        onFileLoaded(content, file.name);
      };
      reader.onerror = () => {
        setError("Erreur lors de la lecture du fichier");
      };
      reader.readAsText(file, "utf-8");
    },
    [onFileLoaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  if (currentFile) {
    return (
      <div className="n-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <p className="font-medium text-sm">{currentFile}</p>
              <p className="text-xs text-muted-foreground">Fichier chargé</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            disabled={isLoading}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all",
          isLoading && "opacity-50 cursor-not-allowed",
          error && "border-destructive"
        )}
        style={{
          background: isDragActive ? "var(--n-surface-raised)" : "var(--n-surface)",
          borderColor: isDragActive ? "var(--n-border-visible)" : error ? undefined : "var(--n-border)",
        }}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <Upload
            className="h-6 w-6"
            style={{ color: isDragActive ? "var(--n-text-primary)" : "var(--n-text-secondary)" }}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive ? "Déposez le fichier ici" : "Glissez un fichier CSV ou cliquez pour sélectionner"}
            </p>
            <p className="text-xs text-muted-foreground">
              Format CSV uniquement, max 5 Mo
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
