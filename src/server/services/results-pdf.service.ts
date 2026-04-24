/**
 * Results PDF Generation Service - Story 8.4
 * Generates synthesis PDFs with horizontal bar charts for product results
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Image,
  Svg,
  Path,
} from "@react-pdf/renderer";
import { db } from "~/server/db";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { formatScoreForScale, getMaxScoreForScale } from "~/lib/validations/labels";
import { formatTerpeneAroma } from "~/lib/lab-analysis/terpene-sensory";
import path from "path";
import { existsSync } from "fs";

// PDF Styles - A4 compact: 1 product = 1 page, 28pt padding, 539pt usable width
const styles = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 36,
    fontSize: 8,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#f59e0b",
  },
  cupTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "right",
  },
  cupSubtitle: {
    fontSize: 8,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 2,
  },
  introSection: {
    backgroundColor: "#fef3c7",
    padding: 8,
    borderRadius: 3,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  introText: {
    fontSize: 8,
    color: "#92400e",
    lineHeight: 1.3,
  },
  productHeader: {
    backgroundColor: "#111827",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  productName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
  },
  productCategory: {
    fontSize: 8,
    color: "#d1d5db",
    marginTop: 2,
  },
  resultsBanner: {
    flexDirection: "row",
    marginBottom: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  resultBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopWidth: 2,
    borderTopColor: "#f59e0b",
  },
  resultBoxDivider: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopWidth: 2,
    borderTopColor: "#f59e0b",
    borderLeftWidth: 1,
    borderLeftColor: "#e5e7eb",
  },
  resultLabel: {
    fontSize: 6.5,
    color: "#6b7280",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  resultValueAmber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f59e0b",
  },
  labelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginTop: 2,
  },
  labelText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
  },
  detailsTable: {
    marginTop: 4,
  },
  tableTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 2,
    borderBottomColor: "#f59e0b",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 3,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
  },
  tableCell: {
    fontSize: 8,
    color: "#1f2937",
  },
  criterionCol: {
    width: "38%",
  },
  scoreCol: {
    width: "14%",
    textAlign: "center",
  },
  avgCol: {
    width: "14%",
    textAlign: "center",
  },
  diffCol: {
    width: "14%",
    textAlign: "right",
  },
  barCol: {
    width: "20%",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  criterionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  criterionRowAlt: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  miniBarContainer: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    position: "relative",
    width: 80,
  },
  miniBarFillAbove: {
    height: 6,
    borderRadius: 2,
    backgroundColor: "#f59e0b",
  },
  miniBarFillBelow: {
    height: 6,
    borderRadius: 2,
    backgroundColor: "#9ca3af",
  },
  miniBarAvgMarker: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: "#374151",
  },
  positiveScore: {
    color: "#059669",
    fontWeight: "bold",
  },
  negativeScore: {
    color: "#b91c1c",
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
});

// Result data interface
/**
 * Lab analysis section attached to a product PDF page.
 * Populated from the lab_analyses table when a SpectralFingerprints
 * certificate has been uploaded and confirmed for this product.
 */
export interface ProductLabAnalysisPdfData {
  labName: string;
  analysisNumber: string | null;
  approvedAt: string | null;
  // Terpenes total (number, already parsed from pg numeric string)
  terpenesTotal: number | null;
  // Every measured terpene (flag=value), sorted by percentage desc. The
  // render layer picks top 10 for the horizontal bar chart and top 8 +
  // an aggregated "Autres" slice for the pie chart.
  terpenes: Array<{ abbreviation: string; name: string; percentage: number }>;
  // Category comparison (anonymized): rank / total having an analysis
  terpeneRank: number | null;
  terpeneRankOutOf: number;
  categoryTerpeneAverage: number | null;
}

export interface ProductResultData {
  productId: string;
  productName: string;
  categoryName: string;
  anonymousCode: string | null;
  finalScore: number | null;
  categoryRank: number | null;
  totalInCategory: number;
  percentile: number | null;
  label: {
    name: string;
    color: string;
  } | null;
  criteriaScores: Array<{
    criterionName: string;
    criterionDescription: string | null;
    coefficient: number;
    productScore: number | null;
    categoryAverage: number | null;
  }>;
  juryComments: string[];
  ratingScale: "0-5" | "0-10" | "0-20" | "0-100";
  /** Optional lab analysis section — rendered as a 2nd page when present. */
  labAnalysis: ProductLabAnalysisPdfData | null;
}

export interface SynthesisPdfData {
  cupName: string;
  cupId: string;
  organizationName: string;
  pdfLogoUrl: string | null;
  organizationLogoUrl: string | null;
  pdfIntroText: string | null;
  producerName: string;
  producerBrand: string | null;
  products: ProductResultData[];
  generatedAt: Date;
}

/**
 * Create a mini horizontal bar for a criterion row.
 * Uses nested Views (react-pdf compatible, no SVG overflow issues).
 * barWidth: total width of the bar track in pts.
 */
