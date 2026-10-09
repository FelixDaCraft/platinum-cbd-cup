"use client";

import { useEffect, useState } from "react";
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
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { type CupJuror, plural, useInvalidateJury } from "./shared";

/**
 * Affectation de catégories :
 *  - « replace » (un juré) : remplace ses catégories (jury.assignCategories) ;
 *  - « add » (sélection) : ajoute des catégories (jury.bulkAssignCategories).
 */
export function CategoryAssignDialog({
  cupId,
  request,
  juries,
  onClose,
  onAssigned,
}: {
  cupId: string;
  request: { ids: string[]; mode: "replace" | "add" } | null;
  juries: CupJuror[];
  onClose: () => void;
  onAssigned: (bulk: boolean) => void;
}) {
  const invalidate = useInvalidateJury(cupId);
  const { data: categories, isLoading } = api.category.list.useQuery({ cupId });
  const [selected, setSelected] = useState<string[]>([]);

  const replace = request?.mode === "replace" && request.ids.length === 1;
  const single = replace ? juries.find((j) => j.id === request.ids[0]) : undefined;

  useEffect(() => {
    if (!request) return;
    setSelected(single ? single.categoryAssignments.map((a) => a.category.id) : []);
    // Préremplissage à l'ouverture seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const assignMutation = api.jury.assignCategories.useMutation({
    onSuccess: () => {
      toast.success("Catégories enregistrées");
      invalidate();
      onAssigned(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkMutation = api.jury.bulkAssignCategories.useMutation({
    onSuccess: (data) => {
      toast.success(
        `${data.assignmentsCreated} affectation${data.assignmentsCreated > 1 ? "s" : ""} créée${data.assignmentsCreated > 1 ? "s" : ""}`
      );
      invalidate();
      onAssigned(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const count = request?.ids.length ?? 0;
  const pending = assignMutation.isPending || bulkMutation.isPending;

  const submit = () => {
    if (!request) return;
    if (replace) {
      assignMutation.mutate({ cupJuryId: request.ids[0]!, categoryIds: selected });
    } else if (selected.length > 0) {
      bulkMutation.mutate({ cupId, cupJuryIds: request.ids, categoryIds: selected });
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{replace ? "Catégories du juré" : "Affecter des catégories"}</DialogTitle>
          <DialogDescription className="n-label">
            {replace
              ? `Sélectionnez les catégories que ${single?.user.name ?? "ce juré"} notera`
              : `Catégories à ajouter aux ${count} ${plural(count, "juré", "jurés")} ${plural(count, "sélectionné")} (les affectations existantes sont conservées)`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {isLoading ? (
            <p className="n-label py-8 text-center">[LOADING...]</p>
          ) : !categories || categories.length === 0 ? (
            <div className="py-10 text-center">
              <p className="n-font-body font-medium text-[var(--n-text-secondary)]">Aucune catégorie configurée</p>
              <p className="n-label mt-1">Créez des catégories dans la configuration de la cup</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => {
                const id = `assign-cat-${category.id}`;
                return (
                  <label
                    key={category.id}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-3 rounded border border-[var(--n-border)] bg-[var(--n-surface)] p-3 transition-colors hover:bg-[var(--n-surface-raised)]"
                  >
                    <Checkbox id={id} checked={selected.includes(category.id)} onCheckedChange={() => toggle(category.id)} />
                    <div className="flex-1">
                      <Label htmlFor={id} className="n-font-body cursor-pointer font-medium text-[var(--n-text-primary)]">
                        {category.name}
                      </Label>
                      {category.description && <p className="n-label mt-0.5">{category.description}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="n-label">
              {selected.length} {plural(selected.length, "catégorie")} {plural(selected.length, "sélectionnée")}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="n-label">
                Annuler
              </Button>
              <Button onClick={submit} disabled={pending || (!replace && selected.length === 0)} className="n-label">
                {pending ? "[...]" : replace ? "Enregistrer" : "Affecter"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
