const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const cleanCode = (value: unknown) => String(value || "").replace(/[^a-zA-Z0-9]/g, "").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const serverCode = cleanCode(body.serverCode || body.code || body.query);
    if (serverCode === "healthcheck" || body?.healthcheck) return json({ ok: true, healthcheck: true });
    if (!serverCode) return json({ success: false, error: "Valid serverCode is required", invalid: true });

    const upstream = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverCode}`, {
      headers: { Accept: "application/json", "User-Agent": "CurlyKiddPanel/1.0" },
      signal: AbortSignal.timeout(9000),
    });

    if (!upstream.ok) {
      return json({
        success: false,
        error: upstream.status === 404 ? "Server not found" : "Lookup failed",
        notFound: upstream.status === 404,
        fallback: upstream.status !== 404,
        status: upstream.status,
      });
    }

    const payload = await upstream.json();
    const data = payload?.Data || payload?.data || payload;
    const vars = data?.vars || {};
    const endpoints = Array.isArray(data?.connectEndPoints) ? data.connectEndPoints : [];
    const [ip, rawPort] = String(endpoints[0] || "").split(":");

    return json({
      success: true,
      hostname: data?.hostname || data?.sv_projectName || serverCode,
      players: Array.isArray(data?.players) ? data.players : [],
      playerCount: Number(data?.clients ?? 0),
      maxPlayers: Number(data?.sv_maxclients || vars.sv_maxClients || 0),
      resources: Array.isArray(data?.resources) ? data.resources : [],
      server: serverCode,
      vars,
      ip: ip || null,
      port: rawPort ? Number(rawPort) : undefined,
      iconVersion: data?.iconVersion ?? null,
      ownerName: data?.ownerName ?? null,
      ownerProfile: data?.ownerProfile ?? null,
      ownerAvatar: data?.ownerAvatar ?? null,
      enhancedHostSupport: !!data?.enhancedHostSupport,
      private: !!data?.private,
      projectName: vars.sv_projectName || data?.sv_projectName || null,
      projectDesc: vars.sv_projectDesc || null,
      tags: vars.tags || "",
      locale: vars.locale || null,
      licenseKeyToken: data?.licenseKeyToken || null,
      premiumTier: data?.premium || data?.premiumTier || null,
      banner: vars.banner_detail || vars.banner_connecting || null,
    });
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Lookup failed", fallback: true });
  }
});