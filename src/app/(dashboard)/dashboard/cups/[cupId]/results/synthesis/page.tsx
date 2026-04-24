"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Send,
  Check,
  X,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
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
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { api } from "~/trpc/react";

export default function SynthesisPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const utils = api.useUtils();

  const [pdfLogoUrl, setPdfLogoUrl] = useState("");
  const [pdfIntroText, setPdfIntroText] = useState("");
  const [customEmailMessage, setCustomEmailMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "not_sent" | "error">("all");
  const [expandedProducers, setExpandedProducers] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    current: string | null;
    isRunning: boolean;
  } | null>(null);

  const { data: pdfSettings, isLoading: loadingSettings } = api.results.getPdfSettings.useQuery(
    { cupId },
    { enabled: !!cupId }
  );

  useEffect(() => {
    if (pdfSettings) {
      setPdfLogoUrl(pdfSettings.pdfLogoUrl ?? "");
      setPdfIntroText(pdfSettings.pdfIntroText ?? "");
    }
  }, [pdfSettings]);

  const { data: emailStatusData, isLoading: loadingEmailStatus, refetch: refetchEmailStatus } =
    api.results.getEmailSendStatus.useQuery(
      { cupId, status: statusFilter },
      { enabled: !!cupId }
    );

  const updatePdfSettings = api.results.updatePdfSettings.useMutation({
    onSuccess: () => {
      toast.success("Paramètres PDF mis à jour");
      void utils.results.getPdfSettings.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generateProducerPdf = api.results.generateProducerPdf.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${data.pdfBase64}`;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF généré avec succès");
      setGeneratingPdf(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setGeneratingPdf(null);
    },
  });

  const batchPdfMutation = api.results.generateProducerPdf.useMutation();

  const sendResultsToProducer = api.results.sendResultsToProducer.useMutation({
    onSuccess: () => {
      toast.success("Email envoyé avec succès");
      void refetchEmailStatus();
      setSendingEmail(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setSendingEmail(null);
    },
  });

  const sendResultsToAllProducers = api.results.sendResultsToAllProducers.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.success} emails envoyés, ${data.failed} échecs, ${data.skipped} ignorés`);
      void refetchEmailStatus();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const retryEmailSend = api.results.retryEmailSend.useMutation({
    onSuccess: () => {
      toast.success("Email renvoyé avec succès");
      void refetchEmailStatus();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSaveSettings = () => {
    updatePdfSettings.mutate({
      cupId,
      pdfLogoUrl: pdfLogoUrl || null,
      pdfIntroText: pdfIntroText || null,
    });
  };

  const handleDownloadProducerPdf = (registrationId: string) => {
    setGeneratingPdf(registrationId);
    generateProducerPdf.mutate({ registrationId });
  };

  const handleSendEmail = (registrationId: string) => {
    setSendingEmail(registrationId);
    sendResultsToProducer.mutate({
      registrationId,
      customMessage: customEmailMessage || undefined,
    });
  };

  const handleGenerateAll = async () => {
    const registrationsList = (emailStatusData?.registrations ?? []).filter(
      (r) => r.productCount > 0
    );
    if (registrationsList.length === 0) {
      toast.error("Aucun producteur avec des produits inscrits");
      return;
    }

    setBatchProgress({
      total: registrationsList.length,
      completed: 0,
      failed: 0,
      current: registrationsList[0]?.producerName ?? null,
      isRunning: true,
    });

    let completed = 0;
    let failed = 0;

    for (const registration of registrationsList) {
      setBatchProgress((prev) =>
        prev ? { ...prev, current: registration.producerName } : null
      );

      try {
        const result = await batchPdfMutation.mutateAsync({
          registrationId: registration.registrationId,
        });
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${result.pdfBase64}`;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        completed++;
      } catch {
        failed++;
      }

      setBatchProgress((prev) =>
        prev ? { ...prev, completed: completed, failed } : null
      );

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setBatchProgress((prev) =>
      prev ? { ...prev, isRunning: false, current: null } : null
    );

    if (failed > 0) {
      toast.warning(`${completed} PDFs générés, ${failed} erreur(s)`);
    } else {
      toast.success(`${completed} PDFs générés avec succès`);
    }
  };

  const toggleProducer = (id: string) => {
    setExpandedProducers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "13px",
            letterSpacing: "0.08em",
            color: "var(--n-text-disabled)",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  const emailStatus = emailStatusData?.registrations ?? [];
  const sentCount = emailStatusData?.counts.sent ?? 0;
  const notSentCount = emailStatusData?.counts.notSent ?? 0;
  const errorCount = emailStatusData?.counts.error ?? 0;
  const totalCount = emailStatusData?.counts.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: "'Doto', 'Space Mono', monospace",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--n-text-display)",
            marginBottom: "4px",
          }}
        >
          SYNTHÈSES PDF
        </h1>
        <p className="n-label">Générez et envoyez les synthèses aux producteurs</p>
      </div>

      {/* Warning: results not published */}
      {!pdfSettings?.resultsPublishedAt && (
        <Alert variant="destructive">
          <AlertTitle>[RÉSULTATS NON PUBLIÉS]</AlertTitle>
          <AlertDescription>
            Les résultats doivent être publiés avant d&apos;envoyer les synthèses aux producteurs.{" "}
            <Link
              href={`/dashboard/cups/${cupId}/results/publication`}
              style={{ textDecoration: "underline" }}
            >
              Publier les résultats
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Template PDF</TabsTrigger>
          <TabsTrigger value="generate">Génération</TabsTrigger>
          <TabsTrigger value="send">
            Envoi ({sentCount}/{totalCount})
          </TabsTrigger>
        </TabsList>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings" className="space-y-4">
          {/* Logo */}
          <div
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--n-border)",
              }}
            >
              <p
                style={{
                  fontFamily: "'Doto', 'Space Mono', monospace",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--n-text-display)",
                  fontWeight: 700,
                  marginBottom: "2px",
                }}
              >
                LOGO DU CONCOURS
              </p>
              <p className="n-label">
                URL d&apos;une image affichée en en-tête des PDFs de synthèse
              </p>
            </div>
            <div style={{ padding: "20px" }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">URL du logo</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={pdfLogoUrl}
                  onChange={(e) => setPdfLogoUrl(e.target.value)}
                />
              </div>
              {pdfLogoUrl && (
                <div
                  style={{
                    border: "1px solid var(--n-border)",
                    borderRadius: "6px",
                    padding: "16px",
                    background: "var(--n-black)",
                  }}
                >
                  <p className="n-label" style={{ marginBottom: "8px" }}>Aperçu :</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pdfLogoUrl}
                    alt="Logo preview"
                    className="max-h-24 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Intro Text */}
          <div
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--n-border)",
              }}
            >
              <p
                style={{
                  fontFamily: "'Doto', 'Space Mono', monospace",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--n-text-display)",
                  fontWeight: 700,
                  marginBottom: "2px",
                }}
              >
                TEXTE D&apos;INTRODUCTION
              </p>
              <p className="n-label">
                Message personnalisé affiché en haut de chaque page de synthèse
              </p>
            </div>
            <div style={{ padding: "20px" }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="introText">Texte (max 2000 caractères)</Label>
                <Textarea
                  id="introText"
                  placeholder="Félicitations pour votre participation à notre concours..."
                  value={pdfIntroText}
                  onChange={(e) => setPdfIntroText(e.target.value)}
                  rows={4}
                  maxLength={2000}
                />
                <p
                  className="n-label"
                  style={{ textAlign: "right" }}
                >
                  {pdfIntroText.length}/2000
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={updatePdfSettings.isPending}
            >
              {updatePdfSettings.isPending ? "[ENREGISTREMENT...]" : "Enregistrer les paramètres"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Generation Tab ── */}
        <TabsContent value="generate" className="space-y-4">
          {/* Batch generation */}
          <div
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--n-border)",
              }}
            >
              <p
                style={{
                  fontFamily: "'Doto', 'Space Mono', monospace",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--n-text-display)",
                  fontWeight: 700,
                  marginBottom: "2px",
                }}
              >
                GÉNÉRATION EN MASSE
              </p>
              <p className="n-label">
                Générer et télécharger tous les PDFs de synthèse un par un
              </p>
            </div>
            <div style={{ padding: "20px" }} className="space-y-4">
              {batchProgress ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "12px",
                        color: "var(--n-text-secondary)",
                      }}
                    >
                      {batchProgress.isRunning
                        ? `[GÉNÉRATION : ${batchProgress.current ?? "..."}]`
                        : "[TERMINÉ]"}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "12px",
                        color: "var(--n-text-display)",
                      }}
                    >
                      {batchProgress.completed + batchProgress.failed}/{batchProgress.total}
                    </span>
                  </div>
                  {/* Progress bar — Nothing style segmented */}
                  <div className="n-progress-bar">
                    {Array.from({ length: batchProgress.total }).map((_, i) => (
                      <div
                        key={i}
                        className={`n-progress-segment ${
                          i < batchProgress.completed
                            ? "filled success"
                            : i < batchProgress.completed + batchProgress.failed
                              ? "filled accent"
                              : ""
                        }`}
                      />
                    ))}
                  </div>
                  {batchProgress.failed > 0 && (
                    <p
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "12px",
                        color: "var(--n-accent)",
                      }}
                    >
                      {batchProgress.failed} erreur(s)
                    </p>
                  )}
                  {!batchProgress.isRunning && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBatchProgress(null)}
                    >
                      Fermer
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  disabled={loadingEmailStatus}
                  onClick={() => void handleGenerateAll()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Générer tous les PDFs
                </Button>
              )}
            </div>
          </div>

          {/* Individual PDFs */}
          <div
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--n-border)",
              }}
            >
              <p
                style={{
                  fontFamily: "'Doto', 'Space Mono', monospace",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--n-text-display)",
                  fontWeight: 700,
                  marginBottom: "2px",
                }}
              >
                PDFS PAR PRODUCTEUR
              </p>
              <p className="n-label">Télécharger les synthèses individuellement</p>
            </div>
            <div style={{ padding: "20px" }}>
              {loadingEmailStatus ? (
                <div className="flex justify-center py-8">
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "13px",
                      letterSpacing: "0.08em",
                      color: "var(--n-text-disabled)",
                    }}
                  >
                    [LOADING...]
                  </span>
                </div>
              ) : emailStatus.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <p
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "13px",
                      color: "var(--n-text-disabled)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    [AUCUN PRODUCTEUR]
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emailStatus.map((registration) => (
                    <Collapsible
                      key={registration.registrationId}
                      open={expandedProducers.has(registration.registrationId)}
                      onOpenChange={() => toggleProducer(registration.registrationId)}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 14px",
                          border: "1px solid var(--n-border)",
                          borderRadius: "6px",
                        }}
                      >
                        <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                          <div>
                            <p
                              style={{
                                fontSize: "14px",
                                fontWeight: 500,
                                color: "var(--n-text-primary)",
                              }}
                            >
                              {registration.producerName}
                            </p>
                            <p className="n-label">
                              {registration.productsWithResults} produit(s) noté(s)
                            </p>
                          </div>
                          {expandedProducers.has(registration.registrationId) ? (
                            <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
                          )}
                        </CollapsibleTrigger>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={() => handleDownloadProducerPdf(registration.registrationId)}
                          disabled={generatingPdf === registration.registrationId}
                        >
                          {generatingPdf === registration.registrationId ? (
                            <span
                              style={{
                                fontFamily: "'Space Mono', monospace",
                                fontSize: "11px",
                                color: "var(--n-text-disabled)",
                              }}
                            >
                              ...
                            </span>
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <CollapsibleContent className="pl-4 pr-3 pb-2 pt-1">
                        <p
                          style={{
                            fontSize: "12px",
                            color: "var(--n-text-disabled)",
                            fontFamily: "'Space Mono', monospace",
                          }}
                        >
                          {registration.producerEmail}
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Send Tab ── */}
        <TabsContent value="send" className="space-y-4">
          {/* Stats row */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total", value: totalCount },
              { label: "Envoyés", value: sentCount, color: "var(--n-success)" },
              { label: "En attente", value: notSentCount, color: "var(--n-warning)" },
              { label: "Erreurs", value: errorCount, color: "var(--n-accent)" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "var(--n-surface)",
                  border: "1px solid var(--n-border)",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <p
                  className="n-font-data"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "28px",
                    fontWeight: 700,
                    color: stat.color ?? "var(--n-text-display)",
                    lineHeight: 1,
                    marginBottom: "6px",
                  }}
                >
                  {stat.value}
                </p>
                <p className="n-label">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Bulk Send */}
          <div
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--n-border)",
              }}
            >
              <p
                style={{
                  fontFamily: "'Doto', 'Space Mono', monospace",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--n-text-display)",
                  fontWeight: 700,
                  marginBottom: "2px",
                }}
              >
                ENVOI EN MASSE
              </p>
              <p className="n-label">
                Envoyer les synthèses à tous les producteurs en une fois
              </p>
            </div>
            <div style={{ padding: "20px" }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customMessage">Message personnalisé (optionnel)</Label>
                <Textarea
                  id="customMessage"
                  placeholder="Message qui sera inclus dans l'email..."
                  value={customEmailMessage}
                  onChange={(e) => setCustomEmailMessage(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={sendResultsToAllProducers.isPending || !pdfSettings?.resultsPublishedAt}
                  >
                    {sendResultsToAllProducers.isPending ? (
                      "[ENVOI EN COURS...]"
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Envoyer à tous les producteurs
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Envoi en masse</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action va envoyer un email avec la synthèse PDF à tous les
                      producteurs ayant des produits notés ({notSentCount} en attente). Continuer ?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        sendResultsToAllProducers.mutate({
                          cupId,
                          customMessage: customEmailMessage || undefined,
                        })
                      }
                    >
                      Envoyer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Individual Send Status */}
          <div
            style={{
              background: "var(--n-surface)",
              border: "1px solid var(--n-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--n-border)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p
                    style={{
                      fontFamily: "'Doto', 'Space Mono', monospace",
                      fontSize: "12px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--n-text-display)",
                      fontWeight: 700,
                      marginBottom: "2px",
                    }}
                  >
                    SUIVI DES ENVOIS
                  </p>
                  <p className="n-label">Statut des emails envoyés aux producteurs</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filtrer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="sent">Envoyés</SelectItem>
                      <SelectItem value="not_sent">En attente</SelectItem>
                      <SelectItem value="error">Erreurs</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => void refetchEmailStatus()}
                    disabled={loadingEmailStatus}
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingEmailStatus ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>
            <div style={{ padding: "20px" }}>
              {loadingEmailStatus ? (
                <div className="flex justify-center py-8">
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "13px",
                      letterSpacing: "0.08em",
                      color: "var(--n-text-disabled)",
                    }}
                  >
                    [LOADING...]
                  </span>
                </div>
              ) : emailStatus.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <p
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "13px",
                      color: "var(--n-text-disabled)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    [AUCUN PRODUCTEUR]
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producteur</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Produits</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailStatus.map((registration) => (
                      <TableRow key={registration.registrationId}>
                        <TableCell className="font-medium">
                          {registration.producerName}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {registration.producerEmail}
                        </TableCell>
                        <TableCell>{registration.productsWithResults}</TableCell>
                        <TableCell>
                          {registration.sentAt ? (
                            <Badge variant="default" className="bg-emerald-600 text-white">
                              <Check className="h-3 w-3 mr-1" />
                              Envoyé
                            </Badge>
                          ) : registration.error ? (
                            <Badge variant="destructive">
                              <X className="h-3 w-3 mr-1" />
                              Erreur
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              En attente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {formatDate(registration.sentAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {registration.error ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                retryEmailSend.mutate({
                                  registrationId: registration.registrationId,
                                })
                              }
                              disabled={retryEmailSend.isPending}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Réessayer
                            </Button>
                          ) : !registration.sentAt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendEmail(registration.registrationId)}
                              disabled={
                                sendingEmail === registration.registrationId ||
                                !pdfSettings?.resultsPublishedAt
                              }
                            >
                              {sendingEmail === registration.registrationId ? (
                                <span
                                  style={{
                                    fontFamily: "'Space Mono', monospace",
                                    fontSize: "11px",
                                    color: "var(--n-text-disabled)",
                                  }}
                                >
                                  [...]
                                </span>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-1" />
                                  Envoyer
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendEmail(registration.registrationId)}
                              disabled={sendingEmail === registration.registrationId}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Renvoyer
                            </Button>
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
    </div>
  );
}
