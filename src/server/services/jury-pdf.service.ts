/**
 * Jury PDF Synthesis Service
 * Generates PDF summaries of a jury's ratings with comparison to final scores
 * Includes code/variety/producer correspondence (only after cup completion)
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
} from "@react-pdf/renderer";
import { db } from "~/server/db";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { formatScoreForScale, getMaxScoreForScale } from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";
import { TRPCError } from "@trpc/server";
import path from "path";
import { existsSync } from "fs";

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
    borderBottomColor: "#6366f1",
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
  juryHeader: {
    backgroundColor: "#1e1b4b",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
  },
  juryName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
  },
  jurySubtext: {
    fontSize: 8,
    color: "#c7d2fe",
    marginTop: 2,
  },
  statsBanner: {
    flexDirection: "row",
    marginBottom: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopWidth: 2,
    borderTopColor: "#6366f1",
  },
  statBoxDivider: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopWidth: 2,
    borderTopColor: "#6366f1",
    borderLeftWidth: 1,
    borderLeftColor: "#e5e7eb",
  },
  statLabel: {
    fontSize: 6.5,
    color: "#6b7280",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  statValuePrimary: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6366f1",
  },
  categoryTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 8,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 2,
    borderBottomColor: "#6366f1",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 3,
  },
  tableHeaderCell: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableRowAlt: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  colRank: { width: "6%", textAlign: "center" },
  colCode: { width: "8%", textAlign: "center" },
  colProduct: { width: "26%" },
  colProducer: { width: "22%" },
  colJuryScore: { width: "12%", textAlign: "center" },
  colFinalScore: { width: "12%", textAlign: "center" },
  colDiff: { width: "10%", textAlign: "center" },
  cellText: {
    fontSize: 7.5,
    color: "#1f2937",
  },
  cellBold: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#1f2937",
  },
  positiveScore: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#059669",
  },
  negativeScore: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#b91c1c",
  },
  neutralScore: {
    fontSize: 7.5,
    color: "#6b7280",
  },
  labelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  labelText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#ffffff",
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
  legendSection: {
    marginTop: 6,
    marginBottom: 6,
    flexDirection: "row",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 7,
    color: "#6b7280",
  },
});

interface JuryPdfProduct {
  productId: string;
  productName: string;
  anonymousCode: string | null;
  categoryName: string;
  categoryId: string;
  categoryRank: number | null;
  producerName: string | null;
  producerBrand: string | null;
  juryScore: number | null;
  finalScore: number | null;
  difference: number | null;
  label: { name: string; color: string | null; icon: string | null } | null;
}

interface JuryPdfData {
  cupName: string;
  juryName: string;
  organizationName: string;
  ratingScale: "0-5" | "0-10" | "0-20" | "0-100";
  logoUrl: string | null;
  products: JuryPdfProduct[];
  stats: {
    totalProducts: number;
    ratedByJury: number;
    alignmentScore: number | null;
    averageDifference: number | null;
  };
  generatedAt: Date;
}

/**
 * Resolve a logo URL to a source usable by react-pdf
 */
function resolveLogoForPdf(url: string | null): string | null {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.endsWith(".webp")) return url.replace(/\.webp$/, ".png");
    return url;
  }

  const pngPath = url.endsWith(".webp") ? url.replace(/\.webp$/, ".png") : url;
  const fsPath = path.join(process.cwd(), "public", pngPath);

  if (existsSync(fsPath)) {
    return fsPath;
  }

  const originalFsPath = path.join(process.cwd(), "public", url);
  if (existsSync(originalFsPath) && !url.endsWith(".webp")) {
    return originalFsPath;
  }

  return null;
}

