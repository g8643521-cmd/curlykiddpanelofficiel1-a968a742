import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (body?.healthcheck) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = {
      user_id: body.user_id ?? null,
      user_email: body.user_email ?? null,
      user_display_name: body.user_display_name ?? null,
      category: body.category ?? "general",
      action: body.action ?? "unknown",
      description: body.description ?? null,
      metadata: body.metadata ?? null,
      page_path: body.page_path ?? null,
      ip_address: body.ip_address ?? null,
      user_agent: body.user_agent ?? null,
      severity: body.severity ?? "info",
    };

    const { error } = await supabase.from("activity_log").insert(row);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
