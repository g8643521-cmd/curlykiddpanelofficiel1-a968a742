import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getDiscordCredentials(): Promise<{ id: string; secret: string }> {
  const secret = process.env.DISCORD_CLIENT_SECRET ?? "";
  let id = "";
  try {
    const { data } = await supabaseAdmin
      .from("admin_settings")
      .select("key, value")
      .eq("key", "discord_client_id");
    for (const row of data ?? []) {
      if (row.key === "discord_client_id" && row.value) id = row.value as string;
    }
  } catch (e) {
    console.warn("[discord-oauth] failed to read client id from DB:", e);
  }
  if (!id) id = process.env.DISCORD_CLIENT_ID ?? "";
  return { id, secret };
}

function forceLoginRedirectUri(redirectUri: string): string {
  const parsed = new URL(redirectUri);
  return `${parsed.origin}/login`;
}

function getDiscordCallbackRedirectUri(redirectUri: string): string {
  const parsed = new URL(redirectUri);
  const path = parsed.pathname.replace(/\/$/, "") || "/";
  if (path === "/auth" || path === "/login" || path === "/") {
    return `${parsed.origin}${path === "/" ? "/" : path}`;
  }
  return `${parsed.origin}/login`;
}

async function getUserFromAuthHeader(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function autoJoinGuild(discordUserId: string, accessToken: string) {
  try {
    const botToken = await getBotToken();
    if (!botToken) return false;
    const { data: guildSetting } = await supabaseAdmin
      .from("admin_settings")
      .select("value")
      .eq("key", "discord_guild_id")
      .maybeSingle();
    if (!guildSetting?.value) return false;
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildSetting.value}/members/${discordUserId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      },
    );
    return res.status === 201 || res.status === 204;
  } catch (e) {
    console.error("Auto-join failed:", e);
    return false;
  }
}

async function readDiscordSetting(key: string) {
  const { data } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ? String(data.value) : "";
}

async function getBotToken() {
  return process.env.DISCORD_BOT_TOKEN || await readDiscordSetting("discord_bot_token");
}

async function checkGuildMember(discordUserId: string) {
  const guildId = await readDiscordSetting("discord_guild_id");
  const botToken = await getBotToken();
  if (!guildId || !botToken || !discordUserId) {
    return { member: false, status: "not_configured" };
  }
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (res.status === 200) return { member: true, status: "member" };
  if (res.status === 404) return { member: false, status: "not_member" };
  return { member: false, status: `discord_${res.status}` };
}

