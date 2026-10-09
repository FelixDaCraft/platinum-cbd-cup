"use client";

import { useEffect, useState } from "react";
import { Check, Package, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { formatDate, plural, type PrintableCode } from "./shared";

const MAX_CODES = 200;

interface GenerateQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cupId: string;
  categories: Array<{ id: string; name: string }>;
  /** Catégories cochées à l'ouverture (une seule en général). */
  initialCategoryIds: string[];
  /** Fin de la notation : date d'expiration des codes générés maintenant. */
  ratingEndAt: Date | null;
  /** Lieux déjà utilisés, proposés en saisie. */
  knownDestinations: string[];
  /** Appelé après génération ; `print` si l'organisateur veut la planche tout de suite. */
  onGenerated: (result: { codes: PrintableCode[]; scopeLabel: string; print: boolean }) => void;
}

export function GenerateQrDialog({
  open,
  onOpenChange,
  cupId,
  categories,
  initialCategoryIds,
  ratingEndAt,
  knownDestinations,
  onGenerated,
}: GenerateQrDialogProps) {
  const utils = api.useUtils();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialCategoryIds);
  const [count, setCount] = useState(20);
  const [destination, setDestination] = useState("");
  const [samplesIncluded, setSamplesIncluded] = useState(false);
  const [printAfter, setPrintAfter] = useState(true);

  // Chaque ouverture repart de la catégorie demandée (carte, lien ?category=…).
  useEffect(() => {
    if (open) {
      setSelectedIds(initialCategoryIds);
      setCount(20);
      setDestination("");
      setSamplesIncluded(false);
    }
    // initialCategoryIds n'est lu qu'à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generate = api.juryCodes.generate.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`${data.count} ${plural(data.count, "QR code généré", "QR codes générés")}`);
      void utils.juryCodes.list.invalidate({ cupId });
      void utils.juryCodes.getStats.invalidate({ cupId });
      void utils.jury.getCoverage.invalidate({ cupId });
      const names = categories
        .filter((c) => variables.categoryIds.includes(c.id))
        .map((c) => c.name);
      onOpenChange(false);
      onGenerated({
        codes: data.codes.map((code) => ({ code, categories: names })),
        scopeLabel: `Nouveau lot · ${names.join(" · ")}${variables.destination ? ` · ${variables.destination}` : ""}`,
        print: printAfter,
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    if (selectedIds.length === 0) {
      toast.error("Choisissez au moins une catégorie");
      return;
    }
    generate.mutate({
      cupId,
      categoryIds: selectedIds,
      count,
      destination: destination.trim() || undefined,
      samplesIncluded,
    });
  };

  const expired = ratingEndAt !== null && new Date(ratingEndAt) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Générer des QR codes</DialogTitle>
          <DialogDescription>
            Chaque QR imprimé ouvre une place de juré public. Glissez-le dans la box
            d&apos;échantillons ou remettez-le en main propre.
          </DialogDescription>
        </DialogHeader>

        <form
          id="generate-qr-form"
          className="space-y-5 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {/* Catégories */}
          <fieldset className="space-y-2">
            <legend className="n-label mb-2">Catégorie</legend>
            {categories.length === 0 ? (
              <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                Aucune catégorie configurée pour cette cup.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const active = selectedIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(cat.id)}
                      className="n-tag"
                      style={{
                        cursor: "pointer",
                        gap: 6,
                        background: active ? "var(--n-text-display)" : "transparent",
                        color: active ? "var(--n-black)" : "var(--n-text-secondary)",
                        borderColor: active ? "var(--n-text-display)" : "var(--n-border-visible)",
                      }}
                    >
                      {active && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedIds.length > 1 && (
              <p className="text-xs" style={{ color: "var(--n-warning)" }}>
                Chaque QR ouvrira {selectedIds.length} catégories au même juré.
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="qr-count" className="n-label">
                Quantité
              </Label>
              <Input
                id="qr-count"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_CODES}
                value={count}
                onChange={(e) =>
                  setCount(Math.min(MAX_CODES, Math.max(1, parseInt(e.target.value, 10) || 1)))
                }
              />
              <p className="text-xs" style={{ color: "var(--n-text-disabled)" }}>
                {MAX_CODES} maximum
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-destination" className="n-label">
                Lieu de distribution (optionnel)
              </Label>
              <Input
                id="qr-destination"
                list="qr-known-destinations"
                placeholder="Ex. Le Comptoir Vert — Lyon 2e"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                autoComplete="off"
              />
              <datalist id="qr-known-destinations">
                {knownDestinations.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <p className="text-xs" style={{ color: "var(--n-text-disabled)" }}>
                Pour savoir d&apos;où viennent les jurés.
              </p>
            </div>
          </div>

          {/* Échantillons */}
          <label
            htmlFor="qr-samples"
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
            style={{ borderColor: samplesIncluded ? "var(--n-text-secondary)" : "var(--n-border-visible)" }}
          >
            <Checkbox
              id="qr-samples"
              checked={samplesIncluded}
              onCheckedChange={(v) => setSamplesIncluded(v === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm" style={{ color: "var(--n-text-display)" }}>
                <Package className="h-4 w-4" aria-hidden="true" />
                Échantillons inclus dans la box
              </span>
              <span className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                Le QR est glissé dans la box : la réception des échantillons est confirmée à
                l&apos;activation. Décoché, le juré confirmera lui-même la réception.
              </span>
            </span>
          </label>

          {/* Validité */}
          <div
            className="flex items-start gap-3 rounded-lg p-3 text-xs"
            style={{ background: "var(--n-surface-raised)", color: "var(--n-text-secondary)" }}
          >
            <QrCode className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">
              Usage unique · révocable tant qu&apos;il n&apos;est pas activé.{" "}
              {ratingEndAt ? (
                <>
                  Valable jusqu&apos;à la fin de la notation, le{" "}
                  <strong style={{ color: expired ? "var(--n-accent)" : "var(--n-text-primary)" }}>
                    {formatDate(ratingEndAt, true)}
                  </strong>
                  {expired && " — date déjà passée : ces codes seraient expirés dès leur création"}. Cette
                  date est figée à la génération : la changer ensuite ne prolonge pas les codes déjà
                  créés.
                </>
              ) : (
                <>
                  Aucune fin de notation n&apos;est fixée pour la cup : ces codes n&apos;expireront
                  pas.
                </>
              )}
            </p>
          </div>

          <label htmlFor="qr-print-after" className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              id="qr-print-after"
              checked={printAfter}
              onCheckedChange={(v) => setPrintAfter(v === true)}
            />
            <span style={{ color: "var(--n-text-primary)" }}>Ouvrir la planche à imprimer ensuite</span>
          </label>
        </form>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="generate-qr-form"
            disabled={selectedIds.length === 0 || generate.isPending}
          >
            {printAfter ? <Printer className="mr-2 h-4 w-4" /> : <QrCode className="mr-2 h-4 w-4" />}
            {generate.isPending
              ? "Génération…"
              : `Générer ${count} QR${printAfter ? " et imprimer" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
