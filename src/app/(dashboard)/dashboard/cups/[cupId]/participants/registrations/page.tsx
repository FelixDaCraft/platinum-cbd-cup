"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { api } from "~/trpc/react";
import { formatPrice, type Currency } from "~/lib/validations/pricing";
import {
  CheckoutBadge,
  type ProductCheckout,
} from "~/components/features/products/checkout-badge";
import {
  checkoutStateConfig,
  isCompeting,
  isUnfinished,
  type CheckoutState,
} from "~/lib/registration-checkout";
import { formatPhone } from "~/lib/validations/producer";

/** Filtre par parcours : groupes, puis chaque étape du parcours. */
const parcoursFilters: { value: string; label: string }[] = [
  { value: "all", label: "Tous les parcours" },
  { value: "competing", label: "En lice" },
  { value: "unfinished", label: "Non terminées" },
  ...(["paid", "imported", "empty", "cart", "abandoned", "declined", "cancelled"] as const).map(
    (state) => ({ value: state, label: checkoutStateConfig[state].label })
  ),
];

function matchesParcours(state: CheckoutState, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "competing") return isCompeting(state);
  if (filter === "unfinished") return isUnfinished(state);
  return state === filter;
}

// Product status configuration
const productStatusConfig = {
  pending: {
    label: "EN ATTENTE",
    color: "var(--n-warning)",
  },
  received: {
    label: "RECU",
    color: "var(--n-interactive)",
  },
  rating: {
    label: "EN NOTATION",
    color: "var(--n-text-secondary)",
  },
  rated: {
    label: "NOTE",
    color: "var(--n-success)",
  },
};

type RegistrationStatus = "pending_payment" | "confirmed" | "cancelled";

interface Producer {
  id: string;
  companyName: string;
  brandName: string;
  siret: string | null;
  website: string | null;
  phone: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface Product {
  id: string;
  name: string;
  status: string;
  category: {
    id: string;
    name: string;
  };
}

interface Registration {
  id: string;
  status: RegistrationStatus;
  totalAmount: number;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
  producer: Producer;
  products: Product[];
  productCount: number;
  checkout: ProductCheckout;
}

/**
 * Montant d'une inscription. Un total à 0 n'est jamais une gratuité ici :
 * panier vide, ou inscription importée réglée hors du site.
 */
function formatRegistrationAmount(registration: Registration): string {
  if (registration.checkout.state === "imported") return "Hors site";
  if (registration.checkout.state === "empty") return "—";
  return formatPrice(registration.totalAmount, (registration.currency as Currency) ?? "EUR");
}

/** Statut affiché : le parcours d'inscription, plus parlant que le statut brut. */
function RegistrationStatusCell({ registration }: { registration: Registration }) {
  if (registration.checkout.state === "paid") {
    const config = checkoutStateConfig.paid;
    return (
      <span
        title={config.hint}
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: config.color,
          background: config.bg,
          borderRadius: "4px",
          padding: "1px 6px",
        }}
      >
        {config.label}
      </span>
    );
  }
  return <CheckoutBadge checkout={registration.checkout} />;
}

