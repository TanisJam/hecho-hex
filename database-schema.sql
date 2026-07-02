-- =============================================================================
-- EchoHex — database-schema.sql
-- Reconstructed schema for the self-hosted Supabase (Postgres + GoTrue + Realtime)
-- backend. The original hosted Supabase project is gone; this file is rebuilt
-- from application source (src/types/database.ts, src/lib/messages.ts,
-- src/lib/session.ts, src/hooks/use-realtime-messages.ts, README.md,
-- supabase/functions/cleanup-expired/index.ts).
--
-- There is NO Supabase Auth usage in this app. User identity is a client-side
-- crypto.randomUUID() persisted in sessionStorage (src/lib/session.ts) and sent
-- as the `temp_user_id` column on every insert — it is NOT tied to auth.users.
--
-- Intended to be loaded via: psql -f database-schema.sql
-- against a fresh self-hosted Postgres that already has PostGIS + GoTrue/Realtime
-- running, but no application schema yet.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLE: public.messages
-- Column shape is authoritative from src/types/database.ts (Row/Insert/Update).
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
  -- Row/Insert: id is optional on insert (has a default), always present on
  -- read. src/types/database.ts:6,15
  id uuid primary key default gen_random_uuid(),

  -- Row/Insert: h3_index is required (never optional) on both Row and Insert.
  -- src/types/database.ts:7,16. Plain text — H3 indexing happens client-side
  -- (h3-js), no PostGIS geometry involved.
  h3_index text not null,

  -- Row/Insert: h3_res7 / h3_res8 are the resolution-7 and resolution-8
  -- parent cells of h3_index, computed client-side via
  -- cellToParent(h3_index, 7|8) (src/lib/h3.ts, src/lib/messages.ts).
  -- Nullable — the map renders coarser display resolutions below zoom 14
  -- (getResolutionForZoom), and h3_index alone never string-matches across
  -- resolutions, so these columns let fetchMessagesByHexes query the column
  -- matching the resolution actually displayed. Added by migration
  -- supabase/migrations/20260701000000_add_h3_parent_columns.sql; rows
  -- written before that migration have NULL here and age out via the 48h
  -- expiry window instead of being backfilled.
  h3_res7 text,
  h3_res8 text,

  -- Row/Insert: content is required (never optional).
  -- src/types/database.ts:8,17
  -- CHECK grounded in src/lib/messages.ts:15-17 (client enforces 200 char cap
  -- before insert; mirrored server-side as a defensive constraint).
  content text not null check (char_length(content) <= 200),

  -- Row/Insert: pos_relative is `{ x: number; y: number }`, optional on
  -- Insert (defaulted), always present on Row. src/types/database.ts:9,18
  -- Modeled as jsonb (not a PostGIS geometry — this is a UI-relative
  -- coordinate for bubble placement inside a hex, per src/lib/messages.ts:24-27).
  pos_relative jsonb not null default '{"x": 0.5, "y": 0.5}'::jsonb,

  -- Row/Insert: reactions is `Record<string, number>`, optional on Insert
  -- (defaulted to empty map), always present on Row.
  -- src/types/database.ts:10,19. Mutated only via increment_reaction() below.
  reactions jsonb not null default '{}'::jsonb,

  -- Row/Insert: created_at is optional on Insert (has a default), always
  -- present on Row. src/types/database.ts:11,20. Drives the 48h expiry window
  -- used both client-side (src/lib/messages.ts:42,48) and by the
  -- cleanup-expired Edge Function (supabase/functions/cleanup-expired/index.ts:18).
  created_at timestamptz not null default now(),

  -- Row/Insert: temp_user_id is required (never optional) on both Row and
  -- Insert. src/types/database.ts:12,21. Value is always a
  -- crypto.randomUUID() string minted client-side (src/lib/session.ts:8),
  -- NOT a Supabase Auth user id — there is no auth.users FK here.
  temp_user_id uuid not null
);

comment on table public.messages is
  'Geospatial message board rows. No Supabase Auth: temp_user_id is a client-generated anonymous UUID (see src/lib/session.ts).';

-- -----------------------------------------------------------------------------
-- 2. INDEXES
-- fetchMessagesByHexes (src/lib/messages.ts:44-50) filters `.in("h3_index", ...)`
-- and `.gte("created_at", cutoff)`, then `.order("created_at", desc)`.
-- -----------------------------------------------------------------------------
create index if not exists idx_messages_h3_index on public.messages (h3_index);
create index if not exists idx_messages_h3_res7 on public.messages (h3_res7);
create index if not exists idx_messages_h3_res8 on public.messages (h3_res8);
create index if not exists idx_messages_created_at on public.messages (created_at);

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.messages enable row level security;

-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES (anon role only)
-- The app only ever talks to Supabase using NEXT_PUBLIC_SUPABASE_ANON_KEY
-- (README.md:63); there is no authenticated-user flow. Policies below are
-- INFERRED from what the client code actually does — no original policy
-- definitions survive.
-- -----------------------------------------------------------------------------