function createJuryPdfDocument(data: JuryPdfData) {
  const maxScore = getMaxScoreForScale(data.ratingScale);

  // Group products by category
  const productsByCategory = new Map<string, JuryPdfProduct[]>();
  for (const product of data.products) {
    const arr = productsByCategory.get(product.categoryName) ?? [];
    arr.push(product);
    productsByCategory.set(product.categoryName, arr);
  }

  const logoUrl = resolveLogoForPdf(data.logoUrl);

  const pages: React.ReactElement[] = [];

  // Page 1: Summary + first categories
  const categoryEntries = Array.from(productsByCategory.entries());

  // Build all rows across categories
  const allRows: { categoryName: string; product: JuryPdfProduct; index: number }[] = [];
  for (const [categoryName, products] of categoryEntries) {
    products.forEach((product, index) => {
      allRows.push({ categoryName, product, index });
    });
  }

  // Split into pages (~25 rows per page after header, ~35 for subsequent pages)
  const ROWS_FIRST_PAGE = 22;
  const ROWS_PER_PAGE = 32;

  let rowIndex = 0;
  let pageNum = 0;

  while (rowIndex < allRows.length) {
    const isFirstPage = pageNum === 0;
    const maxRows = isFirstPage ? ROWS_FIRST_PAGE : ROWS_PER_PAGE;
    const pageRows = allRows.slice(rowIndex, rowIndex + maxRows);
    rowIndex += maxRows;
    pageNum++;

    // Group page rows by category
    const pageCategoryGroups: { categoryName: string; rows: typeof pageRows }[] = [];
    let currentCategory = "";
    for (const row of pageRows) {
      if (row.categoryName !== currentCategory) {
        pageCategoryGroups.push({ categoryName: row.categoryName, rows: [] });
        currentCategory = row.categoryName;
      }
      pageCategoryGroups[pageCategoryGroups.length - 1]!.rows.push(row);
    }

    pages.push(
      React.createElement(
        Page,
        { key: `page-${pageNum}`, size: "A4", style: styles.page },
        // Header
        React.createElement(
          View,
          { style: styles.header },
          logoUrl
            ? React.createElement(
                View,
                { style: { width: 200, height: 60, alignItems: "flex-start", justifyContent: "center" } },
                React.createElement(Image, {
                  src: logoUrl,
                  style: { maxWidth: 200, maxHeight: 60, objectFit: "contain" as const },
                })
              )
            : React.createElement(
                View,
                { style: { backgroundColor: "#1e1b4b", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 3 } },
                React.createElement(
                  Text,
                  { style: { fontSize: 13, fontWeight: "bold", color: "#ffffff" } },
                  data.organizationName
                )
              ),
          React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.cupTitle }, data.cupName),
            React.createElement(Text, { style: styles.cupSubtitle }, "Synthèse Jury")
          )
        ),
        // Jury header + stats (first page only)
        isFirstPage
          ? React.createElement(
              View,
              null,
              // Jury header
              React.createElement(
                View,
                { style: styles.juryHeader },
                React.createElement(Text, { style: styles.juryName }, data.juryName),
                React.createElement(
                  Text,
                  { style: styles.jurySubtext },
                  `Correspondance codes / variétés / producteurs`
                )
              ),
              // Stats banner
              React.createElement(
                View,
                { style: styles.statsBanner },
                React.createElement(
                  View,
                  { style: styles.statBox },
                  React.createElement(Text, { style: styles.statLabel }, "Produits évalués"),
                  React.createElement(
                    Text,
                    { style: styles.statValuePrimary },
                    `${data.stats.ratedByJury}/${data.stats.totalProducts}`
                  )
                ),
                React.createElement(
                  View,
                  { style: styles.statBoxDivider },
                  React.createElement(Text, { style: styles.statLabel }, "Score d'alignement"),
                  React.createElement(
                    Text,
                    { style: styles.statValue },
                    data.stats.alignmentScore !== null ? `${data.stats.alignmentScore}%` : "N/A"
                  )
                ),
                React.createElement(
                  View,
                  { style: styles.statBoxDivider },
                  React.createElement(Text, { style: styles.statLabel }, "Écart moyen"),
                  React.createElement(
                    Text,
                    { style: styles.statValue },
                    data.stats.averageDifference !== null
                      ? `${data.stats.averageDifference > 0 ? "+" : ""}${data.stats.averageDifference.toFixed(1)}`
                      : "N/A"
                  )
                )
              ),
              // Legend
              React.createElement(
                View,
                { style: styles.legendSection },
                React.createElement(
                  View,
                  { style: styles.legendItem },
                  React.createElement(View, { style: [styles.legendDot, { backgroundColor: "#059669" }] }),
                  React.createElement(Text, { style: styles.legendText }, "Plus généreux que la moyenne")
                ),
                React.createElement(
                  View,
                  { style: styles.legendItem },
                  React.createElement(View, { style: [styles.legendDot, { backgroundColor: "#b91c1c" }] }),
                  React.createElement(Text, { style: styles.legendText }, "Plus sévère que la moyenne")
                )
              )
            )
          : null,
        // Category tables
        ...pageCategoryGroups.map(({ categoryName, rows }) =>
          React.createElement(
            View,
            { key: categoryName },
            // Category title
            React.createElement(Text, { style: styles.categoryTitle }, categoryName),
            // Table header
            React.createElement(
              View,
              { style: styles.tableHeader },
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colRank] }, "#"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colCode] }, "Code"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colProduct] }, "Variété"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colProducer] }, "Producteur"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colJuryScore] }, "Ma note"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colFinalScore] }, "Score"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colDiff] }, "Écart")
            ),
            // Table rows
            ...rows.map(({ product, index }) => {
              const diff = product.difference;
              const diffStyle =
                diff !== null && diff > 0
                  ? styles.positiveScore
                  : diff !== null && diff < 0
                    ? styles.negativeScore
                    : styles.neutralScore;

              return React.createElement(
                View,
                {
                  key: product.productId,
                  style: index % 2 === 1 ? styles.tableRowAlt : styles.tableRow,
                },
                // Rank
                React.createElement(
                  Text,
                  { style: [styles.cellText, styles.colRank] },
                  product.categoryRank?.toString() ?? "-"
                ),
                // Code
                React.createElement(
                  Text,
                  { style: [styles.cellBold, styles.colCode] },
                  product.anonymousCode ?? "-"
                ),
                // Product name
                React.createElement(
                  View,
                  { style: styles.colProduct },
                  React.createElement(
                    Text,
                    { style: styles.cellText },
                    product.productName
                  )
                ),
                // Producer
                React.createElement(
                  View,
                  { style: styles.colProducer },
                  React.createElement(
                    Text,
                    { style: styles.cellText },
                    product.producerName ?? "-"
                  )
                ),
                // Jury score
                React.createElement(
                  Text,
                  { style: [styles.cellBold, styles.colJuryScore] },
                  product.juryScore !== null
                    ? formatScoreForScale(product.juryScore, data.ratingScale)
                    : "-"
                ),
                // Final score
                React.createElement(
                  Text,
                  { style: [styles.cellText, styles.colFinalScore, { color: "#6366f1", fontWeight: "bold" }] },
                  product.finalScore !== null
                    ? formatScoreForScale(product.finalScore, data.ratingScale)
                    : "-"
                ),
                // Difference
                React.createElement(
                  Text,
                  { style: [diffStyle, styles.colDiff] },
                  diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "-"
                )
              );
            })
          )
        ),
        // Footer
        React.createElement(
          View,
          { style: styles.footer },
          React.createElement(
            Text,
            { style: styles.footerText },
            "Document confidentiel — Synthèse générée par Platinum CBD Cup"
          ),
          React.createElement(
            Text,
            { style: styles.footerText },
            new Date().toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          )
        )
      )
    );
  }

  // Handle empty case
  if (pages.length === 0) {
    pages.push(
      React.createElement(
        Page,
        { key: "empty", size: "A4", style: styles.page },
        React.createElement(
          View,
          { style: { alignItems: "center", justifyContent: "center", flex: 1 } },
          React.createElement(
            Text,
            { style: { fontSize: 14, color: "#6b7280" } },
            "Aucun produit évalué"
          )
        )
      )
    );
  }

  return React.createElement(Document, null, ...pages) as Parameters<
    typeof renderToBuffer
  >[0];
}

