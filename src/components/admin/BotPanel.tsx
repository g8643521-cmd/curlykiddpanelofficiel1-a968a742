import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Hash,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  Settings2,
  Shield,
  Trash2,
  Webhook,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";


import DiscordServerSetup from "@/components/admin/DiscordServerSetup";
import DiscordBotPanel from "@/components/admin/DiscordBotPanel";
import DiscordModUploadPanel from "@/components/admin/DiscordModUploadPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

type BotAutomation = {
  enabled: boolean;
  events: {
    new_report: boolean;
    status_change: boolean;
    removal: boolean;
  };
  destinations: {
    zapier: boolean;
    generic: boolean;
    slack: boolean;
  };
};

type WebhookSecurity = {
  enabled: boolean;
  secret_token: string;
  include_signature: boolean;
};

type RetrySettings = {
  enabled: boolean;
  max_retries: number;
  retry_delay: number;
};

type BotStatus = {
  timestamp: string;
  ok: boolean;
  provider: string;
  event_type: string;
  message?: string;
};

type BotError = {
  timestamp: string;
  provider: string;
  event_type: string;
  error: string;
};

const DEFAULT_AUTOMATION: BotAutomation = {
  enabled: false,
  events: { new_report: true, status_change: true, removal: false },
  destinations: { zapier: false, generic: false, slack: false },
};

const DEFAULT_SECURITY: WebhookSecurity = {
  enabled: false,
  secret_token: "",
  include_signature: true,
};

const DEFAULT_RETRY: RetrySettings = {
  enabled: true,
  max_retries: 3,
  retry_delay: 5,
};

const SETTINGS_KEYS = [
  "bot_automation",
  "bot_zapier_webhook_url",
  "bot_generic_webhook_url",
  "bot_slack_webhook_url",
  "bot_webhook_security",
  "bot_retry_settings",
  "bot_last_discord_delivery",
  "bot_last_discord_error",
  "bot_last_zapier_delivery",
  "bot_last_zapier_error",
  "bot_last_generic_delivery",
  "bot_last_generic_error",
  "bot_last_slack_delivery",
  "bot_last_slack_error",
  "bot_test_logs",
] as const;

type Key = (typeof SETTINGS_KEYS)[number];

function parseJson<T>(v: unknown): T | null {
  try {
    if (v == null) return null;
    if (typeof v === "string") return JSON.parse(v);
    if (typeof v === "object") return v as T;
    return null;
  } catch {
    return null;
  }
}

function coerceString(v: unknown): string {
  if (typeof v === "string") return v.replace(/^"|"$/g, "");
  return "";
}

function generateSecretToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "whsec_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function BotPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [zapierWebhookUrl, setZapierWebhookUrl] = useState("");
  const [genericWebhookUrl, setGenericWebhookUrl] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [automation, setAutomation] = useState<BotAutomation>(DEFAULT_AUTOMATION);
  const [security, setSecurity] = useState<WebhookSecurity>(DEFAULT_SECURITY);
  const [retrySettings, setRetrySettings] = useState<RetrySettings>(DEFAULT_RETRY);

  const [showSecretToken, setShowSecretToken] = useState(false);

  const [lastOk, setLastOk] = useState<Record<string, BotStatus | null>>({
    discord: null,
    zapier: null,
    generic: null,
    slack: null,
  });
  const [lastErr, setLastErr] = useState<Record<string, BotError | null>>({
    discord: null,
    zapier: null,
    generic: null,
    slack: null,
  });

  const [testLogs, setTestLogs] = useState<Array<{ timestamp: string; ok: boolean; message: string }> | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", SETTINGS_KEYS as unknown as string[]);

    if (error) {
      console.error("Error fetching bot settings:", error);
      toast.error("Failed to load bot settings");
      setIsLoading(false);
      return;
    }

    const get = (k: Key) => data?.find((s) => s.key === k)?.value;

    setZapierWebhookUrl(coerceString(get("bot_zapier_webhook_url")));
    setGenericWebhookUrl(coerceString(get("bot_generic_webhook_url")));
    setSlackWebhookUrl(coerceString(get("bot_slack_webhook_url")));

    const parsedAutomation = parseJson<BotAutomation>(get("bot_automation"));
    setAutomation(parsedAutomation ?? DEFAULT_AUTOMATION);

    const parsedSecurity = parseJson<WebhookSecurity>(get("bot_webhook_security"));
    setSecurity(parsedSecurity ?? DEFAULT_SECURITY);

    const parsedRetry = parseJson<RetrySettings>(get("bot_retry_settings"));
    setRetrySettings(parsedRetry ?? DEFAULT_RETRY);

    setLastOk({
      discord: parseJson<BotStatus>(get("bot_last_discord_delivery")),
      zapier: parseJson<BotStatus>(get("bot_last_zapier_delivery")),
      generic: parseJson<BotStatus>(get("bot_last_generic_delivery")),
      slack: parseJson<BotStatus>(get("bot_last_slack_delivery")),
    });

    setLastErr({
      discord: parseJson<BotError>(get("bot_last_discord_error")),
      zapier: parseJson<BotError>(get("bot_last_zapier_error")),
      generic: parseJson<BotError>(get("bot_last_generic_error")),
      slack: parseJson<BotError>(get("bot_last_slack_error")),
    });

    const logs = parseJson<Array<{ timestamp: string; ok: boolean; message: string }>>(get("bot_test_logs"));
    setTestLogs(logs);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const upsertSetting = useCallback(async (key: string, value: Json) => {
    const { data: sessionRes } = await supabase.auth.getSession();
    const session = sessionRes.session;
    if (!session) throw new Error("Not authenticated");

    const { data: updated, error: updateError } = await supabase
      .from("admin_settings")
      .update({ value: typeof value === 'string' ? value : JSON.stringify(value) })
      .eq("key", key)
      .select("id");

    if (!updateError && updated && updated.length > 0) return;

    const { error: insertError } = await supabase.from("admin_settings").insert([
      {
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
      },
    ]);

    if (insertError) throw insertError;
  }, []);

  const handleSaveAutomation = async () => {
    setIsSaving(true);
    try {
      await upsertSetting("bot_automation", automation as unknown as Json);
      toast.success("Automation rules saved");
      await fetchSettings();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save automation rules");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIntegrations = async () => {
    setIsSaving(true);
    try {
      await upsertSetting("bot_zapier_webhook_url", zapierWebhookUrl);
      await upsertSetting("bot_generic_webhook_url", genericWebhookUrl);
      await upsertSetting("bot_slack_webhook_url", slackWebhookUrl);
      toast.success("Integrations saved");
      await fetchSettings();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save integrations");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    setIsSaving(true);
    try {
      await upsertSetting("bot_webhook_security", security as unknown as Json);
      toast.success("Security settings saved");
      await fetchSettings();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save security settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRetry = async () => {
    setIsSaving(true);
    try {
      await upsertSetting("bot_retry_settings", retrySettings as unknown as Json);
      toast.success("Retry settings saved");
      await fetchSettings();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save retry settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateToken = () => {
    const newToken = generateSecretToken();
    setSecurity((prev) => ({ ...prev, secret_token: newToken }));
    toast.success("New secret token generated");
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(security.secret_token);
    toast.success("Token copied to clipboard");
  };

  const canTest = useMemo(() => {
    return Boolean(
      (zapierWebhookUrl && zapierWebhookUrl.startsWith("http")) || 
      (genericWebhookUrl && genericWebhookUrl.startsWith("http")) ||
      (slackWebhookUrl && slackWebhookUrl.startsWith("http"))
    );
  }, [zapierWebhookUrl, genericWebhookUrl, slackWebhookUrl]);

  const handleSendTest = async () => {
    if (!canTest) {
      toast.error("Add a webhook URL first");
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bot-events", {
        body: {
          event_type: "test",
          message: "Test event from Bot panel",
        },
      });

      if (error) {
        console.error(error);
        toast.error("Test failed");
      } else if (data?.success) {
        toast.success("Test event sent");
      } else {
        toast.error(data?.message || "Test failed");
      }

      await fetchSettings();
    } catch (e) {
      console.error(e);
      toast.error("Test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearLogs = async () => {
    setIsSaving(true);
    try {
      const keysToDelete = [
        'bot_last_discord_delivery',
        'bot_last_discord_error',
        'bot_last_zapier_delivery',
        'bot_last_zapier_error',
        'bot_last_generic_delivery',
        'bot_last_generic_error',
        'bot_last_slack_delivery',
        'bot_last_slack_error',
        'bot_test_logs',
      ];
      
      await supabase
        .from('admin_settings')
        .delete()
        .in('key', keysToDelete);
      
      setLastOk({ discord: null, zapier: null, generic: null, slack: null });
      setLastErr({ discord: null, zapier: null, generic: null, slack: null });
      setTestLogs(null);
      
      toast.success('Logs cleared');
    } catch (e) {
      console.error(e);
      toast.error('Failed to clear logs');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusCard = (provider: "discord" | "zapier" | "generic" | "slack", label: string, icon: React.ReactNode) => {
    const ok = lastOk[provider];
    const err = lastErr[provider];
    const isOk = Boolean(ok?.ok);
    const showError = err?.error && (!ok?.timestamp || (err.timestamp && new Date(err.timestamp) > new Date(ok.timestamp)));

    return (
      <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon}
            <p className="text-sm font-medium text-foreground">{label}</p>
          </div>
          {isOk ? (
            <Badge className="bg-[hsl(var(--green))]/15 text-[hsl(var(--green))] border-[hsl(var(--green))]/30 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              OK
            </Badge>
          ) : err ? (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="w-3 h-3 mr-1" />
              Error
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">—</Badge>
          )}
        </div>
        {showError && <p className="text-xs text-destructive mt-1 line-clamp-1">{err.error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-foreground">Bot & Integrations</h3>
              <p className="text-sm text-muted-foreground">Discord, webhooks, and automation</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchSettings}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Discord Content */}
      <div className="space-y-4">

        {/* Discord Server Setup */}
        <DiscordServerSetup />

        {/* Discord Bot Management */}
        <DiscordBotPanel />

        {/* Discord Mod Upload */}
        <DiscordModUploadPanel />
      </div>
    </div>
  );
}

function RuleToggle({
  label,
  icon,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  icon?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg border border-border/30 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm text-foreground">{label}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}