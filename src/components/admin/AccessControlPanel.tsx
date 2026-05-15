import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Zap, Webhook } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type PermissionKey =
  | "admin.panel.view"
  | "bot.view"
  | "bot.integrations.manage"
  | "bot.automation.manage"
  | "bot.discord.manage";

const INTEGRATIONS_ROLE = "integrations_manager" as const;

const PERMISSIONS: Array<{ key: PermissionKey; label: string; description: string; Icon: React.ComponentType<{ className?: string }> }> = [
  {
    key: "admin.panel.view",
    label: "Admin Panel",
    description: "Allow entering /admin (tab visibility still depends on other permissions).",
    Icon: ShieldCheck,
  },
  {
    key: "bot.view",
    label: "Bot: View",
    description: "View bot status, integrations, automations, and Discord settings.",
    Icon: Zap,
  },
  {
    key: "bot.integrations.manage",
    label: "Bot: Integrations",
    description: "Edit Zapier + generic webhook URLs.",
    Icon: Webhook,
  },
  {
    key: "bot.automation.manage",
    label: "Bot: Automation",
    description: "Edit automation rules (events + destinations).",
    Icon: Zap,
  },
  {
    key: "bot.discord.manage",
    label: "Bot: Discord",
    description: "Edit Discord notification options.",
    Icon: Webhook,
  },
];

export default function AccessControlPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState<Record<PermissionKey, boolean>>({
    "admin.panel.view": false,
    "bot.view": false,
    "bot.integrations.manage": false,
    "bot.automation.manage": false,
    "bot.discord.manage": false,
  });

  const load = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role", INTEGRATIONS_ROLE as any);

    if (error) {
      console.error(error);
      toast.error("Failed to load role permissions");
      setIsLoading(false);
      return;
    }

    const set = new Set((data ?? []).map((r) => r.permission_key as PermissionKey));

    setEnabled({
      "admin.panel.view": set.has("admin.panel.view"),
      "bot.view": set.has("bot.view"),
      "bot.integrations.manage": set.has("bot.integrations.manage"),
      "bot.automation.manage": set.has("bot.automation.manage"),
      "bot.discord.manage": set.has("bot.discord.manage"),
    });

    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const desiredRows = useMemo(() => {
    return Object.entries(enabled)
      .filter(([, v]) => v)
      .map(([k]) => ({ role: INTEGRATIONS_ROLE, permission_key: k }));
  }, [enabled]);

  const logActivity = async (actionType: string, details: Record<string, unknown>) => {
    const { logActivity: logAct } = await import('@/lib/activityLog');
    await logAct({ category: 'admin', action: actionType, severity: 'warning', metadata: details });
  };

  const save = async () => {
    setIsSaving(true);
    try {
      // Replace set for this role: delete then insert desired
      const { error: delErr } = await supabase.from("role_permissions").delete().eq("role", INTEGRATIONS_ROLE as any);
      if (delErr) throw delErr;

      if (desiredRows.length > 0) {
        const { error: insErr } = await supabase.from("role_permissions").insert(desiredRows as any);
        if (insErr) throw insErr;
      }

      await logActivity('role_permissions_update', {
        role: INTEGRATIONS_ROLE,
        permission_keys: desiredRows.map((r) => r.permission_key),
      });

      toast.success("Permissions saved");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <p className="text-sm text-muted-foreground">Loading permissions…</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-foreground">Access Control</h3>
          <p className="text-sm text-muted-foreground">Configure what the Integrations Manager role can do (deny-by-default).</p>
        </div>
        <Badge variant="secondary">Role: integrations_manager</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PERMISSIONS.map(({ key, label, description, Icon }) => (
          <div key={key} className="p-4 rounded-lg bg-secondary/20 border border-border/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
              <Switch
                checked={enabled[key]}
                onCheckedChange={(v) => setEnabled((p) => ({ ...p, [key]: v }))}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={isSaving}>
          Save permissions
        </Button>
        <Button variant="outline" onClick={load} disabled={isSaving}>
          Reload
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: assign the <span className="font-mono">integrations_manager</span> role to a user in User Management → Roles.
      </p>
    </div>
  );
}
