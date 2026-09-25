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
import { eq, like, desc, sql } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { ORGANIZATION_NAME } from "~/lib/organization";

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
  logoGold: {
    color: "#d4af37",
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
  // Mention légale obligatoire non encore renseignée : visible plutôt que
  // silencieusement absente, pour qu'une facture incomplète se voie.
  partyMissing: {
    fontSize: 10,
    color: "#b91c1c",
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
  sellerVatNumber?: string;
  /** Mention de TVA à imprimer en bas de facture. */
  sellerVatMention?: string;
  /**
   * Vrai seulement si l'émetteur facture réellement de la TVA. Sépare le
   * libellé des totaux (HT/TTC) de la simple présence d'une mention : un
   * organisme non assujetti imprime la mention mais un total unique.
   */
  sellerVatApplicable?: boolean;
  // Buyer (producer)
  buyerName: string;
  buyerCompany?: string;
  buyerAddress?: string;
  buyerSiret?: string;
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
 * Identité légale du vendeur, imprimée sur chaque facture.
 *
 * TODO(legal) : renseigner l'adresse, le SIRET et, le cas échéant, le numéro
 * de TVA intracommunautaire de la structure qui organise la Platinum CBD Cup.
 * Ces mentions sont obligatoires sur une facture (art. L441-9 du code de
 * commerce) ; elles sont volontairement laissées vides plutôt qu'inventées.
 */
const SELLER_LEGAL: {
  name: string;
  address: string | null;
  siret: string | null;
  vatNumber: string | null;
  /**
   * Mention de TVA applicable, p. ex. "TVA non applicable, art. 293 B du CGI"
   * pour une franchise en base, ou le taux réellement appliqué.
   * TODO(legal) : déterminer le régime réel avant la première facture.
   */
  vatMention: string | null;
  /** Faux pour un organisme non assujetti : pas de ligne ni de total TTC. */
  vatApplicable: boolean;
} = {
  // Entité juridique émettrice, distincte du nom de l'évènement
  // (« Platinum CBD Cup ») : c'est elle qui doit figurer sur la facture.
  // Source : annuaire des entreprises, SIREN 921 098 497, établissement actif.
  name: "Platinum CBD",
  address:
    "Association déclarée (loi 1901) · RNA W442027639\n" +
    "9 rue de Beaulieu\n" +
    "44340 Bouguenais\n" +
    "France",
  siret: "921 098 497 00016",
  // Association à but non lucratif : non assujettie, donc pas de numéro de
  // TVA intracommunautaire et aucune TVA facturée.
  vatNumber: null,
  vatMention:
    "TVA non applicable — article 261-7-1° du CGI (organisme sans but lucratif)",
  vatApplicable: false,
};

/**
 * Clé du verrou consultatif Postgres qui sérialise l'attribution des numéros
 * de facture. Un verrou de transaction (`pg_advisory_xact_lock`) est relâché
 * au commit ; il évite que deux confirmations simultanées lisent le même
 * MAX(invoice_number) et tombent ensuite sur la contrainte d'unicité.
 */
const INVOICE_NUMBER_LOCK_KEY = 4120251;

/**
 * Un client Drizzle : la connexion globale ou une transaction en cours.
 */
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Prend le verrou d'attribution des numéros de facture pour toute la durée de
 * la transaction en cours. À appeler avant `generateInvoiceNumber`.
 */
export async function lockInvoiceNumbering(tx: DbClient): Promise<void> {
  // Clé en dur dans le SQL : un paramètre non typé laisserait Postgres hésiter
  // entre les surcharges (bigint) et (int, int) de la fonction.
  await tx.execute(
    sql.raw(`SELECT pg_advisory_xact_lock(${INVOICE_NUMBER_LOCK_KEY})`)
  );
}

/**
 * Calcule le prochain numéro de facture de l'année courante.
 * Format : INV-YYYY-XXXXX (p. ex. INV-2026-00001).
 *
 * Lecture seule et NON protégée contre la concurrence : n'appeler que dans une
 * transaction ayant pris `lockInvoiceNumbering`, ou via `allocateInvoiceNumber`.
 */
export async function generateInvoiceNumber(
  client: DbClient = db
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Le numéro le plus élevé de l'année : le zero-padding rend l'ordre
  // lexicographique équivalent à l'ordre numérique jusqu'à 99999.
  const lastInvoice = await client.query.registrations.findFirst({
    where: like(schema.registrations.invoiceNumber, `${prefix}%`),
    orderBy: [desc(schema.registrations.invoiceNumber)],
    columns: { invoiceNumber: true },
  });

  let sequence = 1;
  if (lastInvoice?.invoiceNumber) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(5, "0")}`;
}

/**
 * Attribue un numéro de facture à une inscription et le persiste, sous verrou.
 *
 * Idempotent : une inscription déjà numérotée conserve son numéro. À appeler
 * dans la transaction de confirmation pour que le numéro et le passage en
 * `confirmed` soient commités ensemble.
 */
export async function allocateInvoiceNumber(
  tx: DbClient,
  registrationId: string,
  now: Date = new Date()
): Promise<string> {
  await lockInvoiceNumbering(tx);

  const existing = await tx.query.registrations.findFirst({
    where: eq(schema.registrations.id, registrationId),
    columns: { invoiceNumber: true },
  });

  if (existing?.invoiceNumber) {
    return existing.invoiceNumber;
  }

  const invoiceNumber = await generateInvoiceNumber(tx);

  await tx
    .update(schema.registrations)
    .set({
      invoiceNumber,
      invoiceGeneratedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.registrations.id, registrationId));

  return invoiceNumber;
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

  // Numérotation : normalement posée lors de la confirmation du paiement. Une
  // inscription encore sans numéro en reçoit un ici, sous le même verrou, pour
  // que deux téléchargements simultanés ne produisent pas deux numéros.
  const invoiceNumber =
    registration.invoiceNumber ??
    (await db.transaction((tx) => allocateInvoiceNumber(tx, registrationId)));

  // La date de facture est celle de l'émission, pas celle du téléchargement.
  const invoiceDate = registration.invoiceGeneratedAt ?? new Date();

  // Build invoice data
  const invoiceData: InvoiceData = {
    invoiceNumber,
    invoiceDate,
    // Seller (single-tenant: Platinum CBD Cup)
    sellerName: SELLER_LEGAL.name,
    sellerAddress: SELLER_LEGAL.address ?? undefined,
    sellerSiret: SELLER_LEGAL.siret ?? undefined,
    sellerVatNumber: SELLER_LEGAL.vatNumber ?? undefined,
    sellerVatMention: SELLER_LEGAL.vatMention ?? undefined,
    sellerVatApplicable: SELLER_LEGAL.vatApplicable,
    // Buyer (producer)
    buyerName: registration.producer.user.name ?? "N/A",
    buyerCompany: registration.producer.companyName ?? undefined,
    buyerAddress: registration.producer.address ?? undefined,
    buyerSiret: registration.producer.siret ?? undefined,
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
      registration.status === "confirmed"
        ? (registration.invoiceGeneratedAt ?? registration.updatedAt)
        : undefined,
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
            React.createElement(Text, { style: styles.logoGold }, "Platinum "),
            React.createElement(Text, { style: styles.logoBlack }, "CBD Cup")
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
          ...(data.sellerAddress
            ? data.sellerAddress
                .split("\n")
                .map((line, index) =>
                  React.createElement(
                    Text,
                    { key: `seller-addr-${index}`, style: styles.partyDetail },
                    line
                  )
                )
            : [
                React.createElement(
                  Text,
                  { key: "seller-addr-todo", style: styles.partyMissing },
                  "Adresse a completer"
                ),
              ]),
          React.createElement(
            Text,
            { style: data.sellerSiret ? styles.partyDetail : styles.partyMissing },
            data.sellerSiret ? `SIRET: ${data.sellerSiret}` : "SIRET a completer"
          ),
          data.sellerVatNumber &&
            React.createElement(
              Text,
              { style: styles.partyDetail },
              `TVA: ${data.sellerVatNumber}`
            )
        ),
        // Buyer
        React.createElement(
          View,
          { style: styles.partyBox },
          React.createElement(Text, { style: styles.partyTitle }, "ACHETEUR"),
          React.createElement(Text, { style: styles.partyName }, data.buyerName),
          data.buyerCompany &&
            React.createElement(Text, { style: styles.partyDetail }, data.buyerCompany),
          ...(data.buyerAddress
            ? data.buyerAddress
                .split("\n")
                .map((line, index) =>
                  React.createElement(
                    Text,
                    { key: `buyer-addr-${index}`, style: styles.partyDetail },
                    line
                  )
                )
            : []),
          data.buyerSiret &&
            React.createElement(
              Text,
              { style: styles.partyDetail },
              `SIRET: ${data.buyerSiret}`
            )
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
          React.createElement(
            Text,
            { style: styles.totalLabel },
            data.sellerVatApplicable ? "Total HT:" : "Total:"
          ),
          React.createElement(Text, { style: styles.totalValue }, formatCurrency(data.totalAmountInCents))
        ),
        // Pas de ligne de TVA pour un émetteur non assujetti : la mention
        // d'exonération figure dans les mentions légales en bas de page.
        data.sellerVatApplicable && data.sellerVatMention
          ? React.createElement(
              View,
              { style: styles.totalRow },
              React.createElement(Text, { style: styles.totalLabel }, "TVA:"),
              React.createElement(Text, { style: styles.totalValue }, data.sellerVatMention)
            )
          : null,
        React.createElement(
          View,
          { style: [styles.totalRow, styles.grandTotal] },
          React.createElement(
            Text,
            { style: styles.totalLabel },
            data.sellerVatApplicable ? "TOTAL TTC:" : "TOTAL A PAYER:"
          ),
          React.createElement(Text, { style: styles.totalValue }, formatCurrency(data.totalAmountInCents))
        )
      ),
      // Legal mentions
      React.createElement(
        View,
        { style: styles.legalMentions },
        React.createElement(
          Text,
          { style: styles.legalLine },
          data.sellerSiret
            ? `${data.sellerName} — SIRET: ${data.sellerSiret}${data.sellerAddress ? ` — ${data.sellerAddress.replace(/\n/g, ", ")}` : ""}`
            : `${data.sellerName} — identification legale du vendeur a completer`
        ),
        React.createElement(
          Text,
          { style: styles.legalLine },
          data.sellerVatMention ?? "Regime de TVA a preciser"
        ),
        React.createElement(
          Text,
          { style: styles.legalLine },
          `Paiement effectue par carte bancaire${data.paymentDate ? ` le ${formatDate(data.paymentDate)}` : ""}`
        ),
        React.createElement(
          Text,
          { style: styles.legalLine },
          `Facture generee automatiquement par ${data.sellerName}`
        ),
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
    sellerName: SELLER_LEGAL.name,
    sellerAddress: SELLER_LEGAL.address ?? undefined,
    sellerSiret: SELLER_LEGAL.siret ?? undefined,
    sellerVatNumber: SELLER_LEGAL.vatNumber ?? undefined,
    sellerVatMention: SELLER_LEGAL.vatMention ?? undefined,
    sellerVatApplicable: SELLER_LEGAL.vatApplicable,
    buyerName: registration.producer.user.name ?? "N/A",
    buyerCompany: registration.producer.companyName ?? undefined,
    buyerAddress: registration.producer.address ?? undefined,
    buyerSiret: registration.producer.siret ?? undefined,
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
