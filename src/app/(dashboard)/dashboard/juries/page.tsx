"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, UserPlus, X } from "lucide-react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AddToCupForm } from "~/components/features/jury-directory/add-to-cup-form";
import { JurorDetailSheet } from "~/components/features/jury-directory/juror-detail-sheet";
import {
  cupChipLabel,
  defaultTargetCup,
  displayedPanel,
  formatRate,
  overallCompletion,
  panelShortLabel,
  type DirectoryEntry,
} from "~/components/features/jury-directory/directory-utils";
import { api } from "~/trpc/react";

const PAGE_SIZE = 25;
/** Limite du serveur pour un ajout groupé. */
const MAX_SELECTION = 100;
const MAX_CHIPS = 3;

const thLabel = "n-label whitespace-nowrap px-3 py-3 text-left font-normal";

/**
 * Vivier de jurés — Route : /dashboard/juries
 * Tous les comptes ayant un profil juré ou ayant siégé dans une cup, avec leur
 * historique, et l'ajout direct à une cup sans nouvelle invitation.
 */
export default function JuryDirectoryPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Map<string, DirectoryEntry>>(new Map());
  const [detail, setDetail] = useState<DirectoryEntry | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [cupChoice, setCupChoice] = useState<string | null>(null);

  // Recherche différée : une requête par pause de frappe, retour en page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const cupsQuery = api.cup.list.useQuery();
  const cups = cupsQuery.data;
  const targetCupId = cupChoice ?? defaultTargetCup(cups)?.id ?? null;
  const targetCup = cups?.find((c) => c.id === targetCupId) ?? null;

  const directory = api.jury.listDirectory.useQuery(
    {
      search: search || undefined,
      cupId: targetCupId ?? undefined,
      limit: PAGE_SIZE,
      offset,
    },
    { placeholderData: keepPreviousData, enabled: !cupsQuery.isLoading }
  );

  const items = useMemo(() => directory.data?.items ?? [], [directory.data]);
  const total = directory.data?.total ?? 0;

  // Garde la fiche ouverte et la sélection à jour après un ajout ou un changement de cup.
  useEffect(() => {
    if (items.length === 0) return;
    const byId = new Map(items.map((i) => [i.userId, i]));
    setDetail((d) => (d && byId.get(d.userId)) ?? d);
    setSelected((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of prev.keys()) {
        const fresh = byId.get(id);
        if (fresh && fresh !== prev.get(id)) {
          next.set(id, fresh);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const pageIds = items.map((i) => i.userId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));
  const selectionFull = selected.size >= MAX_SELECTION;

  const toggleOne = (entry: DirectoryEntry, on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (on) {
        if (next.size >= MAX_SELECTION) return prev;
        next.set(entry.userId, entry);
      } else next.delete(entry.userId);
      return next;
    });

  const togglePage = (on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const entry of items) {
        if (on) {
          if (next.size >= MAX_SELECTION) break;
          next.set(entry.userId, entry);
        } else next.delete(entry.userId);
      }
      return next;
    });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="n-label">Organisation · Jurys</p>
          <h1
            className="mt-1"
            style={{
              fontFamily: "'Doto', 'Space Mono', monospace",
              fontSize: "24px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 700,
              color: "var(--n-text-display)",
            }}
          >
            Vivier de jurés
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Tous les jurés ayant participé à une cup. Ajoutez-les à une nouvelle édition sans renvoyer
            d&apos;invitation.
          </p>
        </div>
        <div className="n-card flex items-center gap-6 !px-5 !py-3">
          <div>
            <p className="n-label" style={{ fontSize: "10px" }}>Personnes</p>
            <p className="n-font-data text-xl" style={{ color: "var(--n-text-display)" }}>
              {directory.data ? total : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1" htmlFor="directory-search">
          <span className="sr-only">Rechercher un juré</span>
          <Search
            className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--n-text-disabled)" }}
          />
          <input
            id="directory-search"
            type="search"
            className="n-input !pl-6"
            placeholder="Nom, e-mail, expertise…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </label>
        <div className="flex items-center gap-2 lg:w-80">
          <span className="n-label shrink-0">Cup cible</span>
          <Select
            value={targetCupId ?? undefined}
            onValueChange={(v) => setCupChoice(v)}
            disabled={!cups || cups.length === 0}
          >
            <SelectTrigger className="w-full" aria-label="Cup cible">
              <SelectValue placeholder={cupsQuery.isLoading ? "Chargement…" : "Aucune cup"} />
            </SelectTrigger>
            <SelectContent>
              {cups?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sélection */}
      {selected.size > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{ border: "1px solid var(--n-border-visible)", background: "var(--n-surface-raised)" }}
          role="status"
        >
          <span className="text-sm" style={{ color: "var(--n-text-primary)" }}>
            {selected.size} juré{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}
            {selectionFull && (
              <span className="ml-2 text-xs" style={{ color: "var(--n-warning)" }}>
                (maximum {MAX_SELECTION} par ajout)
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button type="button" className="n-btn-ghost" onClick={() => setSelected(new Map())}>
              <X className="mr-1 h-4 w-4" /> Désélectionner
            </button>
            <button type="button" className="n-btn-primary" onClick={() => setBulkOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Ajouter à une cup
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {directory.isError ? (
        <div className="n-card flex flex-col items-center gap-4 text-center">
          <span role="alert" className="n-font-data text-sm" style={{ color: "var(--n-text-secondary)" }}>
            [ERREUR] Le vivier n&apos;a pas pu être chargé.
          </span>
          <button type="button" className="n-btn-secondary" onClick={() => void directory.refetch()}>
            Réessayer
          </button>
        </div>
      ) : directory.isLoading || cupsQuery.isLoading ? (
        <div className="n-card text-center">
          <span className="n-font-data text-xs" style={{ color: "var(--n-text-secondary)", letterSpacing: "0.08em" }}>
            [CHARGEMENT…]
          </span>
        </div>
      ) : items.length === 0 ? (
        <div className="n-card text-center">
          <p className="n-font-data text-sm" style={{ color: "var(--n-text-secondary)" }}>
            {search ? `[Aucun juré ne correspond à « ${search} »]` : "[Aucun juré pour l'instant]"}
          </p>
          {!search && (
            <p className="mt-2 text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Les jurés invités dans une cup apparaîtront ici.
            </p>
          )}
        </div>
      ) : (
        <div
          className="n-card overflow-x-auto !p-0"
          style={{ opacity: directory.isPlaceholderData ? 0.6 : 1, transition: "opacity 150ms" }}
          aria-busy={directory.isFetching}
        >
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--n-border)" }}>
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    aria-label="Sélectionner la page"
                    checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => togglePage(v === true)}
                  />
                </th>
                <th className={thLabel}>Juré</th>
                <th className={thLabel}>Type</th>
                <th className={thLabel}>Expertise</th>
                <th className={thLabel}>Historique</th>
                <th className={thLabel}>Complétion</th>
                <th className={thLabel}>{targetCup ? targetCup.name : "Cup cible"}</th>
                <th className={thLabel}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => {
                const isSelected = selected.has(entry.userId);
                const panel = displayedPanel(entry);
                const completion = overallCompletion(entry);
                const extraCups = entry.cups.length - MAX_CHIPS;
                return (
                  <tr
                    key={entry.userId}
                    className="cursor-pointer transition-colors hover:bg-[var(--n-surface-raised)]"
                    style={{
                      borderBottom: "1px solid var(--n-border)",
                      background: isSelected ? "var(--n-surface-raised)" : undefined,
                    }}
                    onClick={() => setDetail(entry)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Sélectionner ${entry.name}`}
                        checked={isSelected}
                        disabled={!isSelected && selectionFull}
                        onCheckedChange={(v) => toggleOne(entry, v === true)}
                      />
                    </td>
                    <td className="max-w-[220px] px-3 py-3">
                      <span className="block truncate font-medium" style={{ color: "var(--n-text-primary)" }}>
                        {entry.name}
                      </span>
                      <span className="block truncate text-xs" style={{ color: "var(--n-text-secondary)" }}>
                        {entry.email}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {panel ? (
                        <span
                          className="n-tag"
                          style={panel === "pro" ? { color: "var(--n-text-display)", borderColor: "var(--n-text-display)" } : undefined}
                        >
                          {panelShortLabel(panel)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--n-text-disabled)" }}>—</span>
                      )}
                    </td>
                    <td className="max-w-[180px] px-3 py-3">
                      <span className="line-clamp-2 text-xs" style={{ color: "var(--n-text-secondary)" }}>
                        {entry.expertise ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {entry.cups.length === 0 ? (
                        <span className="text-xs" style={{ color: "var(--n-text-disabled)" }}>Aucune cup</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {entry.cups.slice(0, MAX_CHIPS).map((c) => (
                            <span
                              key={c.cupJuryId}
                              className="n-tag whitespace-nowrap !px-2 !py-0.5 !text-[10px]"
                              title={`${c.cupName}${c.isActive ? "" : " · retiré"} — ${c.ratings.submitted}/${c.ratings.expected} fiches`}
                              style={c.isActive ? undefined : { opacity: 0.55 }}
                            >
                              {cupChipLabel(c)}
                            </span>
                          ))}
                          {extraCups > 0 && (
                            <span className="n-tag !px-2 !py-0.5 !text-[10px]">+{extraCups}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="n-font-data"
                        style={{
                          color:
                            completion.rate !== null && completion.rate < 70
                              ? "var(--n-warning)"
                              : "var(--n-text-primary)",
                        }}
                      >
                        {formatRate(completion.rate)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {entry.inCup ? (
                        <span
                          className={entry.inCup.isActive ? "n-tag success" : "n-tag"}
                          style={{ fontSize: "10px", padding: "2px 8px" }}
                        >
                          {panelShortLabel(entry.inCup.panel)}
                          {entry.inCup.isActive ? "" : " · retiré"}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--n-text-disabled)" }}>
                          {targetCup ? "Absent" : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="n-btn-ghost !min-h-0 !px-2 !py-1 !text-[11px]"
                        onClick={() => setDetail(entry)}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {directory.data && total > PAGE_SIZE && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <span className="n-label">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} sur {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="n-btn-secondary !min-h-0 !px-3 !py-2"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="n-font-data text-xs" style={{ color: "var(--n-text-secondary)" }}>
              {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              className="n-btn-secondary !min-h-0 !px-3 !py-2"
              disabled={currentPage >= pageCount}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}

      <JurorDetailSheet
        juror={detail}
        onClose={() => setDetail(null)}
        cupId={targetCupId}
        onCupChange={setCupChoice}
      />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajouter à une cup</DialogTitle>
            <DialogDescription>
              {selected.size} juré{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""} : ils
              rejoignent directement la cup, sans nouvelle invitation.
            </DialogDescription>
          </DialogHeader>
          {bulkOpen && (
            <AddToCupForm
              jurors={[...selected.values()]}
              cupId={targetCupId}
              onCupChange={setCupChoice}
              onCancel={() => setBulkOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