/**
 * Generate the jury synthesis PDF
 */
export async function generateJurySynthesisPdf(
  cupId: string,
  userId: string
): Promise<{ buffer: Buffer; filename: string }> {
  // Find jury membership
  const cupJury = await db.query.cupJuries.findFirst({
    where: and(
      eq(schema.cupJuries.cupId, cupId),
      eq(schema.cupJuries.userId, userId),
      eq(schema.cupJuries.isActive, true)
    ),
    with: {
      cup: true,
      user: { columns: { name: true, email: true } },
      categoryAssignments: {
        with: { category: true },
      },
    },
  });

  if (!cupJury) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Jury non trouvé pour cette cup",
    });
  }

  const cup = cupJury.cup;

  if (cup.status !== "completed") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Les résultats ne sont disponibles qu'une fois la cup terminée",
    });
  }

  const assignedCategoryIds = cupJury.categoryAssignments.map((a) => a.categoryId);

  if (assignedCategoryIds.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Aucune catégorie assignée",
    });
  }

  // Get all products from confirmed registrations in assigned categories
  const allProducts = await db
    .select({
      productId: schema.products.id,
      productName: schema.products.name,
      anonymousCode: schema.products.anonymousCode,
      finalScore: schema.products.finalScore,
      categoryRank: schema.products.categoryRank,
      categoryId: schema.products.categoryId,
      categoryName: schema.categories.name,
      producerName: schema.producers.companyName,
      producerBrand: schema.producers.brandName,
      labelId: schema.cupLabels.id,
      labelName: schema.cupLabels.name,
      labelColor: schema.cupLabels.color,
      labelIcon: schema.cupLabels.icon,
    })
    .from(schema.products)
    .innerJoin(
      schema.registrations,
      eq(schema.products.registrationId, schema.registrations.id)
    )
    .innerJoin(
      schema.categories,
      eq(schema.products.categoryId, schema.categories.id)
    )
    .innerJoin(
      schema.producers,
      eq(schema.registrations.producerId, schema.producers.id)
    )
    .leftJoin(schema.cupLabels, eq(schema.products.labelId, schema.cupLabels.id))
    .where(
      and(
        eq(schema.registrations.cupId, cupId),
        eq(schema.registrations.status, "confirmed"),
        inArray(schema.products.categoryId, assignedCategoryIds)
      )
    );

  // Get jury's ratings
  const productIds = allProducts.map((p) => p.productId);
  const juryRatings =
    productIds.length > 0
      ? await db
          .select({
            productId: schema.productRatings.productId,
            ratingId: schema.productRatings.id,
          })
          .from(schema.productRatings)
          .where(
            and(
              eq(schema.productRatings.juryId, cupJury.id),
              inArray(schema.productRatings.productId, productIds),
              isNotNull(schema.productRatings.submittedAt)
            )
          )
      : [];

  // Get criteria for categories
  const criteria = await db.query.ratingCriteria.findMany({
    where: inArray(schema.ratingCriteria.categoryId, assignedCategoryIds),
  });

  // Get criterion scores
  const ratingIds = juryRatings.map((r) => r.ratingId);
  const juryScores =
    ratingIds.length > 0
      ? await db
          .select({
            productRatingId: schema.criterionScores.productRatingId,
            criterionId: schema.criterionScores.criterionId,
            score: schema.criterionScores.score,
          })
          .from(schema.criterionScores)
          .where(inArray(schema.criterionScores.productRatingId, ratingIds))
      : [];

  // Build jury score map
  const ratingIdToProduct = new Map(
    juryRatings.map((r) => [r.ratingId, r.productId])
  );

  const criteriaByCategory = new Map<string, typeof criteria>();
  for (const c of criteria) {
    const arr = criteriaByCategory.get(c.categoryId) ?? [];
    arr.push(c);
    criteriaByCategory.set(c.categoryId, arr);
  }

  const scoresByProduct = new Map<string, Map<string, number>>();
  for (const s of juryScores) {
    const productId = ratingIdToProduct.get(s.productRatingId);
    if (!productId) continue;
    let productMap = scoresByProduct.get(productId);
    if (!productMap) {
      productMap = new Map();
      scoresByProduct.set(productId, productMap);
    }
    productMap.set(s.criterionId, s.score);
  }

  // Compute jury weighted average per product
  const juryScoreByProduct = new Map<string, number>();
  for (const product of allProducts) {
    const productScores = scoresByProduct.get(product.productId);
    if (!productScores) continue;
    const categoryCriteria = criteriaByCategory.get(product.categoryId) ?? [];
    let weightedSum = 0;
    let coeffSum = 0;
    for (const c of categoryCriteria) {
      const score = productScores.get(c.id);
      if (score !== undefined) {
        weightedSum += score * c.coefficient;
        coeffSum += c.coefficient;
      }
    }
    if (coeffSum > 0) {
      juryScoreByProduct.set(product.productId, weightedSum / coeffSum);
    }
  }

  // Build products
  const pdfProducts: JuryPdfProduct[] = allProducts.map((product) => {
    const juryScore = juryScoreByProduct.get(product.productId) ?? null;
    const finalScore = product.finalScore ? parseFloat(product.finalScore) : null;
    const difference =
      juryScore !== null && finalScore !== null ? juryScore - finalScore : null;

    return {
      productId: product.productId,
      productName: product.productName,
      anonymousCode: product.anonymousCode,
      categoryName: product.categoryName,
      categoryId: product.categoryId,
      categoryRank: product.categoryRank,
      producerName: product.producerName,
      producerBrand: product.producerBrand,
      juryScore: juryScore !== null ? Math.round(juryScore * 100) / 100 : null,
      finalScore,
      difference: difference !== null ? Math.round(difference * 100) / 100 : null,
      label: product.labelName
        ? { name: product.labelName, color: product.labelColor, icon: product.labelIcon }
        : null,
    };
  });

  // Sort by category then by jury score descending
  pdfProducts.sort((a, b) => {
    if (a.categoryName !== b.categoryName) {
      return a.categoryName.localeCompare(b.categoryName);
    }
    if (a.juryScore !== null && b.juryScore !== null) {
      return b.juryScore - a.juryScore;
    }
    if (a.juryScore !== null) return -1;
    if (b.juryScore !== null) return 1;
    return 0;
  });

  // Compute stats
  const maxScale = getMaxScoreForScale(cup.ratingScale as RatingScale);
  const ratedByJury = pdfProducts.filter((p) => p.juryScore !== null).length;
  const withBothScores = pdfProducts.filter(
    (p) => p.juryScore !== null && p.finalScore !== null
  );

  let alignmentScore: number | null = null;
  let averageDifference: number | null = null;

  if (withBothScores.length > 0) {
    const threshold = 1; // ±1 point
    const aligned = withBothScores.filter(
      (p) => Math.abs(p.difference!) <= threshold
    ).length;
    alignmentScore = Math.round((aligned / withBothScores.length) * 100);
    const totalDiff = withBothScores.reduce((sum, p) => sum + p.difference!, 0);
    averageDifference =
      Math.round((totalDiff / withBothScores.length) * 100) / 100;
  }

  // Get logo (single-tenant: only cup-specific PDF logo)
  const logoUrl = resolveLogoForPdf(cup.pdfLogoUrl);

  const pdfData: JuryPdfData = {
    cupName: cup.name,
    juryName: cupJury.user.name ?? cupJury.user.email ?? "Jury",
    organizationName: "Platinum CBD Cup",
    ratingScale: cup.ratingScale as "0-5" | "0-10" | "0-20" | "0-100",
    logoUrl,
    products: pdfProducts,
    stats: {
      totalProducts: allProducts.length,
      ratedByJury,
      alignmentScore,
      averageDifference,
    },
    generatedAt: new Date(),
  };

  const pdfDocument = createJuryPdfDocument(pdfData);
  const buffer = await renderToBuffer(pdfDocument);

  const sanitizedName = (cupJury.user.name ?? "jury")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();

  return {
    buffer: Buffer.from(buffer),
    filename: `synthese-jury-${sanitizedName}-${new Date().toISOString().split("T")[0]}.pdf`,
  };
}

