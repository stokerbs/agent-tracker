-- Security fix: SUPERVISOR must not see client (customer) PII.
--
-- 0087 scoped supervisor access for cases/evidence/invoices/messages/relationships
-- but the `clients` table was left on the original 0003 policies, which use
-- is_staff() (= admin OR supervisor). A supervisor could therefore SELECT every
-- client row (name, company, email, phone, address) via the /clients page, the
-- invoice/case client pickers, and global search.
--
-- Product decision: the clients module is ADMIN-ONLY. Restrict the clients table
-- to admins (full manage) plus each client reading their own row (portal). Agents
-- were never staff, so they are unaffected.
--
-- Recreate both policies (DROP old + CREATE) preserving command and permissive
-- flag; only the predicate narrows from is_staff() to is_admin(). Idempotent.

BEGIN;

-- SELECT: admin sees all clients; a client reads only their own linked row.
DROP POLICY IF EXISTS "clients staff read" ON public.clients;
CREATE POLICY "clients admin read" ON public.clients
  AS PERMISSIVE FOR SELECT TO public
  USING (public.is_admin() OR profile_id = auth.uid());

-- ALL (manage): admin only.
DROP POLICY IF EXISTS "clients staff write" ON public.clients;
CREATE POLICY "clients admin write" ON public.clients
  AS PERMISSIVE FOR ALL TO public
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
