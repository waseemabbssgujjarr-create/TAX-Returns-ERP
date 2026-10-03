-- Repair firm_directory sync: UPDATE must upsert when the directory row is missing
-- (e.g. after a mistaken orphan wipe under FORCE RLS). Also backfill from firms.

CREATE OR REPLACE FUNCTION sync_firm_directory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO firm_directory (firm_id, slug, is_active)
    VALUES (NEW.id, NEW.slug, NEW."isActive")
    ON CONFLICT (firm_id) DO UPDATE
      SET slug = EXCLUDED.slug,
          is_active = EXCLUDED.is_active;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM firm_directory WHERE firm_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxdesk_migrations') THEN
    ALTER FUNCTION sync_firm_directory() OWNER TO taxdesk_migrations;
  END IF;
END
$$;

-- Backfill under FORCE RLS: briefly disable RLS on firms so the table owner can
-- read all rows for catalog repair, then restore ENABLE + FORCE.
ALTER TABLE firms DISABLE ROW LEVEL SECURITY;

INSERT INTO firm_directory (firm_id, slug, is_active)
SELECT id, slug, "isActive" FROM firms
ON CONFLICT (firm_id) DO UPDATE
  SET slug = EXCLUDED.slug,
      is_active = EXCLUDED.is_active;

ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE firms FORCE ROW LEVEL SECURITY;
