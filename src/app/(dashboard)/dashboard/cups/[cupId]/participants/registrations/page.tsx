"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown } from "lucide-react";

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

// Registration status configuration
const registrationStatusConfig = {
  pending_payment: {
    label: "EN ATTENTE",
    color: "var(--n-warning)",
  },
  confirmed: {
    label: "CONFIRME",
    color: "var(--n-success)",
  },
  cancelled: {
    label: "ANNULE",
    color: "var(--n-accent)",
  },
};

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
}

export default function CupRegistrationsPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data: cup, isLoading: isCupLoading } = api.cup.getById.useQuery({ id: cupId });

  const { data: categories = [] } = api.category.list.useQuery(
    { cupId },
    { enabled: !!cup }
  );

  const { data: registrations = [], isLoading: isRegistrationsLoading } =
    api.registration.listByCup.useQuery(
      {
        cupId,
        status: statusFilter !== "all" ? (statusFilter as RegistrationStatus) : undefined,
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
    setIsSheetOpen(true);
  };

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

  if (!cup) {
    return null;
  }

  const confirmedCount = registrations.filter((r) => r.status === "confirmed").length;
  const pendingCount = registrations.filter((r) => r.status === "pending_payment").length;
  const totalProducts = registrations.reduce((sum, r) => sum + r.productCount, 0);

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
          <p className="n-label" style={{ marginBottom: "4px" }}>CONFIRMÉES</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "30px", fontWeight: 700, color: "var(--n-success)" }}>{confirmedCount}</p>
        </div>
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "16px" }}>
          <p className="n-label" style={{ marginBottom: "4px" }}>EN ATTENTE</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "30px", fontWeight: 700, color: "var(--n-warning)" }}>{pendingCount}</p>
        </div>
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "16px" }}>
          <p className="n-label" style={{ marginBottom: "4px" }}>PRODUITS</p>
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
          <div className="w-full sm:w-[180px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="confirmed">Confirmé</SelectItem>
                <SelectItem value="pending_payment">En attente</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
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
                    const statusConfig = registrationStatusConfig[registration.status];
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
                          <span style={{
                            fontFamily: "'Space Mono', monospace",
                            fontSize: "10px",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            color: statusConfig.color,
                            border: `1px solid ${statusConfig.color}`,
                            borderRadius: "4px",
                            padding: "2px 6px",
                          }}>
                            {statusConfig.label}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-primary)" }}>
                            {formatPrice(
                              registration.totalAmount,
                              (registration.currency as Currency) ?? "EUR"
                            )}
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
                <div className="flex items-center gap-3">
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: registrationStatusConfig[selectedRegistration.status].color,
                    border: `1px solid ${registrationStatusConfig[selectedRegistration.status].color}`,
                    borderRadius: "4px",
                    padding: "2px 6px",
                  }}>
                    {registrationStatusConfig[selectedRegistration.status].label}
                  </span>
                  <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}>
                    {formatPrice(
                      selectedRegistration.totalAmount,
                      (selectedRegistration.currency as Currency) ?? "EUR"
                    )}
                  </span>
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
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
