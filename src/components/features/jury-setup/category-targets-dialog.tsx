"use client";

import { useEffect, useState } from "react";
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
import { api } from "~/trpc/react";
import type { CategoryCoverageData } from "./shared";

interface Draft {
  pro: string;
  public: string;
}

const toDraft = (v: number | null) => (v === null ? "" : String(v));

/** "" = pas d'objectif ; sinon entier 1..1000. `undefined` = invalide. */
function parseTarget(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n >= 1 && n <= 1000 ? n : undefined;
}

/**
 * Objectifs de jurés par catégorie (pro / public). Édition dédiée via
 * category.update : ces champs ne font pas partie du formulaire catégorie.
 */
export function CategoryTargetsDialog({
  open,
  onOpenChange,
  categories,
  cupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Catégories éditées (une seule depuis une ligne, toutes depuis l'en-tête). */
  categories: CategoryCoverageData[];
  cupId: string;
}) {
  const utils = api.useUtils();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const updateCategory = api.category.update.useMutation();

  useEffect(() => {
    if (!open) return;
    setDrafts(
      Object.fromEntries(
        categories.map((c) => [
          c.categoryId,
          { pro: toDraft(c.targets.pro), public: toDraft(c.targets.public) },
        ])
      )
    );
    // Réinitialisé à chaque ouverture uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const invalid = categories.some((c) => {
    const d = drafts[c.categoryId];
    return d ? parseTarget(d.pro) === undefined || parseTarget(d.public) === undefined : false;
  });

  const handleSave = async () => {
    const changes = categories
      .map((c) => {
        const d = drafts[c.categoryId];
        if (!d) return null;
        const pro = parseTarget(d.pro);
        const pub = parseTarget(d.public);
        if (pro === undefined || pub === undefined) return null;
        if (pro === c.targets.pro && pub === c.targets.public) return null;
        return { id: c.categoryId, targetProJurors: pro, targetPublicJurors: pub };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (changes.length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    const results = await Promise.allSettled(changes.map((c) => updateCategory.mutateAsync(c)));
    setSaving(false);
    void utils.jury.getCoverage.invalidate({ cupId });
    void utils.category.list.invalidate({ cupId });

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      const first = failed[0] as PromiseRejectedResult;
      toast.error(
        `${failed.length} objectif${failed.length > 1 ? "s" : ""} non enregistré${failed.length > 1 ? "s" : ""} : ${
          first.reason instanceof Error ? first.reason.message : "erreur inconnue"
        }`
      );
      return;
    }
    toast.success(changes.length > 1 ? "Objectifs enregistrés" : "Objectif enregistré");
    onOpenChange(false);
  };

  const setField = (id: string, field: keyof Draft, value: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { pro: "", public: "" }), [field]: value } }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Objectifs de jurés</DialogTitle>
          <DialogDescription className="n-label">
            Nombre de jurés visés par catégorie. Laissez vide pour ne fixer aucun objectif (un juré
            actif suffit alors).
          </DialogDescription>
        </DialogHeader>

        {categories.length === 0 ? (
          <p className="n-label py-6 text-center">Aucune catégorie configurée</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
            <div className="grid grid-cols-[1fr_88px_88px] gap-x-3 gap-y-2 items-center">
              <span className="n-label">CATÉGORIE</span>
              <span className="n-label text-center">JURY PRO</span>
              <span className="n-label text-center">JURY PUBLIC</span>
              {categories.map((c) => {
                const d = drafts[c.categoryId] ?? { pro: "", public: "" };
                const proBad = parseTarget(d.pro) === undefined;
                const pubBad = parseTarget(d.public) === undefined;
                return (
                  <div key={c.categoryId} className="contents">
                    <span className="n-font-body text-sm text-[var(--n-text-primary)] truncate" title={c.name}>
                      {c.name}
                    </span>
                    <Input
                      inputMode="numeric"
                      aria-label={`Objectif jury pro · ${c.name}`}
                      aria-invalid={proBad}
                      placeholder="—"
                      value={d.pro}
                      onChange={(e) => setField(c.categoryId, "pro", e.target.value)}
                      className="text-center"
                      style={proBad ? { borderColor: "var(--n-accent)" } : undefined}
                    />
                    <Input
                      inputMode="numeric"
                      aria-label={`Objectif jury public · ${c.name}`}
                      aria-invalid={pubBad}
                      placeholder="—"
                      value={d.public}
                      onChange={(e) => setField(c.categoryId, "public", e.target.value)}
                      className="text-center"
                      style={pubBad ? { borderColor: "var(--n-accent)" } : undefined}
                    />
                  </div>
                );
              })}
            </div>
            {invalid && (
              <p role="alert" className="n-label mt-3" style={{ color: "var(--n-accent)" }}>
                Entier entre 1 et 1000, ou vide
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="n-label">
            Annuler
          </Button>
          <Button onClick={() => void handleSave()} disabled={invalid || saving} className="n-label">
            {saving ? "[...]" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
