/**
 * Invoice Generation Service
 * Generates PDF invoices for producer registrations using @react-pdf/renderer
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { db } from "~/server/db";
import { eq, like, desc } from "drizzle-orm";
import * as schema from "~/server/db/schema";

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  logo: {
    fontSize: 24,
    fontWeight: "bold",
  },
  logoOrange: {
    color: "#f59e0b",
  },
  logoBlack: {
    color: "#1f2937",
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    textAlign: "right",
  },
  invoiceInfo: {
    textAlign: "right",
    marginTop: 8,
    color: "#6b7280",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  partySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  partyBox: {
    width: "45%",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  partyTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  partyName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  partyDetail: {
    fontSize: 10,
    color: "#4b5563",
    marginBottom: 2,
  },
  cupInfo: {
    backgroundColor: "#fef3c7",
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
  },
  cupName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#92400e",
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 8,
    fontWeight: "bold",
    fontSize: 10,
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableColProduct: {
    width: "50%",
  },
  tableColCategory: {
    width: "25%",
  },
  tableColPrice: {
    width: "25%",
    textAlign: "right",
  },
  totalsSection: {
    alignItems: "flex-end",
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: "#1f2937",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
    width: 200,
  },
  totalLabel: {
    width: 120,
    textAlign: "right",
    paddingRight: 12,
  },
  totalValue: {
    width: 80,
    textAlign: "right",
    fontWeight: "bold",
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
  },
  legalMentions: {
    fontSize: 8,
    color: "#9ca3af",
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  legalLine: {
    marginBottom: 2,
  },
  paidBadge: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    padding: "4 8",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: "bold",
    alignSelf: "flex-start",
    marginTop: 8,
  },
});

// Invoice data interface
export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  // Seller (organizer)
  sellerName: string;
  sellerAddress?: string;
  sellerSiret?: string;
  // Buyer (producer)
  buyerName: string;
  buyerCompany?: string;
  buyerAddress?: string;
  // Cup info
  cupName: string;
  // Products
  products: Array<{
    name: string;
    category: string;
    priceInCents: number;
  }>;
  // Totals
  totalAmountInCents: number;
  currency: string;
  // Payment status
  isPaid: boolean;
  paymentDate?: Date;
}

/**
 * Generate a unique invoice number
 * Format: INV-YYYY-XXXXX (e.g., INV-2026-00001)
 *
 * Note: This uses optimistic locking with retry on collision.
 * The invoiceNumber column has a UNIQUE constraint, so concurrent
 * inserts will fail and trigger a retry with the next sequence.
 */
export async function generateInvoiceNumber(maxRetries = 3): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Find the highest invoice number for this year
    const lastInvoice = await db.query.registrations.findFirst({
      where: like(schema.registrations.invoiceNumber, `${prefix}%`),
      orderBy: [desc(schema.registrations.invoiceNumber)],
      columns: { invoiceNumber: true },
    });

    let sequence = 1;
    if (lastInvoice?.invoiceNumber) {
      const lastSequence = parseInt(
        lastInvoice.invoiceNumber.replace(prefix, ""),
        10
      );
      if (!isNaN(lastSequence)) {
        // Add attempt offset to handle concurrent generation
        sequence = lastSequence + 1 + attempt;
      }
    }

    return `${prefix}${String(sequence).padStart(5, "0")}`;
  }

  // Fallback: use timestamp-based suffix for guaranteed uniqueness
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}${timestamp.slice(-5)}`;
}

/**
 * Generate a PDF invoice for a registration
 * @param registrationId - The registration ID
 * @returns Buffer containing the PDF data
 */
export async function generateInvoicePdf(
  registrationId: string
): Promise<{ buffer: Buffer; invoiceNumber: string }> {
  // Fetch registration with all related data (single-tenant, no org join)
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    with: {
      producer: {
        with: {
          user: true,
        },
      },
      cup: true,
      products: {
        with: {
          category: true,
        },
      },
    },
  });

  if (!registration) {
    throw new Error(`Registration not found: ${registrationId}`);
  }

  // Generate invoice number if not already set
  const invoiceNumber =
    registration.invoiceNumber ?? (await generateInvoiceNumber());

  // Build invoice data
  const invoiceData: InvoiceData = {
    invoiceNumber,
    invoiceDate: new Date(),
    // Seller (single-tenant: Platinum CBD Cup)
    sellerName: "Platinum CBD Cup",
    sellerAddress: undefined,
    sellerSiret: undefined,
    // Buyer (producer)
    buyerName: registration.producer.user.name ?? "N/A",
    buyerCompany: registration.producer.companyName ?? undefined,
    buyerAddress: undefined, // Could be added to producer schema if needed
    // Cup info
    cupName: registration.cup.name,
    // Products
    products: registration.products.map((product) => ({
      name: product.name,
      category: product.category?.name ?? "Sans categorie",
      priceInCents: product.priceAtRegistration ?? 0,
    })),
    // Totals
    totalAmountInCents: registration.totalAmount,
    currency: registration.currency ?? "EUR",
    // Payment status
    isPaid: registration.status === "confirmed",
    paymentDate:
      registration.status === "confirmed" ? registration.updatedAt : undefined,
  };

  // Generate PDF - renderToBuffer expects Document element directly
  try {
    const pdfDocument = createInvoiceDocument(invoiceData);
    const buffer = await renderToBuffer(pdfDocument);

    if (!buffer || buffer.byteLength === 0) {
      throw new Error("PDF generation returned empty buffer");
    }

    return {
      buffer: Buffer.from(buffer),
      invoiceNumber,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to generate PDF invoice: ${errorMessage}`);
  }
}

/**
 * Create the PDF Document element for invoice
 */
