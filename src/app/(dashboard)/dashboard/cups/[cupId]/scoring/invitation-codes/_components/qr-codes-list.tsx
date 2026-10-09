"use client";

import { forwardRef, useMemo, useState } from "react";
import { Ban, Copy, Link2, MoreHorizontal, Package, Printer, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { effectiveCodeStatus } from "~/lib/jury-coverage";
import { api } from "~/trpc/react";
import {
  STATUS_META,
  formatDate,
  getActivationUrl,
  plural,
  type CodeStatus,
  type PrintableCode,
  type QrCodeRow,
} from "./shared";

const PAGE_SIZE = 50;

export type StatusFilter = CodeStatus | "all";

interface QrCodesListProps {
  cupId: string;
  codes: QrCodeRow[] | undefined;
  isLoading: boolean;
  categories: Array<{ id: string; name: string }>;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  onPrint: (codes: PrintableCode[], scopeLabel: string) => void;
}

const toPrintable = (code: QrCodeRow): PrintableCode => ({
  code: code.code,
  categories: code.categories.map((c) => c.name),
});

function StatusTag({ status }: { status: CodeStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="n-tag" style={{ borderColor: meta.color, color: meta.color, padding: "2px 8px", whiteSpace: "nowrap" }}>
      {meta.label}
    </span>
  );
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Copie impossible : sélectionnez le texte à la main");
  }
}

