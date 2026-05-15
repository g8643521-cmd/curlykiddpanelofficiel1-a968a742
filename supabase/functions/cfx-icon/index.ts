import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { serverCode, v } = await req.json().catch(() => ({}));
    if (!serverCode || serverCode === "__healthcheck__" || serverCode === "healthcheck") {
      return new Response(JSON.stringify({ ok: true, healthcheck: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const code = String(serverCode).trim().toLowerCase();
    const url = `https://servers-frontend.fivem.net/api/servers/icon/${code}/${v ?? 0}.png`;
    const upstream = await fetch(url);

    if (!upstream.ok) {
      // Return 200 with a 1x1 transparent PNG so callers don't treat as error
      const empty = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), c => c.charCodeAt(0));
      return new Response(empty, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "image/png", "X-Icon-Status": "missing" },
      });
    }

    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
