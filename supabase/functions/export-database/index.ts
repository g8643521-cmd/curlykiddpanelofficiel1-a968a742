import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

function toCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return "";
  const cols = Array.from(
    rows.reduce((s: Set<string>, r) => {
      Object.keys(r ?? {}).forEach((k) => s.add(k));
      return s;
    }, new Set<string>()),
  );
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tables: string[] = Array.isArray(body?.tables) ? body.tables : [];
    const format: "json" | "csv" = body?.format === "csv" ? "csv" : "json";

    if (tables.length === 0) {
      return new Response(JSON.stringify({ error: "No tables specified" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data: Record<string, any> = {};
    for (const t of tables) {
      const { data: rows, error } = await admin.from(t).select("*");
      if (error) {
        data[t] = [];
        continue;
      }
      data[t] = format === "csv" ? toCsv(rows ?? []) : (rows ?? []);
    }

    if (format === "json") {
      // Include metadata + auth users (best-effort)
      data._export_metadata = {
        exported_at: new Date().toISOString(),
        table_count: tables.length,
      };
      try {
        const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        data._auth_users = (usersPage?.users ?? []).map((u: any) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
        }));
      } catch {
        data._auth_users = [];
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
