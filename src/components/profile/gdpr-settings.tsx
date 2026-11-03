"use client";

import { useState } from "react";
import { Download, Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useServerError } from "~/i18n/server-error";
import { formatDate as formatLocaleDate, type Locale } from "~/i18n/locales";

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
  const t = useTranslations("gdpr");
  const locale = useLocale() as Locale;
  const serverError = useServerError();
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
      a.download = `${t("fileName")}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("exported"));
      setIsExporting(false);
    },
    onError: (error) => {
      toast.error(serverError(error));
      setIsExporting(false);
    },
  });

  const requestDeletion = api.profile.requestAccountDeletion.useMutation({
    onSuccess: () => {
      toast.success(t("deletionRequested"));
      void refetch();
    },
    onError: (error) => {
      toast.error(serverError(error));
    },
  });

  const cancelDeletion = api.profile.cancelAccountDeletion.useMutation({
    onSuccess: () => {
      toast.success(t("deletionCancelled"));
      void refetch();
    },
    onError: (error) => {
      toast.error(serverError(error));
    },
  });

  const handleExport = () => {
    setIsExporting(true);
    exportData.mutate();
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return formatLocaleDate(new Date(date), locale);
  };

  return (
    <div className="space-y-6">
      {/* Deletion Warning */}
      {accountStatus?.deletionRequested && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("scheduled")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              {t.rich("willBeDeleted", {
                date: formatDate(accountStatus.deletionScheduledFor),
                b: (chunks) => <strong>{chunks}</strong>,
              })}
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
              {t("cancelDeletion")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Export Data Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">{t("exportTitle")}</h4>
        <p className="text-sm text-muted-foreground">
          {t("exportText")}
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
          {t("exportTitle")}
        </Button>
      </div>

      {/* Delete Account Section */}
      <div className="space-y-2 pt-4 border-t">
        <h4 className="text-sm font-medium text-destructive">
          {t("deleteTitle")}
        </h4>
        <p className="text-sm text-muted-foreground">
          {t("deleteText")}
        </p>

        {!accountStatus?.deletionRequested && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                {t("deleteTitle")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>{t.rich("irreversible", { b: (chunks) => <strong>{chunks}</strong> })}</p>
                  <p>{t("willDelete")}</p>
                  <ul className="list-disc list-inside text-sm">
                    <li>{t("item1")}</li>
                    <li>{t("item2")}</li>
                    <li>{t("item3")}</li>
                    <li>{t("item4")}</li>
                  </ul>
                  <p className="text-sm">{t("billingKept")}</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => requestDeletion.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {requestDeletion.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  {t("confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