function createMiniBar(
  productScore: number | null,
  categoryAvg: number | null,
  maxScore: number,
  barWidth: number = 100
): React.ReactElement {
  const productFillWidth =
    productScore !== null ? Math.max(0, Math.min(1, productScore / maxScore)) * barWidth : 0;
  const avgMarkerLeft =
    categoryAvg !== null ? Math.max(0, Math.min(1, categoryAvg / maxScore)) * barWidth - 1 : null;

  return React.createElement(
    View,
    { style: [styles.miniBarContainer, { width: barWidth }] },
    // Product score fill (amber if above avg, gray if below)
    productScore !== null
      ? React.createElement(View, {
          style: [
            categoryAvg !== null && productScore >= categoryAvg
              ? styles.miniBarFillAbove
              : styles.miniBarFillBelow,
            { width: productFillWidth },
          ],
        })
      : null,
    // Dark gray avg marker (absolute)
    avgMarkerLeft !== null
      ? React.createElement(View, {
          style: [styles.miniBarAvgMarker, { left: avgMarkerLeft }],
        })
      : null
  );
}

/**
 * Create product result page - compact layout: 1 product = 1 page A4
 */
function createProductPage(
  product: ProductResultData,
  cupName: string,
  introText: string | null,
  logoUrl: string | null,
  organizationName: string
) {
  const maxScore = getMaxScoreForScale(product.ratingScale);

  return React.createElement(
    Page,
    { key: product.productId, size: "A4", style: styles.page },
    // Header
    React.createElement(
      View,
      { style: styles.header },
      logoUrl
        ? React.createElement(
            View,
            { style: { width: 240, height: 80, alignItems: "flex-start", justifyContent: "center" } },
            React.createElement(Image, {
              src: logoUrl,
              style: { maxWidth: 240, maxHeight: 80, objectFit: "contain" as const },
            })
          )
        : React.createElement(
            View,
            { style: { backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 3 } },
            React.createElement(
              Text,
              { style: { fontSize: 13, fontWeight: "bold", color: "#ffffff" } },
              organizationName
            )
          ),
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: styles.cupTitle }, cupName),
        React.createElement(Text, { style: styles.cupSubtitle }, "Synthèse des résultats")
      )
    ),
    // Intro text (compact)
    introText
      ? React.createElement(
          View,
          { style: styles.introSection },
          React.createElement(Text, { style: styles.introText }, introText)
        )
      : null,
    // Product header
    React.createElement(
      View,
      { style: styles.productHeader },
      React.createElement(Text, { style: styles.productName }, product.productName),
      React.createElement(
        Text,
        { style: styles.productCategory },
        `Catégorie: ${product.categoryName}${product.anonymousCode ? ` • Code: ${product.anonymousCode}` : ""}`
      )
    ),
    // Results banner (compact)
    React.createElement(
      View,
      { style: styles.resultsBanner },
      React.createElement(
        View,
        { style: styles.resultBox },
        React.createElement(Text, { style: styles.resultLabel }, "Score Final"),
        React.createElement(
          Text,
          { style: styles.resultValueAmber },
          product.finalScore !== null
            ? formatScoreForScale(product.finalScore, product.ratingScale)
            : "N/A"
        )
      ),
      React.createElement(
        View,
        { style: styles.resultBoxDivider },
        React.createElement(Text, { style: styles.resultLabel }, "Classement"),
        React.createElement(
          Text,
          { style: styles.resultValue },
          product.categoryRank !== null
            ? `${product.categoryRank}/${product.totalInCategory}`
            : "N/A"
        )
      ),
      React.createElement(
        View,
        { style: styles.resultBoxDivider },
        React.createElement(Text, { style: styles.resultLabel }, "Performance"),
        React.createElement(
          Text,
          { style: styles.resultValue },
          product.percentile !== null ? `Top ${100 - product.percentile}%` : "N/A"
        ),
        product.percentile !== null
          ? React.createElement(
              Text,
              { style: { fontSize: 6.5, color: "#6b7280", marginTop: 1, textAlign: "center" } },
              `Surpasse ${product.percentile}% des produits`
            )
          : null
      ),
      React.createElement(
        View,
        { style: styles.resultBoxDivider },
        React.createElement(Text, { style: styles.resultLabel }, "Label"),
        product.label
          ? React.createElement(
              View,
              { style: [styles.labelBadge, { backgroundColor: product.label.color }] },
              React.createElement(Text, { style: styles.labelText }, product.label.name)
            )
          : React.createElement(Text, { style: { fontSize: 9, color: "#9ca3af" } }, "Aucun")
      )
    ),
    // Details table - single row per criterion
    React.createElement(
      View,
      { style: styles.detailsTable },
      React.createElement(Text, { style: styles.tableTitle }, "Détail des notes par critère"),
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.criterionCol] }, "Critère"),
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.scoreCol] }, "Note"),
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.avgCol] }, "Moy."),
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.diffCol] }, "Écart"),
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.barCol] }, "")
      ),
      ...product.criteriaScores.map((criterion, index) => {
        const diff =
          criterion.productScore !== null && criterion.categoryAverage !== null
            ? criterion.productScore - criterion.categoryAverage
            : null;

        return React.createElement(
          View,
          { key: index, style: index % 2 === 1 ? styles.criterionRowAlt : styles.criterionRow },
          React.createElement(
            View,
            { style: styles.criterionCol },
            React.createElement(
              Text,
              { style: { fontSize: 8, color: "#1f2937" } },
              `${criterion.criterionName} (x${criterion.coefficient})`
            ),
            criterion.criterionDescription
              ? React.createElement(
                  Text,
                  { style: { fontSize: 6.5, color: "#6b7280", fontFamily: "Helvetica-Oblique", lineHeight: 1.2 } },
                  criterion.criterionDescription
                )
              : null
          ),
          React.createElement(
            Text,
            { style: [styles.tableCell, styles.scoreCol, { fontWeight: "bold" }] },
            criterion.productScore !== null ? criterion.productScore.toFixed(1) : "N/A"
          ),
          React.createElement(
            Text,
            { style: [styles.tableCell, styles.avgCol] },
            criterion.categoryAverage !== null ? criterion.categoryAverage.toFixed(1) : "N/A"
          ),
          React.createElement(
            Text,
            {
              style: [
                styles.tableCell,
                styles.diffCol,
                diff !== null && diff > 0 ? styles.positiveScore : diff !== null && diff < 0 ? styles.negativeScore : {},
              ],
            },
            diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "-"
          ),
          React.createElement(
            View,
            { style: styles.barCol },
            createMiniBar(criterion.productScore, criterion.categoryAverage, maxScore, 80)
          )
        );
      })
    ),
    // Jury comments (compact)
    product.juryComments.length > 0
      ? React.createElement(
          View,
          { style: { marginTop: 8 } },
          React.createElement(
            Text,
            {
              style: {
                fontSize: 8,
                fontWeight: "bold",
                color: "#1f2937",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 4,
                paddingBottom: 3,
                borderBottomWidth: 2,
                borderBottomColor: "#f59e0b",
              },
            },
            `Commentaires des jurys (${product.juryComments.length})`
          ),
          ...product.juryComments.map((comment, index) =>
            React.createElement(
              View,
              {
                key: `comment-${index}`,
                style: {
                  flexDirection: "row",
                  paddingVertical: 3,
                  paddingHorizontal: 6,
                  backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                },
              },
              React.createElement(
                Text,
                { style: { fontSize: 7, fontWeight: "bold", color: "#f59e0b", width: 36 } },
                `Jury ${index + 1}`
              ),
              React.createElement(
                Text,
                { style: { fontSize: 7.5, fontFamily: "Helvetica-Oblique", color: "#374151", flex: 1, lineHeight: 1.3 } },
                `« ${comment} »`
              )
            )
          )
        )
      : null,
    // Footer
    React.createElement(
      View,
      { style: styles.footer },
      React.createElement(Text, { style: styles.footerText }, "Document généré automatiquement par CupMetrics"),
      React.createElement(
        Text,
        { style: styles.footerText },
        new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
      )
    )
  );
}

