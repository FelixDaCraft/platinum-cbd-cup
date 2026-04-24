"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CreditCard,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription } from "~/components/ui/alert";
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

// Stripe form schema
const stripeSchema = z.object({
  provider: z.literal("stripe"),
  secretKey: z.string().min(1, "Cle secrete requise").startsWith("sk_", "La cle secrete doit commencer par sk_"),
  publishableKey: z.string().min(1, "Cle publique requise").startsWith("pk_", "La cle publique doit commencer par pk_"),
});

// Viva Wallet form schema
const vivaWalletSchema = z.object({
  provider: z.literal("viva_wallet"),
  merchantId: z.string().min(1, "Merchant ID requis"),
  apiKey: z.string().min(1, "API Key requise"),
  clientId: z.string().min(1, "Client ID requis"),
  clientSecret: z.string().min(1, "Client Secret requis"),
});

type StripeFormData = z.infer<typeof stripeSchema>;
type VivaWalletFormData = z.infer<typeof vivaWalletSchema>;

interface PaymentConfigFormProps {
  currentProvider: string | null;
  isConfigured: boolean;
  configuredAt: Date | null;
  encryptionAvailable: boolean;
  onSave: (data: StripeFormData | VivaWalletFormData) => Promise<void>;
  onTest: () => Promise<{ success: boolean; message: string }>;
  onRemove: () => Promise<void>;
  isSaving: boolean;
  isTesting: boolean;
  isRemoving: boolean;
}

export function PaymentConfigForm({
  currentProvider,
  isConfigured,
  configuredAt,
  encryptionAvailable,
  onSave,
  onTest,
  onRemove,
  isSaving,
  isTesting,
  isRemoving,
}: PaymentConfigFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<"stripe" | "viva_wallet">(
    (currentProvider as "stripe" | "viva_wallet") || "stripe"
  );
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const stripeForm = useForm<StripeFormData>({
    resolver: zodResolver(stripeSchema),
    defaultValues: {
      provider: "stripe",
      secretKey: "",
      publishableKey: "",
    },
  });

  const vivaForm = useForm<VivaWalletFormData>({
    resolver: zodResolver(vivaWalletSchema),
    defaultValues: {
      provider: "viva_wallet",
      merchantId: "",
      apiKey: "",
      clientId: "",
      clientSecret: "",
    },
  });

  const handleSaveStripe = async (data: StripeFormData) => {
    setTestResult(null);
    await onSave(data);
  };

  const handleSaveViva = async (data: VivaWalletFormData) => {
    setTestResult(null);
    await onSave(data);
  };

  const handleTest = async () => {
    const result = await onTest();
    setTestResult(result);
  };

  const handleRemove = async () => {
    setTestResult(null);
    await onRemove();
  };

  if (!encryptionAvailable) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Le chiffrement n&apos;est pas configure sur le serveur. Contactez l&apos;administrateur
          pour configurer la variable d&apos;environnement ENCRYPTION_KEY.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="space-y-2">
        <Label>Processeur de paiement</Label>
        <Select
          value={selectedProvider}
          onValueChange={(value) => setSelectedProvider(value as "stripe" | "viva_wallet")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stripe">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe
              </div>
            </SelectItem>
            <SelectItem value="viva_wallet">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Viva Wallet
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Current Config Status */}
      {isConfigured && currentProvider === selectedProvider && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            {selectedProvider === "stripe" ? "Stripe" : "Viva Wallet"} est configure.
            {configuredAt && (
              <span className="text-muted-foreground ml-1">
                (Configure le {new Date(configuredAt).toLocaleDateString("fr-FR")})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Stripe Form */}
      {selectedProvider === "stripe" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration Stripe</CardTitle>
            <CardDescription>
              Entrez vos cles API Stripe. Elles seront chiffrees avant d&apos;etre stockees.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={stripeForm.handleSubmit(handleSaveStripe)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secretKey">Cle secrete (Secret Key)</Label>
                <div className="relative">
                  <Input
                    id="secretKey"
                    type={showSecrets ? "text" : "password"}
                    placeholder="sk_live_..."
                    {...stripeForm.register("secretKey")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {stripeForm.formState.errors.secretKey && (
                  <p className="text-sm text-destructive">{stripeForm.formState.errors.secretKey.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="publishableKey">Cle publique (Publishable Key)</Label>
                <Input
                  id="publishableKey"
                  type={showSecrets ? "text" : "password"}
                  placeholder="pk_live_..."
                  {...stripeForm.register("publishableKey")}
                />
                {stripeForm.formState.errors.publishableKey && (
                  <p className="text-sm text-destructive">{stripeForm.formState.errors.publishableKey.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Viva Wallet Form */}
      {selectedProvider === "viva_wallet" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration Viva Wallet</CardTitle>
            <CardDescription>
              Entrez vos identifiants Viva Wallet. Ils seront chiffres avant d&apos;etre stockes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={vivaForm.handleSubmit(handleSaveViva)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="merchantId">Merchant ID</Label>
                <Input
                  id="merchantId"
                  type="text"
                  placeholder="Votre Merchant ID"
                  {...vivaForm.register("merchantId")}
                />
                {vivaForm.formState.errors.merchantId && (
                  <p className="text-sm text-destructive">{vivaForm.formState.errors.merchantId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vivaApiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="vivaApiKey"
                    type={showSecrets ? "text" : "password"}
                    placeholder="Votre API Key"
                    {...vivaForm.register("apiKey")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {vivaForm.formState.errors.apiKey && (
                  <p className="text-sm text-destructive">{vivaForm.formState.errors.apiKey.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  type="text"
                  placeholder="Votre Client ID"
                  {...vivaForm.register("clientId")}
                />
                {vivaForm.formState.errors.clientId && (
                  <p className="text-sm text-destructive">{vivaForm.formState.errors.clientId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type={showSecrets ? "text" : "password"}
                  placeholder="Votre Client Secret"
                  {...vivaForm.register("clientSecret")}
                />
                {vivaForm.formState.errors.clientSecret && (
                  <p className="text-sm text-destructive">{vivaForm.formState.errors.clientSecret.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Test Connection & Remove */}
      {isConfigured && currentProvider === selectedProvider && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting}
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tester la connexion
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isRemoving}>
                    {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Supprimer la configuration
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer la configuration ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprimera vos cles API. Vous devrez les reconfigurer
                      pour recevoir des paiements.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemove}>
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