export default function CupRegistrationsPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: cup, isLoading: isCupLoading, isError: isCupError } = api.cup.getById.useQuery({ id: cupId });

  const { data: categories = [] } = api.category.list.useQuery(
    { cupId },
    { enabled: !!cup }
  );

  const {
    data: allRegistrations = [],
    isLoading: isRegistrationsLoading,
    isError: isRegistrationsError,
    refetch: refetchRegistrations,
  } = api.registration.listByCup.useQuery(
      {
        cupId,
        categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
      },
      { enabled: !!cup }
    );

  const isLoading = isCupLoading || isRegistrationsLoading;

  const groupProductsByCategory = (products: Product[]) => {
    const grouped: Record<string, { category: { id: string; name: string }; products: Product[] }> = {};
    products.forEach((product) => {
      const catId = product.category.id;
      if (!grouped[catId]) {
        grouped[catId] = { category: product.category, products: [] };
      }
      grouped[catId].products.push(product);
    });
    return Object.values(grouped);
  };

  const handleViewDetails = (registration: Registration) => {
    setSelectedRegistration(registration);
    setConfirmDelete(false);
    setIsSheetOpen(true);
  };

  const utils = api.useUtils();
  const deleteRegistration = api.registration.deleteByOrganizer.useMutation({
    onSuccess: () => {
      toast.success("Inscription supprimée");
      setIsSheetOpen(false);
      setSelectedRegistration(null);
      void utils.registration.listByCup.invalidate();
      void utils.product.listByCupGroupedByCategory.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      setConfirmDelete(false);
    },
  });

  const resetFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  const hasActiveFilters = statusFilter !== "all" || categoryFilter !== "all";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}>[LOADING...]</span>
      </div>
    );
  }

  // Sans cela, une erreur serveur affichait « 0 inscription » : l'organisateur
  // aurait pu croire à une absence réelle d'inscrits.
  if (isCupError || isRegistrationsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <span role="alert" style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", letterSpacing: "0.08em", color: "var(--n-text-secondary)" }}>
          [ERREUR] LES INSCRIPTIONS N&apos;ONT PAS PU ÊTRE CHARGÉES
        </span>
        <button type="button" className="n-btn-secondary text-xs" onClick={() => void refetchRegistrations()}>
          RÉESSAYER
        </button>
      </div>
    );
  }

  if (!cup) {
    return null;
  }

  const registrations = allRegistrations.filter((r) =>
    matchesParcours(r.checkout.state, statusFilter)
  );
  const competing = allRegistrations.filter((r) => isCompeting(r.checkout.state));
  const confirmedCount = competing.length;
  const pendingCount = allRegistrations.filter((r) => isUnfinished(r.checkout.state)).length;
  const totalProducts = competing.reduce((sum, r) => sum + r.productCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>
          Inscriptions
        </h1>
        <p className="n-label" style={{ marginTop: "4px" }}>
          Gérez les producteurs inscrits à la compétition
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-3">
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "16px" }}>
          <p className="n-label" style={{ marginBottom: "4px" }}>EN LICE</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "30px", fontWeight: 700, color: "var(--n-success)" }}>{confirmedCount}</p>
        </div>
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "16px" }}>
          <p className="n-label" style={{ marginBottom: "4px" }}>NON TERMINÉES</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "30px", fontWeight: 700, color: "var(--n-warning)" }}>{pendingCount}</p>
        </div>
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "16px" }}>
          <p className="n-label" style={{ marginBottom: "4px" }}>PRODUITS EN LICE</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "30px", fontWeight: 700, color: "var(--n-text-display)" }}>{totalProducts}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "16px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
          <span className="n-label">FILTRES</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 n-label" style={{ color: "var(--n-text-secondary)" }}>
              Réinitialiser
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="w-full sm:w-[210px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Parcours" />
              </SelectTrigger>
              <SelectContent>
                {parcoursFilters.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[200px]">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Registrations Table */}
      <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--n-border)" }}>
          <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>Liste des inscriptions</p>
          <p className="n-label" style={{ marginTop: "2px" }}>
            {registrations.length} inscription{registrations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          {registrations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ color: "var(--n-text-secondary)" }}>Aucune inscription pour cette cup</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderBottom: "1px solid var(--n-border-visible)" }}>
                    <TableHead><span className="n-label" style={{ color: "var(--n-text-secondary)" }}>PRODUCTEUR</span></TableHead>
                    <TableHead className="hidden sm:table-cell"><span className="n-label" style={{ color: "var(--n-text-secondary)" }}>PRODUITS</span></TableHead>
                    <TableHead><span className="n-label" style={{ color: "var(--n-text-secondary)" }}>STATUT</span></TableHead>
                    <TableHead className="hidden sm:table-cell"><span className="n-label" style={{ color: "var(--n-text-secondary)" }}>MONTANT</span></TableHead>
                    <TableHead className="hidden md:table-cell"><span className="n-label" style={{ color: "var(--n-text-secondary)" }}>DATE</span></TableHead>
                    <TableHead className="text-right"><span className="n-label" style={{ color: "var(--n-text-secondary)" }}>ACTIONS</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((registration) => {
                    return (
                      <TableRow
                        key={registration.id}
                        style={{ borderBottom: "1px solid var(--n-border)" }}
                        className="hover:bg-[var(--n-surface-raised)]"
                      >
                        <TableCell>
                          <div>
                            <div style={{ fontWeight: 500, color: "var(--n-text-primary)" }}>
                              {registration.producer.brandName}
                            </div>
                            <div className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                              {registration.producer.companyName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="n-tag">
                            {registration.productCount} produit{registration.productCount !== 1 ? "s" : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <RegistrationStatusCell registration={registration} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-primary)" }}>
                            {formatRegistrationAmount(registration)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}>
                            {format(new Date(registration.createdAt), "dd MMM yyyy", { locale: fr })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(registration)}
                            style={{ color: "var(--n-text-secondary)" }}
                          >
                            Voir détails
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Producer Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {selectedRegistration && (
            <>
              <SheetHeader>
                <SheetTitle style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>
                  {selectedRegistration.producer.brandName}
                </SheetTitle>
                <SheetDescription className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                  Détails de l&apos;inscription
                </SheetDescription>
              </SheetHeader>

              <div style={{ marginTop: "24px" }} className="space-y-6">
                {/* Registration Status */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <RegistrationStatusCell registration={selectedRegistration} />
                    <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}>
                      {formatRegistrationAmount(selectedRegistration)}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--n-text-secondary)" }}>
                    {checkoutStateConfig[selectedRegistration.checkout.state].hint}
                  </p>
                </div>

                {/* Company Info */}
                <div className="space-y-3">
                  <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>ENTREPRISE</p>
                  <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "8px", padding: "12px" }} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>NOM COMMERCIAL</span>
                      <span style={{ color: "var(--n-text-primary)" }}>
                        {selectedRegistration.producer.companyName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>MARQUE</span>
                      <span style={{ color: "var(--n-text-primary)" }}>
                        {selectedRegistration.producer.brandName}
                      </span>
                    </div>
                    {selectedRegistration.producer.siret && (
                      <div className="flex justify-between">
                        <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>SIRET</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-primary)" }}>
                          {selectedRegistration.producer.siret}
                        </span>
                      </div>
                    )}
                    {selectedRegistration.producer.website && (
                      <div className="flex justify-between">
                        <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>SITE WEB</span>
                        <a
                          href={selectedRegistration.producer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--n-accent)" }}
                          className="hover:underline"
                        >
                          {selectedRegistration.producer.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>CONTACT</p>
                  <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "8px", padding: "12px" }} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>NOM</span>
                      <span style={{ color: "var(--n-text-primary)" }}>
                        {selectedRegistration.producer.user.name ?? "Non renseigné"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>EMAIL</span>
                      <a
                        href={`mailto:${selectedRegistration.producer.user.email}`}
                        style={{ color: "var(--n-accent)" }}
                        className="hover:underline"
                      >
                        {selectedRegistration.producer.user.email}
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>TÉLÉPHONE</span>
                      {selectedRegistration.producer.phone ? (
                        <a
                          href={`tel:${selectedRegistration.producer.phone}`}
                          style={{ color: "var(--n-accent)" }}
                          className="hover:underline"
                        >
                          {formatPhone(selectedRegistration.producer.phone)}
                        </a>
                      ) : (
                        <span style={{ color: "var(--n-text-disabled)" }}>Non renseigné</span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${selectedRegistration.producer.user.email}`} className="n-label">
                      Envoyer un email
                    </a>
                  </Button>
                </div>

                {/* Products by Category */}
                <div className="space-y-3">
                  <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                    PRODUITS ({selectedRegistration.productCount})
                  </p>
                  <div className="space-y-2">
                    {groupProductsByCategory(selectedRegistration.products).map(
                      ({ category, products }) => (
                        <Collapsible key={category.id} defaultOpen>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-between h-auto py-2"
                              style={{ border: "1px solid var(--n-border)" }}
                            >
                              <span style={{ fontWeight: 500, color: "var(--n-text-primary)" }}>
                                {category.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="n-tag">{products.length}</span>
                                <ChevronDown className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                              </div>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div style={{ paddingLeft: "16px" }} className="space-y-2 py-2">
                              {products.map((product) => {
                                const pStatusConfig =
                                  productStatusConfig[
                                    product.status as keyof typeof productStatusConfig
                                  ] ?? productStatusConfig.pending;
                                return (
                                  <div
                                    key={product.id}
                                    className="flex items-center justify-between"
                                  >
                                    <span style={{ color: "var(--n-text-primary)" }}>
                                      {product.name}
                                    </span>
                                    <span style={{
                                      fontFamily: "'Space Mono', monospace",
                                      fontSize: "10px",
                                      letterSpacing: "0.06em",
                                      textTransform: "uppercase",
                                      fontWeight: 700,
                                      color: pStatusConfig.color,
                                      border: `1px solid ${pStatusConfig.color}`,
                                      borderRadius: "4px",
                                      padding: "2px 6px",
                                    }}>
                                      {pStatusConfig.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )
                    )}
                  </div>
                </div>

                {/* Registration Date */}
                <div style={{ paddingTop: "16px", borderTop: "1px solid var(--n-border-visible)" }}>
                  <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
                    Inscrit le{" "}
                    {format(new Date(selectedRegistration.createdAt), "dd MMMM yyyy 'à' HH:mm", {
                      locale: fr,
                    })}
                  </p>
                </div>
              </div>

              {/* Suppression : jamais pour une inscription payée (facture à conserver) */}
              {selectedRegistration.checkout.state !== "paid" && (
                <div
                  className="space-y-2"
                  style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--n-border)" }}
                >
                  <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                    Supprime l&apos;inscription et ses {selectedRegistration.productCount} produit
                    {selectedRegistration.productCount !== 1 ? "s" : ""}. Le compte du producteur
                    est conservé.
                  </p>
                  {!confirmDelete ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      style={{ color: "var(--n-accent)", borderColor: "var(--n-accent)" }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer l&apos;inscription
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={deleteRegistration.isPending}
                        onClick={() =>
                          deleteRegistration.mutate({ registrationId: selectedRegistration.id })
                        }
                        style={{ background: "var(--n-accent)", color: "var(--n-text-display)" }}
                      >
                        {deleteRegistration.isPending ? "Suppression…" : "Confirmer la suppression"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                        Annuler
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
