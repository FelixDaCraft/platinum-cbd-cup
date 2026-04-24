-- Drop all cannabinoid-related columns from lab_analyses.
-- The POC scope was trimmed down to terpenes only — we no longer parse,
-- display or store any cannabinoid data.
--
-- Apply on the DEV Neon branch only:
--   pnpm tsx scripts/apply-sql.ts scripts/sql/002-drop-cannabinoids.sql

BEGIN;

ALTER TABLE lab_analyses DROP COLUMN IF EXISTS thc_total;
ALTER TABLE lab_analyses DROP COLUMN IF EXISTS cbd_total;
ALTER TABLE lab_analyses DROP COLUMN IF EXISTS cbg_total;
ALTER TABLE lab_analyses DROP COLUMN IF EXISTS cannabinoids_total;
ALTER TABLE lab_analyses DROP COLUMN IF EXISTS cannabinoids;

COMMIT;
