"use client";

import { useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  QrCode,
  Plus,
  MoreHorizontal,
  Trash2,
  Ban,
  Copy,
  Printer,
  Layers,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

export default function InvitationCodesPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const printRef = useRef<HTMLDivElement>(null);

  // Dialog states
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [codeCount, setCodeCount] = useState(10);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [destination, setDestination] = useState("");

  // Filter states
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "activated" | "revoked" | "expired">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [destinationFilter, setDestinationFilter] = useState<string>("all");

  // Action states
  const [revokeCodeId, setRevokeCodeId] = useState<string | null>(null);
  const [deleteCodeId, setDeleteCodeId] = useState<string | null>(null);

  // Bulk selection
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([]);

  const utils = api.useUtils();

  // Queries
  const { data: cup, isLoading: cupLoading } = api.cup.getById.useQuery({ id: cupId });
  const { data: allCodes, isLoading: codesLoading } = api.juryCodes.list.useQuery({ cupId });
  const { data: stats } = api.juryCodes.getStats.useQuery({ cupId });
  const { data: categories } = api.category.list.useQuery({ cupId });

  // Client-side filtering
  const filteredCodes = useMemo(() => {
    if (!allCodes) return [];
    return allCodes.filter((code) => {
      if (statusFilter !== "all" && code.status !== statusFilter) return false;
      if (categoryFilter !== "all") {
        const hasCategory = code.categories.some((cat) => cat.id === categoryFilter);
        if (!hasCategory) return false;
      }
      if (destinationFilter !== "all" && code.destination !== destinationFilter) return false;
      return true;
    });
  }, [allCodes, statusFilter, categoryFilter, destinationFilter]);

  const destinations = useMemo(() => {
    if (!allCodes) return [];
    const uniqueDestinations = [...new Set(
      allCodes
        .map((c) => c.destination)
        .filter((d): d is string => d !== null && d !== undefined && d.trim() !== "")
    )];
    return uniqueDestinations.sort();
  }, [allCodes]);

  const codes = filteredCodes;

  // Mutations
  const generateMutation = api.juryCodes.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} code${data.count !== 1 ? "s" : ""} genere${data.count !== 1 ? "s" : ""}`);
      setIsGenerateDialogOpen(false);
      setCodeCount(10);
      setSelectedCategoryIds([]);
      setDestination("");
      void utils.juryCodes.list.invalidate({ cupId });
      void utils.juryCodes.getStats.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const revokeMutation = api.juryCodes.revoke.useMutation({
    onSuccess: () => {
      toast.success("Code revoque");
      setRevokeCodeId(null);
      void utils.juryCodes.list.invalidate({ cupId });
      void utils.juryCodes.getStats.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = api.juryCodes.delete.useMutation({
    onSuccess: () => {
      toast.success("Code supprime");
      setDeleteCodeId(null);
      void utils.juryCodes.list.invalidate({ cupId });
      void utils.juryCodes.getStats.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteBulkMutation = api.juryCodes.deleteBulk.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deletedCount} code${data.deletedCount !== 1 ? "s" : ""} supprime${data.deletedCount !== 1 ? "s" : ""}`);
      if (data.skippedCount > 0) {
        toast.info(`${data.skippedCount} code${data.skippedCount !== 1 ? "s" : ""} ignore${data.skippedCount !== 1 ? "s" : ""} (deja actives)`);
      }
      setSelectedCodeIds([]);
      void utils.juryCodes.list.invalidate({ cupId });
      void utils.juryCodes.getStats.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handlers
  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleGenerate = () => {
    if (selectedCategoryIds.length === 0) {
      toast.error("Selectionnez au moins une categorie");
      return;
    }
    generateMutation.mutate({
      cupId,
      categoryIds: selectedCategoryIds,
      count: codeCount,
      destination: destination.trim() || undefined,
    });
  };

  const toggleCodeSelection = (codeId: string) => {
    setSelectedCodeIds((prev) =>
      prev.includes(codeId)
        ? prev.filter((id) => id !== codeId)
        : [...prev, codeId]
    );
  };

  const toggleAllCodes = () => {
    if (!codes) return;
    const selectableCodes = codes.filter((c) => c.status !== "activated");
    if (selectedCodeIds.length === selectableCodes.length) {
      setSelectedCodeIds([]);
    } else {
      setSelectedCodeIds(selectableCodes.map((c) => c.id));
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copie");
  };

  const getActivationUrl = (code: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/activate?code=${code}`;
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenetre d'impression");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Codes d'invitation - ${cup?.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 24px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .code-card {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 16px;
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-container { margin-bottom: 8px; }
            .code-text {
              font-family: monospace;
              font-size: 16px;
              font-weight: bold;
              letter-spacing: 1px;
            }
            .categories {
              font-size: 10px;
              color: #666;
              margin-top: 4px;
            }
            @media print {
              body { padding: 10px; }
              .grid { gap: 10px; }
            }
          </style>
        </head>
        <body>
          <h1>${cup?.name} - Codes d'invitation</h1>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-warning)", color: "var(--n-warning)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            EN ATTENTE
          </span>
        );
      case "activated":
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-success)", color: "var(--n-success)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            ACTIVE
          </span>
        );
      case "revoked":
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-accent)", color: "var(--n-accent)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            REVOQUE
          </span>
        );
      case "expired":
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-text-disabled)", color: "var(--n-text-disabled)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            EXPIRE
          </span>
        );
      default:
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-border-visible)", color: "var(--n-text-secondary)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {status}
          </span>
        );
    }
  };

  const pendingCodes = codes?.filter((c) => c.status === "pending") ?? [];
  const selectedPendingCodes = pendingCodes.filter((c) => selectedCodeIds.includes(c.id));
  const codesToPrint = selectedPendingCodes.length > 0 ? selectedPendingCodes : pendingCodes;

  if (cupLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="n-font-body text-[var(--n-text-secondary)]">[LOADING...]</p>
      </div>
    );
  }

  if (!cup) {
    return null;
  }

  // Only show for public cups
  if (cup.type !== "public") {
    return (
      <div className="n-card p-8 space-y-4 max-w-md mx-auto text-center">
        <QrCode className="h-10 w-10 mx-auto text-[var(--n-text-disabled)]" />
        <div className="space-y-2">
          <h1 className="n-font-body text-xl font-semibold text-[var(--n-text-primary)]">
            Fonctionnalite non disponible
          </h1>
          <p className="n-label text-[var(--n-text-secondary)]">
            Les codes d&apos;invitation sont uniquement disponibles pour les cups publiques.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="n-font-body text-2xl font-bold text-[var(--n-text-display)]">
            Codes d&apos;invitation
          </h1>
          <p className="n-label text-[var(--n-text-secondary)] mt-1">
            Generez des codes QR pour les jurys de votre cup publique
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="n-label">
                <Plus className="mr-2 h-4 w-4" />
                Generer des codes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
                  Generer des codes d&apos;invitation
                </DialogTitle>
                <DialogDescription className="n-label text-[var(--n-text-secondary)]">
                  Creez des codes QR que les jurys pourront scanner pour s&apos;inscrire
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Number of codes */}
                <div className="space-y-2">
                  <Label htmlFor="count" className="n-label text-[var(--n-text-secondary)]">NOMBRE DE CODES</Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={200}
                    value={codeCount}
                    onChange={(e) => setCodeCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                  <p className="n-label text-[var(--n-text-disabled)]">
                    Maximum 200 codes par generation
                  </p>
                </div>

                {/* Category selection */}
                <div className="space-y-2">
                  <Label className="n-label text-[var(--n-text-secondary)]">CATEGORIES ASSIGNEES *</Label>
                  <p className="n-label text-[var(--n-text-disabled)] mb-2">
                    Les jurys ayant ce code pourront noter les produits de ces categories
                  </p>
                  {!categories || categories.length === 0 ? (
                    <div className="text-center py-6 border border-[var(--n-border)] rounded">
                      <Layers className="h-6 w-6 mx-auto mb-2 text-[var(--n-text-disabled)]" />
                      <p className="n-label text-[var(--n-text-secondary)]">Aucune categorie configuree</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {categories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center space-x-3 rounded border border-[var(--n-border)] bg-[var(--n-surface)] p-3 hover:bg-[var(--n-surface-raised)] cursor-pointer transition-colors"
                          onClick={() => toggleCategory(category.id)}
                        >
                          <Checkbox
                            id={`category-${category.id}`}
                            checked={selectedCategoryIds.includes(category.id)}
                            onCheckedChange={() => toggleCategory(category.id)}
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={`category-${category.id}`}
                              className="n-font-body font-medium cursor-pointer text-[var(--n-text-primary)]"
                            >
                              {category.name}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Destination / Store */}
                <div className="space-y-2">
                  <Label htmlFor="destination" className="n-label text-[var(--n-text-secondary)]">
                    DESTINATION / MAGASIN (OPTIONNEL)
                  </Label>
                  <Input
                    id="destination"
                    placeholder="Ex: Carrefour Lyon, Cave du Coin..."
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                  <p className="n-label text-[var(--n-text-disabled)]">
                    Permet de tracer ou sont envoyes les packs de QR codes
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="n-label"
                  onClick={() => {
                    setIsGenerateDialogOpen(false);
                    setSelectedCategoryIds([]);
                    setDestination("");
                  }}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={selectedCategoryIds.length === 0 || generateMutation.isPending}
                  className="n-label"
                >
                  {generateMutation.isPending ? "[...]" : <Plus className="mr-2 h-4 w-4" />}
                  Generer {codeCount} code{codeCount !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-text-secondary)] mb-1">TOTAL CODES</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-text-display)]">
            {stats?.total ?? 0}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-warning)] mb-1">EN ATTENTE</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-warning)]">
            {stats?.pending ?? 0}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-success)] mb-1">ACTIVES</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-success)]">
            {stats?.activated ?? 0}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label mb-1" style={{ color: "var(--n-accent)" }}>REVOQUES</p>
          <p className="n-font-data text-3xl font-bold" style={{ color: "var(--n-accent)" }}>
            {stats?.revoked ?? 0}
          </p>
        </div>
        <div className="n-card p-4 col-span-2 lg:col-span-1">
          <p className="n-label text-[var(--n-text-secondary)] mb-1">EXPIRES</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-text-disabled)]">
            {stats?.expired ?? 0}
          </p>
        </div>
      </div>

      {/* Filters & Bulk actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--n-text-secondary)]" />
            <span className="n-label text-[var(--n-text-secondary)]">FILTRES:</span>
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="activated">Actives</SelectItem>
              <SelectItem value="revoked">Revoques</SelectItem>
              <SelectItem value="expired">Expires</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {destinations && destinations.length > 0 && (
            <Select value={destinationFilter} onValueChange={setDestinationFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes destinations</SelectItem>
                {destinations.map((dest) => (
                  <SelectItem key={dest} value={dest}>
                    {dest}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pendingCodes.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPrintDialogOpen(true)}
              className="n-label"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer{selectedPendingCodes.length > 0
                ? ` (${selectedPendingCodes.length})`
                : ` tout (${pendingCodes.length})`}
            </Button>
          )}
          {selectedCodeIds.length > 0 && (
            <>
              <span className="n-label text-[var(--n-text-secondary)]">
                {selectedCodeIds.length} selectionne{selectedCodeIds.length !== 1 ? "s" : ""}
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteBulkMutation.mutate({ codeIds: selectedCodeIds })}
                disabled={deleteBulkMutation.isPending}
                className="n-label"
              >
                {deleteBulkMutation.isPending ? "[...]" : <Trash2 className="mr-2 h-4 w-4" />}
                Supprimer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedCodeIds([])}
                className="n-label"
              >
                Annuler
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Codes Table */}
      <div className="n-card overflow-hidden">
        <div className="p-4 border-b border-[var(--n-border-visible)]">
          <h2 className="n-font-body font-semibold text-[var(--n-text-primary)]">Codes generes</h2>
          <p className="n-label text-[var(--n-text-secondary)]">
            Liste de tous les codes d&apos;invitation
          </p>
        </div>
        <div className="p-4">
          {codesLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="n-font-body text-[var(--n-text-secondary)]">[LOADING...]</p>
            </div>
          ) : !codes || codes.length === 0 ? (
            <div className="text-center py-12">
              <QrCode className="h-8 w-8 mx-auto mb-3 text-[var(--n-text-disabled)]" />
              <p className="n-font-body font-medium text-[var(--n-text-secondary)]">Aucun code genere</p>
              <p className="n-label text-[var(--n-text-disabled)]">
                Cliquez sur &quot;Generer des codes&quot; pour commencer
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--n-border-visible)]">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedCodeIds.length > 0 &&
                        selectedCodeIds.length === codes.filter((c) => c.status !== "activated").length
                      }
                      onCheckedChange={toggleAllCodes}
                    />
                  </TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">CODE</TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">STATUT</TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">CATEGORIES</TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">DESTINATION</TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">ACTIVE PAR</TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">CREE LE</TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">EXPIRE LE</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow
                    key={code.id}
                    className="border-b border-[var(--n-border)] hover:bg-[var(--n-surface-raised)]"
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedCodeIds.includes(code.id)}
                        onCheckedChange={() => toggleCodeSelection(code.id)}
                        disabled={code.status === "activated"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="n-font-data font-semibold text-sm bg-[var(--n-surface-raised)] px-2 py-1 rounded border border-[var(--n-border)]">
                          {code.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyCode(code.code)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(code.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {code.categories.map((cat) => (
                          <span key={cat.id} className="n-tag">
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {code.destination ? (
                        <span className="n-font-body text-[var(--n-text-secondary)]">
                          {code.destination}
                        </span>
                      ) : (
                        <span className="n-label text-[var(--n-text-disabled)]">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {code.activatedBy ? (
                        <span className="n-font-body text-[var(--n-text-secondary)]">
                          {code.activatedBy.name ?? code.activatedBy.email}
                        </span>
                      ) : (
                        <span className="n-label text-[var(--n-text-disabled)]">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                        {new Date(code.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {code.expiresAt ? (
                        <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                          {new Date(code.expiresAt).toLocaleDateString("fr-FR")}
                        </span>
                      ) : (
                        <span className="n-label text-[var(--n-text-disabled)]">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {code.status === "pending" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyCode(getActivationUrl(code.code))}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copier le lien
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[var(--n-warning)]"
                              onClick={() => setRevokeCodeId(code.id)}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Revoquer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              style={{ color: "var(--n-accent)" }}
                              onClick={() => setDeleteCodeId(code.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Revoke Dialog */}
      <AlertDialog open={!!revokeCodeId} onOpenChange={() => setRevokeCodeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Revoquer ce code ?
            </AlertDialogTitle>
            <AlertDialogDescription className="n-label text-[var(--n-text-secondary)]">
              Le code ne pourra plus etre utilise pour s&apos;inscrire comme jury.
              Cette action peut etre annulee en supprimant le code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeCodeId && revokeMutation.mutate({ codeId: revokeCodeId })}
              className="n-label"
            >
              {revokeMutation.isPending && "[...]"}
              Revoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteCodeId} onOpenChange={() => setDeleteCodeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Supprimer ce code ?
            </AlertDialogTitle>
            <AlertDialogDescription className="n-label text-[var(--n-text-secondary)]">
              Cette action est irreversible. Le code sera definitivement supprime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCodeId && deleteMutation.mutate({ codeId: deleteCodeId })}
              className="n-label" style={{ background: "var(--n-accent)", color: "var(--n-black)" }}
            >
              {deleteMutation.isPending && "[...]"}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Imprimer les codes QR
            </DialogTitle>
            <DialogDescription className="n-label text-[var(--n-text-secondary)]">
              {selectedPendingCodes.length > 0
                ? `Apercu des ${codesToPrint.length} codes selectionnes`
                : `Apercu des ${codesToPrint.length} codes en attente prets a imprimer`}
            </DialogDescription>
          </DialogHeader>

          <div ref={printRef} className="py-4">
            <div className="grid grid-cols-3 gap-4">
              {codesToPrint.map((code) => (
                <div
                  key={code.id}
                  className="code-card border border-[var(--n-border)] rounded p-4 text-center bg-white"
                >
                  <div className="qr-container flex justify-center mb-2">
                    <QRCodeSVG
                      value={getActivationUrl(code.code)}
                      size={100}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="code-text n-font-data text-lg font-bold text-black tracking-wider">
                    {code.code}
                  </p>
                  <p className="categories n-label text-[var(--n-text-secondary)] mt-1">
                    {code.categories.map((c) => c.name).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)} className="n-label">
              Fermer
            </Button>
            <Button onClick={handlePrint} className="n-label">
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
