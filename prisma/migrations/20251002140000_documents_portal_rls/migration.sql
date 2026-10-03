-- Portal sessions must only see their own client's documents (app-layer alone is insufficient
-- under FORCE RLS + firm-scoped policy). Staff keeps firm-wide document access.

DROP POLICY IF EXISTS documents_isolation ON documents;

CREATE POLICY documents_isolation ON documents
  FOR ALL
  USING (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND (
      current_setting('app.session_type', true) = 'staff'
      OR (
        current_setting('app.session_type', true) = 'portal'
        AND client_id::text = current_setting('app.current_client_id', true)
      )
    )
  )
  WITH CHECK (
    firm_id = NULLIF(current_setting('app.current_firm_id', true), '')
    AND (
      current_setting('app.session_type', true) = 'staff'
      OR (
        current_setting('app.session_type', true) = 'portal'
        AND client_id::text = current_setting('app.current_client_id', true)
      )
    )
  );
