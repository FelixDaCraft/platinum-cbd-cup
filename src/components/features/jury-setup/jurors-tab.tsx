"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Bell,
  CheckCircle,
  FileText,
  Layers,
  MoreHorizontal,
  Package,
  PackageX,
  RotateCcw,
  Trash2,
  Users,
  UserPlus,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Progress } from "~/components/ui/progress";
import { Switch } from "~/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { JURY_PANEL_LABELS } from "~/lib/enums";
import { api } from "~/trpc/react";
import { CategoryAssignDialog } from "./category-assign-dialog";
import { ChangePanelDialog, ConfirmDialog } from "./juror-dialogs";
import {
  type CupJuror,
  EmptyState,
  ErrorState,
  LoadingState,
  panelShort,
  plural,
  useInvalidateJury,
} from "./shared";

type View = "active" | "inactive";

/** Demande externe : présélectionner des jurés et ouvrir l'affectation en masse. */
export interface AssignRequest {
  cupJuryIds: string[];
  nonce: number;
}

const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("fr-FR") : null);

/** Onglet « Par juré » : jurés actifs / désactivés, actions unitaires et en masse. */
export function JurorsTab({
  cupId,
  assignRequest,
  onAddJurors,
}: {
  cupId: string;
  assignRequest: AssignRequest | null;
  onAddJurors: () => void;
}) {
  const invalidate = useInvalidateJury(cupId);
  const [view, setView] = useState<View>("active");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignFor, setAssignFor] = useState<{ ids: string[]; mode: "replace" | "add" } | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [reactivateId, setReactivateId] = useState<string | null>(null);
  const [panelFor, setPanelFor] = useState<CupJuror | null>(null);

  const { data: allJuries, isLoading, isError, refetch } = api.jury.listJuries.useQuery({
    cupId,
    includeInactive: true,
  });
  const { data: completionStats } = api.jury.getCompletionStats.useQuery({ cupId });

  const juries = useMemo(() => allJuries?.filter((j) => j.isActive) ?? [], [allJuries]);
  const inactiveJuries = useMemo(() => allJuries?.filter((j) => !j.isActive) ?? [], [allJuries]);
  const statByJury = useMemo(
    () => new Map((completionStats?.juryStats ?? []).map((s) => [s.juryId, s])),
    [completionStats]
  );

  // Demande venue de l'onglet « Par catégorie » (jurés sans catégorie).
  useEffect(() => {
    if (!assignRequest || assignRequest.cupJuryIds.length === 0) return;
    setView("active");
    setSelectedIds(assignRequest.cupJuryIds);
    setAssignFor({ ids: assignRequest.cupJuryIds, mode: "add" });
  }, [assignRequest]);

  // ── Mutations ───────────────────────────────────────────────
  const onError = (error: { message: string }) => toast.error(error.message);

  const removeMutation = api.jury.removeJury.useMutation({
    onSuccess: () => {
      toast.success("Juré retiré de la cup");
      setRemoveId(null);
      invalidate();
    },
    onError,
  });

  const reactivateMutation = api.jury.reactivateJury.useMutation({
    onSuccess: () => {
      toast.success("Juré réactivé");
      setReactivateId(null);
      invalidate();
    },
    onError,
  });

  const sendReminderMutation = api.jury.sendRatingReminder.useMutation({
    onSuccess: () => {
      toast.success("Rappel envoyé");
      invalidate();
    },
    onError,
  });

  const sendBulkRemindersMutation = api.jury.sendBulkRatingReminders.useMutation({
    onSuccess: (data) => {
      if (data.success > 0) toast.success(`${data.success} rappel${data.success > 1 ? "s" : ""} envoyé${data.success > 1 ? "s" : ""}`);
      if (data.skipped > 0)
        toast.info(`${data.skipped} juré${data.skipped > 1 ? "s ont" : " a"} désactivé les rappels`);
      if (data.failed > 0) toast.error(`${data.failed} échec${data.failed > 1 ? "s" : ""}`);
      setSelectedIds([]);
      invalidate();
    },
    onError,
  });

  const sendRatingSheetMutation = api.jury.sendRatingSheet.useMutation({
    onSuccess: () => {
      toast.success("Fiche de notation envoyée");
      invalidate();
    },
    onError,
  });

  const sendAllRatingSheetsMutation = api.jury.sendAllRatingSheets.useMutation({
    onSuccess: (data) => {
      if (data.success > 0) toast.success(`${data.success} fiche${data.success > 1 ? "s" : ""} envoyée${data.success > 1 ? "s" : ""}`);
      const skipped = data.totalJuries - data.juriesWithProducts;
      if (skipped > 0) toast.info(`${skipped} juré${skipped > 1 ? "s" : ""} sans catégorie affectée`);
      if (data.failed > 0) toast.error(`${data.failed} échec${data.failed > 1 ? "s" : ""}`);
      invalidate();
    },
    onError,
  });

  const samplesMutation = api.jury.setSamplesReceived.useMutation({
    onSuccess: (data, vars) => {
      const n = data.updated;
      if (vars.cupJuryIds.length === 1) {
        toast.success(data.received ? "Échantillons marqués reçus" : "Réception des échantillons annulée");
      } else if (n === 0) {
        toast.info("Aucun changement : déjà à jour");
      } else {
        toast.success(
          `${n} juré${n > 1 ? "s" : ""} ${data.received ? `marqué${n > 1 ? "s" : ""} « échantillons reçus »` : `repassé${n > 1 ? "s" : ""} en « non reçus »`}`
        );
      }
      if (vars.cupJuryIds.length > 1) setSelectedIds([]);
      invalidate();
    },
    onError,
  });

  const setPanelMutation = api.jury.setPanel.useMutation({
    onSuccess: (data) => {
      setPanelFor(null);
      if (!data.changed) {
        toast.info("Ce juré était déjà dans ce jury");
        return;
      }
      const drafts =
        data.draftsDeleted > 0
          ? ` · ${data.draftsDeleted} brouillon${data.draftsDeleted > 1 ? "s" : ""} supprimé${data.draftsDeleted > 1 ? "s" : ""}`
          : "";
      toast.success(`Juré passé au ${JURY_PANEL_LABELS[data.panel].toLowerCase()}${drafts}`);
      invalidate();
    },
    onError,
  });

  // ── Sélection ───────────────────────────────────────────────
  const toggleSelection = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allSelected = juries.length > 0 && juries.every((j) => selectedIds.includes(j.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : juries.map((j) => j.id));

  if (isLoading) return <LoadingState minHeight={300} />;
  if (isError) {
    return <ErrorState message="LES JURÉS DE CETTE CUP N'ONT PAS PU ÊTRE CHARGÉS" onRetry={() => void refetch()} />;
  }

  const removeTarget = juries.find((j) => j.id === removeId);
  const reactivateTarget = inactiveJuries.find((j) => j.id === reactivateId);
  const panelForStat = panelFor ? statByJury.get(panelFor.id) : undefined;

  return (
    <div className="n-card overflow-hidden" style={{ padding: 0 }}>
      {/* Barre d'outils */}
      <div className="flex flex-col gap-3 border-b border-[var(--n-border-visible)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Statut des jurés">
          <button
            type="button"
            role="tab"
            aria-selected={view === "active"}
            className={`n-tag ${view === "active" ? "active" : ""}`}
            onClick={() => setView("active")}
          >
            ACTIFS · {juries.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "inactive"}
            className={`n-tag ${view === "inactive" ? "active" : ""}`}
            onClick={() => {
              setView("inactive");
              setSelectedIds([]);
            }}
          >
            DÉSACTIVÉS · {inactiveJuries.length}
          </button>
        </div>

        {view === "active" &&
          (selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="n-label">
                {selectedIds.length} {plural(selectedIds.length, "sélectionné")}
              </span>
              <Button size="sm" onClick={() => setAssignFor({ ids: selectedIds, mode: "add" })} className="n-label">
                <Layers className="mr-2 h-4 w-4" />
                Affecter des catégories
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => samplesMutation.mutate({ cupId, cupJuryIds: selectedIds, received: true })}
                disabled={samplesMutation.isPending}
                className="n-label"
              >
                <Package className="mr-2 h-4 w-4" />
                Échantillons reçus
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => samplesMutation.mutate({ cupId, cupJuryIds: selectedIds, received: false })}
                disabled={samplesMutation.isPending}
                className="n-label"
              >
                <PackageX className="mr-2 h-4 w-4" />
                Non reçus
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendBulkRemindersMutation.mutate({ cupId, juryIds: selectedIds })}
                disabled={sendBulkRemindersMutation.isPending}
                className="n-label"
              >
                {sendBulkRemindersMutation.isPending ? "[...]" : <Bell className="mr-2 h-4 w-4" />}
                Relancer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="n-label">
                Annuler
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendAllRatingSheetsMutation.mutate({ cupId })}
              disabled={sendAllRatingSheetsMutation.isPending || juries.length === 0}
              className="n-label self-start lg:self-auto"
            >
              {sendAllRatingSheetsMutation.isPending ? "[...]" : <FileText className="mr-2 h-4 w-4" />}
              Envoyer toutes les fiches
            </Button>
          ))}
      </div>

      <div className="p-4">
        {view === "active" ? (
          juries.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Aucun juré actif"
              hint="Ajoutez des jurés existants, invitez-en par e-mail ou générez des QR codes pour le jury public"
              action={
                <Button size="sm" onClick={onAddJurors} className="n-label">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Ajouter des jurés
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--n-border-visible)]">
                  <TableHead className="w-[44px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Tout sélectionner" />
                  </TableHead>
                  <TableHead className="n-label">JURÉ</TableHead>
                  <TableHead className="n-label">CATÉGORIES</TableHead>
                  <TableHead className="n-label">ÉCHANTILLONS</TableHead>
                  <TableHead className="n-label">NOTATION</TableHead>
                  <TableHead className="n-label">FICHE ENVOYÉE</TableHead>
                  <TableHead className="n-label">DERNIÈRE RELANCE</TableHead>
                  <TableHead className="n-label">REJOINT LE</TableHead>
                  <TableHead className="w-[50px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {juries.map((jury) => {
                  const stat = statByJury.get(jury.id);
                  const name = jury.user.name ?? "Sans nom";
                  const otherPanel = jury.panel === "pro" ? "public" : "pro";
                  return (
                    <TableRow key={jury.id} className="border-b border-[var(--n-border)] hover:bg-[var(--n-surface-raised)]">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(jury.id)}
                          onCheckedChange={() => toggleSelection(jury.id)}
                          aria-label={`Sélectionner ${name}`}
                        />
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="n-font-body font-medium text-[var(--n-text-primary)]">{name}</span>
                          {/* Panel du juré dans cette cup : ses notes comptent dans ce classement. */}
                          <button
                            type="button"
                            className={`n-tag ${jury.panel === "pro" ? "active" : ""}`}
                            style={{ padding: "1px 8px", fontSize: 10, gap: 4, cursor: "pointer" }}
                            title={`${JURY_PANEL_LABELS[jury.panel]} · changer de jury`}
                            aria-label={`${JURY_PANEL_LABELS[jury.panel]} : changer de jury pour ${name}`}
                            onClick={() => setPanelFor(jury)}
                          >
                            {panelShort(jury.panel)}
                            <ArrowLeftRight className="h-2.5 w-2.5" aria-hidden />
                          </button>
                        </div>
                        <span className="n-font-body text-xs text-[var(--n-text-secondary)] break-all">{jury.user.email}</span>
                      </TableCell>
                      <TableCell>
                        {jury.categoryAssignments.length === 0 ? (
                          <span className="n-label" style={{ color: "var(--n-warning)" }}>NON AFFECTÉ</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {jury.categoryAssignments.map((a) => (
                              <span key={a.id} className="n-tag" style={{ padding: "1px 8px", fontSize: 10 }}>
                                {a.category.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Switch
                            checked={!!jury.samplesReceivedAt}
                            disabled={samplesMutation.isPending}
                            onCheckedChange={(v) =>
                              samplesMutation.mutate({ cupId, cupJuryIds: [jury.id], received: v })
                            }
                            aria-label={`Échantillons reçus par ${name}`}
                          />
                          <span className="n-font-data text-xs text-[var(--n-text-secondary)] whitespace-nowrap">
                            {jury.samplesReceivedAt ? `REÇUS ${fmtDate(jury.samplesReceivedAt)}` : "NON REÇUS"}
                          </span>
                        </label>
                      </TableCell>
                      <TableCell>
                        {!stat || stat.totalProductsToRate === 0 ? (
                          <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>-</span>
                        ) : (
                          <div className="w-24">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="n-font-data text-xs text-[var(--n-text-primary)]">{stat.completionRate}%</span>
                              <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                                {stat.productsRated}/{stat.totalProductsToRate}
                              </span>
                            </div>
                            <Progress value={stat.completionRate} className="h-1" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {jury.ratingSheetSentAt ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-[var(--n-success)]" aria-hidden />
                            <span className="n-font-data text-xs text-[var(--n-text-secondary)]">{fmtDate(jury.ratingSheetSentAt)}</span>
                          </div>
                        ) : (
                          <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="n-font-data text-xs text-[var(--n-text-secondary)]">{fmtDate(jury.lastReminderAt) ?? "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="n-font-data text-xs text-[var(--n-text-secondary)]">{fmtDate(jury.joinedAt)}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions pour ${name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setAssignFor({ ids: [jury.id], mode: "replace" })}>
                              <Layers className="mr-2 h-4 w-4" />
                              Affecter des catégories
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPanelFor(jury)}>
                              <ArrowLeftRight className="mr-2 h-4 w-4" />
                              Changer de jury ({JURY_PANEL_LABELS[otherPanel].toLowerCase()})
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                samplesMutation.mutate({ cupId, cupJuryIds: [jury.id], received: !jury.samplesReceivedAt })
                              }
                            >
                              {jury.samplesReceivedAt ? <PackageX className="mr-2 h-4 w-4" /> : <Package className="mr-2 h-4 w-4" />}
                              {jury.samplesReceivedAt ? "Marquer échantillons non reçus" : "Marquer échantillons reçus"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => sendRatingSheetMutation.mutate({ cupJuryId: jury.id })}
                              disabled={sendRatingSheetMutation.isPending || jury.categoryAssignments.length === 0}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Envoyer la fiche de notation
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => sendReminderMutation.mutate({ cupJuryId: jury.id })}
                              disabled={sendReminderMutation.isPending}
                            >
                              <Bell className="mr-2 h-4 w-4" />
                              Envoyer un rappel
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem style={{ color: "var(--n-accent)" }} onClick={() => setRemoveId(jury.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Retirer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        ) : inactiveJuries.length === 0 ? (
          <EmptyState icon={<CheckCircle className="h-8 w-8" />} title="Aucun juré désactivé" hint="Tous les jurés sont actifs" />
        ) : (
          <>
            <p className="n-label mb-3 flex items-center gap-2">
              <UserX className="h-3.5 w-3.5" aria-hidden />
              Jurés retirés de la cup : ils peuvent être réactivés
            </p>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--n-border-visible)]">
                  <TableHead className="n-label">JURÉ</TableHead>
                  <TableHead className="n-label">E-MAIL</TableHead>
                  <TableHead className="n-label">REJOINT LE</TableHead>
                  <TableHead className="n-label w-[120px]">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveJuries.map((jury) => (
                  <TableRow key={jury.id} className="border-b border-[var(--n-border)] opacity-70 hover:bg-[var(--n-surface-raised)]">
                    <TableCell className="n-font-body font-medium text-[var(--n-text-primary)]">
                      {jury.user.name ?? "Sans nom"}
                      <span className="n-tag ml-2" style={{ padding: "1px 8px", fontSize: 10 }} title={JURY_PANEL_LABELS[jury.panel]}>
                        {panelShort(jury.panel)}
                      </span>
                    </TableCell>
                    <TableCell className="n-font-body text-[var(--n-text-secondary)]">{jury.user.email}</TableCell>
                    <TableCell>
                      <span className="n-font-data text-xs text-[var(--n-text-secondary)]">{fmtDate(jury.joinedAt)}</span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setReactivateId(jury.id)} className="n-label">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Réactiver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>

      {/* Dialogues */}
      <CategoryAssignDialog
        cupId={cupId}
        request={assignFor}
        juries={juries}
        onClose={() => setAssignFor(null)}
        onAssigned={(bulk) => {
          setAssignFor(null);
          if (bulk) setSelectedIds([]);
        }}
      />

      <ChangePanelDialog
        juror={panelFor}
        submittedCount={panelForStat?.productsRated ?? 0}
        pending={setPanelMutation.isPending}
        onCancel={() => setPanelFor(null)}
        onConfirm={(panel) => panelFor && setPanelMutation.mutate({ cupJuryId: panelFor.id, panel })}
      />

      <ConfirmDialog
        open={!!removeId}
        onCancel={() => setRemoveId(null)}
        title="Retirer ce juré ?"
        description={`${removeTarget?.user.name ?? "Ce juré"} ne pourra plus noter les produits de cette cup. Vous pourrez le réactiver depuis la vue « Désactivés ».`}
        confirmLabel="Retirer"
        destructive
        pending={removeMutation.isPending}
        onConfirm={() => removeId && removeMutation.mutate({ cupJuryId: removeId })}
      />

      <ConfirmDialog
        open={!!reactivateId}
        onCancel={() => setReactivateId(null)}
        title="Réactiver ce juré ?"
        description={`${reactivateTarget?.user.name ?? "Ce juré"} pourra à nouveau noter les produits de cette cup.`}
        confirmLabel="Réactiver"
        pending={reactivateMutation.isPending}
        onConfirm={() => reactivateId && reactivateMutation.mutate({ cupJuryId: reactivateId })}
      />
    </div>
  );
}
