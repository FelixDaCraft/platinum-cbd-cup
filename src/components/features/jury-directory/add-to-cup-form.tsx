"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";

import { Checkbox } from "~/components/ui/checkbox";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getStatusLabel } from "~/lib/validations/cup";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  PANEL_EXPLANATIONS,
  panelLongLabel,
  type DirectoryEntry,
  type JuryPanel,
} from "./directory-utils";

type AddResult = RouterOutputs["jury"]["addExistingJurors"];
type Membership = DirectoryEntry["inCup"];

const RESULT_LABELS: Record<AddResult["results"][number]["status"], { label: string; color: string }> = {
  added: { label: "Ajouté", color: "var(--n-success)" },
  updated: { label: "Mis à jour", color: "var(--n-interactive)" },
  unchanged: { label: "Inchangé", color: "var(--n-text-secondary)" },
  error: { label: "Erreur", color: "var(--n-accent)" },
};

/** Statut d'un juré vis-à-vis de la cup et du jury choisis. */
function membershipStatus(
  membership: Membership | undefined,
  panel: JuryPanel
): { label: string; excluded: boolean; tone: string } {
  if (membership === undefined) {
    return { label: "Vérification…", excluded: false, tone: "var(--n-text-disabled)" };
  }
  if (membership === null) {
    return { label: "Sera ajouté", excluded: false, tone: "var(--n-success)" };
  }
  if (membership.panel !== panel) {
    return {
      label: `Déjà dans le ${panelLongLabel(membership.panel).toLowerCase()} · exclu`,
      excluded: true,
      tone: "var(--n-accent)",
    };
  }
  return membership.isActive
    ? { label: "Déjà dans ce jury · catégories complétées", excluded: false, tone: "var(--n-text-secondary)" }
    : { label: "Retiré de ce jury · sera réactivé", excluded: false, tone: "var(--n-warning)" };
}

interface AddToCupFormProps {
  jurors: DirectoryEntry[];
  cupId: string | null;
  onCupChange: (cupId: string) => void;
  onCancel?: () => void;
  /** Jury proposé à l'ouverture (ex. type du juré sélectionné). */
  initialPanel?: JuryPanel;
}

