-- Password reset tokens (staff accounts)

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_password_reset_sent_at" TIMESTAMPTZ;

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "firm_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_firm_id_user_id_idx" ON "password_reset_tokens"("firm_id", "user_id");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY password_reset_tokens_isolation ON password_reset_tokens
  FOR ALL
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));