async function handle(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const { id: CLIENT_ID, secret: CLIENT_SECRET } = await getDiscordCredentials();

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json(
      { error: "Discord credentials not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET." },
      503,
    );
  }

  // Build OAuth URL for linking flow (existing user)
  if (action === "initiate") {
    const redirectUri = url.searchParams.get("redirect_uri");
    if (!redirectUri) return json({ error: "redirect_uri required" }, 400);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify guilds.join",
    });
    return json({ url: `https://discord.com/api/oauth2/authorize?${params}` });
  }

  // Build OAuth URL for login (no auth required)
  if (action === "login_initiate") {
    const requested = url.searchParams.get("redirect_uri");
    if (!requested) return json({ error: "redirect_uri required" }, 400);
    let redirectUri: string;
    try {
      redirectUri = forceLoginRedirectUri(requested);
    } catch {
      return json({ error: "invalid redirect_uri" }, 400);
    }
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify email guilds.join",
      prompt: "consent",
      state: "discord_login",
    });
    return json({ url: `https://discord.com/api/oauth2/authorize?${params}` });
  }

  // Login callback
  if (action === "login_callback") {
    const body = await request.json().catch(() => ({}));
    const { code, redirect_uri: requested } = body as { code?: string; redirect_uri?: string };
    if (!code || !requested) return json({ error: "code and redirect_uri required" }, 400);
    let redirect_uri: string;
    try {
      redirect_uri = getDiscordCallbackRedirectUri(requested);
    } catch {
      return json({ error: "invalid redirect_uri" }, 400);
    }

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return json({ error: "Failed to exchange Discord code", details: tokenData }, 400);
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();
    if (!discordUser?.id) return json({ error: "Failed to fetch Discord user" }, 400);

    const email: string =
      discordUser.email && discordUser.verified !== false
        ? String(discordUser.email).toLowerCase()
        : `${discordUser.id}@discord.users.local`;
    const displayName: string =
      discordUser.global_name || discordUser.username || `Discord ${discordUser.id}`;
    const avatarUrl: string | null = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${String(discordUser.avatar).startsWith("a_") ? "gif" : "png"}?size=256`
      : null;

    let existingUserId: string | null = null;
    {
      const { data: byDiscord } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("discord_user_id", discordUser.id)
        .maybeSingle();
      if (byDiscord?.user_id) existingUserId = byDiscord.user_id as string;
    }
    if (!existingUserId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
      if (match) existingUserId = match.id;
    }

    if (!existingUserId) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          avatar_url: avatarUrl,
          provider_id: discordUser.id,
          user_name: discordUser.username,
          discord: true,
        },
      });
      if (createErr || !created?.user) {
        return json({ error: "Failed to create user", details: createErr?.message }, 500);
      }
      existingUserId = created.user.id;
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        discord_user_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: avatarUrl,
        ...(displayName ? { display_name: displayName } : {}),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      .eq("user_id", existingUserId);

    const joined = await autoJoinGuild(discordUser.id, tokenData.access_token);
    const membership = joined ? { member: true, status: "joined" } : await checkGuildMember(discordUser.id);
    await supabaseAdmin
      .from("profiles")
      .update({
        discord_guild_member: membership.member,
        discord_guild_status: membership.status,
        discord_guild_checked_at: new Date().toISOString(),
      })
      .eq("user_id", existingUserId);

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${new URL(redirect_uri).origin}/` },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return json({ error: "Failed to generate session link", details: linkErr?.message }, 500);
    }

    return json({
      success: true,
      action_link: linkData.properties.action_link,
      joined_guild: joined,
      guild_member: membership.member,
      guild_status: membership.status,
      discord: { id: discordUser.id, username: discordUser.username, avatar: avatarUrl },
    });
  }

  // Linking callback (authenticated user)
  if (action === "callback") {
    const user = await getUserFromAuthHeader(request);
    if (!user) return json({ error: "Not authenticated" }, 401);
    const body = await request.json().catch(() => ({}));
    const { code, redirect_uri } = body as { code?: string; redirect_uri?: string };
    if (!code || !redirect_uri) return json({ error: "code and redirect_uri required" }, 400);

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return json({ error: "Failed to get Discord token", details: tokenData }, 400);
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${String(discordUser.avatar).startsWith("a_") ? "gif" : "png"}?size=256`
      : null;

    const joined = await autoJoinGuild(discordUser.id, tokenData.access_token);
    const membership = joined ? { member: true, status: "joined" } : await checkGuildMember(discordUser.id);

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        discord_user_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: avatarUrl,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        discord_guild_member: membership.member,
        discord_guild_status: membership.status,
        discord_guild_checked_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (updateErr) return json({ error: "Failed to update profile" }, 500);

    return json({
      success: true,
      joined_guild: joined,
      guild_member: membership.member,
      guild_status: membership.status,
      discord: { id: discordUser.id, username: discordUser.username, avatar: avatarUrl },
    });
  }

  if (action === "membership") {
    const user = await getUserFromAuthHeader(request);
    if (!user) return json({ error: "Not authenticated" }, 401);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("discord_user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.discord_user_id) return json({ member: false, status: "not_linked" });
    const membership = await checkGuildMember(profile.discord_user_id as string);
    await supabaseAdmin
      .from("profiles")
      .update({
        discord_guild_member: membership.member,
        discord_guild_status: membership.status,
        discord_guild_checked_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    return json({ member: membership.member, status: membership.status });
  }

  // Unlink Discord
  if (action === "unlink") {
    const user = await getUserFromAuthHeader(request);
    if (!user) return json({ error: "Not authenticated" }, 401);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ discord_user_id: null, discord_username: null, discord_avatar: null })
      .eq("user_id", user.id);
    if (error) return json({ error: "Failed to unlink" }, 500);
    return json({ success: true });
  }

  return json({ error: "Invalid action" }, 400);
}

export const Route = createFileRoute("/api/public/discord-oauth")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      OPTIONS: ({ request }) => handle(request),
    },
  },
});