export function AddToCupForm({ jurors, cupId, onCupChange, onCancel, initialPanel }: AddToCupFormProps) {
  const [panel, setPanel] = useState<JuryPanel>(initialPanel ?? "pro");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState<{ cupId: string; data: AddResult } | null>(null);

  const utils = api.useUtils();
  const cupsQuery = api.cup.list.useQuery();
  const cups = cupsQuery.data;
  const selectedCup = cups?.find((c) => c.id === cupId) ?? null;

  const categoriesQuery = api.category.list.useQuery(
    { cupId: cupId ?? "" },
    { enabled: !!cupId }
  );

  // Les catégories cochées n'ont de sens que pour la cup choisie.
  useEffect(() => {
    setCategoryIds([]);
    setResult(null);
  }, [cupId]);

  // Présence de chaque juré dans la cup choisie : une seule requête,
  // restreinte aux jurés sélectionnés.
  const membershipQuery = api.jury.listDirectory.useQuery(
    { cupId: cupId!, userIds: jurors.map((j) => j.userId), limit: 100, offset: 0 },
    { enabled: !!cupId && jurors.length > 0, staleTime: 10_000 }
  );

  // undefined : vérification en cours ; null : absent de la cup.
  const memberships = new Map<string, Membership | undefined>();
  jurors.forEach((j) => {
    const data = membershipQuery.data;
    const found = data?.items.find((it) => it.userId === j.userId);
    memberships.set(j.userId, data ? (found ? found.inCup : null) : undefined);
  });

  const statuses = jurors.map((j) => ({ juror: j, ...membershipStatus(memberships.get(j.userId), panel) }));
  const eligibleIds = statuses.filter((s) => !s.excluded).map((s) => s.juror.userId);
  const excludedCount = statuses.length - eligibleIds.length;

  const mutation = api.jury.addExistingJurors.useMutation({
    onSuccess: (data, variables) => {
      setResult({ cupId: variables.cupId, data });
      void utils.jury.listDirectory.invalidate();
    },
  });

  const submit = () => {
    if (!cupId || eligibleIds.length === 0) return;
    mutation.mutate({ cupId, userIds: eligibleIds, panel, categoryIds, notify });
  };

  if (result) {
    const { data } = result;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {data.added > 0 && <span className="n-tag success">{data.added} ajouté{data.added > 1 ? "s" : ""}</span>}
          {data.updated > 0 && <span className="n-tag">{data.updated} mis à jour</span>}
          {data.unchanged > 0 && <span className="n-tag">{data.unchanged} inchangé{data.unchanged > 1 ? "s" : ""}</span>}
          {data.failed > 0 && (
            <span className="n-tag" style={{ color: "var(--n-accent)", borderColor: "var(--n-accent)" }}>
              {data.failed} erreur{data.failed > 1 ? "s" : ""}
            </span>
          )}
          {data.emailsSent > 0 && <span className="n-tag">{data.emailsSent} e-mail{data.emailsSent > 1 ? "s" : ""} envoyé{data.emailsSent > 1 ? "s" : ""}</span>}
        </div>

        <ul className="space-y-2">
          {data.results.map((r) => {
            const meta = RESULT_LABELS[r.status];
            return (
              <li
                key={r.userId}
                className="flex items-start justify-between gap-3 py-2"
                style={{ borderBottom: "1px solid var(--n-border)" }}
              >
                <div className="min-w-0">
                  <p className="n-font-body text-sm truncate" style={{ color: "var(--n-text-primary)" }}>
                    {r.name ?? r.email ?? r.userId}
                  </p>
                  {r.error && (
                    <p className="text-xs mt-1" style={{ color: "var(--n-text-secondary)" }}>
                      {r.error}
                    </p>
                  )}
                  {r.notified && (
                    <p className="text-xs mt-1" style={{ color: "var(--n-text-secondary)" }}>
                      Prévenu par e-mail
                    </p>
                  )}
                </div>
                <span className="n-label shrink-0" style={{ color: meta.color }}>
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/cups/${result.cupId}/scoring/juries`} className="n-btn-primary">
            Voir les jurés de la cup <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <button type="button" className="n-btn-secondary" onClick={() => setResult(null)}>
            Nouvel ajout
          </button>
          {onCancel && (
            <button type="button" className="n-btn-ghost" onClick={onCancel}>
              Fermer
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* Cup */}
      <div className="space-y-2">
        <label className="n-label block" htmlFor="add-to-cup-cup">
          Cup
        </label>
        {cupsQuery.isLoading ? (
          <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>[Chargement…]</p>
        ) : cupsQuery.isError ? (
          <p role="alert" className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Les cups n&apos;ont pas pu être chargées.{" "}
            <button type="button" className="underline" onClick={() => void cupsQuery.refetch()}>
              Réessayer
            </button>
          </p>
        ) : !cups || cups.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Aucune cup : créez d&apos;abord une édition.
          </p>
        ) : (
          <Select value={cupId ?? undefined} onValueChange={onCupChange}>
            <SelectTrigger id="add-to-cup-cup" className="w-full">
              <SelectValue placeholder="Choisir une cup" />
            </SelectTrigger>
            <SelectContent>
              {cups.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · {getStatusLabel(c.status).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedCup?.status === "completed" && (
          <p className="text-xs" style={{ color: "var(--n-warning)" }}>
            Cette cup est terminée : ajouter des jurés n&apos;aura pas d&apos;effet sur ses résultats.
          </p>
        )}
      </div>

      {/* Jury */}
      <fieldset className="space-y-2">
        <legend className="n-label mb-2">Jury</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["pro", "public"] as const).map((p) => {
            const checked = panel === p;
            return (
              <label
                key={p}
                className="flex cursor-pointer flex-col gap-1 rounded-lg p-3"
                style={{
                  border: `1px solid ${checked ? "var(--n-text-display)" : "var(--n-border-visible)"}`,
                  background: checked ? "var(--n-surface-raised)" : "transparent",
                }}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="add-to-cup-panel"
                    value={p}
                    checked={checked}
                    onChange={() => setPanel(p)}
                    style={{ accentColor: "var(--n-text-display)" }}
                  />
                  <span className="n-font-body text-sm font-medium" style={{ color: "var(--n-text-display)" }}>
                    {panelLongLabel(p)}
                  </span>
                </span>
                <span className="text-xs leading-snug" style={{ color: "var(--n-text-secondary)" }}>
                  {PANEL_EXPLANATIONS[p]}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Catégories */}
      {cupId && (
        <fieldset className="space-y-2">
          <legend className="n-label mb-1">Catégories (facultatif)</legend>
          <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            Sans catégorie, le juré rejoint la cup et sera affecté plus tard.
          </p>
          {categoriesQuery.isLoading ? (
            <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>[Chargement…]</p>
          ) : categoriesQuery.isError ? (
            <p role="alert" className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Les catégories n&apos;ont pas pu être chargées.{" "}
              <button type="button" className="underline" onClick={() => void categoriesQuery.refetch()}>
                Réessayer
              </button>
            </p>
          ) : (categoriesQuery.data ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Aucune catégorie dans cette cup.
            </p>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              {categoriesQuery.data?.map((cat) => {
                const id = `add-to-cup-cat-${cat.id}`;
                const checked = categoryIds.includes(cat.id);
                return (
                  <label key={cat.id} htmlFor={id} className="flex cursor-pointer items-center gap-2 py-1.5">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(v) =>
                        setCategoryIds((prev) =>
                          v === true ? [...prev, cat.id] : prev.filter((x) => x !== cat.id)
                        )
                      }
                    />
                    <span className="text-sm" style={{ color: "var(--n-text-primary)" }}>
                      {cat.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      {/* Notification */}
      <div className="flex items-start justify-between gap-4">
        <label htmlFor="add-to-cup-notify" className="cursor-pointer">
          <span className="n-label block">Prévenir par e-mail</span>
          <span className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
            Un e-mail « Vous faites partie du jury » est envoyé aux seuls jurés ajoutés ou modifiés.
          </span>
        </label>
        <Switch id="add-to-cup-notify" checked={notify} onCheckedChange={setNotify} />
      </div>

      {/* Personnes concernées */}
      {cupId && (
        <div className="space-y-2">
          <p className="n-label">
            {jurors.length === 1 ? "Juré" : `Jurés sélectionnés (${jurors.length})`}
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {statuses.map((s) => (
              <li key={s.juror.userId} className="flex items-center justify-between gap-3 text-sm py-1">
                <span className="truncate" style={{ color: s.excluded ? "var(--n-text-disabled)" : "var(--n-text-primary)" }}>
                  {s.juror.name}
                </span>
                <span className="n-label shrink-0 text-right" style={{ color: s.tone, fontSize: "10px" }}>
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
          {excludedCount > 0 && (
            <p className="flex items-start gap-2 text-xs" style={{ color: "var(--n-text-secondary)" }}>
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {excludedCount === 1
                ? "Une personne siège déjà dans l'autre jury de cette cup : changez son jury depuis « Jurys & affectation »."
                : `${excludedCount} personnes siègent déjà dans l'autre jury de cette cup : changez leur jury depuis « Jurys & affectation ».`}
            </p>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs" style={{ color: "var(--n-text-secondary)" }}>
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--n-success)" }} />
        Compte existant : pas de nouvelle invitation, le juré retrouve la cup dans son espace.
      </p>

      {mutation.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--n-accent)" }}>
          {mutation.error.message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button type="button" className="n-btn-ghost" onClick={onCancel}>
            Annuler
          </button>
        )}
        <button
          type="submit"
          className="n-btn-primary"
          disabled={!cupId || eligibleIds.length === 0 || mutation.isPending}
        >
          {mutation.isPending
            ? "Ajout…"
            : eligibleIds.length > 1
              ? `Ajouter ${eligibleIds.length} jurés`
              : notify
                ? "Ajouter et prévenir"
                : "Ajouter"}
        </button>
      </div>
    </form>
  );
}