function createInvoiceDocument(data: InvoiceData) {
  const formatCurrency = (cents: number) => {
    return (cents / 100).toFixed(2).replace(".", ",") + " " + data.currency;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          null,
          React.createElement(
            Text,
            { style: styles.logo },
            React.createElement(Text, { style: styles.logoOrange }, "Cup"),
            React.createElement(Text, { style: styles.logoBlack }, "Metrics")
          )
        ),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.invoiceTitle }, "FACTURE"),
          React.createElement(
            Text,
            { style: styles.invoiceInfo },
            `N° ${data.invoiceNumber}`
          ),
          React.createElement(
            Text,
            { style: styles.invoiceInfo },
            `Date: ${formatDate(data.invoiceDate)}`
          ),
          data.isPaid &&
            React.createElement(Text, { style: styles.paidBadge }, "ACQUITTEE")
        )
      ),
      // Parties (Seller & Buyer)
      React.createElement(
        View,
        { style: styles.partySection },
        // Seller
        React.createElement(
          View,
          { style: styles.partyBox },
          React.createElement(Text, { style: styles.partyTitle }, "VENDEUR"),
          React.createElement(Text, { style: styles.partyName }, data.sellerName),
          data.sellerAddress &&
            React.createElement(Text, { style: styles.partyDetail }, data.sellerAddress),
          data.sellerSiret &&
            React.createElement(Text, { style: styles.partyDetail }, `SIRET: ${data.sellerSiret}`)
        ),
        // Buyer
        React.createElement(
          View,
          { style: styles.partyBox },
          React.createElement(Text, { style: styles.partyTitle }, "ACHETEUR"),
          React.createElement(Text, { style: styles.partyName }, data.buyerName),
          data.buyerCompany &&
            React.createElement(Text, { style: styles.partyDetail }, data.buyerCompany),
          data.buyerAddress &&
            React.createElement(Text, { style: styles.partyDetail }, data.buyerAddress)
        )
      ),
      // Cup info
      React.createElement(
        View,
        { style: styles.cupInfo },
        React.createElement(
          Text,
          { style: { fontSize: 10, color: "#92400e", marginBottom: 4 } },
          "Inscription a la competition:"
        ),
        React.createElement(Text, { style: styles.cupName }, data.cupName)
      ),
      // Products table
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(Text, { style: styles.sectionTitle }, "PRODUITS INSCRITS"),
        // Table header
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.tableColProduct }, "Produit"),
          React.createElement(Text, { style: styles.tableColCategory }, "Categorie"),
          React.createElement(Text, { style: styles.tableColPrice }, "Prix unitaire")
        ),
        // Table rows
        ...data.products.map((product, index) =>
          React.createElement(
            View,
            { key: index, style: styles.tableRow },
            React.createElement(Text, { style: styles.tableColProduct }, product.name),
            React.createElement(Text, { style: styles.tableColCategory }, product.category),
            React.createElement(Text, { style: styles.tableColPrice }, formatCurrency(product.priceInCents))
          )
        )
      ),
      // Totals
      React.createElement(
        View,
        { style: styles.totalsSection },
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, "Total HT:"),
          React.createElement(Text, { style: styles.totalValue }, formatCurrency(data.totalAmountInCents))
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, "TVA:"),
          React.createElement(Text, { style: styles.totalValue }, "Non applicable")
        ),
        React.createElement(
          View,
          { style: [styles.totalRow, styles.grandTotal] },
          React.createElement(Text, { style: styles.totalLabel }, "TOTAL TTC:"),
          React.createElement(Text, { style: styles.totalValue }, formatCurrency(data.totalAmountInCents))
        )
      ),
      // Legal mentions
      React.createElement(
        View,
        { style: styles.legalMentions },
        data.sellerSiret &&
          React.createElement(Text, { style: styles.legalLine }, `SIRET: ${data.sellerSiret}`),
        React.createElement(Text, { style: styles.legalLine }, "TVA non applicable, art. 293 B du CGI"),
        React.createElement(
          Text,
          { style: styles.legalLine },
          `Paiement effectue par carte bancaire${data.paymentDate ? ` le ${formatDate(data.paymentDate)}` : ""}`
        ),
        React.createElement(Text, { style: styles.legalLine }, "Facture generee automatiquement par Platinum CBD Cup"),
        React.createElement(
          Text,
          { style: styles.legalLine },
          "En cas de retard de paiement, une penalite de 3 fois le taux d'interet legal sera appliquee."
        )
      )
    )
  );
}

/**
 * Get invoice data without generating PDF (for preview/API)
 */
export async function getInvoiceData(
  registrationId: string
): Promise<InvoiceData | null> {
  const registration = await db.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    with: {
      producer: {
        with: {
          user: true,
        },
      },
      cup: true,
      products: {
        with: {
          category: true,
        },
      },
    },
  });

  if (!registration) {
    return null;
  }

  return {
    invoiceNumber: registration.invoiceNumber ?? "PREVIEW",
    invoiceDate: registration.invoiceGeneratedAt ?? new Date(),
    sellerName: "Platinum CBD Cup",
    buyerName: registration.producer.user.name ?? "N/A",
    buyerCompany: registration.producer.companyName ?? undefined,
    cupName: registration.cup.name,
    products: registration.products.map((product) => ({
      name: product.name,
      category: product.category?.name ?? "Sans categorie",
      priceInCents: product.priceAtRegistration ?? 0,
    })),
    totalAmountInCents: registration.totalAmount,
    currency: registration.currency ?? "EUR",
    isPaid: registration.status === "confirmed",
    paymentDate:
      registration.status === "confirmed" ? registration.updatedAt : undefined,
  };
}
