-- =============================================================================
-- Add h3_res7 / h3_res8 parent-cell columns to public.messages
--
-- Messages are always written at H3_RESOLUTION = 9 (src/lib/h3.ts), but the
-- map only renders coarser display resolutions below zoom 14 — resolution 8
-- for zoom 11-13, resolution 7 for zoom 8-10 (getResolutionForZoom in
-- src/lib/h3.ts). H3 cell strings at different resolutions never compare
-- equal as strings, so a viewport query filtering `h3_index` at the display
-- resolution returned zero rows below zoom 14.
--
-- Storing the resolution-7 and resolution-8 parent cells (computed
-- client-side via cellToParent, see src/lib/h3.ts and src/lib/messages.ts)
-- lets fetchMessagesByHexes query the column that matches whatever
-- resolution is currently displayed.
--
-- Existing rows predate this migration and have NULL h3_res7/h3_res8 — they
-- simply won't match any viewport query below zoom 14 until they expire and
-- are swept by the cleanup-expired Edge Function (48h TTL), so no backfill
-- is required.
-- =============================================================================

alter table public.messages
  add column if not exists h3_res7 text,
  add column if not exists h3_res8 text;

create index if not exists idx_messages_h3_res7 on public.messages (h3_res7);
create index if not exists idx_messages_h3_res8 on public.messages (h3_res8);
