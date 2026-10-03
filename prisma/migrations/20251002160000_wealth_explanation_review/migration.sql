-- Wealth statement explanations / review workflow (no tax logic)
ALTER TABLE wealth_statements
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'NOT_STARTED';
