import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const IGNORED_KEYS = new Set(["_export_metadata", "_auth_users", "_storage"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
    const isOwner = (roles ?? []).some((r: any) => r.role === "owner");
    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Forbidden — owner role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const backup = body?.backup;
    const dryRun: boolean = body?.dryRun === true;
    const strategy: "upsert" | "skip" | "replace" =
      body?.strategy === "skip" || body?.strategy === "replace" ? body.strategy : "upsert";
    const allowedTables: string[] | null = Array.isArray(body?.tables) && body.tables.length > 0 ? body.tables : null;

    if (!backup || typeof backup !== "object") {
      return new Response(JSON.stringify({ error: "Invalid backup payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tableResults: Array<{ table: string; rows: number; skipped?: number; errors?: number }> = [];
    const ignoredKeys: string[] = [];
    let totalRows = 0;
    let totalTables = 0;

    for (const [key, value] of Object.entries(backup)) {
      if (IGNORED_KEYS.has(key)) {
        ignoredKeys.push(key);
        continue;
      }
      if (!Array.isArray(value)) continue;
      if (allowedTables && !allowedTables.includes(key)) continue;
      totalTables += 1;

      if (dryRun) {
        tableResults.push({ table: key, rows: value.length });
        totalRows += value.length;
        continue;
      }

      let inserted = 0;
      let errors = 0;

      if (strategy === "replace" && value.length > 0) {
        // Truncate by deleting all rows (RLS bypassed by service role)
        await admin.from(key).delete().not("id", "is", null);
      }

      if (value.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < value.length; i += chunkSize) {
          const chunk = value.slice(i, i + chunkSize);
          if (strategy === "skip") {
            const { error, count } = await admin
              .from(key)
              .insert(chunk, { count: "exact" })
              .select("id", { count: "exact", head: true });
            if (error) errors += chunk.length;
            else inserted += count ?? chunk.length;
          } else {
            const { error } = await admin.from(key).upsert(chunk, { onConflict: "id" });
            if (error) errors += chunk.length;
            else inserted += chunk.length;
          }
        }
      }
      totalRows += inserted;
      tableResults.push({ table: key, rows: inserted, errors });
    }

    return new Response(
      JSON.stringify({
        dryRun,
        strategy,
        tablesImported: totalTables,
        rowsImported: totalRows,
        tableResults,
        ignoredKeys,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
