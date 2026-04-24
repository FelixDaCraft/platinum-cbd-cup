"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Search,
  Plus,
  Download,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { api } from "~/trpc/react";

type SubscriberStatus = "all" | "active" | "pending" | "unsubscribed";

function StatusTag({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <span className="n-tag" style={{ color: "var(--n-success)", borderColor: "var(--n-success)" }}>ACTIF</span>;
    case "pending":
      return <span className="n-tag" style={{ color: "var(--n-warning)", borderColor: "var(--n-warning)" }}>EN ATTENTE</span>;
    case "unsubscribed":
      return <span className="n-tag" style={{ color: "var(--n-text-secondary)" }}>DESINSCRIT</span>;
    default:
      return null;
  }
}

export default function NewsletterPage() {
  const [status, setStatus] = useState<SubscriberStatus>("all");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subscriberToDelete, setSubscriberToDelete] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [skipConfirmation, setSkipConfirmation] = useState(false);

  const utils = api.useUtils();

  const { data: stats, isLoading: statsLoading } = api.newsletter.getStats.useQuery();
  const { data: subscriberData, isLoading: listLoading } = api.newsletter.list.useQuery({
    status,
    search: searchQuery,
    page,
    limit: 20,
  });

  const addMutation = api.newsletter.add.useMutation({
    onSuccess: () => {
      toast.success("Abonne ajoute");
      setAddDialogOpen(false);
      setNewEmail("");
      setNewName("");
      setSkipConfirmation(false);
      void utils.newsletter.list.invalidate();
      void utils.newsletter.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = api.newsletter.delete.useMutation({
    onSuccess: () => {
      toast.success("Abonne supprime");
      setDeleteDialogOpen(false);
      setSubscriberToDelete(null);
      void utils.newsletter.list.invalidate();
      void utils.newsletter.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { refetch: exportCsv } = api.newsletter.export.useQuery(
    { status: status === "all" ? "active" : status },
    { enabled: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(search);
    setPage(1);
  };

  const handleExport = async () => {
    const result = await exportCsv();
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `newsletter-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${result.data.count} abonnes exportes`);
    }
  };

  const handleAddSubscriber = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate({
      email: newEmail,
      name: newName || undefined,
      skipConfirmation,
    });
  };

  const handleDeleteSubscriber = () => {
    if (subscriberToDelete) {
      deleteMutation.mutate({ id: subscriberToDelete });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Newsletter</h1>
        <p className="n-label" style={{ marginTop: "4px", color: "var(--n-text-secondary)" }}>
          GEREZ LES ABONNES A VOTRE NEWSLETTER
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="n-card p-4">
          <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>TOTAL ABONNES</p>
          <p className="n-font-data text-2xl font-bold mt-1" style={{ color: "var(--n-text-primary)" }}>
            {statsLoading ? "[...]" : (stats?.total ?? 0)}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>ACTIFS</p>
          <p className="n-font-data text-2xl font-bold mt-1" style={{ color: "var(--n-success)" }}>
            {statsLoading ? "[...]" : (stats?.active ?? 0)}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>EN ATTENTE</p>
          <p className="n-font-data text-2xl font-bold mt-1" style={{ color: "var(--n-warning)" }}>
            {statsLoading ? "[...]" : (stats?.pending ?? 0)}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>DESINSCRITS</p>
          <p className="n-font-data text-2xl font-bold mt-1" style={{ color: "var(--n-text-secondary)" }}>
            {statsLoading ? "[...]" : (stats?.unsubscribed ?? 0)}
          </p>
        </div>
      </div>

      {/* Subscribers list */}
      <div className="n-card overflow-hidden">
        <div className="p-5" style={{ borderBottom: "1px solid var(--n-border)" }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700, marginBottom: "2px" }}>Abonnes</p>
              <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>
                LISTE DE TOUS LES ABONNES A VOTRE NEWSLETTER
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport} className="n-btn-secondary">
                <Download className="mr-2 h-4 w-4" />
                Exporter CSV
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="n-btn-primary">
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleAddSubscriber}>
                    <DialogHeader>
                      <DialogTitle className="n-font-body">Ajouter un abonne</DialogTitle>
                      <DialogDescription className="n-font-body">
                        Ajoutez manuellement un abonne a votre newsletter.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="n-label">EMAIL *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="email@exemple.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name" className="n-label">NOM (OPTIONNEL)</Label>
                        <Input
                          id="name"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Jean Dupont"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="skipConfirmation"
                          checked={skipConfirmation}
                          onCheckedChange={(checked) =>
                            setSkipConfirmation(checked === true)
                          }
                        />
                        <Label htmlFor="skipConfirmation" className="n-font-body text-sm">
                          Activer directement (sans confirmation email)
                        </Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAddDialogOpen(false)}
                        className="n-btn-secondary"
                      >
                        Annuler
                      </Button>
                      <Button type="submit" disabled={addMutation.isPending} className="n-btn-primary">
                        {addMutation.isPending ? (
                          <span className="n-font-data text-xs">[AJOUT...]</span>
                        ) : (
                          "Ajouter"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* Search and filter */}
          <div className="flex flex-wrap gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px] max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                <Input
                  type="search"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                Rechercher
              </Button>
            </form>

            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as SubscriberStatus);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="unsubscribed">Desinscrits</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {listLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="n-font-data" style={{ color: "var(--n-text-secondary)", fontFamily: "'Space Mono', monospace" }}>[LOADING...]</p>
            </div>
          ) : subscriberData && subscriberData.subscribers.length > 0 ? (
            <>
              <div className="overflow-hidden" style={{ border: "1px solid var(--n-border)" }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderBottom: "1px solid var(--n-border)" }}>
                      <TableHead className="n-label" style={{ fontSize: "10px" }}>EMAIL</TableHead>
                      <TableHead className="n-label" style={{ fontSize: "10px" }}>NOM</TableHead>
                      <TableHead className="n-label" style={{ fontSize: "10px" }}>STATUT</TableHead>
                      <TableHead className="n-label" style={{ fontSize: "10px" }}>SOURCE</TableHead>
                      <TableHead className="n-label" style={{ fontSize: "10px" }}>INSCRIT</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriberData.subscribers.map((subscriber) => (
                      <TableRow key={subscriber.id} style={{ borderBottom: "1px solid var(--n-border)" }}>
                        <TableCell className="n-font-data text-sm font-medium">
                          {subscriber.email}
                        </TableCell>
                        <TableCell className="n-font-body text-sm">{subscriber.name ?? "-"}</TableCell>
                        <TableCell><StatusTag status={subscriber.status} /></TableCell>
                        <TableCell>
                          <span className="n-tag">
                            {subscriber.source === "portal"
                              ? "PORTAIL"
                              : subscriber.source === "manual"
                                ? "MANUEL"
                                : (subscriber.source ?? "").toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--n-text-secondary)" }}>
                          {formatDistanceToNow(new Date(subscriber.createdAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setSubscriberToDelete(subscriber.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {subscriberData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!subscriberData.pagination.hasPrevPage}
                    onClick={() => setPage((p) => p - 1)}
                    className="n-btn-secondary"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--n-text-secondary)" }}>
                    PAGE {subscriberData.pagination.currentPage} / {subscriberData.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!subscriberData.pagination.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                    className="n-btn-secondary"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}>[AUCUN ABONNE]</p>
              <p style={{ fontSize: "14px", color: "var(--n-text-secondary)", marginTop: "4px" }}>
                {searchQuery
                  ? "Aucun abonne ne correspond a votre recherche."
                  : "Vous n'avez pas encore d'abonnes a votre newsletter."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="n-font-body">Supprimer cet abonne ?</AlertDialogTitle>
            <AlertDialogDescription className="n-font-body">
              Cette action est irreversible. L&apos;abonne sera definitivement
              supprime de votre liste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-btn-secondary">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubscriber}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <span className="n-font-data text-xs">[SUPPRESSION...]</span>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
