"use client";

import dynamic from "next/dynamic";

/**
 * Enveloppe à chargement différé autour de <ProductRadarChart />.
 *
 * Recharts (+ ses dépendances d3) pèse ~410 Ko répartis sur 3 chunks. Importé
 * statiquement, il entrait dans le First Load JS de /producer/results et de
 * /dashboard/cups/[cupId]/results/details : les producteurs téléchargeaient
 * toute la librairie avant de voir le moindre score, alors que le radar est un
 * graphique secondaire situé sous la ligne de flottaison.
 *
 * SSR désactivé : ResponsiveContainer mesure son conteneur au montage et ne
 * rend rien d'utile côté serveur.
 */
export const ProductRadarChart = dynamic(
  () =>
    import("./product-radar-chart").then((m) => ({
      default: m.ProductRadarChart,
    })),
  {
    ssr: false,
    // Même hauteur que le ResponsiveContainer du graphique, pour éviter le
    // décalage de mise en page quand le chunk arrive.
    loading: () => (
      <div
        className="flex items-center justify-center rounded-lg bg-muted/30"
        style={{ height: 280 }}
        aria-hidden="true"
      >
        <span className="text-xs text-muted-foreground">
          Chargement du graphique…
        </span>
      </div>
    ),
  },
);
