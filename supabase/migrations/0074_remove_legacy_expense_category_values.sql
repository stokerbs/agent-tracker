-- Migration 0074 — Remove legacy 'food' and 'hotel' values from expense_category
--
-- The expense_category enum was created in 0001 as
-- ('fuel','toll','parking','food','hotel','misc'). In 0052 four new values were
-- appended via ALTER TYPE ... ADD VALUE ('meals','accommodation',
-- 'transportation','office'), and in 0053 the legacy data was remapped
-- (food→meals, hotel→accommodation). The 'food' and 'hotel' labels are now
-- dead — no row should carry them — but they linger in the enum because
-- PostgreSQL cannot DROP VALUE from an enum. Removing them therefore requires a
-- TYPE SWAP: create a replacement enum without the legacy labels, repoint every
-- consumer at it, drop the old type, and rename the new one into place.
--
-- TWO consumers depend on the old type and BOTH must be detached inside this
-- single transaction or DROP TYPE will fail:
--   Consumer A — column public.expenses.category (NOT NULL, DEFAULT 'misc').
--                The default is dropped first (it is typed to the old enum),
--                the column is swapped via a text round-trip cast (which
--                preserves NOT NULL automatically), then the default is re-added
--                cast to the new type.
--   Consumer B — function public.monthly_expense_summary(date), whose
--                RETURNS TABLE references expense_category. It is dropped before
--                the swap and recreated VERBATIM from 0002 afterwards, so it
--                rebinds to the renamed type with no behavioural change.
--
-- The surviving values keep their original relative order:
--   fuel, toll, parking, misc, meals, accommodation, transportation, office.
--
-- TD-10 / Register #20.
--
-- Schema-qualified public. No CASCADE: both dependents are detached explicitly
-- above, so DROP TYPE has nothing left to cascade; CASCADE would be unsafe (it
-- could silently drop an unexpected dependent) and is deliberately omitted.
-- The generated src/lib/database.types.ts still lists 'food'/'hotel' as a stale
-- static string-literal union (harmless, non-breaking); it will be cleared on
-- the next `supabase gen types` regeneration (separate follow-up).

BEGIN;

-- (a) Safety remap: re-apply the 0053 mapping so any stray legacy row is converted
--     before the cast (idempotent; expected to affect 0 rows post-0053).
UPDATE public.expenses SET category = 'meals'::public.expense_category        WHERE category = 'food';
UPDATE public.expenses SET category = 'accommodation'::public.expense_category WHERE category = 'hotel';

-- (b) New enum with food/hotel removed, surviving values in the same relative order.
CREATE TYPE public.expense_category_new AS ENUM
  ('fuel', 'toll', 'parking', 'misc', 'meals', 'accommodation', 'transportation', 'office');

-- (c) Drop the column default (typed to the old enum) and the dependent function.
ALTER TABLE public.expenses ALTER COLUMN category DROP DEFAULT;
DROP FUNCTION IF EXISTS public.monthly_expense_summary(date);

-- (d) Swap the column type via the text round-trip cast.
ALTER TABLE public.expenses
  ALTER COLUMN category TYPE public.expense_category_new
  USING category::text::public.expense_category_new;

-- (e) Re-add the default, cast to the new type.
ALTER TABLE public.expenses ALTER COLUMN category SET DEFAULT 'misc'::public.expense_category_new;

-- (f) Drop the old type and rename the new one into place.
DROP TYPE public.expense_category;
ALTER TYPE public.expense_category_new RENAME TO expense_category;

-- Recreate monthly_expense_summary VERBATIM from 0002 (now binds to the renamed type).
create or replace function public.monthly_expense_summary(p_month date default date_trunc('month', current_date)::date)
returns table (
  agent_id uuid,
  agent_name text,
  category expense_category,
  total numeric,
  entries bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.agent_id,
    a.full_name,
    e.category,
    sum(e.amount) as total,
    count(*) as entries
  from public.expenses e
  left join public.agents a on a.id = e.agent_id
  where date_trunc('month', e.expense_date) = date_trunc('month', p_month)
  group by e.agent_id, a.full_name, e.category
  order by a.full_name, e.category;
$$;

COMMIT;