// ─── Jury Product Detail PDF ───────────────────────────────────────────────

/**
 * Styles specific to the product detail PDF (amber theme, matching results-pdf)
 */
const detailStyles = StyleSheet.create({
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
  productMeta: {
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
  criterionCol: { width: "38%" },
  scoreCol: { width: "14%", textAlign: "center" },
  avgCol: { width: "14%", textAlign: "center" },
  diffCol: { width: "14%", textAlign: "right" },
  barCol: { width: "20%", alignItems: "flex-start", justifyContent: "center" },
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
  commentSection: {
    marginTop: 8,
  },
  commentTitle: {
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
  commentText: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: "#374151",
    lineHeight: 1.4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#f9fafb",
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

/**
 * Mini bar helper for detail PDF (replicates the same logic as results-pdf)
 */
function createDetailMiniBar(
  juryScore: number | null,
  categoryAvg: number | null,
  maxScore: number,
  barWidth = 80
): React.ReactElement {
  const fillWidth =
    juryScore !== null ? Math.max(0, Math.min(1, juryScore / maxScore)) * barWidth : 0;
  const avgLeft =
    categoryAvg !== null
      ? Math.max(0, Math.min(1, categoryAvg / maxScore)) * barWidth - 1
      : null;

  return React.createElement(
    View,
    { style: [detailStyles.miniBarContainer, { width: barWidth }] },
    juryScore !== null
      ? React.createElement(View, {
          style: [
            categoryAvg !== null && juryScore >= categoryAvg
              ? detailStyles.miniBarFillAbove
              : detailStyles.miniBarFillBelow,
            { width: fillWidth },
          ],
        })
      : null,
    avgLeft !== null
      ? React.createElement(View, {
          style: [detailStyles.miniBarAvgMarker, { left: avgLeft }],
        })
      : null
  );
}

interface JuryProductDetailData {
  productId: string;
  productName: string;
  anonymousCode: string | null;
  categoryName: string;
  producerName: string | null;
  finalScore: number | null;
  juryWeightedAverage: number | null;
  juryComment: string | null;
  ratingScale: string;
  criteriaDetails: Array<{
    criterionName: string;
    criterionDescription: string | null;
    coefficient: number;
    juryScore: number | null;
    categoryAverage: number | null;
  }>;
}

interface JuryProductDetailPdfData {
  cupName: string;
  organizationName: string;
  logoUrl: string | null;
  product: JuryProductDetailData;
}

/**
 * Create a single product detail page for the jury detail PDF
 */
function createDetailPage(data: JuryProductDetailPdfData): React.ReactElement {
  const { product } = data;
  const maxScore = getMaxScoreForScale(product.ratingScale as RatingScale);
  const ecart =
    product.juryWeightedAverage !== null && product.finalScore !== null
      ? product.juryWeightedAverage - product.finalScore
      : null;

  return React.createElement(
    Page,
    { size: "A4", style: detailStyles.page },
    // Header
    React.createElement(
      View,
      { style: detailStyles.header },
      data.logoUrl
        ? React.createElement(
            View,
            { style: { width: 240, height: 80, alignItems: "flex-start", justifyContent: "center" } },
            React.createElement(Image, {
              src: data.logoUrl,
              style: { maxWidth: 240, maxHeight: 80, objectFit: "contain" as const },
            })
          )
        : React.createElement(
            View,
            { style: { backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 3 } },
            React.createElement(
              Text,
              { style: { fontSize: 13, fontWeight: "bold", color: "#ffffff" } },
              data.organizationName
            )
          ),
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: detailStyles.cupTitle }, data.cupName),
        React.createElement(Text, { style: detailStyles.cupSubtitle }, "Détail notation jury")
      )
    ),
    // Product header
    React.createElement(
      View,
      { style: detailStyles.productHeader },
      React.createElement(Text, { style: detailStyles.productName }, product.productName),
      React.createElement(
        Text,
        { style: detailStyles.productMeta },
        [
          `Catégorie: ${product.categoryName}`,
          product.anonymousCode ? `Code: ${product.anonymousCode}` : null,
          product.producerName ? `Producteur: ${product.producerName}` : null,
        ]
          .filter(Boolean)
          .join(" • ")
      )
    ),
    // Results banner: jury score, final score, écart (no label/distinction)
    React.createElement(
      View,
      { style: detailStyles.resultsBanner },
      React.createElement(
        View,
        { style: detailStyles.resultBox },
        React.createElement(Text, { style: detailStyles.resultLabel }, "Ma note"),
        React.createElement(
          Text,
          { style: detailStyles.resultValueAmber },
          product.juryWeightedAverage !== null
            ? formatScoreForScale(product.juryWeightedAverage, product.ratingScale as RatingScale)
            : "N/A"
        )
      ),
      React.createElement(
        View,
        { style: detailStyles.resultBoxDivider },
        React.createElement(Text, { style: detailStyles.resultLabel }, "Score final"),
        React.createElement(
          Text,
          { style: detailStyles.resultValue },
          product.finalScore !== null
            ? formatScoreForScale(product.finalScore, product.ratingScale as RatingScale)
            : "N/A"
        )
      ),
      React.createElement(
        View,
        { style: detailStyles.resultBoxDivider },
        React.createElement(Text, { style: detailStyles.resultLabel }, "Écart"),
        React.createElement(
          Text,
          {
            style: [
              detailStyles.resultValue,
              ecart !== null && ecart > 0 ? { color: "#059669" } : ecart !== null && ecart < 0 ? { color: "#b91c1c" } : {},
            ],
          },
          ecart !== null ? `${ecart > 0 ? "+" : ""}${ecart.toFixed(2)}` : "N/A"
        )
      )
    ),
    // Criteria table
    React.createElement(
      View,
      { style: { marginTop: 4 } },
      React.createElement(Text, { style: detailStyles.tableTitle }, "Détail des notes par critère"),
      React.createElement(
        View,
        { style: detailStyles.tableHeader },
        React.createElement(Text, { style: [detailStyles.tableHeaderCell, detailStyles.criterionCol] }, "Critère"),
        React.createElement(Text, { style: [detailStyles.tableHeaderCell, detailStyles.scoreCol] }, "Ma note"),
        React.createElement(Text, { style: [detailStyles.tableHeaderCell, detailStyles.avgCol] }, "Moy. cat."),
        React.createElement(Text, { style: [detailStyles.tableHeaderCell, detailStyles.diffCol] }, "Écart"),
        React.createElement(Text, { style: [detailStyles.tableHeaderCell, detailStyles.barCol] }, "")
      ),
      ...product.criteriaDetails.map((criterion, index) => {
        const diff =
          criterion.juryScore !== null && criterion.categoryAverage !== null
            ? criterion.juryScore - criterion.categoryAverage
            : null;

        return React.createElement(
          View,
          { key: index, style: index % 2 === 1 ? detailStyles.criterionRowAlt : detailStyles.criterionRow },
          React.createElement(
            View,
            { style: detailStyles.criterionCol },
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
            { style: [detailStyles.tableCell, detailStyles.scoreCol, { fontWeight: "bold" }] },
            criterion.juryScore !== null ? criterion.juryScore.toFixed(1) : "N/A"
          ),
          React.createElement(
            Text,
            { style: [detailStyles.tableCell, detailStyles.avgCol] },
            criterion.categoryAverage !== null ? criterion.categoryAverage.toFixed(1) : "N/A"
          ),
          React.createElement(
            Text,
            {
              style: [
                detailStyles.tableCell,
                detailStyles.diffCol,
                diff !== null && diff > 0
                  ? detailStyles.positiveScore
                  : diff !== null && diff < 0
                    ? detailStyles.negativeScore
                    : {},
              ],
            },
            diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "-"
          ),
          React.createElement(
            View,
            { style: detailStyles.barCol },
            createDetailMiniBar(criterion.juryScore, criterion.categoryAverage, maxScore, 80)
          )
        );
      })
    ),
    // Comment section
    product.juryComment && product.juryComment.trim().length > 0
      ? React.createElement(
          View,
          { style: detailStyles.commentSection },
          React.createElement(Text, { style: detailStyles.commentTitle }, "Mon commentaire"),
          React.createElement(
            Text,
            { style: detailStyles.commentText },
            `« ${product.juryComment.trim()} »`
          )
        )
      : null,
    // Footer
    React.createElement(
      View,
      { style: detailStyles.footer },
      React.createElement(Text, { style: detailStyles.footerText }, "Document confidentiel — Généré par Platinum CBD Cup"),
      React.createElement(
        Text,
        { style: detailStyles.footerText },
        new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
      )
    )
  );
}

/**
 * Generate a jury product detail PDF (single product)
 */
export async function generateJuryProductDetailPdf(
  productId: string,
  cupId: string,
  userId: string
): Promise<{ buffer: Buffer; filename: string }> {
  // Verify jury membership and cup status
  const cupJury = await db.query.cupJuries.findFirst({
    where: and(
      eq(schema.cupJuries.cupId, cupId),
      eq(schema.cupJuries.userId, userId),
      eq(schema.cupJuries.isActive, true)
    ),
    with: {
      cup: true,
      user: { columns: { name: true, email: true } },
    },
  });

  if (!cupJury) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Jury non trouvé pour cette cup",
    });
  }

  const cup = cupJury.cup;

  if (cup.status !== "completed") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Les résultats ne sont disponibles qu'une fois la cup terminée",
    });
  }

  // Get product with category + producer
  const productRow = await db
    .select({
      productId: schema.products.id,
      productName: schema.products.name,
      anonymousCode: schema.products.anonymousCode,
      finalScore: schema.products.finalScore,
      categoryId: schema.products.categoryId,
      categoryName: schema.categories.name,
      producerName: schema.producers.companyName,
    })
    .from(schema.products)
    .innerJoin(
      schema.registrations,
      eq(schema.products.registrationId, schema.registrations.id)
    )
    .innerJoin(
      schema.categories,
      eq(schema.products.categoryId, schema.categories.id)
    )
    .innerJoin(
      schema.producers,
      eq(schema.registrations.producerId, schema.producers.id)
    )
    .where(
      and(
        eq(schema.products.id, productId),
        eq(schema.registrations.cupId, cupId)
      )
    )
    .then((rows) => rows[0] ?? null);

  if (!productRow) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Produit non trouvé" });
  }

  // Get jury rating
  const juryRating = await db.query.productRatings.findFirst({
    where: and(
      eq(schema.productRatings.productId, productId),
      eq(schema.productRatings.juryId, cupJury.id),
      isNotNull(schema.productRatings.submittedAt)
    ),
  });

  // Get criteria ordered by sortOrder
  const criteria = await db.query.ratingCriteria.findMany({
    where: eq(schema.ratingCriteria.categoryId, productRow.categoryId),
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });

  // Get jury's criterion scores
  const juryScores = juryRating
    ? await db
        .select({
          criterionId: schema.criterionScores.criterionId,
          score: schema.criterionScores.score,
        })
        .from(schema.criterionScores)
        .where(eq(schema.criterionScores.productRatingId, juryRating.id))
    : [];

  const juryScoreMap = new Map(juryScores.map((s) => [s.criterionId, s.score]));

  // Compute category averages
  const categoryAvgRows = await db
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
        eq(schema.products.categoryId, productRow.categoryId),
        eq(schema.registrations.cupId, cupId),
        isNotNull(schema.productRatings.submittedAt)
      )
    );

  const categoryScoresByCriterion = new Map<string, number[]>();
  for (const row of categoryAvgRows) {
    const arr = categoryScoresByCriterion.get(row.criterionId) ?? [];
    arr.push(row.score);
    categoryScoresByCriterion.set(row.criterionId, arr);
  }

  const criteriaDetails = criteria.map((criterion) => {
    const juryScore = juryScoreMap.get(criterion.id) ?? null;
    const catScores = categoryScoresByCriterion.get(criterion.id) ?? [];
    const categoryAverage =
      catScores.length > 0
        ? catScores.reduce((sum, s) => sum + s, 0) / catScores.length
        : null;
    return {
      criterionName: criterion.name,
      criterionDescription: criterion.description,
      coefficient: criterion.coefficient,
      juryScore: juryScore !== null ? juryScore : null,
      categoryAverage: categoryAverage !== null ? Math.round(categoryAverage * 100) / 100 : null,
    };
  });

  const scoredCriteria = criteriaDetails.filter((c) => c.juryScore !== null);
  const totalCoeff = scoredCriteria.reduce((sum, c) => sum + c.coefficient, 0);
  const juryWeightedAverage =
    totalCoeff > 0
      ? scoredCriteria.reduce((sum, c) => sum + c.juryScore! * c.coefficient, 0) / totalCoeff
      : null;

  // Logo (single-tenant: only cup-specific PDF logo)
  const logoUrl = resolveLogoForPdf(cup.pdfLogoUrl);

  const pdfData: JuryProductDetailPdfData = {
    cupName: cup.name,
    organizationName: "Platinum CBD Cup",
    logoUrl,
    product: {
      productId: productRow.productId,
      productName: productRow.productName,
      anonymousCode: productRow.anonymousCode,
      categoryName: productRow.categoryName,
      producerName: productRow.producerName,
      finalScore: productRow.finalScore ? parseFloat(productRow.finalScore) : null,
      juryWeightedAverage:
        juryWeightedAverage !== null ? Math.round(juryWeightedAverage * 100) / 100 : null,
      juryComment: juryRating?.comment ?? null,
      ratingScale: cup.ratingScale,
      criteriaDetails,
    },
  };

  const document = React.createElement(
    Document,
    null,
    createDetailPage(pdfData)
  ) as Parameters<typeof renderToBuffer>[0];

  const buffer = await renderToBuffer(document);
  const sanitizedName = productRow.productName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

  return {
    buffer: Buffer.from(buffer),
    filename: `detail-${sanitizedName}.pdf`,
  };
}