/**
 * Color palette for pie chart slices — 20 visually distinct hues so every
 * terpene from an SFP certificate (typically ~19 quantified) gets its own
 * slice without needing an aggregate "Autres" bucket. Ordered so the brand
 * amber is on top.
 */
const PIE_COLORS = [
  "#f59e0b", // amber (primary, top terpene)
  "#3b82f6", // blue
  "#10b981", // emerald
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#22c55e", // green
  "#eab308", // yellow
  "#d946ef", // fuchsia
  "#0ea5e9", // sky
  "#dc2626", // red
  "#ca8a04", // yellow-600
  "#7c3aed", // violet-600
  "#059669", // emerald-600
  "#be185d", // pink-700
  "#64748b", // slate
];

type PieSlice = {
  label: string;
  fullName: string;
  percentage: number;
  color: string;
};

/**
 * Build one pie slice per measured terpene. Colors cycle through the
 * palette if there are more terpenes than colors (rare but safe).
 */
function buildPieSlices(
  terpenes: Array<{ abbreviation: string; name: string; percentage: number }>,
): PieSlice[] {
  return terpenes.map((t, i) => ({
    label: t.abbreviation,
    fullName: t.name,
    percentage: t.percentage,
    color: PIE_COLORS[i % PIE_COLORS.length]!,
  }));
}

