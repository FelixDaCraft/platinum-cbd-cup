"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Send,
  CheckCircle,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Layers,
  Upload,
  Download,
  FileSpreadsheet,
  Bell,
  FileText,
  RotateCcw,
  UserX,
  UserPlus,
  Mail,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
import { api } from "~/trpc/react";

export default function JuriesPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  // Dialog states
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [cancelInvitationId, setCancelInvitationId] = useState<string | null>(null);
  const [removeJuryId, setRemoveJuryId] = useState<string | null>(null);
  const [reactivateJuryId, setReactivateJuryId] = useState<string | null>(null);

  // Category assignment states
  const [assignCategoryJuryId, setAssignCategoryJuryId] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // CSV import states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedCsvData, setParsedCsvData] = useState<Array<{ email: string; firstName?: string; lastName?: string }>>([]);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    duplicates: number;
    errors: string[];
  } | null>(null);

  // Bulk selection states
  const [selectedJuryIds, setSelectedJuryIds] = useState<string[]>([]);
  const [isBulkAssignDialogOpen, setIsBulkAssignDialogOpen] = useState(false);
  const [bulkSelectedCategoryIds, setBulkSelectedCategoryIds] = useState<string[]>([]);

  const utils = api.useUtils();

  // Queries
  const { data: cup, isLoading: cupLoading } = api.cup.getById.useQuery({ id: cupId });
  const { data: invitations, isLoading: invitationsLoading } = api.jury.listInvitations.useQuery({
    cupId,
    status: "all",
  });
  const { data: stats } = api.jury.getInvitationStats.useQuery({ cupId });
  const { data: allJuries, isLoading: juriesLoading } = api.jury.listJuries.useQuery({ cupId, includeInactive: true });

  const juries = useMemo(() => allJuries?.filter((j) => j.isActive) ?? [], [allJuries]);
  const inactiveJuries = useMemo(() => allJuries?.filter((j) => !j.isActive) ?? [], [allJuries]);
  const { data: categories } = api.category.list.useQuery({ cupId });
  const { data: completionStats } = api.jury.getCompletionStats.useQuery({ cupId });

  // Mutations
  const inviteMutation = api.jury.invite.useMutation({
    onSuccess: (data) => {
      if (data.alreadyInvited) {
        toast.info("Invitation renvoyee");
      } else {
        toast.success("Invitation envoyee avec succes");
      }
      setIsInviteDialogOpen(false);
      resetInviteForm();
      void utils.jury.listInvitations.invalidate({ cupId });
      void utils.jury.getInvitationStats.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resendMutation = api.jury.resendInvitation.useMutation({
    onSuccess: () => {
      toast.success("Relance envoyee");
      void utils.jury.listInvitations.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = api.jury.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation annulee");
      setCancelInvitationId(null);
      void utils.jury.listInvitations.invalidate({ cupId });
      void utils.jury.getInvitationStats.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMutation = api.jury.removeJury.useMutation({
    onSuccess: () => {
      toast.success("Jury retire");
      setRemoveJuryId(null);
      void utils.jury.listJuries.invalidate({ cupId });
      void utils.jury.getInvitationStats.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reactivateMutation = api.jury.reactivateJury.useMutation({
    onSuccess: () => {
      toast.success("Jury reactive");
      setReactivateJuryId(null);
      void utils.jury.listJuries.invalidate({ cupId });
      void utils.jury.getInvitationStats.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const assignCategoriesMutation = api.jury.assignCategories.useMutation({
    onSuccess: () => {
      toast.success("Categories assignees");
      setAssignCategoryJuryId(null);
      setSelectedCategoryIds([]);
      void utils.jury.listJuries.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inviteBulkMutation = api.jury.inviteBulk.useMutation({
    onSuccess: (data) => {
      const errors = data.results
        .filter((r) => !r.success && r.error)
        .map((r) => `${r.email}: ${r.error}`);
      setImportResult({
        success: data.success,
        failed: data.failed,
        duplicates: data.alreadyInvited,
        errors,
      });
      void utils.jury.listInvitations.invalidate({ cupId });
      void utils.jury.getInvitationStats.invalidate({ cupId });
      toast.success(`${data.success} invitation${data.success !== 1 ? "s" : ""} envoyee${data.success !== 1 ? "s" : ""}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const bulkAssignMutation = api.jury.bulkAssignCategories.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.assignmentsCreated} assignation${data.assignmentsCreated !== 1 ? "s" : ""} creee${data.assignmentsCreated !== 1 ? "s" : ""}`);
      setIsBulkAssignDialogOpen(false);
      setBulkSelectedCategoryIds([]);
      setSelectedJuryIds([]);
      void utils.jury.listJuries.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendReminderMutation = api.jury.sendRatingReminder.useMutation({
    onSuccess: () => {
      toast.success("Rappel envoye");
      void utils.jury.listJuries.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendBulkRemindersMutation = api.jury.sendBulkRatingReminders.useMutation({
    onSuccess: (data) => {
      if (data.success > 0) {
        toast.success(`${data.success} rappel${data.success !== 1 ? "s" : ""} envoye${data.success !== 1 ? "s" : ""}`);
      }
      if (data.skipped > 0) {
        toast.info(`${data.skipped} jury${data.skipped !== 1 ? "s" : ""} a${data.skipped !== 1 ? " ont" : ""} desactive les rappels`);
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} echec${data.failed !== 1 ? "s" : ""}`);
      }
      setSelectedJuryIds([]);
      void utils.jury.listJuries.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendRatingSheetMutation = api.jury.sendRatingSheet.useMutation({
    onSuccess: () => {
      toast.success("Fiche de notation envoyee");
      void utils.jury.listJuries.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendAllRatingSheetsMutation = api.jury.sendAllRatingSheets.useMutation({
    onSuccess: (data) => {
      if (data.success > 0) {
        toast.success(`${data.success} fiche${data.success !== 1 ? "s" : ""} envoyee${data.success !== 1 ? "s" : ""}`);
      }
      const skipped = data.totalJuries - data.juriesWithProducts;
      if (skipped > 0) {
        toast.info(`${skipped} jury${skipped !== 1 ? "s" : ""} sans categories assignees`);
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} echec${data.failed !== 1 ? "s" : ""}`);
      }
      void utils.jury.listJuries.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Load current assignments when opening the assign dialog
  useEffect(() => {
    if (assignCategoryJuryId && juries) {
      const jury = juries.find((j) => j.id === assignCategoryJuryId);
      if (jury) {
        setSelectedCategoryIds(jury.categoryAssignments.map((a) => a.category.id));
      }
    }
  }, [assignCategoryJuryId, juries]);

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteMessage("");
  };

  const handleInvite = () => {
    inviteMutation.mutate({
      cupId,
      email: inviteEmail,
      firstName: inviteFirstName || undefined,
      lastName: inviteLastName || undefined,
      customMessage: inviteMessage || undefined,
    });
  };

  const handleAssignCategories = () => {
    if (assignCategoryJuryId) {
      assignCategoriesMutation.mutate({
        cupJuryId: assignCategoryJuryId,
        categoryIds: selectedCategoryIds,
      });
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const downloadCsvTemplate = () => {
    const csvContent = "email,prenom,nom\njury1@example.com,Jean,Dupont\njury2@example.com,Marie,Martin";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template-jurys.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCsvFile = async (file: File) => {
    setCsvParseError(null);
    setParsedCsvData([]);
    setImportResult(null);

    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);

    if (lines.length < 2) {
      setCsvParseError("Le fichier CSV doit contenir au moins une ligne d'en-tete et une ligne de donnees");
      return;
    }

    const header = lines[0]!.toLowerCase().split(/[,;]/);
    const emailIndex = header.findIndex((h) => h.trim() === "email");
    const prenomIndex = header.findIndex((h) => h.trim() === "prenom" || h.trim() === "prénom" || h.trim() === "firstname");
    const nomIndex = header.findIndex((h) => h.trim() === "nom" || h.trim() === "lastname");

    if (emailIndex === -1) {
      setCsvParseError("La colonne 'email' est requise dans le fichier CSV");
      return;
    }

    const data: Array<{ email: string; firstName?: string; lastName?: string }> = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;

      const cols = line.split(/[,;]/);
      const email = cols[emailIndex]?.trim();

      if (!email) {
        errors.push(`Ligne ${i + 1}: email manquant`);
        continue;
      }

      if (!email.includes("@") || !email.includes(".")) {
        errors.push(`Ligne ${i + 1}: email invalide (${email})`);
        continue;
      }

      data.push({
        email,
        firstName: prenomIndex !== -1 ? cols[prenomIndex]?.trim() || undefined : undefined,
        lastName: nomIndex !== -1 ? cols[nomIndex]?.trim() || undefined : undefined,
      });
    }

    if (errors.length > 0) {
      setCsvParseError(`Erreurs de parsing:\n${errors.join("\n")}`);
    }

    setParsedCsvData(data);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      void parseCsvFile(file);
    }
  };

  const handleImportCsv = () => {
    if (parsedCsvData.length === 0) return;
    inviteBulkMutation.mutate({ cupId, juries: parsedCsvData });
  };

  const resetImportDialog = () => {
    setIsImportDialogOpen(false);
    setCsvFile(null);
    setParsedCsvData([]);
    setCsvParseError(null);
    setImportResult(null);
  };

  const toggleJurySelection = (juryId: string) => {
    setSelectedJuryIds((prev) =>
      prev.includes(juryId)
        ? prev.filter((id) => id !== juryId)
        : [...prev, juryId]
    );
  };

  const toggleAllJuries = () => {
    if (juries.length === 0) return;
    if (selectedJuryIds.length === juries.length) {
      setSelectedJuryIds([]);
    } else {
      setSelectedJuryIds(juries.map((j) => j.id));
    }
  };

  const toggleBulkCategory = (categoryId: string) => {
    setBulkSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleBulkAssign = () => {
    if (selectedJuryIds.length === 0 || bulkSelectedCategoryIds.length === 0) return;
    bulkAssignMutation.mutate({
      cupId,
      cupJuryIds: selectedJuryIds,
      categoryIds: bulkSelectedCategoryIds,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-warning)", color: "var(--n-warning)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            EN ATTENTE
          </span>
        );
      case "accepted":
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-success)", color: "var(--n-success)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            ACCEPTEE
          </span>
        );
      case "declined":
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-accent)", color: "var(--n-accent)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            REFUSEE
          </span>
        );
      case "expired":
        return (
          <span className="n-label" style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--n-text-disabled)", color: "var(--n-text-disabled)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            EXPIREE
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="n-font-body text-2xl font-bold text-[var(--n-text-display)]">
            Gestion des jurys
          </h1>
          <p className="n-label text-[var(--n-text-secondary)] mt-1">
            Invitez et gerez les jurys de la competition
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendAllRatingSheetsMutation.mutate({ cupId })}
            disabled={sendAllRatingSheetsMutation.isPending || juries.length === 0}
            className="n-label"
          >
            {sendAllRatingSheetsMutation.isPending ? "[...]" : null}
            <FileText className="mr-2 h-4 w-4" />
            Envoyer les fiches
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportDialogOpen(true)}
            className="n-label"
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer CSV
          </Button>
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="n-label">
                <UserPlus className="mr-2 h-4 w-4" />
                Inviter un jury
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
                  Inviter un jury
                </DialogTitle>
                <DialogDescription className="n-label text-[var(--n-text-secondary)]">
                  Envoyez une invitation par email a un nouveau jury
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="n-label text-[var(--n-text-secondary)]">EMAIL *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jury@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="n-label text-[var(--n-text-secondary)]">PRENOM</Label>
                    <Input
                      id="firstName"
                      placeholder="Jean"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="n-label text-[var(--n-text-secondary)]">NOM</Label>
                    <Input
                      id="lastName"
                      placeholder="Dupont"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className="n-label text-[var(--n-text-secondary)]">MESSAGE PERSONNALISE (OPTIONNEL)</Label>
                  <Textarea
                    id="message"
                    placeholder="Nous serions honores de vous avoir comme jury..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsInviteDialogOpen(false);
                    resetInviteForm();
                  }}
                  className="n-label"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail || inviteMutation.isPending}
                  className="n-label"
                >
                  {inviteMutation.isPending ? "[...]" : <Send className="mr-2 h-4 w-4" />}
                  Envoyer l&apos;invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-text-secondary)] mb-1">INVITATIONS</p>
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
          <p className="n-label text-[var(--n-success)] mb-1">ACCEPTEES</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-success)]">
            {stats?.accepted ?? 0}
          </p>
        </div>
        <div className="n-card p-4">
          <p className="n-label text-[var(--n-text-secondary)] mb-1">JURYS ACTIFS</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-text-display)]">
            {juries.length}
          </p>
        </div>
        <div className="n-card p-4 col-span-2 lg:col-span-1">
          <p className="n-label text-[var(--n-text-secondary)] mb-1">COMPLETION</p>
          <p className="n-font-data text-3xl font-bold text-[var(--n-text-display)]">
            {completionStats?.globalStats.completionRate ?? 0}%
          </p>
          <Progress
            value={completionStats?.globalStats.completionRate ?? 0}
            className="mt-2 h-1"
          />
          <p className="n-label text-[var(--n-text-disabled)] mt-1">
            {completionStats?.globalStats.totalProductsRated ?? 0}/{completionStats?.globalStats.totalProductsToRate ?? 0} notes
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="juries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="juries" className="n-label">Jurys actifs</TabsTrigger>
          <TabsTrigger value="inactive" className="n-label">
            Desactives
            {inactiveJuries.length > 0 && (
              <span className="n-tag ml-2">{inactiveJuries.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="invitations" className="n-label">Invitations</TabsTrigger>
        </TabsList>

        {/* Active Juries Tab */}
        <TabsContent value="juries">
          <div className="n-card overflow-hidden">
            <div className="p-4 border-b border-[var(--n-border-visible)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="n-font-body font-semibold text-[var(--n-text-primary)]">Jurys actifs</h2>
                  <p className="n-label text-[var(--n-text-secondary)]">
                    Les jurys ayant accepte leur invitation
                  </p>
                </div>
                {selectedJuryIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="n-label text-[var(--n-text-secondary)]">
                      {selectedJuryIds.length} selectionne{selectedJuryIds.length !== 1 ? "s" : ""}
                    </span>
                    <Button size="sm" onClick={() => setIsBulkAssignDialogOpen(true)} className="n-label">
                      <Layers className="mr-2 h-4 w-4" />
                      Assigner des categories
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendBulkRemindersMutation.mutate({ cupId, juryIds: selectedJuryIds })}
                      disabled={sendBulkRemindersMutation.isPending}
                      className="n-label"
                    >
                      {sendBulkRemindersMutation.isPending ? "[...]" : <Bell className="mr-2 h-4 w-4" />}
                      Relancer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedJuryIds([])} className="n-label">
                      Annuler
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              {juriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="n-font-body text-[var(--n-text-secondary)]">[LOADING...]</p>
                </div>
              ) : juries.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-8 w-8 mx-auto mb-3 text-[var(--n-text-disabled)]" />
                  <p className="n-font-body font-medium text-[var(--n-text-secondary)]">Aucun jury actif</p>
                  <p className="n-label text-[var(--n-text-disabled)]">
                    Les jurys apparaitront ici une fois qu&apos;ils auront accepte leur invitation
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[var(--n-border-visible)]">
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedJuryIds.length === juries.length && juries.length > 0}
                          onCheckedChange={toggleAllJuries}
                        />
                      </TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">JURY</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">EMAIL</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">CATEGORIES</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">COMPLETION</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">FICHE ENVOYEE</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">DERNIERE RELANCE</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">REJOINT LE</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {juries.map((jury) => (
                      <TableRow
                        key={jury.id}
                        className="border-b border-[var(--n-border)] hover:bg-[var(--n-surface-raised)]"
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedJuryIds.includes(jury.id)}
                            onCheckedChange={() => toggleJurySelection(jury.id)}
                          />
                        </TableCell>
                        <TableCell className="n-font-body font-medium text-[var(--n-text-primary)]">
                          {jury.user.name ?? "Sans nom"}
                        </TableCell>
                        <TableCell className="n-font-body text-[var(--n-text-secondary)]">
                          {jury.user.email}
                        </TableCell>
                        <TableCell>
                          {jury.categoryAssignments.length === 0 ? (
                            <span className="n-label text-[var(--n-text-disabled)]">Non assigne</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {jury.categoryAssignments.map((assignment) => (
                                <span key={assignment.id} className="n-tag">
                                  {assignment.category.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const juryStat = completionStats?.juryStats.find(
                              (s) => s.juryId === jury.id
                            );
                            if (!juryStat || juryStat.totalProductsToRate === 0) {
                              return <span className="n-label text-[var(--n-text-disabled)]">-</span>;
                            }
                            return (
                              <div className="w-24">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="n-font-data text-xs text-[var(--n-text-primary)]">
                                    {juryStat.completionRate}%
                                  </span>
                                  <span className="n-label text-[var(--n-text-disabled)]">
                                    {juryStat.productsRated}/{juryStat.totalProductsToRate}
                                  </span>
                                </div>
                                <Progress value={juryStat.completionRate} className="h-1" />
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {jury.ratingSheetSentAt ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-[var(--n-success)]" />
                              <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                                {new Date(jury.ratingSheetSentAt).toLocaleDateString("fr-FR")}
                              </span>
                            </div>
                          ) : (
                            <span className="n-label text-[var(--n-text-disabled)]">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {jury.lastReminderAt ? (
                            <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                              {new Date(jury.lastReminderAt).toLocaleDateString("fr-FR")}
                            </span>
                          ) : (
                            <span className="n-label text-[var(--n-text-disabled)]">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                            {new Date(jury.joinedAt).toLocaleDateString("fr-FR")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setAssignCategoryJuryId(jury.id)}>
                                <Layers className="mr-2 h-4 w-4" />
                                Assigner des categories
                              </DropdownMenuItem>
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
                              <DropdownMenuItem
                                style={{ color: "var(--n-accent)" }}
                                onClick={() => setRemoveJuryId(jury.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Retirer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Inactive Juries Tab */}
        <TabsContent value="inactive">
          <div className="n-card overflow-hidden">
            <div className="p-4 border-b border-[var(--n-border-visible)]">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-[var(--n-text-secondary)]" />
                <div>
                  <h2 className="n-font-body font-semibold text-[var(--n-text-primary)]">Jurys desactives</h2>
                  <p className="n-label text-[var(--n-text-secondary)]">
                    Jurys retires de la competition (peuvent etre reactives)
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4">
              {juriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="n-font-body text-[var(--n-text-secondary)]">[LOADING...]</p>
                </div>
              ) : inactiveJuries.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-8 w-8 mx-auto mb-3 text-[var(--n-text-disabled)]" />
                  <p className="n-font-body font-medium text-[var(--n-text-secondary)]">Aucun jury desactive</p>
                  <p className="n-label text-[var(--n-text-disabled)]">Tous les jurys sont actifs</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[var(--n-border-visible)]">
                      <TableHead className="n-label text-[var(--n-text-secondary)]">JURY</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">EMAIL</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">REJOINT LE</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)] w-[100px]">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveJuries.map((jury) => (
                      <TableRow
                        key={jury.id}
                        className="border-b border-[var(--n-border)] opacity-60 hover:bg-[var(--n-surface-raised)]"
                      >
                        <TableCell className="n-font-body font-medium text-[var(--n-text-primary)]">
                          {jury.user.name ?? "Sans nom"}
                        </TableCell>
                        <TableCell className="n-font-body text-[var(--n-text-secondary)]">
                          {jury.user.email}
                        </TableCell>
                        <TableCell>
                          <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                            {new Date(jury.joinedAt).toLocaleDateString("fr-FR")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReactivateJuryId(jury.id)}
                            className="n-label"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reactiver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <div className="n-card overflow-hidden">
            <div className="p-4 border-b border-[var(--n-border-visible)]">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[var(--n-text-secondary)]" />
                <div>
                  <h2 className="n-font-body font-semibold text-[var(--n-text-primary)]">Invitations</h2>
                  <p className="n-label text-[var(--n-text-secondary)]">
                    Toutes les invitations envoyees aux jurys
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4">
              {invitationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="n-font-body text-[var(--n-text-secondary)]">[LOADING...]</p>
                </div>
              ) : !invitations || invitations.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-8 w-8 mx-auto mb-3 text-[var(--n-text-disabled)]" />
                  <p className="n-font-body font-medium text-[var(--n-text-secondary)]">Aucune invitation envoyee</p>
                  <p className="n-label text-[var(--n-text-disabled)]">
                    Cliquez sur &quot;Inviter un jury&quot; pour commencer
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[var(--n-border-visible)]">
                      <TableHead className="n-label text-[var(--n-text-secondary)]">EMAIL</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">NOM</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">STATUT</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">ENVOYE LE</TableHead>
                      <TableHead className="n-label text-[var(--n-text-secondary)]">EXPIRE LE</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow
                        key={invitation.id}
                        className="border-b border-[var(--n-border)] hover:bg-[var(--n-surface-raised)]"
                      >
                        <TableCell className="n-font-body text-[var(--n-text-primary)]">
                          {invitation.email}
                        </TableCell>
                        <TableCell className="n-font-body text-[var(--n-text-secondary)]">
                          {invitation.firstName || invitation.lastName
                            ? `${invitation.firstName ?? ""} ${invitation.lastName ?? ""}`.trim()
                            : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                        <TableCell>
                          <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                            {invitation.sentAt
                              ? new Date(invitation.sentAt).toLocaleDateString("fr-FR")
                              : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="n-font-data text-xs text-[var(--n-text-secondary)]">
                            {new Date(invitation.expiresAt).toLocaleDateString("fr-FR")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {invitation.status === "pending" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => resendMutation.mutate({ invitationId: invitation.id })}
                                  disabled={resendMutation.isPending}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Relancer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  style={{ color: "var(--n-accent)" }}
                                  onClick={() => setCancelInvitationId(invitation.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Annuler
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
        </TabsContent>
      </Tabs>

      {/* Cancel Invitation Dialog */}
      <AlertDialog open={!!cancelInvitationId} onOpenChange={() => setCancelInvitationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Annuler l&apos;invitation ?
            </AlertDialogTitle>
            <AlertDialogDescription className="n-label text-[var(--n-text-secondary)]">
              Cette action est irreversible. L&apos;invitation sera supprimee et le jury ne pourra plus l&apos;accepter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelInvitationId && cancelMutation.mutate({ invitationId: cancelInvitationId })}
              className="n-label" style={{ background: "var(--n-accent)", color: "var(--n-black)" }}
            >
              {cancelMutation.isPending && "[...]"}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Jury Dialog */}
      <AlertDialog open={!!removeJuryId} onOpenChange={() => setRemoveJuryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Retirer ce jury ?
            </AlertDialogTitle>
            <AlertDialogDescription className="n-label text-[var(--n-text-secondary)]">
              Ce jury ne pourra plus noter les produits de cette cup. Vous pourrez le reactiver depuis l&apos;onglet &quot;Desactives&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeJuryId && removeMutation.mutate({ cupJuryId: removeJuryId })}
              className="n-label" style={{ background: "var(--n-accent)", color: "var(--n-black)" }}
            >
              {removeMutation.isPending && "[...]"}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Jury Dialog */}
      <AlertDialog open={!!reactivateJuryId} onOpenChange={() => setReactivateJuryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Reactiver ce jury ?
            </AlertDialogTitle>
            <AlertDialogDescription className="n-label text-[var(--n-text-secondary)]">
              Ce jury pourra a nouveau noter les produits de cette cup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-label">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reactivateJuryId && reactivateMutation.mutate({ cupJuryId: reactivateJuryId })}
              className="n-label"
            >
              {reactivateMutation.isPending && "[...]"}
              Reactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Categories Dialog */}
      <Dialog
        open={!!assignCategoryJuryId}
        onOpenChange={(open) => {
          if (!open) {
            setAssignCategoryJuryId(null);
            setSelectedCategoryIds([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Assigner des categories
            </DialogTitle>
            <DialogDescription className="n-label text-[var(--n-text-secondary)]">
              Selectionnez les categories que ce jury pourra noter
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {!categories || categories.length === 0 ? (
              <div className="text-center py-12">
                <p className="n-font-body font-medium text-[var(--n-text-secondary)]">Aucune categorie configuree</p>
                <p className="n-label text-[var(--n-text-disabled)]">Creez des categories dans la configuration de la cup</p>
              </div>
            ) : (
              <div className="space-y-2">
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
                      {category.description && (
                        <p className="n-label text-[var(--n-text-secondary)]">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <p className="n-label text-[var(--n-text-secondary)]">
                {selectedCategoryIds.length} categorie{selectedCategoryIds.length !== 1 ? "s" : ""} selectionnee{selectedCategoryIds.length !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAssignCategoryJuryId(null);
                    setSelectedCategoryIds([]);
                  }}
                  className="n-label"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleAssignCategories}
                  disabled={assignCategoriesMutation.isPending}
                  className="n-label"
                >
                  {assignCategoriesMutation.isPending && "[...]"}
                  Enregistrer
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => !open && resetImportDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Importer des jurys depuis un CSV
            </DialogTitle>
            <DialogDescription className="n-label text-[var(--n-text-secondary)]">
              Uploadez un fichier CSV pour inviter plusieurs jurys en une seule fois
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Template download */}
            <div className="flex items-center justify-between rounded border border-[var(--n-border)] bg-[var(--n-surface)] p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-[var(--n-text-secondary)]" />
                <div>
                  <p className="n-font-body font-medium text-[var(--n-text-primary)]">Format attendu</p>
                  <p className="n-label text-[var(--n-text-secondary)]">
                    Colonnes: email (requis), prenom, nom
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="n-label">
                <Download className="mr-2 h-4 w-4" />
                Template
              </Button>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label htmlFor="csv-file" className="n-label text-[var(--n-text-secondary)]">FICHIER CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="cursor-pointer"
              />
            </div>

            {/* Parse error */}
            {csvParseError && (
              <div style={{ borderRadius: "6px", border: "1px solid var(--n-accent)", background: "color-mix(in srgb, var(--n-accent) 10%, transparent)", padding: "16px" }}>
                <p className="n-label whitespace-pre-wrap" style={{ color: "var(--n-accent)" }}>{csvParseError}</p>
              </div>
            )}

            {/* Parsed data preview */}
            {parsedCsvData.length > 0 && !importResult && (
              <div className="space-y-2">
                <p className="n-font-body font-medium text-[var(--n-text-primary)]">
                  {parsedCsvData.length} jury{parsedCsvData.length !== 1 ? "s" : ""} detecte{parsedCsvData.length !== 1 ? "s" : ""}
                </p>
                <div className="max-h-48 overflow-auto rounded border border-[var(--n-border)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[var(--n-border-visible)]">
                        <TableHead className="n-label text-[var(--n-text-secondary)]">EMAIL</TableHead>
                        <TableHead className="n-label text-[var(--n-text-secondary)]">PRENOM</TableHead>
                        <TableHead className="n-label text-[var(--n-text-secondary)]">NOM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedCsvData.slice(0, 10).map((row, idx) => (
                        <TableRow key={idx} className="border-b border-[var(--n-border)]">
                          <TableCell className="n-font-body text-[var(--n-text-primary)]">{row.email}</TableCell>
                          <TableCell className="n-font-body text-[var(--n-text-secondary)]">{row.firstName ?? "-"}</TableCell>
                          <TableCell className="n-font-body text-[var(--n-text-secondary)]">{row.lastName ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                      {parsedCsvData.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center n-label text-[var(--n-text-disabled)]">
                            ... et {parsedCsvData.length - 10} autres
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded border border-[var(--n-success)]/30 bg-[var(--n-success)]/10 p-3 text-center">
                    <p className="n-font-data text-2xl font-bold text-[var(--n-success)]">{importResult.success}</p>
                    <p className="n-label text-[var(--n-text-secondary)]">Succes</p>
                  </div>
                  <div className="rounded border border-[var(--n-warning)]/30 bg-[var(--n-warning)]/10 p-3 text-center">
                    <p className="n-font-data text-2xl font-bold text-[var(--n-warning)]">{importResult.duplicates}</p>
                    <p className="n-label text-[var(--n-text-secondary)]">Doublons</p>
                  </div>
                  <div style={{ borderRadius: "6px", border: "1px solid color-mix(in srgb, var(--n-accent) 30%, transparent)", background: "color-mix(in srgb, var(--n-accent) 10%, transparent)", padding: "12px", textAlign: "center" }}>
                    <p className="n-font-data text-2xl font-bold" style={{ color: "var(--n-accent)" }}>{importResult.failed}</p>
                    <p className="n-label text-[var(--n-text-secondary)]">Echecs</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div style={{ borderRadius: "6px", border: "1px solid color-mix(in srgb, var(--n-accent) 50%, transparent)", background: "color-mix(in srgb, var(--n-accent) 10%, transparent)", padding: "16px" }}>
                    <p className="n-label font-medium mb-2" style={{ color: "var(--n-accent)" }}>ERREURS:</p>
                    <ul className="n-label list-disc list-inside" style={{ color: "var(--n-accent)" }}>
                      {importResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>... et {importResult.errors.length - 5} autres erreurs</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetImportDialog} className="n-label">
              {importResult ? "Fermer" : "Annuler"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImportCsv}
                disabled={parsedCsvData.length === 0 || inviteBulkMutation.isPending}
                className="n-label"
              >
                {inviteBulkMutation.isPending && "[...]"}
                <Send className="mr-2 h-4 w-4" />
                Importer {parsedCsvData.length > 0 && `(${parsedCsvData.length})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Categories Dialog */}
      <Dialog
        open={isBulkAssignDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsBulkAssignDialogOpen(false);
            setBulkSelectedCategoryIds([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="n-font-body font-bold text-[var(--n-text-display)]">
              Assignation en masse
            </DialogTitle>
            <DialogDescription className="n-label text-[var(--n-text-secondary)]">
              Assigner des categories a {selectedJuryIds.length} jury{selectedJuryIds.length !== 1 ? "s" : ""} selectionne{selectedJuryIds.length !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {!categories || categories.length === 0 ? (
              <div className="text-center py-12">
                <p className="n-font-body font-medium text-[var(--n-text-secondary)]">Aucune categorie configuree</p>
                <p className="n-label text-[var(--n-text-disabled)]">Creez des categories dans la configuration de la cup</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="n-label text-[var(--n-text-secondary)] mb-3">
                  Selectionnez les categories a ajouter aux jurys selectionnes:
                </p>
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center space-x-3 rounded border border-[var(--n-border)] bg-[var(--n-surface)] p-3 hover:bg-[var(--n-surface-raised)] cursor-pointer transition-colors"
                    onClick={() => toggleBulkCategory(category.id)}
                  >
                    <Checkbox
                      id={`bulk-category-${category.id}`}
                      checked={bulkSelectedCategoryIds.includes(category.id)}
                      onCheckedChange={() => toggleBulkCategory(category.id)}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`bulk-category-${category.id}`}
                        className="n-font-body font-medium cursor-pointer text-[var(--n-text-primary)]"
                      >
                        {category.name}
                      </Label>
                      {category.description && (
                        <p className="n-label text-[var(--n-text-secondary)]">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <p className="n-label text-[var(--n-text-secondary)]">
                {bulkSelectedCategoryIds.length} categorie{bulkSelectedCategoryIds.length !== 1 ? "s" : ""} selectionnee{bulkSelectedCategoryIds.length !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsBulkAssignDialogOpen(false);
                    setBulkSelectedCategoryIds([]);
                  }}
                  className="n-label"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleBulkAssign}
                  disabled={bulkSelectedCategoryIds.length === 0 || bulkAssignMutation.isPending}
                  className="n-label"
                >
                  {bulkAssignMutation.isPending && "[...]"}
                  Assigner
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
