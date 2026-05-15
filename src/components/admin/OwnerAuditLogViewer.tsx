// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Download, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type ActivityLogRow = {
  id: string;
  user_id: string;
  action_type: string;
  details: any;
  created_at: string;
};

type ProfileLite = { id: string; display_name: string | null; email: string | null };

function safeJsonStringify(v: unknown) {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return "null";
  }
}

function downloadFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((s, r) => {
      Object.keys(r).forEach((k) => s.add(k));
      return s;
    }, new Set<string>())
  );

  const escape = (val: unknown) => {
    const str = typeof val === "string" ? val : safeJsonStringify(val);
    const needsQuotes = /[",\n]/.test(str);
    const escaped = str.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape((r as any)[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

export default function OwnerAuditLogViewer() {
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());

  const [query, setQuery] = useState("");
  const [actionQuery, setActionQuery] = useState("");
  const [onlyRoleAndPerm, setOnlyRoleAndPerm] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, user_id, action_type, details, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const rows = (data ?? []) as ActivityLogRow[];
      setLogs(rows);

      // Fetch display names for actors and affected users
      const ids = new Set<string>();
      rows.forEach((l) => {
        if (l.user_id) ids.add(l.user_id);
        const affected = l?.details?.user_id;
        if (typeof affected === "string") ids.add(affected);
      });

      if (ids.size > 0) {
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", Array.from(ids))
          .limit(1000);

        if (profErr) throw profErr;
        const map = new Map<string, ProfileLite>();
        (prof ?? []).forEach((p: any) => map.set(p.id, p));
        setProfiles(map);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const aq = actionQuery.trim().toLowerCase();

    return logs.filter((l) => {
      if (onlyRoleAndPerm) {
        const a = (l.action_type ?? "").toLowerCase();
        const isRoleOrPerm =
          a.includes("role") ||
          a.includes("permission") ||
          a.includes("permissions") ||
          a.includes("permission_set") ||
          a.includes("access_control") ||
          a.includes("role_permissions");
        if (!isRoleOrPerm) return false;
      }

      if (aq && !(l.action_type ?? "").toLowerCase().includes(aq)) return false;

      if (!q) return true;

      const actor = profiles.get(l.user_id);
      const affectedId = l?.details?.user_id;
      const affected = typeof affectedId === "string" ? profiles.get(affectedId) : null;

      const haystack = [
        l.action_type,
        l.user_id,
        safeJsonStringify(l.details),
        actor?.display_name,
        actor?.email,
        typeof affectedId === "string" ? affectedId : "",
        affected?.display_name,
        affected?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [logs, profiles, query, actionQuery, onlyRoleAndPerm]);

  const exportJson = () => {
    const payload = filtered.map((l) => ({
      id: l.id,
      created_at: l.created_at,
      action_type: l.action_type,
      actor_user_id: l.user_id,
      affected_user_id: l?.details?.user_id ?? null,
      details: l.details ?? null,
    }));

    downloadFile(`audit-logs-${new Date().toISOString()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  };

  const exportCsv = () => {
    const rows = filtered.map((l) => {
      const affectedId = l?.details?.user_id;
      const actor = profiles.get(l.user_id);
      const affected = typeof affectedId === "string" ? profiles.get(affectedId) : null;

      return {
        created_at: l.created_at,
        action_type: l.action_type,
        actor_user_id: l.user_id,
        actor_name: actor?.display_name ?? "",
        actor_email: actor?.email ?? "",
        affected_user_id: typeof affectedId === "string" ? affectedId : "",
        affected_name: affected?.display_name ?? "",
        affected_email: affected?.email ?? "",
        details: safeJsonStringify(l.details),
      };
    });

    downloadFile(`audit-logs-${new Date().toISOString()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Audit logs
            <Badge variant="secondary">{filtered.length}</Badge>
          </h3>
          <p className="text-sm text-muted-foreground">Role & permission changes (and more). Filter and export.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={isLoading} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0} className="gap-2">
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button onClick={exportJson} disabled={filtered.length === 0} className="gap-2">
            <Download className="w-4 h-4" />
            JSON
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Search (user/action/details)</Label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. role_assign, Bot Manager, user@email" />
        </div>
        <div className="space-y-2">
          <Label>Action contains</Label>
          <Input value={actionQuery} onChange={(e) => setActionQuery(e.target.value)} placeholder="e.g. role, permission_set" />
        </div>
        <div className="space-y-2">
          <Label>Scope</Label>
          <Button
            type="button"
            variant={onlyRoleAndPerm ? "default" : "outline"}
            onClick={() => setOnlyRoleAndPerm((v) => !v)}
            className="w-full justify-start"
          >
            {onlyRoleAndPerm ? "Showing: role/permission only" : "Showing: all actions"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No logs match the current filters.</p>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Time</TableHead>
                <TableHead className="w-[220px]">Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Affected</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 200).map((l) => {
                const actor = profiles.get(l.user_id);
                const affectedId = l?.details?.user_id;
                const affected = typeof affectedId === "string" ? profiles.get(affectedId) : null;

                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(l.created_at), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.action_type}</TableCell>
                    <TableCell className="text-sm">
                      <div className="min-w-0">
                        <div className="truncate">{actor?.display_name || l.user_id}</div>
                        {actor?.email && <div className="text-xs text-muted-foreground truncate">{actor.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="min-w-0">
                        <div className="truncate">
                          {affected?.display_name || (typeof affectedId === "string" ? affectedId : "—")}
                        </div>
                        {affected?.email && <div className="text-xs text-muted-foreground truncate">{affected.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[380px]">
                      <span className="line-clamp-2">{safeJsonStringify(l.details)}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filtered.length > 200 && (
            <div className="p-3 text-xs text-muted-foreground bg-background">
              Showing first 200 of {filtered.length} matching logs.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
