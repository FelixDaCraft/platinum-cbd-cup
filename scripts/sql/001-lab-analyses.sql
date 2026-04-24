-- Lab analyses table (POC — SpectralFingerprints cannabinoid/terpene reports).
-- Targeted migration written by hand to avoid triggering unrelated drift
-- (e.g. portal_themes.hero_3d_* columns removal) that drizzle-kit push would
-- want to apply as a side effect.
--
-- Apply on the DEV Neon branch only:
--   psql "$DATABASE_URL" -f scripts/sql/001-lab-analyses.sql

BEGIN;

CREATE TABLE IF NOT EXISTS lab_analyses (
  id                   text PRIMARY KEY,
  product_id           text NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,

  pdf_url              text NOT NULL,
  pdf_filename         text NOT NULL,

  lab_name             text NOT NULL,
  analysis_number      text,
  sfp_code             text,
  serial               text,
  product_description  text,
  sample_type          text,
  method_name          text,
  received_at          text,
  approved_at          text,

  thc_total            numeric(5,2),
  cbd_total            numeric(5,2),
  cbg_total            numeric(5,2),
  cannabinoids_total   numeric(5,2),
  terpenes_total       numeric(5,2),
  computed_terpene_sum numeric(5,2),

  cannabinoids         jsonb NOT NULL DEFAULT '[]'::jsonb,
  terpenes             jsonb NOT NULL DEFAULT '[]'::jsonb,

  uploaded_by          text REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at          timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now(),
  parser_version       integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS lab_analyses_terpenes_total_idx
  ON lab_analyses (terpenes_total);

CREATE INDEX IF NOT EXISTS lab_analyses_product_id_idx
  ON lab_analyses (product_id);

COMMIT;
