-- Document taxonomy expansion (closes roadmap gap: AOP/company/CNIC/NTN/CPR docs)
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'CNIC_COPY';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'NTN_CERTIFICATE';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'AOP_PARTNERSHIP_DEED';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'COMPANY_INCORPORATION_DOCUMENT';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'PRIOR_RETURN_COPY';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'CPR_PAYMENT_RECEIPT';

-- WHT statement IRIS-gate fields (registration no / code / name / transaction date
-- validation mirroring IRIS Data-tab statuses, plus CPR-before-submit gate)
ALTER TABLE withholding_entries
  ADD COLUMN IF NOT EXISTS registration_no TEXT,
  ADD COLUMN IF NOT EXISTS payee_name TEXT,
  ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS wht_code TEXT,
  ADD COLUMN IF NOT EXISTS exemption_code TEXT,
  ADD COLUMN IF NOT EXISTS cpr_reference TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'NOT_CHECKED';
