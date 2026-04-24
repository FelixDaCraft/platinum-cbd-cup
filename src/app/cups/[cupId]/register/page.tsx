"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Trophy,
  Plus,
  Trash2,
  ShoppingCart,
  ArrowLeft,
  Package,
  Euro,
  Check,
  AlertCircle,
  XCircle,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { api } from "~/trpc/react";

// Format price from cents to display
function formatPrice(cents: number | null, currency: string | null): string {
  if (cents === null || cents === 0) return "Gratuit";
  const amount = cents / 100;
  const currencySymbol = currency === "EUR" ? "EUR" : currency ?? "EUR";
  return `${amount.toFixed(2)} ${currencySymbol}`;
}

// Add Product Dialog Component
function AddProductDialog({
  category,
  registrationId,
  onSuccess,
}: {
  category: { id: string; name: string };
  registrationId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const addProduct = api.registration.addProduct.useMutation({
    onSuccess: () => {
      setOpen(false);
      setName("");
      setDescription("");
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addProduct.mutate({
      registrationId,
      categoryId: category.id,
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un produit</DialogTitle>
          <DialogDescription>
            Categorie: {category.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du produit *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Cuvee Prestige 2022"
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Decrivez votre produit..."
              maxLength={1000}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={addProduct.isPending || !name.trim()}>
              {addProduct.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PortalRegisterPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cupId = params.cupId as string;

  // Check if user was redirected from cancelled payment
  const wasCancelled = searchParams.get("cancelled") === "true";

  // Error state for payment mutations
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Get cup details
  const {
    data: cupData,
    isLoading: cupLoading,
    error: cupError,
  } = api.cup.getPublicDetails.useQuery({ cupId }, { enabled: !!cupId });

  // Get or create registration
  const getOrCreate = api.registration.getOrCreate.useMutation();

  // Get registration data
  const {
    data: registration,
    isLoading: regLoading,
    error: regError,
    refetch: refetchRegistration,
  } = api.registration.getById.useQuery(
    { registrationId: getOrCreate.data?.id ?? "" },
    { enabled: !!getOrCreate.data?.id }
  );

  // Remove product mutation
  const removeProduct = api.registration.removeProduct.useMutation({
    onSuccess: () => {
      refetchRegistration();
    },
  });

  // Payment mutations
  const createCheckoutSession = api.registration.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      setPaymentError(null);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error) => {
      setPaymentError(error.message || "Erreur lors de la creation de la session de paiement");
    },
  });

  const confirmFreeRegistration = api.registration.confirmFreeRegistration.useMutation({
    onSuccess: () => {
      setPaymentError(null);
      router.push(`/cups/${cupId}/register/success`);
    },
    onError: (error) => {
      setPaymentError(error.message || "Erreur lors de la confirmation de l'inscription");
    },
  });

  // Initialize registration on mount
  const [initialized, setInitialized] = useState(false);
  if (!initialized && cupData && !getOrCreate.isPending && !getOrCreate.data) {
    setInitialized(true);
    getOrCreate.mutate({ cupId });
  }

  // Loading state
  if (cupLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state - cup not found
  if (cupError || !cupData) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Cup non trouvee</h1>
            <p className="text-muted-foreground mb-4">
              Cette competition n&apos;existe pas ou n&apos;est pas disponible.
            </p>
            <Link href="/">
              <Button variant="outline">Retour a l&apos;accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if registrations are open
  if (!cupData.canRegister) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Inscriptions fermees</h1>
            <p className="text-muted-foreground mb-4">
              Les inscriptions pour cette cup ne sont plus ouvertes.
            </p>
            <Link href={`/cups/${cupId}`}>
              <Button variant="outline">Voir la cup</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Need to create producer profile (user is logged in but no producer profile)
  if (getOrCreate.error?.data?.code === "FORBIDDEN") {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Profil producteur requis</h1>
            <p className="text-muted-foreground mb-4">
              Vous devez completer votre profil producteur pour vous inscrire.
            </p>
            <Link href="/producer/complete-profile">
              <Button>Completer mon profil producteur</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in
  if (getOrCreate.error?.data?.code === "UNAUTHORIZED") {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Connexion requise</h1>
            <p className="text-muted-foreground mb-4">
              Vous devez etre connecte pour vous inscrire a cette cup.
            </p>
            <div className="flex gap-2 justify-center">
              <Link href="/login">
                <Button>Se connecter</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline">Creer un compte</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Generic error
  if (getOrCreate.error) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Erreur</h1>
            <p className="text-muted-foreground mb-4">
              {getOrCreate.error.message || "Une erreur est survenue lors de la creation de l'inscription."}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error fetching registration details
  if (regError) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Erreur</h1>
            <p className="text-muted-foreground mb-4">
              {regError.message || "Une erreur est survenue lors du chargement de l'inscription."}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading registration
  if (getOrCreate.isPending || regLoading || (getOrCreate.data && !registration)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { cup, categories } = cupData;
  const products = registration?.products ?? [];
  const totalAmount = registration?.totalAmount ?? 0;

  // Group products by category
  const productsByCategory = products.reduce<Record<string, typeof products>>(
    (acc, product) => {
      const categoryId = product.categoryId;
      const existing = acc[categoryId] ?? [];
      return {
        ...acc,
        [categoryId]: [...existing, product],
      };
    },
    {}
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/cups/${cupId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour a la cup
        </Link>
        <h1 className="text-2xl font-bold">{cup.name}</h1>
        <p className="text-muted-foreground">Inscription de vos produits</p>
      </div>

      {/* Payment Cancelled Alert */}
      {wasCancelled && (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Le paiement a ete annule. Vous pouvez reessayer quand vous le souhaitez.
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Error Alert */}
      {paymentError && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {paymentError}
          </AlertDescription>
        </Alert>
      )}

      {/* Registration Status */}
      {registration && registration.status !== "pending_payment" && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">
                {registration.status === "confirmed"
                  ? "Inscription confirmee"
                  : "Statut: " + registration.status}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Categories & Products */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Categories disponibles</h2>

          {categories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Aucune categorie disponible pour cette cup.
                </p>
              </CardContent>
            </Card>
          ) : (
            categories.map((category) => {
              const categoryProducts = productsByCategory[category.id] ?? [];
              const price = category.pricePerProduct ?? cup.defaultPricePerProduct ?? 0;

              return (
                <Card key={category.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{category.name}</CardTitle>
                        {category.description && (
                          <CardDescription className="mt-1">
                            {category.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {formatPrice(price, cup.currency)} /produit
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Products in this category */}
                    {categoryProducts.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {categoryProducts.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{product.name}</p>
                              {product.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <span className="text-sm text-muted-foreground">
                                {formatPrice(product.priceAtRegistration, cup.currency)}
                              </span>
                              {registration?.status === "pending_payment" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() =>
                                    removeProduct.mutate({ productId: product.id })
                                  }
                                  disabled={removeProduct.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add product button */}
                    {registration?.status === "pending_payment" && registration.id && (
                      <AddProductDialog
                        category={category}
                        registrationId={registration.id}
                        onSuccess={() => refetchRegistration()}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Recapitulatif
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Produits</span>
                <span>{products.length}</span>
              </div>

              {Object.entries(productsByCategory).map(([catId, prods]) => {
                const cat = categories.find((c) => c.id === catId);
                return (
                  <div key={catId} className="text-sm">
                    <span className="text-muted-foreground">{cat?.name}</span>
                    <span className="float-right">{prods.length} produit(s)</span>
                  </div>
                );
              })}

              <div className="border-t pt-4">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="flex items-center gap-1">
                    <Euro className="h-4 w-4" />
                    {formatPrice(totalAmount, cup.currency)}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                size="lg"
                disabled={
                  products.length === 0 ||
                  registration?.status !== "pending_payment" ||
                  createCheckoutSession.isPending ||
                  confirmFreeRegistration.isPending
                }
                onClick={() => {
                  if (!registration?.id) return;
                  if (totalAmount === 0) {
                    confirmFreeRegistration.mutate({ registrationId: registration.id });
                  } else {
                    createCheckoutSession.mutate({ registrationId: registration.id });
                  }
                }}
              >
                {(createCheckoutSession.isPending || confirmFreeRegistration.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {totalAmount === 0 ? "Valider l'inscription" : "Proceder au paiement"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
