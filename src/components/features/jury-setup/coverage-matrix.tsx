"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Layers, Lock, Package, Pencil, Plus, QrCode, UserCheck, Users } from "lucide-react";

import { api } from "~/trpc/react";
import { CategoryTargetsDialog } from "./category-targets-dialog";
import {
  type AddJurorsPreset,
  type CategoryCoverageData,
  CoverageStatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
  ThinProgress,
  initials,
  percent,
  plural,
  qrCodesHref,
} from "./shared";

const MAX_AVATARS = 8;

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="n-card" style={{ padding: 16 }}>
      <p className="n-label flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p
        className="n-font-data mt-2"
        style={{ fontSize: 24, fontWeight: 700, color: "var(--n-text-display)", lineHeight: 1.1 }}
      >
        {value}
      </p>
      {sub && <p className="n-label mt-1" style={{ textTransform: "none", letterSpacing: "0.02em" }}>{sub}</p>}
    </div>
  );
}

/** Effectif vs objectif, avec le manque explicite (texte + couleur). */
function CountVsTarget({ active, target, unit }: { active: number; target: number | null; unit: string }) {
  const missing = target !== null ? Math.max(0, target - active) : 0;
  const color = active === 0 ? "var(--n-accent)" : missing > 0 ? "var(--n-warning)" : "var(--n-text-display)";
  return (
    <span className="n-font-data text-xs" style={{ color }}>
      {active}
      {target !== null && ` / ${target}`} {unit}
      {active === 0 ? (
        <span> · AUCUN</span>
      ) : missing > 0 ? (
        <span> · MANQUE {missing}</span>
      ) : null}
    </span>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[var(--n-border-visible)] text-[var(--n-text-secondary)] transition-colors hover:border-[var(--n-text-primary)] hover:text-[var(--n-text-display)]"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function LaneLabel({ children }: { children: React.ReactNode }) {
  // Visible seulement quand les colonnes s'empilent (pas d'en-tête de tableau).
  return <span className="n-label lg:hidden" style={{ color: "var(--n-text-disabled)" }}>{children}</span>;
}

function CoverageRow({
  cupId,
  category,
  onAdd,
  onEditTargets,
}: {
  cupId: string;
  category: CategoryCoverageData;
  onAdd: (preset: AddJurorsPreset) => void;
  onEditTargets: () => void;
}) {
  const { pro, public: pub, targets } = category;
  const proRated = percent(pro.ratings.submitted, pro.ratings.expected);
  const pubRated = percent(pub.ratings.submitted, pub.ratings.expected);
  const shown = pro.jurors.slice(0, MAX_AVATARS);
  const hidden = pro.jurors.length - shown.length;

  return (
    <div
      className="grid grid-cols-1 gap-4 border-t border-[var(--n-border)] px-4 py-4 lg:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)_minmax(0,2fr)_140px] lg:items-start lg:gap-6"
    >
      {/* Catégorie */}
      <div className="flex items-start justify-between gap-3 lg:block">
        <div className="min-w-0">
          <p className="n-font-body font-medium text-[var(--n-text-display)] break-words">{category.name}</p>
          <p className="n-label mt-1">
            {category.productsCount} {plural(category.productsCount, "PRODUIT")}
          </p>
        </div>
        <div className="lg:hidden">
          <CoverageStatusBadge status={category.status} />
        </div>
      </div>

      {/* Jury pro */}
      <div className="space-y-2 min-w-0">
        <LaneLabel>JURY PRO</LaneLabel>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <CountVsTarget active={pro.activeCount} target={targets.pro} unit={plural(pro.activeCount, "JURÉ", "JURÉS")} />
          <span className="n-label">NOTÉ {proRated} %</span>
        </div>
        <ThinProgress value={proRated} label={`Notation du jury pro · ${category.name}`} />
        <div className="flex flex-wrap items-center gap-1.5">
          {shown.map((j) => {
            const desc = `${j.name || j.email} · ${j.ratedCount}/${j.toRateCount} notés · échantillons ${
              j.samplesReceived ? "reçus" : "non reçus"
            }`;
            return (
              <span
                key={j.cupJuryId}
                title={desc}
                aria-label={desc}
                role="img"
                className="n-font-data inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px]"
                style={{
                  background: "var(--n-surface-raised)",
                  color: "var(--n-text-primary)",
                  border: j.samplesReceived
                    ? "1px solid var(--n-success)"
                    : "1px dashed var(--n-border-visible)",
                }}
              >
                {initials(j.name, j.email)}
              </span>
            );
          })}
          {hidden > 0 && <span className="n-label">+{hidden}</span>}
          <AddButton
            label={`Ajouter un juré pro à ${category.name}`}
            onClick={() => onAdd({ panel: "pro", categoryId: category.categoryId })}
          />
        </div>
        <p className="n-label">
          ÉCHANTILLONS {pro.samplesReceivedCount} / {pro.activeCount}
        </p>
      </div>

      {/* Jury public */}
      <div className="space-y-2 min-w-0">
        <LaneLabel>JURY PUBLIC</LaneLabel>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <CountVsTarget active={pub.activeCount} target={targets.public} unit={plural(pub.activeCount, "ACTIF", "ACTIFS")} />
          <span className="n-label">NOTÉ {pubRated} %</span>
        </div>
        <ThinProgress value={pubRated} label={`Notation du jury public · ${category.name}`} />
        <p className="n-label flex flex-wrap gap-x-2">
          <span>{pub.codes.generated} QR {plural(pub.codes.generated, "GÉNÉRÉ")}</span>
          <span>→ {pub.codes.activated} {plural(pub.codes.activated, "ACTIVÉ")}</span>
          <span>→ {pub.samplesReceivedCount} ÉCHANT. {plural(pub.samplesReceivedCount, "REÇU")}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={qrCodesHref(cupId, { categoryId: category.categoryId })}
            className="n-tag hover:text-[var(--n-text-display)]"
            style={{ gap: 6, padding: "3px 10px" }}
          >
            <QrCode className="h-3 w-3" aria-hidden />
            QR CODES
          </Link>
          <AddButton
            label={`Ajouter des jurés publics à ${category.name}`}
            onClick={() => onAdd({ panel: "public", categoryId: category.categoryId })}
          />
        </div>
      </div>

      {/* Statut */}
      <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-end">
        <div className="hidden lg:block">
          <CoverageStatusBadge status={category.status} />
        </div>
        <button
          type="button"
          onClick={onEditTargets}
          className="n-btn-ghost"
          style={{ minHeight: 32, padding: "4px 0", fontSize: 11, gap: 6 }}
          aria-label={`Modifier les objectifs de ${category.name}`}
        >
          <Pencil className="h-3 w-3" aria-hidden />
          OBJECTIFS
        </button>
      </div>
    </div>
  );
}

/** Onglet « Par catégorie » : couverture des catégories par les deux jurys. */
export function CoverageMatrix({
  cupId,
  onAdd,
  onAssignUnassigned,
}: {
  cupId: string;
  onAdd: (preset: AddJurorsPreset) => void;
  onAssignUnassigned: (cupJuryIds: string[]) => void;
}) {
  const { data, isLoading, isError, refetch } = api.jury.getCoverage.useQuery({ cupId });
  const [targetsFor, setTargetsFor] = useState<string[] | null>(null);

  if (isLoading) return <LoadingState minHeight={300} />;
  if (isError || !data) {
    return <ErrorState message="LA COUVERTURE DES CATÉGORIES N'A PAS PU ÊTRE CHARGÉE" onRetry={() => void refetch()} />;
  }

  const { categories, totals, unassignedJurors, cup } = data;
  const ready = categories.filter((c) => c.status === "ready").length;
  const incomplete = categories.filter((c) => c.status === "incomplete").length;
  const critical = categories.filter((c) => c.status === "critical").length;
  const proAssignments = categories.reduce((s, c) => s + c.pro.activeCount, 0);
  const proTargetSum = categories.reduce((s, c) => s + (c.targets.pro ?? 0), 0);
  const activeTotal = totals.pro.activeJurors + totals.public.activeJurors;
  const samplesTotal = totals.pro.samplesReceived + totals.public.samplesReceived;
  const editedCategories = targetsFor
    ? categories.filter((c) => targetsFor.includes(c.categoryId))
    : [];

  return (
    <div className="space-y-4">
      {cup.ratingsLockedAt && (
        <div className="n-card flex items-center gap-2" style={{ padding: 12 }}>
          <Lock className="h-4 w-4 text-[var(--n-text-secondary)]" aria-hidden />
          <span className="n-label">
            NOTATION VERROUILLÉE DEPUIS LE {new Date(cup.ratingsLockedAt).toLocaleDateString("fr-FR")}
          </span>
        </div>
      )}

      {/* Totaux */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<UserCheck className="h-3.5 w-3.5" aria-hidden />}
          label="JURY PRO"
          value={`${totals.pro.activeJurors} ${plural(totals.pro.activeJurors, "ACTIF", "ACTIFS")}`}
          sub={
            proTargetSum > 0
              ? `${proAssignments} affectations sur ${proTargetSum} visées`
              : `${proAssignments} ${plural(proAssignments, "affectation")}${
                  totals.pro.inactiveJurors > 0 ? ` · ${totals.pro.inactiveJurors} désactivé${totals.pro.inactiveJurors > 1 ? "s" : ""}` : ""
                }`
          }
        />
        <StatCard
          icon={<Users className="h-3.5 w-3.5" aria-hidden />}
          label="JURY PUBLIC"
          value={`${totals.public.activeJurors} ${plural(totals.public.activeJurors, "ACTIF", "ACTIFS")}`}
          sub={`${totals.codes.generated} QR ${plural(totals.codes.generated, "généré")} · ${totals.codes.activated} ${plural(
            totals.codes.activated,
            "activé"
          )}`}
        />
        <StatCard
          icon={<Package className="h-3.5 w-3.5" aria-hidden />}
          label="ÉCHANTILLONS REÇUS"
          value={`${samplesTotal} / ${activeTotal}`}
          sub={
            activeTotal - samplesTotal > 0
              ? `${activeTotal - samplesTotal} ${plural(activeTotal - samplesTotal, "juré")} sans réception confirmée`
              : activeTotal > 0
                ? "Tous les jurés actifs ont reçu leurs échantillons"
                : "Aucun juré actif"
          }
        />
        <StatCard
          icon={<Layers className="h-3.5 w-3.5" aria-hidden />}
          label="CATÉGORIES PRÊTES"
          value={`${ready} / ${categories.length}`}
          sub={
            <>
              {incomplete} à compléter ·{" "}
              <span style={critical > 0 ? { color: "var(--n-accent)" } : undefined}>
                {critical} {plural(critical, "critique")}
              </span>
            </>
          }
        />
      </div>

      {/* Jurés sans catégorie */}
      {unassignedJurors.length > 0 && (
        <div
          role="status"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderRadius: 12,
            border: "1px solid var(--n-warning)",
            background: "color-mix(in srgb, var(--n-warning) 8%, transparent)",
            padding: 16,
          }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--n-warning)" }} aria-hidden />
            <div className="min-w-0">
              <p className="n-font-body text-sm font-medium text-[var(--n-text-display)]">
                {unassignedJurors.length} {plural(unassignedJurors.length, "juré actif", "jurés actifs")} sans catégorie
              </p>
              <p className="n-label mt-1 break-words" style={{ textTransform: "none", letterSpacing: "0.02em" }}>
                {unassignedJurors
                  .slice(0, 6)
                  .map((j) => `${j.name || j.email} (${j.panel === "pro" ? "pro" : "public"})`)
                  .join(", ")}
                {unassignedJurors.length > 6 && ` et ${unassignedJurors.length - 6} autres`} : ils ne notent rien
                tant qu&apos;aucune catégorie ne leur est affectée.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="n-btn-secondary shrink-0"
            style={{ minHeight: 36, padding: "8px 16px", fontSize: 12 }}
            onClick={() => onAssignUnassigned(unassignedJurors.map((j) => j.cupJuryId))}
          >
            Affecter des catégories
          </button>
        </div>
      )}

      {/* Matrice */}
      <section aria-label="Affectation par catégorie" className="n-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="n-label">PAR CATÉGORIE</span>
          <button
            type="button"
            className="n-btn-ghost"
            style={{ minHeight: 32, padding: "4px 0", fontSize: 11, gap: 6 }}
            onClick={() => setTargetsFor(categories.map((c) => c.categoryId))}
            disabled={categories.length === 0}
          >
            <Pencil className="h-3 w-3" aria-hidden />
            OBJECTIFS DE TOUTES LES CATÉGORIES
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="border-t border-[var(--n-border)]">
            <EmptyState
              icon={<Layers className="h-8 w-8" />}
              title="Aucune catégorie configurée"
              hint="Créez des catégories dans la configuration de la cup pour y affecter des jurés"
              action={
                <Link href={`/dashboard/cups/${cupId}/config/categories`} className="n-btn-secondary" style={{ minHeight: 36, padding: "8px 16px", fontSize: 12 }}>
                  Configurer les catégories
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div
              aria-hidden
              className="hidden border-t border-[var(--n-border)] px-4 py-2 lg:grid lg:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)_minmax(0,2fr)_140px] lg:gap-6"
            >
              <span className="n-label">CATÉGORIE</span>
              <span className="n-label">JURY PRO · EXPERTS</span>
              <span className="n-label">JURY PUBLIC · QR</span>
              <span className="n-label text-right">COUVERTURE</span>
            </div>
            {categories.map((c) => (
              <CoverageRow
                key={c.categoryId}
                cupId={cupId}
                category={c}
                onAdd={onAdd}
                onEditTargets={() => setTargetsFor([c.categoryId])}
              />
            ))}
          </>
        )}
      </section>

      <p className="n-label" style={{ color: "var(--n-text-disabled)", textTransform: "none", letterSpacing: "0.02em" }}>
        Critique : aucun juré actif dans l&apos;un des deux jurys. À compléter : un jury est sous son objectif.
        Survolez un avatar pour voir le juré, sa notation et la réception de ses échantillons (bordure pleine = reçus).
      </p>

      <CategoryTargetsDialog
        open={targetsFor !== null}
        onOpenChange={(open) => !open && setTargetsFor(null)}
        categories={editedCategories}
        cupId={cupId}
      />
    </div>
  );
}