-- NOTE: CREATE POLICY has no IF NOT EXISTS clause in Postgres, so idempotency
-- is achieved via DROP POLICY IF EXISTS + CREATE POLICY instead.

-- INFERRED: the message feed is public read-only data (any visitor sees any
-- hex's messages once fetched into their viewport) — fetchMessagesByHexes
-- (src/lib/messages.ts:37-54) runs unauthenticated via the anon key with no
-- ownership filter, so SELECT must be open to anon.
drop policy if exists "anon can read messages" on public.messages;
create policy "anon can read messages"
  on public.messages
  for select
  to anon
  using (true);

-- INFERRED: createMessage (src/lib/messages.ts:19-34) inserts a new row using
-- only the anon key and a client-supplied temp_user_id — there's no server
-- session to check identity against, so INSERT must be open to anon. The
-- hex-membership and length checks are enforced client-side
-- (src/lib/messages.ts:11-17) only; no equivalent DB-level CHECK is inferred
-- for hex membership because H3 containment logic isn't available in SQL here.
drop policy if exists "anon can create messages" on public.messages;
create policy "anon can create messages"
  on public.messages
  for insert
  to anon
  with check (true);

-- No UPDATE policy for anon: reactions are only ever mutated via the
-- SECURITY DEFINER function increment_reaction() below, which runs as the
-- function owner and bypasses the need for a row-level UPDATE grant to anon.
-- No DELETE policy for anon: expiry is handled exclusively by the
-- cleanup-expired Edge Function using the service_role key
-- (supabase/functions/cleanup-expired/index.ts:8,11), which bypasses RLS
-- entirely — no policy is required or should exist for that path.

-- -----------------------------------------------------------------------------
-- 5. FUNCTION: public.increment_reaction(msg_id uuid, emoji text)
-- Contract per README.md:87: "atomically increments reactions->emoji on the
-- target row." Exact implementation body is INFERRED — the original function
-- source did not survive; this is a standard jsonb read-modify-write pattern
-- consistent with the documented contract and with how src/lib/messages.ts:56-65
-- calls it (rpc("increment_reaction", { msg_id, emoji })).
-- -----------------------------------------------------------------------------
create or replace function public.increment_reaction(msg_id uuid, emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- INFERRED body: atomically bump reactions->>emoji by 1, starting at 1 if
  -- the key is absent, using jsonb_set + COALESCE as specified.
  update public.messages
  set reactions = jsonb_set(
    reactions,
    array[emoji],
    to_jsonb(coalesce((reactions ->> emoji)::int, 0) + 1)
  )
  where id = msg_id;
end;
$$;

comment on function public.increment_reaction(uuid, text) is
  'INFERRED from README.md contract: atomically increments reactions->emoji on a messages row. SECURITY DEFINER so anon callers do not need table UPDATE rights.';

grant execute on function public.increment_reaction(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. FUNCTION: public.messages_in_hexes(hexes text[], res int)
-- Added by migration
-- supabase/migrations/20260701000001_add_messages_in_hexes_rpc.sql.
--
-- fetchMessagesByHexes (src/lib/messages.ts) used to filter with supabase-js
-- `.in(column, h3Indices)`, which supabase-js sends as a GET with the hex
-- list embedded in the querystring. At zoom 8-10 the viewport can hold
-- hundreds-to-thousands of resolution-7 H3 cells (~17 bytes each), producing
-- 20-30 KB URLs — well past the ~8 KB header buffer on the self-hosted
-- nginx/Kong proxy, which rejects the request outright (`net::ERR_FAILED`,
-- plus a secondary CORS error since Kong never attaches CORS headers to its
-- own rejection). Calling this function via `supabase.rpc(...)` instead
-- sends the hex list as a POST body, avoiding the URL-length limit.
--
-- The 48h cutoff, ordering, and row limit that used to live in the
-- query-builder chain now live here. The `res` -> column mapping mirrors
-- columnForResolution in src/lib/h3.ts (kept and tested in
-- src/lib/h3.test.ts as the source-of-truth contract this SQL replicates).
-- -----------------------------------------------------------------------------
create or replace function public.messages_in_hexes(hexes text[], res int)
returns setof public.messages
language sql
stable
set search_path = public
as $$
  select *
  from public.messages
  where created_at >= now() - interval '48 hours'
    and (
      case
        when res >= 9 then h3_index
        when res = 8 then h3_res8
        else h3_res7
      end
    ) = any(hexes)
  order by created_at desc
  limit 200;
$$;

grant execute on function public.messages_in_hexes(text[], int) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. REALTIME
-- src/hooks/use-realtime-messages.ts:31-67 subscribes to postgres_changes on
-- { schema: "public", table: "messages" }, so the table must be published.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 8. GRANTS
-- Mirrors the standard Supabase anon/authenticated grant shape so RLS is the
-- only gate the anon role has to pass (grants without RLS-open policies would
-- otherwise still deny access).
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert on public.messages to anon, authenticated;
