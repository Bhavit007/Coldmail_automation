-- Step 2: columns for scoring, enrichment and the basic landing page. Safe to run more than once.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS website_score    int,
  ADD COLUMN IF NOT EXISTS website_notes    text,
  ADD COLUMN IF NOT EXISTS enrichment_score int,
  ADD COLUMN IF NOT EXISTS enrichment       jsonb,
  ADD COLUMN IF NOT EXISTS landing_html     text,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS processed_at     timestamptz;