export const QrCodesList = forwardRef<HTMLElement, QrCodesListProps>(function QrCodesList(
  { cupId, codes, isLoading, categories, categoryFilter, onCategoryFilterChange, onPrint },
  ref
) {
  const utils = api.useUtils();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [qrPreview, setQrPreview] = useState<QrCodeRow | null>(null);
  // Une cup compte vite plusieurs centaines de codes : liste paginée.
  const [page, setPage] = useState(0);

  const invalidate = () => {
    void utils.juryCodes.list.invalidate({ cupId });
    void utils.juryCodes.getStats.invalidate({ cupId });
    void utils.jury.getCoverage.invalidate({ cupId });
  };

  const revoke = api.juryCodes.revoke.useMutation({
    onSuccess: () => {
      toast.success("QR code révoqué");
      setRevokeId(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = api.juryCodes.delete.useMutation({
    onSuccess: () => {
      toast.success("QR code supprimé");
      setDeleteId(null);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteId));
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeBulk = api.juryCodes.deleteBulk.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deletedCount} ${plural(data.deletedCount, "QR code supprimé", "QR codes supprimés")}`);
      if (data.skippedCount > 0) {
        toast.info(`${data.skippedCount} ${plural(data.skippedCount, "code ignoré", "codes ignorés")} (déjà activés)`);
      }
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Statut effectif : un code en attente passé sa date est expiré.
  const rows = useMemo(() => {
    const now = new Date();
    return (codes ?? []).map((code) => ({
      ...code,
      effectiveStatus: effectiveCodeStatus(
        { status: code.status, expiresAt: code.expiresAt ? new Date(code.expiresAt) : null },
        now
      ),
    }));
  }, [codes]);

  const destinations = useMemo(
    () =>
      [...new Set(rows.map((c) => c.destination?.trim()).filter((d): d is string => !!d))].sort((a, b) =>
        a.localeCompare(b, "fr")
      ),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((code) => {
        if (statusFilter !== "all" && code.effectiveStatus !== statusFilter) return false;
        if (categoryFilter !== "all" && !code.categories.some((c) => c.id === categoryFilter)) return false;
        if (destinationFilter !== "all" && code.destination?.trim() !== destinationFilter) return false;
        return true;
      }),
    [rows, statusFilter, categoryFilter, destinationFilter]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const selectable = filtered.filter((c) => c.status !== "activated");
  const visibleSelected = selectedIds.filter((id) => selectable.some((c) => c.id === id));
  const allSelected = selectable.length > 0 && visibleSelected.length === selectable.length;
  const printablePending = filtered.filter((c) => c.effectiveStatus === "pending");
  const selectedPending = printablePending.filter((c) => visibleSelected.includes(c.id));

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () => setSelectedIds(allSelected ? [] : selectable.map((c) => c.id));

  const categoryName = categories.find((c) => c.id === categoryFilter)?.name;
  const scopeLabel = [categoryName ?? "Toutes catégories", destinationFilter !== "all" ? destinationFilter : null]
    .filter(Boolean)
    .join(" · ");

  const hasFilters = statusFilter !== "all" || categoryFilter !== "all" || destinationFilter !== "all";

  return (
    <section ref={ref} className="n-card overflow-hidden" style={{ padding: 0 }} aria-labelledby="qr-list-title">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: "var(--n-border)" }}>
        <div>
          <h2 id="qr-list-title" className="n-font-display text-sm font-bold uppercase tracking-wider" style={{ color: "var(--n-text-display)" }}>
            Tous les QR codes
          </h2>
          <p className="n-label mt-1" style={{ color: "var(--n-text-disabled)" }}>
            {filtered.length} / {rows.length} {plural(rows.length, "code")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="h-9 w-[180px]" aria-label="Filtrer par catégorie">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filtrer par statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {(Object.keys(STATUS_META) as CodeStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {destinations.length > 0 && (
            <Select value={destinationFilter} onValueChange={setDestinationFilter}>
              <SelectTrigger className="h-9 w-[180px]" aria-label="Filtrer par lieu">
                <SelectValue placeholder="Lieu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les lieux</SelectItem>
                {destinations.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatusFilter("all");
                onCategoryFilterChange("all");
                setDestinationFilter("all");
              }}
            >
              Effacer
            </Button>
          )}
        </div>
      </div>

      {/* Actions sur la sélection / impression */}
      {(printablePending.length > 0 || visibleSelected.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--n-border)" }}>
          {visibleSelected.length > 0 && (
            <span className="n-label mr-auto" style={{ color: "var(--n-text-primary)" }}>
              {visibleSelected.length} {plural(visibleSelected.length, "sélectionné")}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className={visibleSelected.length === 0 ? "ml-auto" : undefined}
            disabled={(selectedPending.length > 0 ? selectedPending : printablePending).length === 0}
            onClick={() =>
              selectedPending.length > 0
                ? onPrint(selectedPending.map(toPrintable), `Sélection · ${scopeLabel}`)
                : onPrint(printablePending.map(toPrintable), scopeLabel)
            }
          >
            <Printer className="mr-2 h-4 w-4" />
            {selectedPending.length > 0
              ? `Imprimer la sélection (${selectedPending.length})`
              : `Imprimer les codes en attente (${printablePending.length})`}
          </Button>
          {visibleSelected.length > 0 && (
            <>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                Désélectionner
              </Button>
            </>
          )}
        </div>
      )}

      <div className="p-2 sm:p-4">
        {isLoading ? (
          <p className="n-label py-10 text-center" style={{ color: "var(--n-text-disabled)" }} role="status">
            [CHARGEMENT…]
          </p>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <QrCode className="mx-auto mb-3 h-8 w-8" style={{ color: "var(--n-text-disabled)" }} aria-hidden="true" />
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Aucun QR code généré pour cette cup.
            </p>
            <p className="n-label mt-1" style={{ color: "var(--n-text-disabled)" }}>
              Générez un premier lot depuis une catégorie.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Aucun code ne correspond à ces filtres.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: "var(--n-border-visible)" }}>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    disabled={selectable.length === 0}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead className="n-label">Code</TableHead>
                <TableHead className="n-label">Statut</TableHead>
                <TableHead className="n-label">Catégorie</TableHead>
                <TableHead className="n-label">Lieu</TableHead>
                <TableHead className="n-label">Activé par</TableHead>
                <TableHead className="n-label">Créé le</TableHead>
                <TableHead className="n-label">Expire le</TableHead>
                <TableHead className="w-[44px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((code) => (
                <TableRow key={code.id} style={{ borderColor: "var(--n-border)" }}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(code.id)}
                      onCheckedChange={() => toggle(code.id)}
                      disabled={code.status === "activated"}
                      aria-label={`Sélectionner ${code.code}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <code
                        className="n-font-data whitespace-nowrap rounded border px-2 py-1 text-sm font-semibold"
                        style={{ background: "var(--n-surface-raised)", borderColor: "var(--n-border)", color: "var(--n-text-display)" }}
                      >
                        {code.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void copyText(code.code, "Code copié")}
                        aria-label={`Copier le code ${code.code}`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {code.samplesIncluded && (
                        <span
                          className="n-tag"
                          style={{ padding: "2px 8px", gap: 4 }}
                          title="QR glissé dans la box : réception des échantillons confirmée à l'activation"
                        >
                          <Package className="h-3 w-3" aria-hidden="true" />
                          Box
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusTag status={code.effectiveStatus} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {code.categories.map((cat) => (
                        <span key={cat.id} className="text-sm whitespace-nowrap" style={{ color: "var(--n-text-primary)" }}>
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    {code.destination ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    {code.activatedBy ? (code.activatedBy.name ?? code.activatedBy.email) : "—"}
                  </TableCell>
                  <TableCell className="n-font-data text-xs" style={{ color: "var(--n-text-secondary)" }}>
                    {formatDate(code.createdAt)}
                  </TableCell>
                  <TableCell className="n-font-data text-xs" style={{ color: "var(--n-text-secondary)" }}>
                    {code.expiresAt ? formatDate(code.expiresAt) : "Sans limite"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions pour ${code.code}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setQrPreview(code)}>
                          <QrCode className="mr-2 h-4 w-4" />
                          Afficher le QR
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void copyText(code.code, "Code copié")}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copier le code
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void copyText(getActivationUrl(code.code), "Lien copié")}>
                          <Link2 className="mr-2 h-4 w-4" />
                          Copier le lien
                        </DropdownMenuItem>
                        {code.effectiveStatus === "pending" && (
                          <DropdownMenuItem onClick={() => onPrint([toPrintable(code)], code.code)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimer
                          </DropdownMenuItem>
                        )}
                        {code.effectiveStatus === "pending" && (
                          <DropdownMenuItem style={{ color: "var(--n-warning)" }} onClick={() => setRevokeId(code.id)}>
                            <Ban className="mr-2 h-4 w-4" />
                            Révoquer
                          </DropdownMenuItem>
                        )}
                        {code.status !== "activated" && (
                          <DropdownMenuItem style={{ color: "var(--n-accent)" }} onClick={() => setDeleteId(code.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 pt-4">
            <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
              {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="n-btn-secondary text-xs"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 0}
              >
                Précédent
              </button>
              <span className="n-label">
                {currentPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="n-btn-secondary text-xs"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= pageCount - 1}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Aperçu d'un QR */}
      <Dialog open={!!qrPreview} onOpenChange={(o) => !o && setQrPreview(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR code</DialogTitle>
            <DialogDescription>
              {qrPreview?.categories.map((c) => c.name).join(" · ")}
              {qrPreview?.samplesIncluded ? " · échantillons inclus dans la box" : ""}
            </DialogDescription>
          </DialogHeader>
          {qrPreview && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={getActivationUrl(qrPreview.code)} size={200} level="M" />
              </div>
              <code className="n-font-data text-lg font-bold tracking-wider" style={{ color: "var(--n-text-display)" }}>
                {qrPreview.code}
              </code>
              <p className="break-all text-center text-xs" style={{ color: "var(--n-text-secondary)" }}>
                {getActivationUrl(qrPreview.code)}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => qrPreview && void copyText(getActivationUrl(qrPreview.code), "Lien copié")}>
              <Link2 className="mr-2 h-4 w-4" />
              Copier le lien
            </Button>
            <Button onClick={() => setQrPreview(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Révocation */}
      <AlertDialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer ce QR code ?</AlertDialogTitle>
            <AlertDialogDescription>
              Il ne pourra plus être activé : la personne qui le scannera verra « code révoqué ». Un code
              révoqué peut ensuite être supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoke.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (revokeId) revoke.mutate({ codeId: revokeId });
              }}
            >
              {revoke.isPending ? "Révocation…" : "Révoquer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suppression */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce QR code ?</AlertDialogTitle>
            <AlertDialogDescription>
              Suppression définitive. S&apos;il a déjà été imprimé, le QR ne mènera plus nulle part.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              style={{ background: "var(--n-accent)", color: "var(--n-text-display)" }}
              onClick={(e) => {
                e.preventDefault();
                if (deleteId) remove.mutate({ codeId: deleteId });
              }}
            >
              {remove.isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suppression groupée */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {visibleSelected.length} {plural(visibleSelected.length, "QR code")} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Suppression définitive. Les codes déjà activés ne sont pas sélectionnables et restent en place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeBulk.isPending || visibleSelected.length === 0}
              style={{ background: "var(--n-accent)", color: "var(--n-text-display)" }}
              onClick={(e) => {
                e.preventDefault();
                removeBulk.mutate({ codeIds: visibleSelected });
              }}
            >
              {removeBulk.isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
});
