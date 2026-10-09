"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { JURY_PANEL_LABELS } from "~/lib/enums";
import { api, type RouterOutputs } from "~/trpc/react";
import { ErrorState, LoadingState, TagBadge, type JuryPanel, plural, useInvalidateJury } from "./shared";

type DirectoryEntry = RouterOutputs["jury"]["listDirectory"]["items"][number];
type AddResult = RouterOutputs["jury"]["addExistingJurors"];

const RESULT_META: Record<AddResult["results"][number]["status"], { label: string; color: string }> = {
  added: { label: "AJOUTÉ", color: "var(--n-success)" },
  updated: { label: "MIS À JOUR", color: "var(--n-interactive)" },
  unchanged: { label: "INCHANGÉ", color: "var(--n-text-secondary)" },
  error: { label: "REFUSÉ", color: "var(--n-accent)" },
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Raison pour laquelle un juré du vivier ne peut pas être ajouté à ce jury. */
function blockedReason(entry: DirectoryEntry, panel: JuryPanel): string | null {
  if (!entry.inCup) return null;
  const label = JURY_PANEL_LABELS[entry.inCup.panel];
  if (entry.inCup.isActive) return `Déjà dans la cup · ${label}`;
  if (entry.inCup.panel !== panel) return `Déjà dans la cup · ${label} (désactivé) : changez son jury`;
  return null;
}

function historyLine(entry: DirectoryEntry): string {
  if (entry.cups.length === 0) return "Profil juré, aucune cup jugée";
  return entry.cups
    .slice(0, 3)
    .map(
      (c) =>
        `${c.year} · ${c.cupName} · ${JURY_PANEL_LABELS[c.panel].toLowerCase()}${
          c.completionRate !== null ? ` · ${c.completionRate} % noté` : ""
        }${c.isActive ? "" : " (retiré)"}`
    )
    .join(" — ");
}

/**
 * Ajout direct de jurés déjà connus (vivier) au jury choisi, sans invitation :
 * recherche, sélection multiple, catégories, e-mail facultatif.
 */
export function ExistingJurorsPicker({
  cupId,
  panel,
  presetCategoryId,
  onDone,
}: {
  cupId: string;
  panel: JuryPanel;
  presetCategoryId?: string;
  onDone: () => void;
}) {
  const invalidate = useInvalidateJury(cupId);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim());
  const [selected, setSelected] = useState<Map<string, DirectoryEntry>>(new Map());
  const [categoryIds, setCategoryIds] = useState<string[]>(presetCategoryId ? [presetCategoryId] : []);
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState<AddResult | null>(null);

  const directory = api.jury.listDirectory.useQuery(
    { cupId, search: debouncedSearch || undefined, limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const coverage = api.jury.getCoverage.useQuery({ cupId });
  const categories = useMemo(() => coverage.data?.categories ?? [], [coverage.data]);

  const addMutation = api.jury.addExistingJurors.useMutation({
    onSuccess: (data) => {
      setResult(data);
      invalidate();
      const parts = [
        data.added > 0 && `${data.added} ${plural(data.added, "ajouté")}`,
        data.updated > 0 && `${data.updated} mis à jour`,
        data.unchanged > 0 && `${data.unchanged} ${plural(data.unchanged, "inchangé")}`,
        data.failed > 0 && `${data.failed} ${plural(data.failed, "refusé")}`,
      ].filter(Boolean);
      const summary = parts.join(" · ") + (data.emailsSent > 0 ? ` · ${data.emailsSent} e-mail${data.emailsSent > 1 ? "s" : ""}` : "");
      if (data.failed > 0 && data.added + data.updated === 0) toast.error(summary);
      else toast.success(summary);
    },
    onError: (error) => toast.error(error.message),
  });

  const toggle = (entry: DirectoryEntry) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(entry.userId)) next.delete(entry.userId);
      else next.set(entry.userId, entry);
      return next;
    });

  const toggleCategory = (id: string) =>
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  // ── Résultats ───────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-4">
        <p className="n-label">RÉSULTAT · {JURY_PANEL_LABELS[panel].toUpperCase()}</p>
        <ul className="divide-y divide-[var(--n-border)] rounded border border-[var(--n-border)]">
          {result.results.map((r) => {
            const meta = RESULT_META[r.status];
            return (
              <li key={r.userId} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="n-font-body text-sm text-[var(--n-text-primary)] break-words">{r.name || r.email || r.userId}</p>
                  {r.error && (
                    <p className="n-label mt-1" style={{ color: "var(--n-accent)", textTransform: "none", letterSpacing: "0.02em" }}>
                      {r.error}
                    </p>
                  )}
                  {r.notified && <p className="n-label mt-1">E-MAIL ENVOYÉ</p>}
                </div>
                <TagBadge color={meta.color}>{meta.label}</TagBadge>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="n-label"
            onClick={() => {
              setResult(null);
              setSelected(new Map());
            }}
          >
            Ajouter d&apos;autres jurés
          </Button>
          <Button className="n-label" onClick={onDone}>
            Terminer
          </Button>
        </div>
      </div>
    );
  }

  // ── Sélection ───────────────────────────────────────────────
  const items = directory.data?.items ?? [];
  const total = directory.data?.total ?? 0;
  const count = selected.size;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--n-text-disabled)]" aria-hidden />
          <Input
            type="search"
            aria-label="Rechercher un juré"
            placeholder="Nom, e-mail ou expertise"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="n-label" aria-live="polite">
          {directory.isFetching ? "[...]" : `${items.length} SUR ${total} ${plural(total, "JURÉ CONNU", "JURÉS CONNUS")}`}
          {total > items.length && " · AFFINEZ LA RECHERCHE"}
        </p>
      </div>

      {directory.isLoading ? (
        <LoadingState minHeight={160} />
      ) : directory.isError ? (
        <ErrorState message="LE VIVIER DE JURÉS N'A PAS PU ÊTRE CHARGÉ" onRetry={() => void directory.refetch()} />
      ) : items.length === 0 ? (
        <p className="n-label py-8 text-center">
          {debouncedSearch ? "AUCUN JURÉ NE CORRESPOND À CETTE RECHERCHE" : "AUCUN JURÉ DANS LE VIVIER : INVITEZ-LES PAR E-MAIL"}
        </p>
      ) : (
        <ul role="list" className="max-h-[38vh] overflow-y-auto rounded border border-[var(--n-border)] divide-y divide-[var(--n-border)]">
          {items.map((entry) => {
            const blocked = blockedReason(entry, panel);
            const checked = selected.has(entry.userId);
            const id = `dir-${entry.userId}`;
            const willReactivate = entry.inCup && !entry.inCup.isActive && entry.inCup.panel === panel;
            const switchesToPro = panel === "pro" && entry.juryType === "public" && !entry.inCup;
            return (
              <li
                key={entry.userId}
                aria-disabled={blocked ? true : undefined}
                className="flex items-start gap-3 p-3"
                style={{ opacity: blocked ? 0.55 : 1 }}
              >
                <Checkbox
                  id={id}
                  checked={blocked ? false : checked}
                  disabled={!!blocked}
                  onCheckedChange={() => toggle(entry)}
                  className="mt-0.5"
                />
                <label htmlFor={id} className={`min-w-0 flex-1 ${blocked ? "" : "cursor-pointer"}`}>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="n-font-body text-sm font-medium text-[var(--n-text-primary)]">
                      {entry.name || entry.email}
                    </span>
                    <span className="n-font-data text-xs text-[var(--n-text-disabled)] break-all">{entry.email}</span>
                  </span>
                  <span className="n-label mt-1 block" style={{ textTransform: "none", letterSpacing: "0.02em" }}>
                    {historyLine(entry)}
                  </span>
                  {(blocked || willReactivate || switchesToPro || entry.expertise) && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {entry.expertise && <span className="n-tag" style={{ padding: "1px 8px", fontSize: 10 }}>{entry.expertise}</span>}
                      {blocked && <TagBadge color="var(--n-text-secondary)">{blocked}</TagBadge>}
                      {willReactivate && <TagBadge color="var(--n-warning)">Désactivé ici · sera réactivé</TagBadge>}
                      {switchesToPro && <TagBadge color="var(--n-interactive)">Ex-jury public · rejoindra le jury pro</TagBadge>}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {/* Catégories */}
      <fieldset className="space-y-2">
        <legend className="n-label mb-2">
          AFFECTER {count > 0 ? `LES ${count} ${plural(count, "JURÉ", "JURÉS")}` : "LA SÉLECTION"} AU{" "}
          {JURY_PANEL_LABELS[panel].toUpperCase()} DE…
        </legend>
        {coverage.isLoading ? (
          <span className="n-label">[LOADING...]</span>
        ) : categories.length === 0 ? (
          <p className="n-label">AUCUNE CATÉGORIE CONFIGURÉE · AJOUT SANS AFFECTATION</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categories.map((c) => {
              const lane = panel === "pro" ? c.pro : c.public;
              const target = panel === "pro" ? c.targets.pro : c.targets.public;
              const isChecked = categoryIds.includes(c.categoryId);
              const after = lane.activeCount + (isChecked ? count : 0);
              const cid = `cat-${c.categoryId}`;
              return (
                <label
                  key={c.categoryId}
                  htmlFor={cid}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded border border-[var(--n-border)] bg-[var(--n-surface)] p-2.5 hover:bg-[var(--n-surface-raised)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Checkbox id={cid} checked={isChecked} onCheckedChange={() => toggleCategory(c.categoryId)} />
                    <span className="n-font-body truncate text-sm text-[var(--n-text-primary)]">{c.name}</span>
                  </span>
                  <span className="n-font-data shrink-0 text-xs text-[var(--n-text-secondary)]">
                    {isChecked && count > 0 ? `${lane.activeCount} → ${after}` : lane.activeCount}
                    {target !== null && ` / ${target}`}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <p className="n-label" style={{ textTransform: "none", letterSpacing: "0.02em" }}>
          Mêmes catégories pour toute la sélection ; elles s&apos;ajoutent à celles déjà affectées. Ajustez juré par
          juré ensuite dans l&apos;onglet « Par juré ».
        </p>
      </fieldset>

      {/* Pied */}
      <div className="flex flex-col gap-3 border-t border-[var(--n-border)] pt-4">
        <label htmlFor="notify-existing" className="flex cursor-pointer items-start gap-2">
          <Checkbox id="notify-existing" checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
          <span className="n-font-body text-sm text-[var(--n-text-primary)]">
            Prévenir par e-mail <span className="text-[var(--n-text-secondary)]">(lien de connexion, sans nouvelle invitation)</span>
          </span>
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="n-label" onClick={onDone}>
            Annuler
          </Button>
          <Button
            className="n-label"
            disabled={count === 0 || addMutation.isPending}
            onClick={() =>
              addMutation.mutate({
                cupId,
                panel,
                userIds: [...selected.keys()],
                categoryIds,
                notify,
              })
            }
          >
            {addMutation.isPending
              ? "[...]"
              : count === 0
                ? "Sélectionnez des jurés"
                : `Ajouter ${count} ${plural(count, "juré", "jurés")}${
                    categoryIds.length > 0 ? ` · ${count * categoryIds.length} ${plural(count * categoryIds.length, "affectation")}` : ""
                  }`}
          </Button>
        </div>
      </div>
    </div>
  );
}