/**
 * Generate a multi-page jury detail PDF for all products in a cup,
 * one page per product, sorted by jury score descending within each category.
 */
export async function generateJuryAllDetailsPdf(
  cupId: string,
  userId: string
): Promise<{ buffer: Buffer; filename: string }> {
  // Verify jury membership
  const cupJury = await db.query.cupJuries.findFirst({
    where: and(
      eq(schema.cupJuries.cupId, cupId),
      eq(schema.cupJuries.userId, userId),
      eq(schema.cupJuries.isActive, true)
    ),
    with: {
      cup: true,
      user: { columns: { name: true, email: true } },
      categoryAssignments: {
        with: { category: true },
      },
    },
  });

  if (!cupJury) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Jury non trouvé pour cette cup",
    });
  }

  const cup = cupJury.cup;

  if (cup.status !== "completed") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Les résultats ne sont disponibles qu'une fois la cup terminée",
    });
  }

  const assignedCategoryIds = cupJury.categoryAssignments.map((a) => a.categoryId);
  if (assignedCategoryIds.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Aucune catégorie assignée" });
  }

  // Get all products from confirmed registrations in assigned categories
  const allProducts = await db
    .select({
      productId: schema.products.id,
      productName: schema.products.name,
      anonymousCode: schema.products.anonymousCode,
      finalScore: schema.products.finalScore,
      categoryId: schema.products.categoryId,
      categoryName: schema.categories.name,
      producerName: schema.producers.companyName,
    })
    .from(schema.products)
    .innerJoin(
      schema.registrations,
      eq(schema.products.registrationId, schema.registrations.id)
    )
    .innerJoin(
      schema.categories,
      eq(schema.products.categoryId, schema.categories.id)
    )
    .innerJoin(
      schema.producers,
      eq(schema.registrations.producerId, schema.producers.id)
    )
    .where(
      and(
        eq(schema.registrations.cupId, cupId),
        eq(schema.registrations.status, "confirmed"),
        inArray(schema.products.categoryId, assignedCategoryIds)
      )
    );

  if (allProducts.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Aucun produit trouvé" });
  }

  // Get all jury ratings for these products
  const productIds = allProducts.map((p) => p.productId);
  const juryRatings = await db
    .select({
      id: schema.productRatings.id,
      productId: schema.productRatings.productId,
      comment: schema.productRatings.comment,
    })
    .from(schema.productRatings)
    .where(
      and(
        eq(schema.productRatings.juryId, cupJury.id),
        inArray(schema.productRatings.productId, productIds),
        isNotNull(schema.productRatings.submittedAt)
      )
    );

  const ratingByProduct = new Map(juryRatings.map((r) => [r.productId, r]));

  // Get all criteria for assigned categories
  const criteria = await db.query.ratingCriteria.findMany({
    where: inArray(schema.ratingCriteria.categoryId, assignedCategoryIds),
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });

  const criteriaByCategory = new Map<string, typeof criteria>();
  for (const c of criteria) {
    const arr = criteriaByCategory.get(c.categoryId) ?? [];
    arr.push(c);
    criteriaByCategory.set(c.categoryId, arr);
  }

  // Get all jury criterion scores in bulk
  const ratingIds = juryRatings.map((r) => r.id);
  const allJuryScores =
    ratingIds.length > 0
      ? await db
          .select({
            productRatingId: schema.criterionScores.productRatingId,
            criterionId: schema.criterionScores.criterionId,
            score: schema.criterionScores.score,
          })
          .from(schema.criterionScores)
          .where(inArray(schema.criterionScores.productRatingId, ratingIds))
      : [];

  const ratingIdToProductId = new Map(juryRatings.map((r) => [r.id, r.productId]));
  const scoresByProduct = new Map<string, Map<string, number>>();
  for (const s of allJuryScores) {
    const pid = ratingIdToProductId.get(s.productRatingId);
    if (!pid) continue;
    let m = scoresByProduct.get(pid);
    if (!m) {
      m = new Map();
      scoresByProduct.set(pid, m);
    }
    m.set(s.criterionId, s.score);
  }

  // Get category averages in bulk (all juries, all products in categories)
  const categoryAvgRows = await db
    .select({
      criterionId: schema.criterionScores.criterionId,
      score: schema.criterionScores.score,
      categoryId: schema.products.categoryId,
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
        inArray(schema.products.categoryId, assignedCategoryIds),
        eq(schema.registrations.cupId, cupId),
        isNotNull(schema.productRatings.submittedAt)
      )
    );

  // Group: categoryId -> criterionId -> scores[]
  const catAvgByCategoryAndCriterion = new Map<string, Map<string, number[]>>();
  for (const row of categoryAvgRows) {
    let catMap = catAvgByCategoryAndCriterion.get(row.categoryId);
    if (!catMap) {
      catMap = new Map();
      catAvgByCategoryAndCriterion.set(row.categoryId, catMap);
    }
    const arr = catMap.get(row.criterionId) ?? [];
    arr.push(row.score);
    catMap.set(row.criterionId, arr);
  }

  // Logo (single-tenant: only cup-specific PDF logo)
  const logoUrl = resolveLogoForPdf(cup.pdfLogoUrl);

  // Build per-product pages, sorted by jury score desc within each category
  const productPages: Array<{ categoryName: string; juryScore: number | null; page: React.ReactElement }> = [];

  for (const prod of allProducts) {
    const categoryCriteria = criteriaByCategory.get(prod.categoryId) ?? [];
    const prodScores = scoresByProduct.get(prod.productId);
    const catMap = catAvgByCategoryAndCriterion.get(prod.categoryId);

    const criteriaDetails = categoryCriteria.map((criterion) => {
      const juryScore = prodScores?.get(criterion.id) ?? null;
      const catScores = catMap?.get(criterion.id) ?? [];
      const categoryAverage =
        catScores.length > 0
          ? catScores.reduce((sum, s) => sum + s, 0) / catScores.length
          : null;
      return {
        criterionName: criterion.name,
        criterionDescription: criterion.description,
        coefficient: criterion.coefficient,
        juryScore: juryScore !== null ? juryScore : null,
        categoryAverage: categoryAverage !== null ? Math.round(categoryAverage * 100) / 100 : null,
      };
    });

    const scoredCriteria = criteriaDetails.filter((c) => c.juryScore !== null);
    const totalCoeff = scoredCriteria.reduce((sum, c) => sum + c.coefficient, 0);
    const juryWeightedAverage =
      totalCoeff > 0
        ? scoredCriteria.reduce((sum, c) => sum + c.juryScore! * c.coefficient, 0) / totalCoeff
        : null;

    const juryRating = ratingByProduct.get(prod.productId);

    const pdfData: JuryProductDetailPdfData = {
      cupName: cup.name,
      organizationName: "Platinum CBD Cup",
      logoUrl,
      product: {
        productId: prod.productId,
        productName: prod.productName,
        anonymousCode: prod.anonymousCode,
        categoryName: prod.categoryName,
        producerName: prod.producerName,
        finalScore: prod.finalScore ? parseFloat(prod.finalScore) : null,
        juryWeightedAverage:
          juryWeightedAverage !== null ? Math.round(juryWeightedAverage * 100) / 100 : null,
        juryComment: juryRating?.comment ?? null,
        ratingScale: cup.ratingScale,
        criteriaDetails,
      },
    };

    productPages.push({
      categoryName: prod.categoryName,
      juryScore: juryWeightedAverage,
      page: createDetailPage(pdfData),
    });
  }

  // Sort by category name then by jury score descending
  productPages.sort((a, b) => {
    const catCmp = a.categoryName.localeCompare(b.categoryName);
    if (catCmp !== 0) return catCmp;
    if (a.juryScore !== null && b.juryScore !== null) return b.juryScore - a.juryScore;
    if (a.juryScore !== null) return -1;
    if (b.juryScore !== null) return 1;
    return 0;
  });

  const document = React.createElement(
    Document,
    null,
    ...productPages.map((p) => p.page)
  ) as Parameters<typeof renderToBuffer>[0];

  const buffer = await renderToBuffer(document);
  const sanitizedName = (cupJury.user.name ?? "jury").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

  return {
    buffer: Buffer.from(buffer),
    filename: `details-jury-${sanitizedName}-${new Date().toISOString().split("T")[0]}.pdf`,
  };
}
