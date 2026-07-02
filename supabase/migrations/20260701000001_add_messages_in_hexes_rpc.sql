-- =============================================================================
-- Add public.messages_in_hexes(hexes, res) RPC
--
-- fetchMessagesByHexes (src/lib/messages.ts) used to call supabase-js
-- `.in(column, h3Indices)`, which supabase-js implements as a GET request
-- with the hex ID list embedded in the querystring. At zoom 8-10 the
-- viewport can hold hundreds-to-thousands of resolution-7 H3 cells (~17
-- bytes each), producing 20-30 KB URLs. The self-hosted Supabase proxy
-- (nginx/Kong) has an ~8 KB header buffer and rejects requests that large,
-- surfacing as `net::ERR_FAILED` plus a secondary CORS error in the browser
-- (Kong never gets far enough to attach CORS headers to its rejection).
--
-- Moving the same query into a Postgres function called via
-- `supabase.rpc(...)` swaps the GET for a POST with the hex list in the
-- body instead of the URL, sidestepping the header-buffer limit entirely.
-- The 48h cutoff, ordering, and row limit that used to live in the
-- query-builder chain (`.gte(...)`, `.order(...)`, `.limit(...)`) now live
-- here so the client-side call is just the hex list and the display
-- resolution.
--
-- The res -> column mapping mirrors columnForResolution in src/lib/h3.ts
-- (kept and still tested in src/lib/h3.test.ts as the source-of-truth
-- contract this SQL replicates).
-- =============================================================================

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
