"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Upload, Users, Package, UserCheck, Info } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ImportProducers } from "./_components/import-producers";
import { ImportProducts } from "./_components/import-products";
import { ImportJurys } from "./_components/import-jurys";

export default function ImportPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const [activeTab, setActiveTab] = useState("producers");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>
          Importer des données
        </h1>
        <p className="n-label mt-1">Ajoutez rapidement vos participants existants via fichiers CSV</p>
      </div>

      {/* Info notice */}
      <div
        className="flex items-start gap-3 p-4 rounded-lg"
        style={{
          background: "var(--n-surface-raised)",
          border: "1px solid var(--n-border-visible)",
        }}
      >
        <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--n-text-secondary)" }} />
        <div className="space-y-1 text-sm">
          <p className="font-medium" style={{ color: "var(--n-text-primary)" }}>
            Importation depuis une compétition existante
          </p>
          <p style={{ color: "var(--n-text-secondary)" }}>
            Vous avez déjà organisé votre cup en dehors de CupMetrics ? Importez vos producteurs,
            produits et jurys pour utiliser la plateforme pour la notation.
          </p>
          <p style={{ color: "var(--n-text-secondary)" }}>
            <span style={{ color: "var(--n-text-primary)" }}>Ordre recommandé :</span>{" "}
            1. Catégories (manuellement) → 2. Producteurs → 3. Produits → 4. Jurys
          </p>
        </div>
      </div>

      {/* Import Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="producers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Producteurs</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Produits</span>
          </TabsTrigger>
          <TabsTrigger value="jurys" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Jurys</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="producers">
          <ImportProducers cupId={cupId} />
        </TabsContent>

        <TabsContent value="products">
          <ImportProducts cupId={cupId} />
        </TabsContent>

        <TabsContent value="jurys">
          <ImportJurys cupId={cupId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
