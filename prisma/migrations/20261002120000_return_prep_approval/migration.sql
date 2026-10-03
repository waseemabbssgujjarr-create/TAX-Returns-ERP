-- Return preparation approval / reviewer metadata (Phase 8 completion)
ALTER TABLE "return_preparations"
  ADD COLUMN IF NOT EXISTS "assigned_reviewer_id" TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submitted_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "approval_comment" VARCHAR(2000);

CREATE INDEX IF NOT EXISTS "return_preparations_firm_id_review_status_idx"
  ON "return_preparations"("firm_id", "review_status");
