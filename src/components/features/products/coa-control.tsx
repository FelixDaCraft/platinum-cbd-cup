"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export interface CoaControlProps {
  productId: string;
  coaFile: string | null;
  /** Appelé après un dépôt ou un retrait, pour rafraîchir la liste affichée. */
  onChanged: () => void;
}

/**
 * Certificat d'analyse (COA) d'un produit : consultation, dépôt, remplacement
 * et retrait. Partagé par la carte produit de l'organisation et « Mes
 * inscriptions » du producteur ; le serveur vérifie que l'appelant est l'un
 * ou l'autre. Le fichier n'est servi qu'à eux, jamais au jury.
 */
export function CoaControl({ productId, coaFile, onChanged }: CoaControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const removeCoa = api.product.removeCoa.useMutation({
    onSuccess: () => {
      toast.success("COA retiré");
      onChanged();
    },
    onError: (error) => toast.error(error.message),
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productId", productId);
      const response = await fetch("/api/upload/coa", { method: "POST", body: formData });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Échec de l'envoi du COA");
      toast.success(coaFile ? "COA remplacé" : "COA déposé");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'envoi du COA");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const busy = uploading || removeCoa.isPending;

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {coaFile ? (
        <>
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <a href={coaFile} target="_blank" rel="noopener noreferrer" title="Voir le COA (PDF)">
              <FileText className="h-4 w-4 mr-1" />
              COA
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            title="Remplacer le COA"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={busy}
            onClick={() => removeCoa.mutate({ productId })}
            title="Retirer le COA"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          title="Déposer le certificat d'analyse (PDF)"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          COA
        </Button>
      )}
    </div>
  );
}
