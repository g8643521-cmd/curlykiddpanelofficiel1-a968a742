import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Save, Loader2, KeyRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getSessionWithTimeout, withTimeout } from "@/lib/authSession";

const KEYS = [
  { key: "auth_show_discord", label: "Discord", description: "Primary recommended login. Uses Discord OAuth.", accent: "#5865F2" },
  { key: "auth_show_google", label: "Google", description: "Sign in with a Google account.", accent: "#EA4335" },
  { key: "auth_show_apple", label: "Apple", description: "Sign in with Apple ID.", accent: "#A2AAAD" },
  { key: "auth_show_email", label: "Email & Password", description: "Classic email/password login form.", accent: "#10B981" },
  { key: "auth_show_signup", label: "Public Sign-Up", description: "Allow new accounts via email signup form (only used if Email is enabled).", accent: "#F59E0B" },
] as const;

const parseBool = (v: unknown, fallback: boolean) => {
  if (v === undefined || v === null) return fallback;
  const s = String(v).replace(/^"|"$/g, "").toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return fallback;
};

const AuthMethodsPanel = () => {
  const [values, setValues] = useState<Record<string, boolean>>({
    auth_show_discord: true,
    auth_show_google: false,
    auth_show_apple: false,
    auth_show_email: false,
    auth_show_signup: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await getSessionWithTimeout();
        if (!session) throw new Error("Not signed in");
        const { data, error } = await withTimeout<any>(
          supabase
            .from("admin_settings")
            .select("key,value")
            .in("key", KEYS.map((k) => k.key)),
          10000,
          "Loading login methods timed out",
        );
        if (error) throw error;
        if (!active) return;
        setValues((prev) => {
          const next = { ...prev };
          for (const row of (data || []) as Array<{ key: string; value: unknown }>) {
            next[row.key] = parseBool(row.value, prev[row.key] ?? false);
          }
          return next;
        });
      } catch (err: any) {
        if (active) toast.error(err?.message || "Failed to load login methods");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const toggle = (key: string) => setValues((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    setSaving(true);
    try {
      const rows = KEYS.map((k) => ({ key: k.key, value: values[k.key] ? "true" : "false" }));
      const { data: { session } } = await getSessionWithTimeout();
      if (!session) throw new Error("Not signed in");
      const { error } = await withTimeout<any>(
        supabase.from("admin_settings").upsert(rows, { onConflict: "key" }),
        12000,
        "Saving login methods timed out",
      );
      if (error) throw error;
      toast.success("Login methods updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/40 bg-gradient-to-br from-card/60 via-card/40 to-card/20 backdrop-blur-xl p-6 shadow-xl shadow-black/20"
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Public Login Methods</h3>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Control which login options appear on the <code className="px-1 py-0.5 rounded bg-muted/50 text-[10px]">/auth</code> page for everyone.
            </p>
          </div>
        </div>
        <Button onClick={save} disabled={saving || loading} size="sm" className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save changes
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        {KEYS.map((k) => (
          <div
            key={k.key}
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border/30 bg-background/40 hover:bg-background/60 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: k.accent, boxShadow: `0 0 8px ${k.accent}66` }}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{k.label}</div>
                <div className="text-xs text-muted-foreground/70 truncate">{k.description}</div>
              </div>
            </div>
            <Switch
              checked={!!values[k.key]}
              onCheckedChange={() => toggle(k.key)}
              disabled={loading}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-2 text-[11px] text-muted-foreground/70 rounded-lg border border-border/30 bg-background/30 px-3 py-2">
        <Shield className="w-3.5 h-3.5 mt-0.5 text-primary/70 shrink-0" />
        <span>
          Disabling all methods will lock every public visitor out of <code>/auth</code>. At least Discord is recommended as the primary method.
        </span>
      </div>
    </motion.div>
  );
};

export default AuthMethodsPanel;
