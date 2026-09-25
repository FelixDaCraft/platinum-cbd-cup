"use client";

import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Copy,
  Filter,
  Layers,
  Link2,
  Plus,
  Printer,
  QrCode,
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";

type TokenStatusFilter = "all" | "available" | "claimed" | "expired";

/**
 * Écran organisateur des jetons jury publics.
 *
 * Un jeton public est un lien à usage unique (`/jury/public/<token>`) qui
 * rattache d'office son porteur à UNE catégorie : contrairement aux codes
 * d'invitation, il n'y a ni saisie de code ni choix de catégories côté juré.
 * On génère donc par lot, par catégorie, et on distribue le lien ou le QR.
 */
export default function PublicJuryTokensPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const printRef = useRef<HTMLDivElement>(null);

  // Génération
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generateCategoryId, setGenerateCategoryId] = useState<string>("");
  const [quantity, setQuantity] = useState(20);
  const [expiresInDays, setExpiresInDays] = useState(90);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<TokenStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");

  // Impression / QR
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);

  const utils = api.useUtils();

  const {
    data: cup,
    isLoading: cupLoading,
    isError: cupError,
    refetch: refetchCup,
  } = api.cup.getById.useQuery({
    id: cupId,
  });
  const { data: categories } = api.category.list.useQuery({ cupId });
  const {
    data: tokenData,
    isLoading: tokensLoading,
    isError: tokensError,
    refetch: refetchTokens,
  } = api.jury.listPublicJuryTokens.useQuery({ cupId, status: "all" });

  const generateMutation = api.jury.generatePublicJuryTokens.useMutation({
    onSuccess: (data) => {
      toast.success(
        `${data.tokensGenerated} jeton${data.tokensGenerated !== 1 ? "s" : ""} généré${data.tokensGenerated !== 1 ? "s" : ""}`
      );
      setIsGenerateDialogOpen(false);
      setGenerateCategoryId("");
      setQuantity(20);
      setExpiresInDays(90);
      void utils.jury.listPublicJuryTokens.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const tokens = useMemo(() => tokenData?.tokens ?? [], [tokenData]);
  const stats = tokenData?.stats;

  const batches = useMemo(() => {
    const unique = [
      ...new Set(
        tokens
          .map((token) => token.batchId)
          .filter((batchId): batchId is string => !!batchId)
      ),
    ];
    return unique;
  }, [tokens]);

  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      if (statusFilter !== "all" && token.status !== statusFilter) return false;
      if (categoryFilter !== "all" && token.categoryId !== categoryFilter)
        return false;
      if (batchFilter !== "all" && token.batchId !== batchFilter) return false;
      return true;
    });
  }, [tokens, statusFilter, categoryFilter, batchFilter]);

  // Seuls les jetons encore distribuables méritent d'être imprimés.
  const printableTokens = filteredTokens.filter(
    (token) => token.status === "available"
  );

  const getClaimUrl = (token: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/jury/public/${token}`;
  };

  const copyText = (value: string, message: string) => {
    void navigator.clipboard.writeText(value);
    toast.success(message);
  };

  const handleGenerate = () => {
    if (!generateCategoryId) {
      toast.error("Sélectionnez une catégorie");
      return;
    }
    generateMutation.mutate({
      cupId,
      categoryId: generateCategoryId,
      quantity,
      expiresInDays,
    });
  };

  const copyAllLinks = () => {
    if (printableTokens.length === 0) {
      toast.error("Aucun jeton disponible à copier");
      return;
    }
    copyText(
      printableTokens.map((token) => getClaimUrl(token.token)).join("\n"),
      `${printableTokens.length} lien${printableTokens.length !== 1 ? "s" : ""} copié${printableTokens.length !== 1 ? "s" : ""}`
    );
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jetons jury publics - ${cup?.name ?? ""}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 24px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .token-card {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 16px;
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-container { margin-bottom: 8px; }
            .token-text {
              font-family: monospace;
              font-size: 12px;
              font-weight: bold;
              letter-spacing: 1px;
              word-break: break-all;
            }
            .category { font-size: 10px; color: #666; margin-top: 4px; }
            @media print {
              body { padding: 10px; }
              .grid { gap: 10px; }
            }
          </style>
        </head>
        <body>
          <h1>${cup?.name ?? ""} - Jetons jury publics</h1>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusBadge = (status: string) => {
    const base: React.CSSProperties = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      border: "1px solid",
      fontSize: "11px",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    };

    switch (status) {
      case "available":
        return (
          <span
            className="n-label"
            style={{
              ...base,
              borderColor: "var(--n-warning)",
              color: "var(--n-warning)",
            }}
          >
            DISPONIBLE
          </span>
        );
      case "claimed":
        return (
          <span
            className="n-label"
            style={{
              ...base,
              borderColor: "var(--n-success)",
              color: "var(--n-success)",
            }}
          >
            RÉCLAMÉ
          </span>
        );
      case "expired":
        return (
          <span
            className="n-label"
            style={{
              ...base,
              borderColor: "var(--n-text-disabled)",
              color: "var(--n-text-disabled)",
            }}
          >
            EXPIRÉ
          </span>
        );
      default:
        return (
          <span
            className="n-label"
            style={{
              ...base,
              borderColor: "var(--n-border-visible)",
              color: "var(--n-text-secondary)",
            }}
          >
            {status}
          </span>
        );
    }
  };

  const formatDate = (value: Date | string | null) =>
    value ? new Date(value).toLocaleDateString("fr-FR") : "-";

  if (cupLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="n-font-body text-[var(--n-text-secondary)]">
          [LOADING...]
        </p>
      </div>
    );
  }

  // Une requête en échec ne doit pas se confondre avec une page vide :
  // un écran « aucune donnée » masquerait l'incident.
  if (cupError || tokensError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <span role="alert" className="n-label" style={{ color: "var(--n-text-secondary)" }}>
          [ERREUR] LES JETONS JURY N&apos;ONT PAS PU ÊTRE CHARGÉS
        </span>
        <button type="button" className="n-btn-secondary text-xs" onClick={() => { void refetchCup(); void refetchTokens(); }}>
          RÉESSAYER
        </button>
      </div>
    );
  }

  if (!cup) {
    return null;
  }

  const hasCategories = !!categories && categories.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="n-font-body text-2xl font-bold text-[var(--n-text-display)]">
            Jetons jury publics
          </h1>
          <p className="n-label text-[var(--n-text-secondary)] mt-1">
            Liens à usage unique rattachant un juré à une catégorie, sans code à
            saisir
          </p>
        </div>

        <Dialog
          open={isGenerateDialogOpen}
          onOpenChange={setIsGenerateDialogOpen}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="n-label" disabled={!hasCategories}>
              <Plus className="mr-2 h-4 w-4" />
              Générer des jetons
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
                Générer un lot de jetons
              </DialogTitle>
              <DialogDescription className="n-label text-[var(--n-text-secondary)]">
                Chaque jeton vaut pour un seul juré et une seule catégorie
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Catégorie */}
              <div className="space-y-2">
                <Label className="n-label text-[var(--n-text-secondary)]">
                  CATÉGORIE *
                </Label>
                {!hasCategories ? (
                  <div className="text-center py-6 border border-[var(--n-border)] rounded">
                    <Layers className="h-6 w-6 mx-auto mb-2 text-[var(--n-text-disabled)]" />
                    <p className="n-label text-[var(--n-text-secondary)]">
                      Aucune catégorie configurée
                    </p>
                  </div>
                ) : (
                  <Select
                    value={generateCategoryId}
                    onValueChange={setGenerateCategoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="n-label text-[var(--n-text-disabled)]">
                  Le juré ne pourra noter que les produits de cette catégorie
                </p>
              </div>

              {/* Quantité */}
              <div className="space-y-2">
                <Label
                  htmlFor="quantity"
                  className="n-label text-[var(--n-text-secondary)]"
                >
                  NOMBRE DE JETONS
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={500}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.min(500, Math.max(1, parseInt(e.target.value) || 1))
                    )
                  }
                />
                <p className="n-label text-[var(--n-text-disabled)]">
                  Maximum 500 jetons par génération
                </p>
              </div>

              {/* Expiration */}
              <div className="space-y-2">
                <Label
                  htmlFor="expires"
                  className="n-label text-[var(--n-text-secondary)]"
                >
                  VALIDITÉ (JOURS)
                </Label>
                <Input
                  id="expires"
                  type="number"
                  min={1}
                  max={365}
                  value={expiresInDays}
                  onChange={(e) =>
                    setExpiresInDays(
                      Math.min(365, Math.max(1, parseInt(e.target.value) || 1))
                    )
                  }
                />
                <p className="n-label text-[var(--n-text-disabled)]">
                  Passé ce délai, un jeton non réclamé devient inutilisable
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                className="n-label"
                onClick={() => {
                  setIsGenerateDialogOpen(false);
                  setGenerateCategoryId("");
                }}
              >
                Annuler
              </Button>
              <Button
                className="n-label"
                onClick={handleGenerate}
                disabled={!generateCategoryId || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  "[...]"
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Générer {quantity} jeton{quantity !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-text-secondary)] mb-1">
            TOTAL JETONS
          </p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-text-display)]">
            {stats?.total ?? 0}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-warning)] mb-1">DISPONIBLES</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-warning)]">
            {stats?.available ?? 0}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-success)] mb-1">RÉCLAMÉS</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-success)]">
            {stats?.claimed ?? 0}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-text-secondary)] mb-1">EXPIRÉS</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-text-disabled)]">
            {stats?.expired ?? 0}
          </p>
        </div>
      </div>

      {/* Filtres & distribution */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--n-text-secondary)]" />
            <span className="n-label text-[var(--n-text-secondary)]">
              FILTRES:
            </span>
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as TokenStatusFilter)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="claimed">Réclamés</SelectItem>
              <SelectItem value="expired">Expirés</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {batches.length > 0 && (
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Lot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les lots</SelectItem>
                {batches.map((batchId, index) => (
                  <SelectItem key={batchId} value={batchId}>
                    Lot {batches.length - index} · {batchId.slice(0, 6)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {printableTokens.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="n-label"
              onClick={copyAllLinks}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Copier les liens ({printableTokens.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="n-label"
              onClick={() => setIsPrintDialogOpen(true)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer les QR ({printableTokens.length})
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="n-card overflow-hidden">
        <div className="p-4 border-b border-[var(--n-border-visible)]">
          <h2 className="n-font-body font-semibold text-[var(--n-text-primary)]">
            Jetons générés
          </h2>
          <p className="n-label text-[var(--n-text-secondary)]">
            {filteredTokens.length} jeton
            {filteredTokens.length !== 1 ? "s" : ""} affiché
            {filteredTokens.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="p-4">
          {tokensLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="n-font-body text-[var(--n-text-secondary)]">
                [LOADING...]
              </p>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-12">
              <QrCode className="h-8 w-8 mx-auto mb-3 text-[var(--n-text-disabled)]" />
              <p className="n-font-body font-medium text-[var(--n-text-secondary)]">
                {tokens.length === 0
                  ? "Aucun jeton généré"
                  : "Aucun jeton ne correspond aux filtres"}
              </p>
              <p className="n-label text-[var(--n-text-disabled)]">
                {tokens.length === 0
                  ? "Cliquez sur « Générer des jetons » pour commencer"
                  : "Élargissez les filtres pour voir les autres jetons"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--n-border-visible)]">
                  <TableHead className="n-label text-[var(--n-text-secondary)]">
                    JETON
                  </TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">
                    STATUT
                  </TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">
                    CATÉGORIE
                  </TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">
                    RÉCLAMÉ PAR
                  </TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">
                    RÉCLAMÉ LE
                  </TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)]">
                    EXPIRE LE
                  </TableHead>
                  <TableHead className="n-label text-[var(--n-text-secondary)] text-right">
                    DISTRIBUER
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.map((token) => (
                  <TableRow
                    key={token.id}
                    className="border-b border-[var(--n-border)] hover:bg-[var(--n-surface-raised)]"
                  >
                    <TableCell>
                      <code className="n-font-data text-xs bg-[var(--n-surface-raised)] px-2 py-1 rounded border border-[var(--n-border)]">
                        {token.token}
                      </code>
                    </TableCell>
                    <TableCell>{getStatusBadge(token.status)}</TableCell>
                    <TableCell>
                      <span className="n-tag">{token.category.name}</span>
                    </TableCell>
                    <TableCell>
                      {token.claimedBy ? (
                        <span className="n-font-body text-[var(--n-text-secondary)]">
                          {token.claimedBy.name ?? token.claimedBy.email}
                        </span>
                      ) : (
                        <span className="n-label text-[var(--n-text-disabled)]">
                          -
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                        {formatDate(token.claimedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                        {formatDate(token.expiresAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {token.status === "available" ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Copier le lien"
                            onClick={() =>
                              copyText(
                                getClaimUrl(token.token),
                                "Lien copié"
                              )
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Afficher le QR code"
                            onClick={() => setQrToken(token.token)}
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="n-label text-[var(--n-text-disabled)]">
                          -
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* QR unitaire */}
      <Dialog open={!!qrToken} onOpenChange={(open) => !open && setQrToken(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              QR code du jeton
            </DialogTitle>
            <DialogDescription className="n-label text-[var(--n-text-secondary)]">
              À scanner par le juré pour rejoindre la cup
            </DialogDescription>
          </DialogHeader>
          {qrToken && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded">
                <QRCodeSVG
                  value={getClaimUrl(qrToken)}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <code className="n-font-data text-xs text-center break-all text-[var(--n-text-secondary)]">
                {getClaimUrl(qrToken)}
              </code>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="n-label"
              onClick={() => setQrToken(null)}
            >
              Fermer
            </Button>
            <Button
              className="n-label"
              onClick={() =>
                qrToken && copyText(getClaimUrl(qrToken), "Lien copié")
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              Copier le lien
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Planche de QR à imprimer */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Imprimer les QR codes
            </DialogTitle>
            <DialogDescription className="n-label text-[var(--n-text-secondary)]">
              Aperçu des {printableTokens.length} jeton
              {printableTokens.length !== 1 ? "s" : ""} disponible
              {printableTokens.length !== 1 ? "s" : ""} selon les filtres
              actuels
            </DialogDescription>
          </DialogHeader>

          <div ref={printRef} className="py-4">
            <div className="grid grid-cols-3 gap-4">
              {printableTokens.map((token) => (
                <div
                  key={token.id}
                  className="token-card border border-[var(--n-border)] rounded p-4 text-center bg-white"
                >
                  <div className="qr-container flex justify-center mb-2">
                    <QRCodeSVG
                      value={getClaimUrl(token.token)}
                      size={100}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="token-text n-font-data text-xs font-bold text-black break-all">
                    {token.token}
                  </p>
                  <p className="category n-label text-[var(--n-text-secondary)] mt-1">
                    {token.category.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="n-label"
              onClick={() => setIsPrintDialogOpen(false)}
            >
              Fermer
            </Button>
            <Button className="n-label" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
