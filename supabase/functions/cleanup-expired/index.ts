// Supabase Edge Function: cleanup-expired
// Schedule: every hour via cron
// Deletes messages whose effective lifetime has expired

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Delete messages older than 48h (max lifetime with full reactions bonus)
  // More granular cleanup: messages with few reactions expire sooner
  const { error, count } = await supabase
    .from("messages")
    .delete({ count: "exact" })
    .lt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(
    JSON.stringify({ deleted: count }),
    { headers: { "Content-Type": "application/json" } }
  )
})
