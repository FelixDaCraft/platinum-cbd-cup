"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileArchive, FileText, X, AlertCircle, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface FileUploadProps {
  /** API endpoint for upload */
  uploadEndpoint: string;
  /** Callback when upload succeeds */
  onUploadComplete: (result: { url: string; fileName: string; size: number }) => void;
  /** Callback when file is removed */
  onRemove?: () => void;
  /** Current file URL (if already uploaded) */
  currentFileUrl?: string | null;
  /** Current file name (for display) */
  currentFileName?: string | null;
  /** Accepted file types */
  accept?: Record<string, string[]>;
  /** Max file size in bytes */
  maxSize?: number;
  /** Custom label */
  label?: string;
  /** Custom description */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return FileText;
  return FileArchive;
}

export function FileUpload({
  uploadEndpoint,
  onUploadComplete,
  onRemove,
  currentFileUrl,
  currentFileName,
  accept = {
    "application/zip": [".zip"],
    "application/pdf": [".pdf"],
    "application/x-rar-compressed": [".rar"],
    "application/x-7z-compressed": [".7z"],
  },
  maxSize = 50 * 1024 * 1024, // 50MB default
  label = "Glissez un fichier ou cliquez pour selectionner",
  description = "ZIP, PDF, RAR ou 7Z - max 50 Mo",
  disabled = false,
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    fileName: string;
    size: number;
  } | null>(
    currentFileUrl && currentFileName
      ? { url: currentFileUrl, fileName: currentFileName, size: 0 }
      : null
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);
      const file = acceptedFiles[0];

      if (!file) return;

      if (file.size > maxSize) {
        setError(`Le fichier ne doit pas depasser ${formatFileSize(maxSize)}`);
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        // Simulate progress (real progress would need XMLHttpRequest)
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        const response = await fetch(uploadEndpoint, {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Erreur lors de l'upload");
        }

        const result = await response.json();
        setUploadProgress(100);

        const uploadResult = {
          url: result.url,
          fileName: result.fileName || file.name,
          size: result.size || file.size,
        };

        setUploadedFile(uploadResult);
        onUploadComplete(uploadResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [uploadEndpoint, maxSize, onUploadComplete]
  );

  const handleRemove = async () => {
    if (uploadedFile?.url && onRemove) {
      try {
        // Call delete endpoint
        await fetch(`${uploadEndpoint}?url=${encodeURIComponent(uploadedFile.url)}`, {
          method: "DELETE",
        });
      } catch {
        // Ignore delete errors
      }
    }
    setUploadedFile(null);
    onRemove?.();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    disabled: disabled || isUploading,
  });

  // Show uploaded file
  if (uploadedFile) {
    const FileIcon = getFileIcon(uploadedFile.fileName);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-4 w-full"
      >
        <div className="flex items-center gap-3 w-full">
          <div className="p-2 rounded-lg bg-green-500/10 shrink-0">
            <FileIcon className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1 w-0">
            <p className="font-medium text-sm truncate">{uploadedFile.fileName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-green-500 shrink-0" />
              <span className="shrink-0">Fichier uploade</span>
              {uploadedFile.size > 0 && (
                <span className="shrink-0">• {formatFileSize(uploadedFile.size)}</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "glass-card border-2 border-dashed p-6 text-center cursor-pointer transition-all",
          isDragActive && "border-primary bg-primary/5",
          (disabled || isUploading) && "opacity-50 cursor-not-allowed",
          error && "border-destructive"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "p-3 rounded-full transition-colors",
              isDragActive ? "bg-primary/20" : "bg-muted"
            )}
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <Upload
                className={cn(
                  "h-6 w-6",
                  isDragActive ? "text-primary" : "text-muted-foreground"
                )}
              />
            )}
          </div>
          <div className="space-y-1">
            {isUploading ? (
              <>
                <p className="text-sm font-medium">Upload en cours...</p>
                <div className="w-48 h-2 bg-muted rounded-full overflow-hidden mx-auto">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {isDragActive ? "Deposez le fichier ici" : label}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