/**
 * Compute an SVG arc path for a pie slice. `startAngle` and `endAngle`
 * are in degrees clockwise from 12 o'clock (top). Returns an M/L/A/Z
 * path string usable with @react-pdf/renderer's <Path>.
 */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  // Full circle (single slice) — approximate with two half arcs so SVG
  // doesn't collapse the path.
  if (endAngle - startAngle >= 359.99) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startAngle));
  const sy = cy + r * Math.sin(toRad(startAngle));
  const ex = cx + r * Math.cos(toRad(endAngle));
  const ey = cy + r * Math.sin(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} Z`;
}

/**
 * Create the optional lab analysis page for a product. Rendered as a 2nd
 * A4 page right after the main result page when the product has a
 * SpectralFingerprints certificate uploaded.
 *
 * Layout:
 *   - Header (reuses the cup bar look of the main page)
 *   - Product header strip (same visual as main page)
 *   - Single "Terpènes total" card
 *   - Pie chart (repartition of terpenes) + legend, side-by-side
 *   - Terpene profile: horizontal bars (top 10)
 *   - Comparison block: rank + category average + delta (NO top 3 — the
 *     producer must not see other competitors' scores)
 *   - Footer identical to main page
 */
function createLabAnalysisPage(
  product: ProductResultData,
  cupName: string,
  logoUrl: string | null,
  organizationName: string,
) {
  const la = product.labAnalysis;
  if (!la) return null;

  // Bar chart input: every measured terpene so the producer sees the full
  // profile of their flower. The SFP certificate typically lists ~19
  // quantified compounds which still comfortably fit on A4 portrait.
  const barTerpenes = la.terpenes;
  // Scale for bars: highest value in the list (or 0.5% as a sensible floor)
  const maxTerp = Math.max(0.5, ...barTerpenes.map((t) => t.percentage));

  // Pie chart slices (one per measured terpene, no aggregation)
  const pieSlices = buildPieSlices(la.terpenes);
  const pieTotal = pieSlices.reduce((acc, s) => acc + s.percentage, 0);

  const createTotalCard = (
    label: string,
    value: number | null,
    accent = false,
  ) =>
    React.createElement(
      View,
      {
        style: {
          flex: 1,
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 4,
          borderWidth: 1,
          borderColor: accent ? "#f59e0b" : "#e5e7eb",
          borderRadius: 4,
          backgroundColor: accent ? "#fffbeb" : "#f9fafb",
          marginHorizontal: 2,
        },
      },
      React.createElement(
        Text,
        {
          style: {
            fontSize: 6.5,
            color: "#6b7280",
            marginBottom: 3,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          },
        },
        label,
      ),
      React.createElement(
        Text,
        {
          style: {
            fontSize: 14,
            fontWeight: "bold",
            color: accent ? "#f59e0b" : "#111827",
          },
        },
        value === null ? "—" : `${value.toFixed(2)}%`,
      ),
    );

  const terpeneBar = (
    abbr: string,
    name: string,
    pct: number,
    index: number,
  ) => {
    const barWidth = 150;
    const fillWidth = Math.max(2, (pct / maxTerp) * barWidth);
    const aroma = formatTerpeneAroma(abbr);
    return React.createElement(
      View,
      {
        key: abbr,
        style: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 1.5,
          paddingHorizontal: 6,
          backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
        },
      },
      React.createElement(
        Text,
        {
          style: {
            fontSize: 7.5,
            fontWeight: "bold",
            color: "#111827",
            width: 46,
          },
        },
        abbr,
      ),
      React.createElement(
        Text,
        {
          style: {
            fontSize: 7,
            color: "#4b5563",
            width: 100,
          },
        },
        name,
      ),
      // Bar track
      React.createElement(
        View,
        {
          style: {
            width: barWidth,
            height: 7,
            backgroundColor: "#e5e7eb",
            borderRadius: 2,
          },
        },
        React.createElement(View, {
          style: {
            width: fillWidth,
            height: 7,
            backgroundColor: "#f59e0b",
            borderRadius: 2,
          },
        }),
      ),
      React.createElement(
        Text,
        {
          style: {
            fontSize: 7.5,
            fontWeight: "bold",
            color: "#111827",
            marginLeft: 6,
            width: 32,
            textAlign: "right",
          },
        },
        `${pct.toFixed(2)}%`,
      ),
      // Aroma keywords (italic gray on the right)
      React.createElement(
        Text,
        {
          style: {
            fontSize: 6.5,
            fontFamily: "Helvetica-Oblique",
            color: "#6b7280",
            marginLeft: 6,
            flex: 1,
          },
        },
        aroma,
      ),
    );
  };

  return React.createElement(
    Page,
    { key: `${product.productId}-lab`, size: "A4", style: styles.page },
    // Header (cup title + logo) — same look as main page
    React.createElement(
      View,
      { style: styles.header },
      logoUrl
        ? React.createElement(
            View,
            {
              style: {
                width: 240,
                height: 80,
                alignItems: "flex-start",
                justifyContent: "center",
              },
            },
            React.createElement(Image, {
              src: logoUrl,
              style: { maxWidth: 240, maxHeight: 80, objectFit: "contain" },
            }),
          )
        : React.createElement(
            Text,
            { style: styles.cupTitle },
            organizationName,
          ),
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: styles.cupTitle }, cupName),
        React.createElement(
          Text,
          { style: styles.cupSubtitle },
          "Analyse de laboratoire",
        ),
      ),
    ),

    // Product header strip
    React.createElement(
      View,
      { style: styles.productHeader },
      React.createElement(
        Text,
        { style: styles.productName },
        product.anonymousCode
          ? `${product.anonymousCode} — ${product.productName}`
          : product.productName,
      ),
      React.createElement(
        Text,
        { style: styles.productCategory },
        `${product.categoryName} • ${la.labName}${
          la.analysisNumber ? ` • N° ${la.analysisNumber}` : ""
        }${la.approvedAt ? ` • Approuvée le ${la.approvedAt}` : ""}`,
      ),
    ),

    // Terpene total headline
    React.createElement(
      View,
      {
        style: {
          flexDirection: "row",
          marginBottom: 12,
        },
      },
      createTotalCard("Terpènes total", la.terpenesTotal, true),
    ),

    // Pie chart + legend (repartition of the flower's terpenes)
    pieSlices.length > 0
      ? React.createElement(
          View,
          {
            style: {
              flexDirection: "row",
              alignItems: "flex-start",
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 4,
              padding: 8,
              marginBottom: 10,
            },
          },
          // SVG pie chart
          React.createElement(
            View,
            { style: { width: 160, height: 160 } },
            (() => {
              const size = 160;
              const cx = size / 2;
              const cy = size / 2;
              const r = 72;
              let cursor = 0;
              const paths: React.ReactElement[] = [];
              for (const slice of pieSlices) {
                const sliceAngle = (slice.percentage / pieTotal) * 360;
                const d = arcPath(cx, cy, r, cursor, cursor + sliceAngle);
                paths.push(
                  React.createElement(Path, {
                    key: slice.label,
                    d,
                    fill: slice.color,
                    stroke: "#ffffff",
                    strokeWidth: 1,
                  }),
                );
                cursor += sliceAngle;
              }
              return React.createElement(
                Svg,
                { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
                ...paths,
              );
            })(),
          ),
          // Legend
          React.createElement(
            View,
            { style: { flex: 1, marginLeft: 14 } },
            React.createElement(
              Text,
              {
                style: {
                  fontSize: 9,
                  fontWeight: "bold",
                  color: "#111827",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                },
              },
              "Répartition des terpènes",
            ),
            ...pieSlices.map((slice) =>
              React.createElement(
                View,
                {
                  key: `leg-${slice.label}`,
                  style: {
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 0.3,
                  },
                },
                React.createElement(View, {
                  style: {
                    width: 8,
                    height: 8,
                    backgroundColor: slice.color,
                    borderRadius: 2,
                    marginRight: 5,
                  },
                }),
                React.createElement(
                  Text,
                  {
                    style: {
                      fontSize: 7,
                      fontWeight: "bold",
                      color: "#111827",
                      width: 44,
                    },
                  },
                  slice.label,
                ),
                React.createElement(
                  Text,
                  {
                    style: {
                      fontSize: 7,
                      color: "#4b5563",
                      flex: 1,
                    },
                  },
                  slice.fullName,
                ),
                React.createElement(
                  Text,
                  {
                    style: {
                      fontSize: 7,
                      fontFamily: "Helvetica-Bold",
                      color: "#111827",
                      marginLeft: 4,
                    },
                  },
                  `${((slice.percentage / pieTotal) * 100).toFixed(1)}%`,
                ),
              ),
            ),
          ),
        )
      : null,

    // Terpene profile title
    React.createElement(
      Text,
      {
        style: {
          fontSize: 9,
          fontWeight: "bold",
          color: "#111827",
          marginBottom: 4,
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
      },
      "Profil terpénique détaillé",
    ),

    // Terpene bars
    barTerpenes.length > 0
      ? React.createElement(
          View,
          {
            style: {
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 4,
              marginBottom: 12,
              overflow: "hidden",
            },
          },
          ...barTerpenes.map((t, i) =>
            terpeneBar(t.abbreviation, t.name, t.percentage, i),
          ),
        )
      : React.createElement(
          Text,
          { style: { fontSize: 8, color: "#6b7280", marginBottom: 12 } },
          "Aucun terpène quantifié.",
        ),

    // Category comparison block — rank + average + delta. No competitor
    // scores are leaked: the producer only sees their own total, the
    // anonymous category average and where they rank within it.
    (() => {
      const delta =
        la.terpenesTotal !== null && la.categoryTerpeneAverage !== null
          ? la.terpenesTotal - la.categoryTerpeneAverage
          : null;
      const deltaColor =
        delta === null ? "#6b7280" : delta >= 0 ? "#10b981" : "#ef4444";
      const deltaLabel =
        delta === null
          ? "—"
          : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% vs moyenne`;

      return React.createElement(
        View,
        {
          style: {
            backgroundColor: "#f3f4f6",
            borderRadius: 4,
            padding: 10,
            marginBottom: 12,
          },
        },
        React.createElement(
          Text,
          {
            style: {
              fontSize: 9,
              fontWeight: "bold",
              color: "#111827",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            },
          },
          "Positionnement dans la catégorie",
        ),
        React.createElement(
          View,
          { style: { flexDirection: "row" } },
          React.createElement(
            View,
            { style: { flex: 1 } },
            React.createElement(
              Text,
              { style: { fontSize: 7, color: "#6b7280" } },
              "Votre total",
            ),
            React.createElement(
              Text,
              {
                style: { fontSize: 14, fontWeight: "bold", color: "#f59e0b" },
              },
              la.terpenesTotal !== null
                ? `${la.terpenesTotal.toFixed(2)}%`
                : "—",
            ),
          ),
          React.createElement(
            View,
            { style: { flex: 1 } },
            React.createElement(
              Text,
              { style: { fontSize: 7, color: "#6b7280" } },
              "Moyenne catégorie",
            ),
            React.createElement(
              Text,
              {
                style: { fontSize: 14, fontWeight: "bold", color: "#111827" },
              },
              la.categoryTerpeneAverage !== null
                ? `${la.categoryTerpeneAverage.toFixed(2)}%`
                : "—",
            ),
          ),
          React.createElement(
            View,
            { style: { flex: 1 } },
            React.createElement(
              Text,
              { style: { fontSize: 7, color: "#6b7280" } },
              "Rang",
            ),
            React.createElement(
              Text,
              {
                style: { fontSize: 14, fontWeight: "bold", color: "#111827" },
              },
              la.terpeneRank !== null
                ? `${la.terpeneRank} / ${la.terpeneRankOutOf}`
                : "—",
            ),
          ),
          React.createElement(
            View,
            { style: { flex: 1.3 } },
            React.createElement(
              Text,
              { style: { fontSize: 7, color: "#6b7280" } },
              "Écart à la moyenne",
            ),
            React.createElement(
              Text,
              {
                style: { fontSize: 12, fontWeight: "bold", color: deltaColor },
              },
              deltaLabel,
            ),
          ),
        ),
      );
    })(),

    // Footer
    React.createElement(
      View,
      { style: styles.footer },
      React.createElement(
        Text,
        { style: styles.footerText },
        "Analyse fournie par le laboratoire · Document généré par CupMetrics",
      ),
      React.createElement(
        Text,
        { style: styles.footerText },
        new Date().toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
      ),
    ),
  );
}

