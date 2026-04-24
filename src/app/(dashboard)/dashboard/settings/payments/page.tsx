"use client";

import { useState } from "react";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Settings,
  Unlink,
  Building2,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  TestTube,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import { api } from "~/trpc/react";

function StatusTag({ status }: { status: string | null }) {
  switch (status) {
    case "active":
      return <span className="n-tag" style={{ color: "var(--n-success)", borderColor: "var(--n-success)" }}>ACTIF</span>;
    case "pending":
      return <span className="n-tag" style={{ color: "var(--n-warning)", borderColor: "var(--n-warning)" }}>EN ATTENTE</span>;
    case "restricted":
      return <span className="n-tag" style={{ color: "var(--n-warning)", borderColor: "var(--n-warning)" }}>RESTREINT</span>;
    case "disabled":
      return <span className="n-tag" style={{ color: "var(--n-error)", borderColor: "var(--n-error)" }}>DESACTIVE</span>;
    default:
      return <span className="n-tag" style={{ color: "var(--n-text-secondary)" }}>NON CONFIGURE</span>;
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Paiements</h1>
        <p style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)", marginTop: "4px" }}>[LOADING...]</p>
      </div>
    </div>
  );
}

export default function PaymentsSettingsPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);

  const [vivaForm, setVivaForm] = useState({
    merchantId: "",
    apiKey: "",
    apiSecret: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [isConfiguringViva, setIsConfiguringViva] = useState(false);
  const [isTestingViva, setIsTestingViva] = useState(false);

  const utils = api.useUtils();

  const { data: status, isLoading, refetch } = api.stripeConnect.getStatus.useQuery();
  const { data: vivaStatus, isLoading: isLoadingViva, refetch: refetchViva } = api.vivaWallet.getStatus.useQuery();

  const createOnboardingLinkMutation = api.stripeConnect.createOnboardingLink.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(error.message);
      setIsConnecting(false);
    },
  });

  const createDashboardLinkMutation = api.stripeConnect.createDashboardLink.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      setIsOpeningDashboard(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsOpeningDashboard(false);
    },
  });

  const disconnectMutation = api.stripeConnect.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Compte Stripe deconnecte");
      void utils.stripeConnect.getStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const configureVivaMutation = api.vivaWallet.configure.useMutation({
    onSuccess: () => {
      toast.success("Viva Wallet configure avec succes");
      void utils.vivaWallet.getStatus.invalidate();
      setVivaForm({ merchantId: "", apiKey: "", apiSecret: "" });
      setIsConfiguringViva(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsConfiguringViva(false);
    },
  });

  const testVivaMutation = api.vivaWallet.testConnection.useMutation({
    onSuccess: () => {
      toast.success("Connexion Viva Wallet reussie");
      setIsTestingViva(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsTestingViva(false);
    },
  });

  const disconnectVivaMutation = api.vivaWallet.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Viva Wallet deconnecte");
      void utils.vivaWallet.getStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleConnect = () => {
    setIsConnecting(true);
    createOnboardingLinkMutation.mutate({});
  };

  const handleOpenDashboard = () => {
    setIsOpeningDashboard(true);
    createDashboardLinkMutation.mutate();
  };

  const handleRefreshStatus = async () => {
    await refetch();
    toast.success("Statut mis a jour");
  };

  const handleConfigureViva = () => {
    if (!vivaForm.merchantId || !vivaForm.apiKey || !vivaForm.apiSecret) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setIsConfiguringViva(true);
    configureVivaMutation.mutate(vivaForm);
  };

  const handleTestViva = () => {
    setIsTestingViva(true);
    testVivaMutation.mutate();
  };

  if (isLoading || isLoadingViva) {
    return <LoadingSkeleton />;
  }

  const isConnected = status?.connected;
  const isActive = status?.stripeAccountStatus === "active";
  const needsAction = status?.stripeAccountStatus === "pending" || status?.stripeAccountStatus === "restricted";

  return (
    <div className="space-y-8">
      <div>
        <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Paiements</h1>
        <p className="n-label" style={{ marginTop: "4px", color: "var(--n-text-secondary)" }}>
          CONFIGUREZ LA RECEPTION DES PAIEMENTS POUR VOS INSCRIPTIONS
        </p>
      </div>

      {/* Stripe Connect Section */}
      <div className="n-card overflow-hidden">
        <div className="p-5" style={{ borderBottom: "1px solid var(--n-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700, marginBottom: "2px" }}>Stripe Connect</p>
              <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>
                RECEVEZ LES PAIEMENTS DIRECTEMENT SUR VOTRE COMPTE STRIPE
              </p>
            </div>
            <StatusTag status={status?.stripeAccountStatus ?? null} />
          </div>
        </div>

        <div className="p-5 space-y-6">
          {!isConnected ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4" style={{ border: "1px solid var(--n-border)" }}>
                <Building2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--n-text-secondary)" }} />
                <div className="space-y-1">
                  <p className="n-font-body font-medium text-sm" style={{ color: "var(--n-text-primary)" }}>Connectez votre compte Stripe</p>
                  <p className="n-font-body text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    Stripe Connect vous permet de recevoir les paiements des inscriptions
                    directement sur votre compte bancaire. La configuration prend quelques minutes.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>AVANTAGES</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 n-font-data text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    <CheckCircle className="h-3 w-3 shrink-0" style={{ color: "var(--n-success)" }} />
                    Paiements securises par Stripe
                  </li>
                  <li className="flex items-center gap-2 n-font-data text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    <CheckCircle className="h-3 w-3 shrink-0" style={{ color: "var(--n-success)" }} />
                    Virements automatiques sur votre compte bancaire
                  </li>
                  <li className="flex items-center gap-2 n-font-data text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    <CheckCircle className="h-3 w-3 shrink-0" style={{ color: "var(--n-success)" }} />
                    Tableau de bord Stripe pour suivre vos transactions
                  </li>
                  <li className="flex items-center gap-2 n-font-data text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    <CheckCircle className="h-3 w-3 shrink-0" style={{ color: "var(--n-success)" }} />
                    Support des cartes bancaires et autres moyens de paiement
                  </li>
                </ul>
              </div>

              <Button onClick={handleConnect} disabled={isConnecting} className="n-btn-primary">
                {isConnecting ? (
                  <span className="n-font-data text-xs">[CONNEXION EN COURS...]</span>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Connecter Stripe
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {needsAction && (
                <div className="flex items-start gap-3 p-4" style={{ border: "1px solid var(--n-warning)", borderLeft: "3px solid var(--n-warning)" }}>
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--n-warning)" }} />
                  <div className="space-y-1">
                    <p className="n-font-body font-medium text-sm" style={{ color: "var(--n-warning)" }}>Action requise</p>
                    <p className="n-font-body text-sm" style={{ color: "var(--n-text-secondary)" }}>
                      Votre compte Stripe necessite des informations supplementaires pour activer
                      les paiements. Cliquez sur &quot;Completer la configuration&quot; pour continuer.
                    </p>
                  </div>
                </div>
              )}

              {isActive && (
                <div className="flex items-start gap-3 p-4" style={{ border: "1px solid var(--n-success)", borderLeft: "3px solid var(--n-success)" }}>
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--n-success)" }} />
                  <div className="space-y-1">
                    <p className="n-font-body font-medium text-sm" style={{ color: "var(--n-success)" }}>Compte actif</p>
                    <p className="n-font-body text-sm" style={{ color: "var(--n-text-secondary)" }}>
                      Votre compte Stripe est configure et pret a recevoir des paiements.
                    </p>
                  </div>
                </div>
              )}

              {status?.details && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3" style={{ border: "1px solid var(--n-border)" }}>
                    <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>PAIEMENTS ACTIVES</p>
                    <p className="n-font-data text-sm mt-1" style={{ color: status.details.chargesEnabled ? "var(--n-success)" : "var(--n-warning)" }}>
                      {status.details.chargesEnabled ? "OUI" : "NON"}
                    </p>
                  </div>
                  <div className="p-3" style={{ border: "1px solid var(--n-border)" }}>
                    <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>VIREMENTS ACTIVES</p>
                    <p className="n-font-data text-sm mt-1" style={{ color: status.details.payoutsEnabled ? "var(--n-success)" : "var(--n-warning)" }}>
                      {status.details.payoutsEnabled ? "OUI" : "NON"}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {needsAction ? (
                  <Button onClick={handleConnect} disabled={isConnecting} className="n-btn-primary">
                    {isConnecting ? (
                      <span className="n-font-data text-xs">[CHARGEMENT...]</span>
                    ) : (
                      <>
                        <Settings className="mr-2 h-4 w-4" />
                        Completer la configuration
                      </>
                    )}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleOpenDashboard} disabled={isOpeningDashboard} className="n-btn-secondary">
                    {isOpeningDashboard ? (
                      <span className="n-font-data text-xs">[OUVERTURE...]</span>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Tableau de bord Stripe
                      </>
                    )}
                  </Button>
                )}

                <Button variant="outline" onClick={handleRefreshStatus} className="n-btn-secondary">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualiser le statut
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="n-btn-secondary text-destructive hover:text-destructive">
                      <Unlink className="mr-2 h-4 w-4" />
                      Deconnecter
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="n-font-body">Deconnecter Stripe ?</AlertDialogTitle>
                      <AlertDialogDescription className="n-font-body">
                        Vous ne pourrez plus recevoir de paiements pour les inscriptions
                        jusqu&apos;a ce que vous reconnectiez un compte Stripe.
                        Les paiements en cours ne seront pas affectes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="n-btn-secondary">Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => disconnectMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Deconnecter
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {status?.paymentConfiguredAt && (
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--n-text-secondary)" }}>
                  CONFIGURE LE{" "}
                  {new Date(status.paymentConfiguredAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).toUpperCase()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Viva Wallet Section */}
      <div className="n-card overflow-hidden">
        <div className="p-5" style={{ borderBottom: "1px solid var(--n-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700, marginBottom: "2px" }}>Viva Wallet</p>
              <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>
                SOLUTION DE PAIEMENT EUROPEENNE
              </p>
            </div>
            {vivaStatus?.configured ? (
              <span className="n-tag" style={{ color: "var(--n-success)", borderColor: "var(--n-success)" }}>CONFIGURE</span>
            ) : (
              <span className="n-tag" style={{ color: "var(--n-text-secondary)" }}>NON CONFIGURE</span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-6">
          {!vivaStatus?.configured ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4" style={{ border: "1px solid var(--n-border)" }}>
                <Key className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--n-text-secondary)" }} />
                <div className="space-y-1">
                  <p className="n-font-body font-medium text-sm" style={{ color: "var(--n-text-primary)" }}>Configurez Viva Wallet</p>
                  <p className="n-font-body text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    Entrez vos identifiants API Viva Wallet pour recevoir les paiements.
                    Vous trouverez ces informations dans votre espace marchand Viva Wallet.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="merchantId" className="n-label">MERCHANT ID</Label>
                  <Input
                    id="merchantId"
                    placeholder="Votre Merchant ID Viva Wallet"
                    value={vivaForm.merchantId}
                    onChange={(e) => setVivaForm({ ...vivaForm, merchantId: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="n-label">API KEY (CLIENT ID)</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder="Votre API Key"
                      value={vivaForm.apiKey}
                      onChange={(e) => setVivaForm({ ...vivaForm, apiKey: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                      ) : (
                        <Eye className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiSecret" className="n-label">API SECRET (CLIENT SECRET)</Label>
                  <div className="relative">
                    <Input
                      id="apiSecret"
                      type={showApiSecret ? "text" : "password"}
                      placeholder="Votre API Secret"
                      value={vivaForm.apiSecret}
                      onChange={(e) => setVivaForm({ ...vivaForm, apiSecret: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiSecret(!showApiSecret)}
                    >
                      {showApiSecret ? (
                        <EyeOff className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                      ) : (
                        <Eye className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleConfigureViva}
                disabled={isConfiguringViva || !vivaForm.merchantId || !vivaForm.apiKey || !vivaForm.apiSecret}
                className="n-btn-primary"
              >
                {isConfiguringViva ? (
                  <span className="n-font-data text-xs">[CONFIGURATION EN COURS...]</span>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Configurer Viva Wallet
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4" style={{ border: "1px solid var(--n-success)", borderLeft: "3px solid var(--n-success)" }}>
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--n-success)" }} />
                <div className="space-y-1">
                  <p className="n-font-body font-medium text-sm" style={{ color: "var(--n-success)" }}>Viva Wallet configure</p>
                  <p className="n-font-body text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    Votre compte Viva Wallet est configure et pret a recevoir des paiements.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3" style={{ border: "1px solid var(--n-border)" }}>
                  <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>MERCHANT ID</p>
                  <p className="n-font-data text-sm mt-1">{vivaStatus.merchantId}</p>
                </div>
                <div className="p-3" style={{ border: "1px solid var(--n-border)" }}>
                  <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>IDENTIFIANTS</p>
                  <p className="n-font-data text-sm mt-1" style={{ color: vivaStatus.hasApiKey && vivaStatus.hasApiSecret ? "var(--n-success)" : "var(--n-warning)" }}>
                    {vivaStatus.hasApiKey && vivaStatus.hasApiSecret ? "CONFIGURES" : "INCOMPLETS"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleTestViva} disabled={isTestingViva} className="n-btn-secondary">
                  {isTestingViva ? (
                    <span className="n-font-data text-xs">[TEST EN COURS...]</span>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Tester la connexion
                    </>
                  )}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="n-btn-secondary text-destructive hover:text-destructive">
                      <Unlink className="mr-2 h-4 w-4" />
                      Deconnecter
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="n-font-body">Deconnecter Viva Wallet ?</AlertDialogTitle>
                      <AlertDialogDescription className="n-font-body">
                        Vos identifiants API seront supprimes. Vous ne pourrez plus
                        recevoir de paiements via Viva Wallet jusqu&apos;a une nouvelle configuration.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="n-btn-secondary">Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => disconnectVivaMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Deconnecter
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {vivaStatus?.paymentConfiguredAt && (
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--n-text-secondary)" }}>
                  CONFIGURE LE{" "}
                  {new Date(vivaStatus.paymentConfiguredAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).toUpperCase()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="n-card overflow-hidden">
        <div className="p-5" style={{ borderBottom: "1px solid var(--n-border)" }}>
          <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>Comment ca marche ?</p>
        </div>
        <div className="p-5 space-y-3 n-font-body text-sm" style={{ color: "var(--n-text-secondary)" }}>
          <p>
            Lorsqu&apos;un participant s&apos;inscrit a une de vos cups avec une inscription
            payante, le paiement sera automatiquement transfere sur votre compte Stripe.
          </p>
          <p>
            Stripe preleve des frais de transaction standard (1.4% + 0.25EUR pour les
            cartes europeennes). CupMetrics ne preleve aucune commission supplementaire
            sur les inscriptions.
          </p>
          <p>
            Les virements vers votre compte bancaire sont effectues automatiquement par
            Stripe selon le calendrier que vous avez configure (generalement 7 jours).
          </p>
        </div>
      </div>
    </div>
  );
}
