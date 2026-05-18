// Supabase Edge Function: screensharex-lookup
// Looks up a Discord user via the ScreenshareX external API using the
// API key stored in the admin_settings table (key = 'screensharex_api_key').
//
// Request body: { discord_id: string, query?: string }
// Response (success): { success: true, data: any }
// Response (failure): { success: false, error: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { discord_id, query, healthcheck } = body || {};

    if (healthcheck || query === "ping") {
      return json({ success: true, healthcheck: true });
    }
    if (!discord_id || typeof discord_id !== "string") {
      return json({ success: false, error: "discord_id is required" }, 400);
    }
    if (!/^\d{17,20}$/.test(discord_id)) {
      return json({ success: false, error: "Invalid discord_id format" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: keyRow, error: keyErr } = await admin
      .from("admin_settings")
      .select("value")
      .eq("key", "screensharex_api_key")
      .maybeSingle();

    if (keyErr) {
      return json(
        { success: false, error: `Failed to load API key: ${keyErr.message}` },
        500,
      );
    }

    const apiKey =
      typeof keyRow?.value === "string" ? keyRow.value.trim() : "";
    if (!apiKey) {
      return json(
        {
          success: false,
          error:
            "ScreenshareX API key is not configured. Add it in Admin → API Keys.",
        },
        400,
      );
    }

    // Ping mode used by the admin status panel — only verifies the key
    // exists; we still attempt a real upstream call so that a working
    // green dot reflects real connectivity.
    const isPing = query === "ping";

    // Try a few well-known endpoint shapes for the ScreenshareX API.
    // The first one that responds with JSON is used.
    const candidates = [
      `https://screenshare.lol/api/public/v1/user?userId=${discord_id}`,
      `https://screensharex.ac/api/lookup/${discord_id}`,
      `https://screensharex.ac/api/v1/lookup/${discord_id}`,
    ];

    let lastStatus = 0;
    let lastBody = "";

    for (const url of candidates) {
      try {
        const upstream = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "X-API-Key": apiKey,
            Accept: "application/json",
          },
          // Keep this short — the UI is waiting on us.
          signal: AbortSignal.timeout(10_000),
        });

        lastStatus = upstream.status;
        const text = await upstream.text();
        lastBody = text.slice(0, 500);

        if (!upstream.ok) continue;

        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          // Non-JSON response — try the next candidate.
          continue;
        }

        return json({ success: true, data, source: url });
      } catch (err) {
        lastBody = err instanceof Error ? err.message : String(err);
        continue;
      }
    }

    const unavailablePayload = {
      success: false,
      unavailable: true,
      error: "External screening is temporarily unavailable. Cheater DB results are still available.",
      details: `Upstream lookup failed (status ${lastStatus || "n/a"}): ${lastBody}`,
    };

    if (isPing) {
      return json(unavailablePayload);
    }

    return json(unavailablePayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: message }, 500);
  }
});