/**
 * Resolve a logo URL to a source usable by react-pdf (only supports JPG/PNG).
 * For local uploads (/uploads/...), resolve to filesystem path and use .png version.
 * For external URLs, pass through (must be JPG/PNG).
 */
function resolveLogoForPdf(url: string | null): string | null {
  if (!url) return null;

  // External absolute URL - pass through but reject webp
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.endsWith(".webp")) return url.replace(/\.webp$/, ".png");
    return url;
  }

  // Local upload path (e.g. /uploads/logos/xxx.webp) - resolve to filesystem
  const pngPath = url.endsWith(".webp") ? url.replace(/\.webp$/, ".png") : url;
  const fsPath = path.join(process.cwd(), "public", pngPath);

  if (existsSync(fsPath)) {
    return fsPath;
  }

  // Fallback: try the original path as filesystem
  const originalFsPath = path.join(process.cwd(), "public", url);
  if (existsSync(originalFsPath) && !url.endsWith(".webp")) {
    return originalFsPath;
  }

  return null;
}

/**
 * Create the synthesis PDF document
 */
function createSynthesisDocument(data: SynthesisPdfData) {
  // Use pdfLogoUrl if set, otherwise fall back to organization logo
  const logoUrl = resolveLogoForPdf(data.pdfLogoUrl) ?? resolveLogoForPdf(data.organizationLogoUrl);

  // For each product we emit the standard result page, followed by an
  // optional lab analysis page when a certificate has been uploaded.
  const pages: React.ReactElement[] = [];
  for (const product of data.products) {
    pages.push(
      createProductPage(
        product,
        data.cupName,
        data.pdfIntroText,
        logoUrl,
        data.organizationName,
      ),
    );
    const labPage = createLabAnalysisPage(
      product,
      data.cupName,
      logoUrl,
      data.organizationName,
    );
    if (labPage) pages.push(labPage);
  }

  return React.createElement(
    Document,
    null,
    ...pages,
  ) as Parameters<typeof renderToBuffer>[0];
}

