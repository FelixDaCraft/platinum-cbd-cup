"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Link as LinkIcon, Loader2, ImageIcon, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  placeholder?: string;
  aspectRatio?: "square" | "video" | "wide" | "auto";
  objectFit?: "cover" | "contain";
  maxSize?: number; // in MB
  disabled?: boolean;
  className?: string;
}

type UploadMode = "upload" | "url";

export function ImageUpload({
  value,
  onChange,
  folder = "images",
  placeholder = "Glissez une image ou cliquez pour sélectionner",
  aspectRatio = "video",
  objectFit = "cover",
  maxSize = 5,
  disabled = false,
  className,
}: ImageUploadProps) {
  const [mode, setMode] = useState<UploadMode>("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      setIsUploading(true);
      setUploadProgress(0);
      setCompressionInfo(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        // Simulate progress (actual progress would require XMLHttpRequest)
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Erreur lors de l'upload");
        }

        onChange(data.url);

        if (data.compressionRatio > 0) {
          setCompressionInfo(`Compressé de ${data.compressionRatio}%`);
        }

        // Clear compression info after 3 seconds
        setTimeout(() => setCompressionInfo(null), 3000);

      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [folder, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/svg+xml": [".svg"],
      "image/webp": [".webp"],
      "image/gif": [".gif"],
    },
    maxSize: maxSize * 1024 * 1024,
    multiple: false,
    disabled: disabled || isUploading,
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (rejection?.errors[0]?.code === "file-too-large") {
        setError(`Fichier trop volumineux. Maximum: ${maxSize}MB`);
      } else if (rejection?.errors[0]?.code === "file-invalid-type") {
        setError("Format non supporté. Utilisez JPG, PNG, SVG, WebP ou GIF");
      }
    },
  });

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setError(null);
      onChange(urlInput.trim());
      setUrlInput("");
    }
  };

  const handleRemove = () => {
    onChange("");
    setError(null);
    setCompressionInfo(null);
  };

  // Aspect ratio classes - different for preview vs dropzone
  const previewAspectRatioClass = {
    square: "h-32 w-32",
    video: "h-36 w-full",
    wide: "h-28 w-full",
    auto: "h-40",
  }[aspectRatio];

  // For dropzone (no value), use larger responsive sizes to fit content
  const dropzoneAspectRatioClass = {
    square: "h-40 w-full max-w-xs",
    video: "h-36 w-full",
    wide: "h-28 w-full",
    auto: "h-40 w-full",
  }[aspectRatio];

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mode Toggle - Amber CupMetrics style */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMode("upload")}
          style={mode === "upload" ? { backgroundColor: "#f59e0b", color: "#0a0a0f", borderColor: "#f59e0b" } : undefined}
          className={cn(
            "flex-1 font-medium transition-all",
            mode === "upload"
              ? "shadow-lg shadow-amber-500/30 hover:bg-amber-400"
              : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-amber-500/50"
          )}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMode("url")}
          style={mode === "url" ? { backgroundColor: "#f59e0b", color: "#0a0a0f", borderColor: "#f59e0b" } : undefined}
          className={cn(
            "flex-1 font-medium transition-all",
            mode === "url"
              ? "shadow-lg shadow-amber-500/30 hover:bg-amber-400"
              : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-amber-500/50"
          )}
        >
          <LinkIcon className="mr-2 h-4 w-4" />
          URL
        </Button>
      </div>

      {/* Preview or Upload Zone */}
      {value ? (
        <div className={cn("relative rounded-lg overflow-hidden border border-white/20", previewAspectRatioClass)}>
          <img
            src={value}
            alt="Preview"
            className={cn("w-full h-full", objectFit === "contain" ? "object-contain" : "object-cover")}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "";
              setError("Impossible de charger l'image");
            }}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="border-white/50 bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </div>
          {compressionInfo && (
            <div className="absolute bottom-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <Check className="h-3 w-3" />
              {compressionInfo}
            </div>
          )}
        </div>
      ) : mode === "upload" ? (
        <div
          {...getRootProps()}
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-all cursor-pointer",
            dropzoneAspectRatioClass,
            "min-h-[150px] flex items-center justify-center",
            isDragActive
              ? "border-primary bg-primary/10"
              : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10",
            disabled && "opacity-50 cursor-not-allowed",
            error && "border-destructive/50"
          )}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3 p-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Conversion en WebP...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="p-3 rounded-full bg-white/10">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isDragActive ? "Déposez l'image ici" : placeholder}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, SVG, WebP ou GIF (max {maxSize}MB)
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleUrlSubmit())}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim() || disabled}
              className="bg-primary hover:bg-primary/90"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Entrez l'URL d'une image existante
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <X className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}
