import {
  pgTable,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { products } from "./products";
import { users } from "./auth";

/**
 * Compound row as stored in jsonb. Mirrors CompoundRow in the parser so
 * we can serialize parser output directly into the DB.
 */
export type StoredCompoundRow = {
  abbreviation: string;
  name: string;
  percentage: number | null;
  flag: "ND" | "LOQ" | "value";
  uncertainty: number | null;
};

/**
 * Lab analyses table — one analysis per product. Re-uploading a lab report
 * overwrites the existing row (we only keep the latest test).
 *
 * Populated from SpectralFingerprints (SFP) GC-FID certificates for now,
 * but the schema is generic enough to support other labs later via labName.
 */
export const labAnalyses = pgTable(
  "lab_analyses",
  {
    id: text("id").primaryKey(), // nanoid

    // 1 analysis per product — the unique index enforces "overwrite on
    // re-upload" at the DB level.
    productId: text("product_id")
      .notNull()
      .unique()
      .references(() => products.id, { onDelete: "cascade" }),

    // Original PDF stored on disk (public/uploads/lab-analyses/...).
    pdfUrl: text("pdf_url").notNull(),
    pdfFilename: text("pdf_filename").notNull(),

    // Lab metadata
    labName: text("lab_name").notNull(), // e.g. "SpectralFingerprints"
    analysisNumber: text("analysis_number"),
    sfpCode: text("sfp_code"),
    serial: text("serial"),
    productDescription: text("product_description"),
    sampleType: text("sample_type"),
    methodName: text("method_name"),
    receivedAt: text("received_at"), // lab-provided date string (YYYY-MM-DD)
    approvedAt: text("approved_at"),

    // Terpenes total — reported by the lab. Indexed for fast ranking queries.
    // Stored as numeric but indexed so `ORDER BY terpenes_total DESC` is cheap.
    terpenesTotal: numeric("terpenes_total", { precision: 5, scale: 2 }),

    // Sum computed from the individual terpene rows (ignoring ND/LOQ).
    // Used as a sanity check vs terpenesTotal and as a fallback ranking key.
    computedTerpeneSum: numeric("computed_terpene_sum", {
      precision: 5,
      scale: 2,
    }),

    // Full terpene list as jsonb — preserved for downstream bar charts
    // (top 10 in the dialog preview, synthesis PDF, ranking view).
    terpenes: jsonb("terpenes")
      .$type<StoredCompoundRow[]>()
      .notNull()
      .default([]),

    // Audit trail
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),

    // Parser version — lets us re-parse old uploads if we fix the parser.
    parserVersion: integer("parser_version").notNull().default(1),
  },
  (table) => [
    // Ranking by terpenes within a cup/category hits this index.
    index("lab_analyses_terpenes_total_idx").on(table.terpenesTotal),
    index("lab_analyses_product_id_idx").on(table.productId),
  ],
);

export const labAnalysesRelations = relations(labAnalyses, ({ one }) => ({
  product: one(products, {
    fields: [labAnalyses.productId],
    references: [products.id],
  }),
  uploader: one(users, {
    fields: [labAnalyses.uploadedBy],
    references: [users.id],
  }),
}));

export type LabAnalysis = typeof labAnalyses.$inferSelect;
export type NewLabAnalysis = typeof labAnalyses.$inferInsert;
