-- Phases 7–11: wealth, withholding, return prep, tax planning, notices, compliance, billing
-- Note: all tenant IDs are TEXT (Prisma String), not PostgreSQL uuid type.

CREATE TYPE "WealthStatementStatus" AS ENUM ('DRAFT', 'RECONCILED', 'DISCREPANCY');

CREATE TABLE "wealth_statements" (
    "id" TEXT NOT NULL,
    "tax_year_file_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "opening_wealth_paisa" BIGINT NOT NULL,
    "closing_wealth_paisa" BIGINT NOT NULL,
    "income_total_paisa" BIGINT NOT NULL,
    "expense_total_paisa" BIGINT NOT NULL,
    "tax_total_paisa" BIGINT NOT NULL,
    "discrepancy_paisa" BIGINT NOT NULL,
    "status" "WealthStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wealth_statements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wealth_statements_tax_year_file_id_key" ON "wealth_statements"("tax_year_file_id");
CREATE INDEX "wealth_statements_firm_id_idx" ON "wealth_statements"("firm_id");

ALTER TABLE "wealth_statements" ADD CONSTRAINT "wealth_statements_tax_year_file_id_fkey"
  FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "WithholdingSource" AS ENUM (
  'SALARY', 'BANK', 'UTILITIES', 'VEHICLE', 'PROPERTY', 'CASH', 'OTHER'
);

CREATE TABLE "withholding_entries" (
    "id" TEXT NOT NULL,
    "tax_year_file_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "source" "WithholdingSource" NOT NULL,
    "amount_paisa" BIGINT NOT NULL,
    "certificate_ref" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withholding_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "withholding_entries_tax_year_file_id_idx" ON "withholding_entries"("tax_year_file_id");
CREATE INDEX "withholding_entries_firm_id_idx" ON "withholding_entries"("firm_id");

ALTER TABLE "withholding_entries" ADD CONSTRAINT "withholding_entries_tax_year_file_id_fkey"
  FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ReturnPrepReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED');

CREATE TABLE "return_preparations" (
    "id" TEXT NOT NULL,
    "tax_year_file_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "structured_json" JSONB NOT NULL DEFAULT '{}',
    "review_status" "ReturnPrepReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_preparations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "return_preparations_tax_year_file_id_key" ON "return_preparations"("tax_year_file_id");
CREATE INDEX "return_preparations_firm_id_idx" ON "return_preparations"("firm_id");

ALTER TABLE "return_preparations" ADD CONSTRAINT "return_preparations_tax_year_file_id_fkey"
  FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tax_plan_scenarios" (
    "id" TEXT NOT NULL,
    "tax_year_file_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "rules_version" TEXT,
    "outcome_json" JSONB,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_plan_scenarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tax_plan_scenarios_tax_year_file_id_created_at_idx"
  ON "tax_plan_scenarios"("tax_year_file_id", "created_at" DESC);
CREATE INDEX "tax_plan_scenarios_firm_id_idx" ON "tax_plan_scenarios"("firm_id");

ALTER TABLE "tax_plan_scenarios" ADD CONSTRAINT "tax_plan_scenarios_tax_year_file_id_fkey"
  FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tax_plan_scenarios" ADD CONSTRAINT "tax_plan_scenarios_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "NoticeStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "tax_year_file_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "assignee_id" TEXT,
    "status" "NoticeStatus" NOT NULL DEFAULT 'OPEN',
    "document_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notices_firm_id_status_idx" ON "notices"("firm_id", "status");
CREATE INDEX "notices_client_id_idx" ON "notices"("client_id");

ALTER TABLE "notices" ADD CONSTRAINT "notices_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notices" ADD CONSTRAINT "notices_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notices" ADD CONSTRAINT "notices_tax_year_file_id_fkey"
  FOREIGN KEY ("tax_year_file_id") REFERENCES "tax_year_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notices" ADD CONSTRAINT "notices_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "ComplianceEventKind" AS ENUM ('DEADLINE', 'REMINDER', 'INFO_REQUEST', 'FILING');

CREATE TABLE "compliance_events" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "client_id" TEXT,
    "tax_year_file_id" TEXT,
    "kind" "ComplianceEventKind" NOT NULL,
    "title" TEXT NOT NULL,
    "event_at" TIMESTAMP(3) NOT NULL,
    "reminder_sent_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compliance_events_firm_id_event_at_idx" ON "compliance_events"("firm_id", "event_at");
CREATE INDEX "compliance_events_event_at_reminder_sent_at_idx"
  ON "compliance_events"("event_at", "reminder_sent_at");

ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID');

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "amount_paisa" BIGINT NOT NULL,
    "balance_paisa" BIGINT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "visible_to_client" BOOLEAN NOT NULL DEFAULT false,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_firm_id_invoice_number_key" ON "invoices"("firm_id", "invoice_number");
CREATE INDEX "invoices_firm_id_client_id_idx" ON "invoices"("firm_id", "client_id");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount_paisa" BIGINT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");
CREATE INDEX "payments_firm_id_idx" ON "payments"("firm_id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security (FORCE) — firm_id isolation; portal reads via client subquery where needed

ALTER TABLE wealth_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE withholding_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_plan_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE wealth_statements FORCE ROW LEVEL SECURITY;
ALTER TABLE withholding_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE return_preparations FORCE ROW LEVEL SECURITY;
ALTER TABLE tax_plan_scenarios FORCE ROW LEVEL SECURITY;
ALTER TABLE notices FORCE ROW LEVEL SECURITY;
ALTER TABLE compliance_events FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY wealth_statements_isolation ON wealth_statements
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

CREATE POLICY withholding_entries_isolation ON withholding_entries
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

CREATE POLICY return_preparations_isolation ON return_preparations
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

CREATE POLICY tax_plan_scenarios_isolation ON tax_plan_scenarios
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''))
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), ''));

CREATE POLICY notices_staff ON notices
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  );

CREATE POLICY notices_portal ON notices
  FOR SELECT
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'portal'
    AND client_id::text = current_setting('app.current_client_id', true)
  );

CREATE POLICY compliance_events_staff ON compliance_events
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  );

CREATE POLICY compliance_events_portal ON compliance_events
  FOR SELECT
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'portal'
    AND client_id::text = current_setting('app.current_client_id', true)
  );

CREATE POLICY invoices_staff ON invoices
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  );

CREATE POLICY invoices_portal ON invoices
  FOR SELECT
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'portal'
    AND client_id::text = current_setting('app.current_client_id', true)
    AND visible_to_client = true
  );

CREATE POLICY payments_staff ON payments
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND current_setting('app.session_type', true) = 'staff'
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wealth_statements TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE withholding_entries TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE return_preparations TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tax_plan_scenarios TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notices TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE compliance_events TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE invoices TO taxdesk_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payments TO taxdesk_app;
  END IF;
END
$$;
