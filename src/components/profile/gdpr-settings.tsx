"use client";

import { useState } from "react";
import { Download, Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

export function GdprSettings() {
  const [isExporting, setIsExporting] = useState(false);

  const { data: accountStatus, refetch } = api.profile.getAccountStatus.useQuery();

  const exportData = api.profile.exportData.useMutation({
    onSuccess: (data) => {
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mes-donnees-cupmetrics-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Vos données ont été exportées");
      setIsExporting(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsExporting(false);
    },
  });

  const requestDeletion = api.profile.requestAccountDeletion.useMutation({
    onSuccess: () => {
      toast.success("Demande de suppression enregistrée");
      void refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelDeletion = api.profile.cancelAccountDeletion.useMutation({
    onSuccess: () => {
      toast.success("Demande de suppression annulée");
      void refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleExport = () => {
    setIsExporting(true);
    exportData.mutate();
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      {/* Deletion Warning */}
      {accountStatus?.deletionRequested && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Suppression programmée</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Votre compte sera supprimé le{" "}
              <strong>{formatDate(accountStatus.deletionScheduledFor)}</strong>.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => cancelDeletion.mutate()}
              disabled={cancelDeletion.isPending}
            >
              {cancelDeletion.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Annuler la suppression
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Export Data Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Exporter mes données</h4>
        <p className="text-sm text-muted-foreground">
          Téléchargez une copie de toutes vos données personnelles (profil,
          organisations, cups, inscriptions, notations).
        </p>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting || exportData.isPending}
        >
          {isExporting || exportData.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exporter mes données
        </Button>
      </div>

      {/* Delete Account Section */}
      <div className="space-y-2 pt-4 border-t">
        <h4 className="text-sm font-medium text-destructive">
          Supprimer mon compte
        </h4>
        <p className="text-sm text-muted-foreground">
          La suppression de votre compte effacera définitivement toutes vos
          données. Un délai de grâce de 30 jours vous permet d&apos;annuler cette
          action.
        </p>

        {!accountStatus?.deletionRequested && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Cette action est <strong>irréversible</strong> après le
                    délai de grâce de 30 jours.
                  </p>
                  <p>Seront supprimés :</p>
                  <ul className="list-disc list-inside text-sm">
                    <li>Votre profil et informations personnelles</li>
                    <li>Vos cups et configurations</li>
                    <li>Vos inscriptions et produits</li>
                    <li>Vos notations en tant que jury</li>
                  </ul>
                  <p className="text-sm">
                    Les données de facturation seront conservées pour raisons
                    légales.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => requestDeletion.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {requestDeletion.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Confirmer la suppression
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