/**
 * Compute weighted average score for a product from its criteriaScores array.
 * Returns null if no scored criteria exist.
 */
function computeWeightedAvg(
  criteriaScores: Array<{ productScore: number | null; coefficient: number }>
): number | null {
  const scored = criteriaScores.filter((c) => c.productScore !== null);
  if (scored.length === 0) return null;
  const totalCoeff = scored.reduce((sum, c) => sum + c.coefficient, 0);
  if (totalCoeff === 0) return null;
  return scored.reduce((sum, c) => sum + c.productScore! * c.coefficient, 0) / totalCoeff;
}

/**
 * Get product result data for PDF generation
 */
export async function getProductResultsForPdf(
  productId: string
): Promise<ProductResultData | null> {
  // Get product with all related data
  const product = await db.query.products.findFirst({
    where: eq(schema.products.id, productId),
    with: {
      category: {
        with: {
          criteria: true,
        },
      },
      label: true,
      registration: {
        with: {
          cup: true,
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  const cup = product.registration.cup;

  // Load lab analysis (may be null) for the 2nd PDF page.
  const labAnalysisRow = await db.query.labAnalyses.findFirst({
    where: eq(schema.labAnalyses.productId, productId),
  });

  // Sort criteria by sortOrder to respect organizer's grouping
  const sortedCriteria = [...product.category.criteria].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  // Batch queries: get ALL scores in parallel instead of N+1 per criterion
  const [allProductScores, allCategoryScores, siblingProductIds, ratingsWithComments] = await Promise.all([
    // All criterion scores for this product
    db
      .select({
        criterionId: schema.criterionScores.criterionId,
        score: schema.criterionScores.score,
      })
      .from(schema.criterionScores)
      .innerJoin(
        schema.productRatings,
        eq(schema.criterionScores.productRatingId, schema.productRatings.id)
      )
      .where(
        and(
          eq(schema.productRatings.productId, productId),
          isNotNull(schema.productRatings.submittedAt)
        )
      ),
    // All category average scores
    db
      .select({
        criterionId: schema.criterionScores.criterionId,
        score: schema.criterionScores.score,
      })
      .from(schema.criterionScores)
      .innerJoin(
        schema.productRatings,
        eq(schema.criterionScores.productRatingId, schema.productRatings.id)
      )
      .innerJoin(schema.products, eq(schema.productRatings.productId, schema.products.id))
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .where(
        and(
          eq(schema.products.categoryId, product.categoryId),
          eq(schema.registrations.cupId, cup.id),
          isNotNull(schema.productRatings.submittedAt)
        )
      ),
    // Sibling products in same category (for rank calculation)
    db
      .select({ id: schema.products.id })
      .from(schema.products)
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .where(
        and(
          eq(schema.products.categoryId, product.categoryId),
          eq(schema.registrations.cupId, cup.id),
          isNotNull(schema.products.anonymousCode)
        )
      ),
    // Jury comments
    db
      .select({ comment: schema.productRatings.comment })
      .from(schema.productRatings)
      .where(
        and(
          eq(schema.productRatings.productId, productId),
          isNotNull(schema.productRatings.submittedAt),
          isNotNull(schema.productRatings.comment)
        )
      ),
  ]);

  // Group product scores by criterion
  const productScoresByCriterion = new Map<string, number[]>();
  for (const s of allProductScores) {
    const arr = productScoresByCriterion.get(s.criterionId) ?? [];
    arr.push(s.score);
    productScoresByCriterion.set(s.criterionId, arr);
  }

  // Group category scores by criterion
  const categoryScoresByCriterion = new Map<string, number[]>();
  for (const s of allCategoryScores) {
    const arr = categoryScoresByCriterion.get(s.criterionId) ?? [];
    arr.push(s.score);
    categoryScoresByCriterion.set(s.criterionId, arr);
  }

  // Build criteria scores from grouped data (sorted by sortOrder)
  const criteriaScores: ProductResultData["criteriaScores"] = [];
  for (const criterion of sortedCriteria) {
    const scores = productScoresByCriterion.get(criterion.id) ?? [];
    const productScore =
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : null;

    const catScores = categoryScoresByCriterion.get(criterion.id) ?? [];
    const categoryAverage =
      catScores.length > 0
        ? catScores.reduce((sum, s) => sum + s, 0) / catScores.length
        : null;

    criteriaScores.push({
      criterionName: criterion.name,
      criterionDescription: criterion.description,
      coefficient: criterion.coefficient,
      productScore,
      categoryAverage,
    });
  }

  // --- Calculate finalScore on the fly ---
  const calculatedFinalScore = computeWeightedAvg(criteriaScores);
  const finalScore = product.finalScore
    ? parseFloat(product.finalScore)
    : calculatedFinalScore;

  const totalInCategory = siblingProductIds.length > 0 ? siblingProductIds.length : 1;

  // Compute rank: batch-fetch ALL criterion scores for ALL siblings in one query
  let categoryRank: number | null = product.categoryRank ?? null;
  if (categoryRank === null && finalScore !== null && siblingProductIds.length > 1) {
    const siblingIds = siblingProductIds.map((s) => s.id);

    // Single query for ALL sibling scores
    const allSiblingScores = await db
      .select({
        productId: schema.productRatings.productId,
        criterionId: schema.criterionScores.criterionId,
        score: schema.criterionScores.score,
      })
      .from(schema.criterionScores)
      .innerJoin(
        schema.productRatings,
        eq(schema.criterionScores.productRatingId, schema.productRatings.id)
      )
      .where(
        and(
          sql`${schema.productRatings.productId} IN ${siblingIds}`,
          isNotNull(schema.productRatings.submittedAt)
        )
      );

    // Group by product -> criterion -> scores
    const scoresByProduct = new Map<string, Map<string, number[]>>();
    for (const s of allSiblingScores) {
      let productMap = scoresByProduct.get(s.productId);
      if (!productMap) {
        productMap = new Map();
        scoresByProduct.set(s.productId, productMap);
      }
      const arr = productMap.get(s.criterionId) ?? [];
      arr.push(s.score);
      productMap.set(s.criterionId, arr);
    }

    // Compute weighted average for each sibling
    const siblingScores: Array<{ id: string; score: number | null }> = [];
    for (const sibling of siblingProductIds) {
      if (sibling.id === productId) {
        siblingScores.push({ id: sibling.id, score: finalScore });
        continue;
      }
      const productMap = scoresByProduct.get(sibling.id);
      const siblingCriteriaScores: Array<{ productScore: number | null; coefficient: number }> = [];
      for (const criterion of sortedCriteria) {
        const sScores = productMap?.get(criterion.id) ?? [];
        const sScore =
          sScores.length > 0
            ? sScores.reduce((sum, s) => sum + s, 0) / sScores.length
            : null;
        siblingCriteriaScores.push({ productScore: sScore, coefficient: criterion.coefficient });
      }
      siblingScores.push({
        id: sibling.id,
        score: computeWeightedAvg(siblingCriteriaScores),
      });
    }

    // Sort descending (nulls last), find 1-indexed rank
    const sorted = siblingScores
      .slice()
      .sort((a, b) => {
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score;
      });
    const rankIndex = sorted.findIndex((s) => s.id === productId);
    categoryRank = rankIndex >= 0 ? rankIndex + 1 : null;
  } else if (categoryRank === null && siblingProductIds.length <= 1) {
    categoryRank = finalScore !== null ? 1 : null;
  }

  const percentile =
    categoryRank !== null && totalInCategory > 0
      ? Math.round(((totalInCategory - categoryRank) / totalInCategory) * 100)
      : null;

  const juryComments = ratingsWithComments
    .map((r) => r.comment)
    .filter((c): c is string => c !== null && c.trim().length > 0);

  // ------------------------------------------------------------
  // Lab analysis section (optional)
  // ------------------------------------------------------------
  let labAnalysis: ProductLabAnalysisPdfData | null = null;
  if (labAnalysisRow) {
    // Fetch every lab analysis for sibling products in the same category so
    // we can compute rank, average and an anonymized top 3. We query through
    // products -> lab_analyses join to only pull analyses attached to this
    // cup+category.
    const siblingAnalyses = await db
      .select({
        productId: schema.labAnalyses.productId,
        anonymousCode: schema.products.anonymousCode,
        terpenesTotal: schema.labAnalyses.terpenesTotal,
        computedTerpeneSum: schema.labAnalyses.computedTerpeneSum,
      })
      .from(schema.labAnalyses)
      .innerJoin(
        schema.products,
        eq(schema.labAnalyses.productId, schema.products.id),
      )
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id),
      )
      .where(
        and(
          eq(schema.products.categoryId, product.categoryId),
          eq(schema.registrations.cupId, cup.id),
        ),
      );

    // Turn numeric strings into numbers and drop rows where we have no
    // usable terpene value at all.
    const siblingList = siblingAnalyses
      .map((s) => ({
        productId: s.productId,
        anonymousCode: s.anonymousCode,
        value:
          (s.terpenesTotal ? parseFloat(s.terpenesTotal) : null) ??
          (s.computedTerpeneSum ? parseFloat(s.computedTerpeneSum) : null),
      }))
      .filter(
        (s): s is { productId: string; anonymousCode: string | null; value: number } =>
          typeof s.value === "number",
      )
      .sort((a, b) => b.value - a.value);

    const myTerpeneValue =
      (labAnalysisRow.terpenesTotal ? parseFloat(labAnalysisRow.terpenesTotal) : null) ??
      (labAnalysisRow.computedTerpeneSum
        ? parseFloat(labAnalysisRow.computedTerpeneSum)
        : null);

    const myRankIndex = siblingList.findIndex((s) => s.productId === productId);
    const terpeneRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
    const terpeneRankOutOf = siblingList.length;

    const categoryTerpeneAverage =
      siblingList.length > 0
        ? siblingList.reduce((sum, s) => sum + s.value, 0) / siblingList.length
        : null;

    const terpenes = (labAnalysisRow.terpenes ?? [])
      .filter(
        (t): t is typeof t & { percentage: number } =>
          t.flag === "value" && typeof t.percentage === "number",
      )
      .sort((a, b) => b.percentage - a.percentage)
      .map((t) => ({
        abbreviation: t.abbreviation,
        name: t.name,
        percentage: t.percentage,
      }));

    labAnalysis = {
      labName: labAnalysisRow.labName,
      analysisNumber: labAnalysisRow.analysisNumber,
      approvedAt: labAnalysisRow.approvedAt,
      terpenesTotal: myTerpeneValue,
      terpenes,
      terpeneRank,
      terpeneRankOutOf,
      categoryTerpeneAverage:
        categoryTerpeneAverage !== null ? round2(categoryTerpeneAverage) : null,
    };
  }

  return {
    productId: product.id,
    productName: product.name,
    categoryName: product.category.name,
    anonymousCode: product.anonymousCode,
    finalScore,
    categoryRank,
    totalInCategory,
    percentile,
    label: product.label
      ? {
          name: product.label.name,
          color: product.label.color ?? "#888888",
        }
      : null,
    criteriaScores,
    juryComments,
    ratingScale: cup.ratingScale as "0-5" | "0-10" | "0-20" | "0-100",
    labAnalysis,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generate a synthesis PDF for a single product
 */
export async function generateProductSynthesisPdf(
  productId: string
): Promise<{ buffer: Buffer; filename: string }> {
  const productData = await getProductResultsForPdf(productId);

  if (!productData) {
    throw new Error(`Product not found: ${productId}`);
  }

  // Get cup and producer info (single-tenant: no organization table)
  const product = await db.query.products.findFirst({
    where: eq(schema.products.id, productId),
    with: {
      registration: {
        with: {
          cup: true,
          producer: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const cup = product.registration.cup;
  const producer = product.registration.producer;

  const pdfData: SynthesisPdfData = {
    cupName: cup.name,
    cupId: cup.id,
    organizationName: "Platinum CBD Cup",
    pdfLogoUrl: cup.pdfLogoUrl,
    organizationLogoUrl: null,
    pdfIntroText: cup.pdfIntroText,
    producerName: producer.companyName ?? "Producteur",
    producerBrand: producer.brandName,
    products: [productData],
    generatedAt: new Date(),
  };

  const pdfDocument = createSynthesisDocument(pdfData);
  const buffer = await renderToBuffer(pdfDocument);

  const sanitizedName = productData.productName
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();

  return {
    buffer: Buffer.from(buffer),
    filename: `synthese-${sanitizedName}-${new Date().toISOString().split("T")[0]}.pdf`,
  };
}

/**
 * Generate a synthesis PDF for all products of a producer in a cup
 */
export async function generateProducerSynthesisPdf(
  registrationId: string
): Promise<{ buffer: Buffer; filename: string }> {
  // Get registration with all products (single-tenant)
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    with: {
      cup: true,
      producer: true,
      products: {
        with: {
          category: true,
          label: true,
        },
      },
    },
  });

  if (!registration) {
    throw new Error(`Registration not found: ${registrationId}`);
  }

  // Get detailed data for each product
  const productsData: ProductResultData[] = [];
  for (const product of registration.products) {
    const productData = await getProductResultsForPdf(product.id);
    if (productData) {
      productsData.push(productData);
    }
  }

  if (productsData.length === 0) {
    throw new Error("No products with results found for this registration");
  }

  const pdfData: SynthesisPdfData = {
    cupName: registration.cup.name,
    cupId: registration.cup.id,
    organizationName: "Platinum CBD Cup",
    pdfLogoUrl: registration.cup.pdfLogoUrl,
    organizationLogoUrl: null,
    pdfIntroText: registration.cup.pdfIntroText,
    producerName: registration.producer.companyName ?? "Producteur",
    producerBrand: registration.producer.brandName,
    products: productsData,
    generatedAt: new Date(),
  };

  const pdfDocument = createSynthesisDocument(pdfData);
  const buffer = await renderToBuffer(pdfDocument);

  const sanitizedName = (registration.producer.companyName ?? "producteur")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();

  return {
    buffer: Buffer.from(buffer),
    filename: `synthese-${sanitizedName}-${new Date().toISOString().split("T")[0]}.pdf`,
  };
}
