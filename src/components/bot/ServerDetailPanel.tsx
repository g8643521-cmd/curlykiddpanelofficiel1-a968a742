import { useState, useEffect, useCallback } from 'react';
import {
  Users, Shield, Server, Copy, Loader2, AlertTriangle, Activity,
  Clock, Hash, Webhook, BarChart3, Pencil, PowerOff, Radio,
  Calendar, Eye, Settings, UserPlus, Trash2, Crown, Mail,
  ShieldAlert, Ban, UserX, Bell, ScrollText, Timer, AtSign, Zap,
  ExternalLink, CheckCircle2, XCircle, ChevronRight, Send, History,
  CircleDashed, RefreshCw
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import type { BotServer, ServerScanSummary } from '@/components/bot/ServerCard';
import { timeAgo } from '@/components/bot/ServerCard';
import ServerMembersPanel from '@/components/bot/ServerMembersPanel';

interface ServerShare {
  id: string;
  shared_with: string;
  shared_by: string;
  permission: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

interface BotServerSettings {
  id?: string;
  server_id: string;
  cheater_role_id: string | null;
  cheater_role_name: string;
  auto_assign_role: boolean;
  auto_kick_cheaters: boolean;
  auto_ban_cheaters: boolean;
  min_bans_for_alert: number;
  notify_on_clean_join: boolean;
  log_all_joins: boolean;
  scan_interval_hours: number | null;
  alert_mention_role_id: string | null;
}

const DEFAULT_SETTINGS: Omit<BotServerSettings, 'server_id'> = {
  cheater_role_id: null,
  cheater_role_name: 'Cheater Confirmed',
  auto_assign_role: false,
  auto_kick_cheaters: false,
  auto_ban_cheaters: false,
  min_bans_for_alert: 1,
  notify_on_clean_join: false,
  log_all_joins: false,
  scan_interval_hours: null,
  alert_mention_role_id: null,
};

const getRestriction = (server: BotServer | null | undefined) => {
  const status = (server?.status as 'active' | 'paused' | 'blacklisted' | undefined) || 'active';
  const restricted = status === 'paused' || status === 'blacklisted';
  const label = status === 'blacklisted' ? 'Access Revoked' : 'Service Suspended';
  const message = status === 'blacklisted'
    ? `Access to this server has been revoked${server?.status_reason ? `: ${server.status_reason}` : '.'}`
    : `This server is suspended${server?.status_reason ? `: ${server.status_reason}` : '.'}`;
  return { status, restricted, label, message };
};

const denyRestrictedAction = (server: BotServer | null | undefined, action: string) => {
  const restriction = getRestriction(server);
  if (!restriction.restricted) return false;
  toast.error(`${action} is unavailable. ${restriction.message}`);
  return true;
};

interface ServerDetailPanelProps {
  server: BotServer | null;
  onClose: () => void;
  isOwner: boolean;
  scanResult?: ServerScanSummary;
  recentJoins: any[];
  detectedCheaters: any[];
  onEdit: (server: BotServer) => void;
  onScan: (server: BotServer) => void;
  onTestWebhook: (server: BotServer) => void;
  onToggle: (server: BotServer) => void;
  isScanning: string | null;
  isTesting: string | null;
  copyToClipboard: (text: string) => void;
}

/* ─── Small reusable pieces ─── */
const StatPill = ({ icon: Icon, value, label, accent, pulse }: { icon: any; value: string | number; label: string; accent: string; pulse?: boolean }) => (
  <div className="flex flex-col items-center gap-1 rounded-xl border border-border/15 bg-card/30 px-4 py-3.5 flex-1 min-w-0 hover:bg-card/50 transition-colors relative">
    <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center mb-0.5`}>
      <Icon className={`w-4 h-4 ${pulse ? 'animate-pulse' : ''}`} />
    </div>
    <span className="text-lg font-bold text-foreground tabular-nums leading-none">{value}</span>
    <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{label}</span>
    {pulse && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />}
  </div>
);

const InfoCell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">{label}</span>
    <span className="text-[12px] text-foreground font-medium truncate">{children}</span>
  </div>
);

const WebhookStatus = ({ url, label }: { url: string | null | undefined; label: string }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">{label}</span>
    <div className="flex items-center gap-1.5">
      {url ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-[11px] font-semibold text-emerald-400">Connected</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
          <span className="text-[11px] text-muted-foreground/50">Not set</span>
        </>
      )}
    </div>
  </div>
);

const ProtectionLevel = ({ hasAutoWebhook, hasFullWebhook, hasAlertChannel, memberCount }: { hasAutoWebhook: boolean; hasFullWebhook: boolean; hasAlertChannel: boolean; memberCount: number }) => {
  const score = [hasAutoWebhook, hasFullWebhook, hasAlertChannel, memberCount > 0].filter(Boolean).length;
  const pct = Math.round((score / 4) * 100);
  const color = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-destructive';
  const bg = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-destructive';
  const label = pct >= 75 ? 'Fully protected' : pct >= 50 ? 'Needs setup' : 'At risk';
  const emoji = pct >= 75 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/15 bg-card/30">
      <div className="flex items-center gap-2.5">
        <Shield className="w-4 h-4 text-primary" />
        <div>
          <span className="text-[11px] font-semibold text-foreground">Server Protection</span>
          <span className={`text-[11px] ml-2 font-bold ${color}`}>{pct}%</span>
        </div>
      </div>
      <span className={`text-[10px] font-semibold ${color} flex items-center gap-1`}>{emoji} {label}</span>
    </div>
  );
};

const InfoRow = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <span className="text-[11px] text-muted-foreground/70 flex items-center gap-2 font-medium">
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
    <span className="text-[11px] text-foreground font-medium">{children}</span>
  </div>
);

const SettingSection = ({ icon: Icon, title, desc, accent, children }: { icon: any; title: string; desc: string; accent: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border/15 bg-card/20 overflow-hidden">
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/10">
      <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <h4 className="text-[13px] font-semibold text-foreground leading-tight">{title}</h4>
        <p className="text-[10px] text-muted-foreground/60">{desc}</p>
      </div>
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </div>
);

const SettingRow = ({ icon: Icon, label, children }: { icon?: any; label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground/50" />}
      <Label className="text-xs text-foreground/80">{label}</Label>
    </div>
    {children}
  </div>
);

/* ─── Main component ─── */
const ServerDetailPanel = ({
  server, onClose, isOwner, scanResult, recentJoins, detectedCheaters,
  onEdit, onScan, onTestWebhook, onToggle, isScanning, isTesting, copyToClipboard
}: ServerDetailPanelProps) => {
  const { t } = useI18n();
  const [shares, setShares] = useState<ServerShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'view' | 'manage'>('view');
  const [isInviting, setIsInviting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isResendingWelcome, setIsResendingWelcome] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    summary: string;
    details: any;
  }>({ open: false, title: '', summary: '', details: null });

  // Welcome stepper state — shown inline in the Overview tab during/after a resend.
  type StepStatus = 'pending' | 'in_progress' | 'success' | 'fail';
  type WelcomeStep = {
    key: string;
    label: string;
    status: StepStatus;
    httpStatus?: number;
    attempts?: number;
    rateLimited?: boolean;
    error?: any;
  };
  const WELCOME_STEP_DEFS: Array<{ key: string; label: string }> = [
    { key: 'auto-scan-alerts', label: '#auto-scan-alerts' },
    { key: 'full-scan-alerts', label: '#full-scan-alerts' },
    { key: 'info', label: '#info channel' },
  ];
  const [welcomeSteps, setWelcomeSteps] = useState<WelcomeStep[] | null>(null);

  // Server audit log — for the new Audit tab.
  type AuditRow = {
    id: string;
    action: string;
    status: 'success' | 'fail' | 'partial' | string;
    created_at: string;
    user_id: string | null;
    details: any;
    error_message: string | null;
    actor?: { display_name: string | null; email: string | null; avatar_url: string | null } | null;
  };
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const writeAudit = async (
    status: 'success' | 'fail' | 'partial',
    details: any,
    errorMessage?: string,
  ) => {
    if (!server) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      await supabase.from('server_audit_log').insert({
        server_id: server.id,
        guild_id: server.guild_id,
        user_id: sess?.session?.user?.id ?? null,
        action: 'resend_welcome',
        status,
        details,
        error_message: errorMessage ?? null,
      });
    } catch (e) {
      console.error('Failed to write audit log:', e);
    }
  };

  const applyWelcomeResultsToSteps = (welcomeResults: any[]) => {
    setWelcomeSteps((prev) => {
      // Start from the predefined order so steps are consistent even if the API returns fewer.
      const base: WelcomeStep[] = (prev ?? WELCOME_STEP_DEFS.map((s) => ({ ...s, status: 'pending' as StepStatus })))
        .map((s) => ({ ...s }));

      welcomeResults.forEach((r, idx) => {
        const matchIdx = base.findIndex(
          (s) => s.key === r.channel || s.label.replace(/^#/, '') === r.channel,
        );
        const target = matchIdx >= 0 ? matchIdx : Math.min(idx, base.length - 1);
        base[target] = {
          ...base[target],
          // Keep the channel name returned by the API for accuracy.
          label: r.channel ? `#${r.channel}` : base[target].label,
          status: r.ok ? 'success' : 'fail',
          httpStatus: r.status,
          attempts: r.attempts,
          rateLimited: r.rate_limited,
          error: r.ok ? undefined : r.error,
        };
      });

      // Any remaining 'in_progress' that wasn't reported → mark as fail (didn't run).
      return base.map((s) => (s.status === 'in_progress' ? { ...s, status: 'fail' } : s));
    });
  };

  const handleResendWelcome = async () => {
    if (!server) return;
    if (denyRestrictedAction(server, 'Welcome resend')) return;
    setIsResendingWelcome(true);
    // Initialise the stepper: first step is in-progress, rest are pending.
    setWelcomeSteps(
      WELCOME_STEP_DEFS.map((s, i) => ({
        ...s,
        status: i === 0 ? 'in_progress' : 'pending',
      })),
    );
    try {
      const { data, error } = await supabase.functions.invoke('discord-member-check', {
        body: { action: 'create-webhook', guildId: server.guild_id, private_channels: false },
      });

      // Network / function-level error
      if (error) {
        const errMsg = error.message || 'Edge function error';
        setWelcomeSteps((prev) => {
          const base: WelcomeStep[] = prev ?? WELCOME_STEP_DEFS.map((s) => ({ ...s, status: 'pending' as StepStatus }));
          return base.map((s) => ({
            ...s,
            status: s.status === 'success' ? ('success' as StepStatus) : ('fail' as StepStatus),
            error: s.error ?? errMsg,
          }));
        });
        setErrorDialog({
          open: true,
          title: 'Resend failed (function error)',
          summary: errMsg,
          details: { error, returned: data ?? null },
        });
        await writeAudit('fail', { error: errMsg, returned: data ?? null }, errMsg);
        toast.error('Resend failed — see details');
        return;
      }

      const welcomeResults: any[] = data?.welcome_results ?? [];
      applyWelcomeResultsToSteps(welcomeResults);
      const failed = welcomeResults.filter((r) => !r.ok);

      if (data?.success === false || failed.length > 0) {
        const status: 'fail' | 'partial' = failed.length === welcomeResults.length || welcomeResults.length === 0
          ? 'fail'
          : 'partial';
        const errMsg = data?.error
          ?? `Failed to post in ${failed.length}/${welcomeResults.length || 3} channel(s)`;
        setErrorDialog({
          open: true,
          title: status === 'partial' ? 'Resend partially failed' : 'Resend failed (Discord API)',
          summary: errMsg,
          details: data,
        });
        await writeAudit(status, data, errMsg);
        toast.error(status === 'partial' ? 'Some channels failed' : 'Resend failed — see details');
        return;
      }

      await writeAudit('success', data);
      toast.success('Welcome messages resent to Discord');
    } catch (e: any) {
      const errMsg = e?.message ?? String(e);
      setWelcomeSteps((prev) => {
        const base: WelcomeStep[] = prev ?? WELCOME_STEP_DEFS.map((s) => ({ ...s, status: 'pending' as StepStatus }));
        return base.map((s) => ({
          ...s,
          status: s.status === 'success' ? ('success' as StepStatus) : ('fail' as StepStatus),
          error: s.error ?? errMsg,
        }));
      });
      setErrorDialog({
        open: true,
        title: 'Resend failed (unexpected)',
        summary: errMsg,
        details: { exception: errMsg, stack: e?.stack ?? null },
      });
      await writeAudit('fail', { exception: errMsg }, errMsg);
      toast.error('Resend failed — see details');
    } finally {
      setIsResendingWelcome(false);
      // After a completed resend, refresh the audit tab in the background.
      fetchAudit();
    }
  };

  const fetchAudit = useCallback(async () => {
    if (!server) return;
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('server_audit_log')
        .select('id, action, status, created_at, user_id, details, error_message')
        .eq('server_id', server.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      const rows = (data ?? []) as AuditRow[];

      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
      let actorMap = new Map<string, { display_name: string | null; email: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, avatar_url')
          .in('user_id', userIds);
        actorMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      }
      setAuditRows(rows.map((r) => ({ ...r, actor: r.user_id ? actorMap.get(r.user_id) ?? null : null })));
    } catch (e) {
      console.error('Failed to load audit log:', e);
      setAuditRows([]);
    } finally {
      setAuditLoading(false);
    }
  }, [server?.id]);


  const [settings, setSettings] = useState<BotServerSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [discordRoles, setDiscordRoles] = useState<Array<{ id: string; name: string; color: number }>>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const srv = server;

  useEffect(() => {
    if (server) {
      setActiveTab('overview');
      fetchShares();
      fetchSettings();
    }
  }, [server?.id]);

  const fetchSettings = useCallback(async () => {
    if (!server) return;
    setSettingsLoading(true);
    const { data, error } = await supabase
      .from('bot_server_settings')
      .select('*')
      .eq('server_id', server.id)
      .maybeSingle();

    if (!error && data) {
      setSettings(data as BotServerSettings);
    } else {
      setSettings({ server_id: server.id, ...DEFAULT_SETTINGS });
    }
    setSettingsLoading(false);
  }, [server?.id]);

  const fetchDiscordRoles = useCallback(async () => {
    if (!server || discordRoles.length > 0) return;
    if (getRestriction(server).restricted) return;
    setRolesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-member-check', {
        body: { action: 'fetch-roles', guildId: server.guild_id },
      });
      if (!error && data?.roles) {
        const filtered = (data.roles as any[]).filter(r => r.name !== '@everyone' && !r.managed);
        setDiscordRoles(filtered);
      }
    } catch (e) {
      console.error('Failed to fetch roles:', e);
    }
    setRolesLoading(false);
  }, [server?.guild_id, discordRoles.length]);

  useEffect(() => {
    if (activeTab === 'settings' && server) {
      fetchDiscordRoles();
    }
    if (activeTab === 'audit' && server) {
      fetchAudit();
    }
  }, [activeTab, server?.id]);

  const saveSettings = async () => {
    if (!settings || !server) return;
    if (denyRestrictedAction(server, 'Settings changes')) return;
    setIsSavingSettings(true);
    try {
      const payload = {
        server_id: server.id,
        cheater_role_id: settings.cheater_role_id,
        cheater_role_name: settings.cheater_role_name || 'Cheater Confirmed',
        auto_assign_role: settings.auto_assign_role,
        auto_kick_cheaters: settings.auto_kick_cheaters,
        auto_ban_cheaters: settings.auto_ban_cheaters,
        min_bans_for_alert: settings.min_bans_for_alert,
        notify_on_clean_join: settings.notify_on_clean_join,
        log_all_joins: settings.log_all_joins,
        scan_interval_hours: settings.scan_interval_hours,
        alert_mention_role_id: settings.alert_mention_role_id,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('bot_server_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('bot_server_settings')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setSettings(data as BotServerSettings);
      }
      toast.success('Settings saved');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to save settings');
    }
    setIsSavingSettings(false);
  };

  const updateSetting = <K extends keyof BotServerSettings>(key: K, value: BotServerSettings[K]) => {
    if (getRestriction(server).restricted) return;
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const fetchShares = async () => {
    if (!server) return;
    setSharesLoading(true);
    const { data, error } = await supabase
      .from('server_shares')
      .select('id, shared_with, shared_by, permission, created_at')
      .eq('server_id', server.id);

    if (!error && data) {
      const userIds = data.map((s: any) => s.shared_with);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, avatar_url')
          .in('user_id', userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setShares(data.map((s: any) => ({ ...s, profile: profileMap.get(s.shared_with) || null })));
      } else {
        setShares([]);
      }
    }
    setSharesLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !server) return;
    if (denyRestrictedAction(server, 'Access sharing')) return;
    setIsInviting(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, display_name, email')
      .eq('email', inviteEmail.trim().toLowerCase())
      .maybeSingle();

    if (!profile) {
      toast.error(t('share.user_not_found'));
      setIsInviting(false);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) { setIsInviting(false); return; }

    if (profile.user_id === session.session.user.id) {
      toast.error(t('share.cannot_self'));
      setIsInviting(false);
      return;
    }

    const { error } = await supabase.from('server_shares').insert({
      server_id: server.id,
      shared_with: profile.user_id,
      shared_by: session.session.user.id,
      permission: invitePermission,
    });

    if (error) {
      toast.error(error.code === '23505' ? t('share.already_shared') : t('share.share_failed'));
    } else {
      toast.success(`${t('share.shared_success')} ${profile.display_name || profile.email}!`);
      setInviteEmail('');
      fetchShares();
    }
    setIsInviting(false);
  };

  const handleRemoveShare = async (shareId: string) => {
    if (denyRestrictedAction(server, 'Access management')) return;
    const { error } = await supabase.from('server_shares').delete().eq('id', shareId);
    if (!error) {
      setShares(prev => prev.filter(s => s.id !== shareId));
      toast.success(t('share.access_removed'));
    }
  };

  const handleUpdatePermission = async (shareId: string, newPerm: string) => {
    if (denyRestrictedAction(server, 'Permission changes')) return;
    const { error } = await supabase.from('server_shares').update({ permission: newPerm }).eq('id', shareId);
    if (!error) {
      setShares(prev => prev.map(s => s.id === shareId ? { ...s, permission: newPerm } : s));
      toast.success(t('share.permission_updated'));
    }
  };

  if (!srv) return null;

  const iconUrl = srv.guild_icon
    ? `https://cdn.discordapp.com/icons/${srv.guild_id}/${srv.guild_icon}.${srv.guild_icon.startsWith('a_') ? 'gif' : 'webp'}?size=256`
    : null;
  const serverJoins = recentJoins.filter(j => j.guild_id === srv.guild_id);
  const cheaterJoins = serverJoins.filter(j => j.is_cheater);
  const serverDetected = detectedCheaters.filter(c => c.guild_id === srv.guild_id);
  const restriction = getRestriction(srv);
  const isRestricted = restriction.restricted;

  return (
    <Dialog open={!!server} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden max-h-[90vh] overflow-y-auto border-border/20 bg-background gap-0">

        {/* ── Hero Header ── */}
        <div className="relative px-6 pt-6 pb-5">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

          <div className="relative flex items-start gap-4">
            {/* Server icon */}
            <div className="relative shrink-0">
              {iconUrl ? (
                <img src={iconUrl} alt={srv.guild_name || ''} className="w-16 h-16 rounded-2xl object-cover ring-1 ring-border/20 shadow-lg" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-card ring-1 ring-border/20 flex items-center justify-center shadow-lg">
                  <Server className="w-7 h-7 text-muted-foreground/40" />
                </div>
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full border-[2.5px] border-background ${srv.is_active ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} />
            </div>

            {/* Server info */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-foreground truncate leading-tight">{srv.guild_name || 'Unknown Server'}</h2>
                <Badge className={`text-[9px] px-1.5 py-0 h-[18px] font-semibold ${srv.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted/30 text-muted-foreground border-border/30'}`}>
                  {srv.is_active ? 'Protected' : 'Inactive'}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mt-1.5">
                <button onClick={() => copyToClipboard(srv.guild_id)} className="text-[11px] text-muted-foreground/50 font-mono flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
                  <Copy className="w-3 h-3" /> {srv.guild_id}
                </button>
                {shares.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {shares.length} shared
                  </span>
                )}
              </div>
            </div>

            {/* Toggle — pushed left to avoid overlap with dialog close button */}
            <div className="shrink-0 pt-1 mr-6">
              <Switch checked={srv.is_active} onCheckedChange={() => onToggle(srv)} disabled={isRestricted} />
            </div>
          </div>
        </div>

        {isRestricted && (
          <div className={`mx-6 mb-5 rounded-xl border px-4 py-3 ${restriction.status === 'blacklisted' ? 'border-destructive/30 bg-destructive/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <div className="flex items-start gap-3">
              {restriction.status === 'blacklisted' ? <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
              <div className="min-w-0">
                <p className={`text-[11px] font-bold uppercase tracking-widest ${restriction.status === 'blacklisted' ? 'text-destructive' : 'text-amber-400'}`}>{restriction.label}</p>
                <p className="mt-1 text-xs font-medium text-foreground/85">All operational controls are locked until an administrator reactivates this server.</p>
                {srv.status_reason && <p className="mt-1 text-[11px] text-muted-foreground/70">Reason: {srv.status_reason}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <div className="px-6 border-b border-border/15">
            <TabsList className="w-full bg-transparent h-auto p-0 gap-0 rounded-none">
              {[
                { value: 'overview', icon: BarChart3, label: t('admin.overview') },
                { value: 'access', icon: Users, label: t('share.shared_with'), count: shares.length || undefined },
                { value: 'members', icon: Users, label: 'Members' },
                { value: 'audit', icon: History, label: 'Audit' },
                { value: 'settings', icon: Settings, label: t('nav.settings_label') },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 gap-1.5 text-[11px] font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2.5 text-muted-foreground/60 data-[state=active]:text-foreground"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count ? <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[8px] font-bold">{tab.count}</Badge> : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="px-6 py-5">
            {/* ── Overview Tab ── */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              {/* Protection health indicator */}
              <ProtectionLevel
                hasAutoWebhook={!!(srv.auto_scan_webhook_url || srv.webhook_url)}
                hasFullWebhook={!!(srv.full_scan_webhook_url || srv.manual_webhook_url)}
                hasAlertChannel={!!srv.alert_channel_name}
                memberCount={srv.member_count || 0}
              />

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2.5">
                <StatPill icon={Users} value={srv.member_count ? srv.member_count.toLocaleString() : '—'} label={t('bot.members')} accent="bg-primary/10 text-primary" />
                <StatPill icon={Activity} value={serverJoins.length} label={t('bot.recent_joins')} accent="bg-sky-500/10 text-sky-400" />
                <StatPill icon={AlertTriangle} value={cheaterJoins.length} label={t('bot.cheater_joins')} accent="bg-destructive/10 text-destructive" pulse={cheaterJoins.length > 0} />
                <StatPill icon={Shield} value={serverDetected.length} label={t('bot.detected')} accent="bg-emerald-500/10 text-emerald-400" />
              </div>

              {/* High risk activity banner */}
              {cheaterJoins.length > 0 && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.04]">
                  <ShieldAlert className="w-4 h-4 text-destructive animate-pulse shrink-0" />
                  <span className="text-[11px] font-semibold text-destructive">High risk activity detected</span>
                  <Badge variant="outline" className="ml-auto text-[9px] h-[18px] border-destructive/20 bg-destructive/5 text-destructive font-bold">{cheaterJoins.length} alerts</Badge>
                </div>
              )}

              {/* Server info — 2 column grid */}
              <div className="rounded-xl border border-border/15 bg-card/20 p-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
                  <InfoCell label="ADDED">
                    {new Date(srv.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </InfoCell>
                  <InfoCell label="LAST SCAN">
                    {srv.last_checked_at ? timeAgo(srv.last_checked_at) : t('bot.never')}
                  </InfoCell>
                  {srv.alert_channel_name && (
                    <InfoCell label="ALERT CHANNEL">
                      <span className="text-primary/80">#{srv.alert_channel_name}</span>
                    </InfoCell>
                  )}
                  <WebhookStatus url={srv.auto_scan_webhook_url || srv.webhook_url} label="AUTO-SCAN WEBHOOK" />
                  <WebhookStatus url={srv.full_scan_webhook_url || srv.manual_webhook_url} label="FULL-SCAN WEBHOOK" />
                </div>
              </div>

              {/* Scan Summary — centerpiece */}
              {scanResult && (
                <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.03] to-transparent overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/10">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="text-[13px] font-bold text-foreground">Scan Summary</span>
                    <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(scanResult.time.toISOString())}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="px-4 pt-3 pb-1">
                    <div className="flex items-center justify-between text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1.5">
                      <span>Checked vs Total</span>
                      <span className="tabular-nums">{scanResult.totalMembers > 0 ? Math.round((scanResult.checked / scanResult.totalMembers) * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-border/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-700"
                        style={{ width: `${scanResult.totalMembers > 0 ? Math.round((scanResult.checked / scanResult.totalMembers) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-px bg-border/10 mt-2">
                    {[
                      { v: scanResult.totalMembers, l: t('bot.total'), color: 'text-foreground' },
                      { v: scanResult.checked, l: t('bot.checked'), color: 'text-emerald-400' },
                      { v: scanResult.skipped, l: t('bot.skipped'), color: 'text-muted-foreground' },
                      { v: scanResult.alerts, l: t('bot.alerts'), color: scanResult.alerts > 0 ? 'text-destructive' : 'text-foreground' },
                    ].map(({ v, l, color }) => (
                      <div key={l} className="text-center py-3.5 bg-background">
                        <div className={`text-lg font-bold tabular-nums ${color}`}>{v}</div>
                        <div className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons — clear hierarchy */}
              {/* Resend welcome — live progress stepper */}
              {welcomeSteps && (
                <div className="rounded-xl border border-border/15 bg-card/20 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/10">
                    <div className="flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[12px] font-semibold text-foreground">Resend welcome progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const ok = welcomeSteps.filter((s) => s.status === 'success').length;
                        const total = welcomeSteps.length;
                        return (
                          <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">{ok}/{total}</span>
                        );
                      })()}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground"
                        onClick={() => setWelcomeSteps(null)}
                        disabled={isResendingWelcome}
                        aria-label="Clear progress"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <ol className="divide-y divide-border/10">
                    {welcomeSteps.map((step, i) => {
                      const Icon =
                        step.status === 'success' ? CheckCircle2
                          : step.status === 'fail' ? XCircle
                          : step.status === 'in_progress' ? Loader2
                          : CircleDashed;
                      const tone =
                        step.status === 'success' ? 'text-emerald-400'
                          : step.status === 'fail' ? 'text-destructive'
                          : step.status === 'in_progress' ? 'text-primary'
                          : 'text-muted-foreground/40';
                      return (
                        <li key={step.key} className="flex items-start gap-3 px-4 py-2.5">
                          <div className="flex flex-col items-center pt-0.5">
                            <Icon className={`w-4 h-4 ${tone} ${step.status === 'in_progress' ? 'animate-spin' : ''}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono text-muted-foreground/40">{i + 1}.</span>
                              <span className="text-[12px] font-semibold text-foreground truncate">{step.label}</span>
                              {step.status === 'in_progress' && (
                                <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 border-primary/30 text-primary">posting…</Badge>
                              )}
                              {step.status === 'pending' && (
                                <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 border-border/30 text-muted-foreground/60">queued</Badge>
                              )}
                              {step.status === 'success' && (
                                <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 border-emerald-500/30 text-emerald-400">sent</Badge>
                              )}
                              {step.status === 'fail' && (
                                <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 border-destructive/30 text-destructive">failed</Badge>
                              )}
                              {typeof step.httpStatus === 'number' && (
                                <Badge variant="outline" className="text-[9px] h-[16px] px-1.5">HTTP {step.httpStatus}</Badge>
                              )}
                              {typeof step.attempts === 'number' && step.attempts > 1 && (
                                <Badge variant="outline" className="text-[9px] h-[16px] px-1.5">{step.attempts} attempts</Badge>
                              )}
                              {step.rateLimited && (
                                <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 border-amber-500/30 text-amber-400">rate-limited</Badge>
                              )}
                            </div>
                            {step.status === 'fail' && step.error && (
                              <pre className="mt-1.5 text-[10px] text-muted-foreground/80 bg-background/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                                {typeof step.error === 'string' ? step.error : JSON.stringify(step.error, null, 2)}
                              </pre>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button variant="outline" size="sm" className="gap-1.5 h-10 text-xs border-border/20 hover:border-border/40 px-4" onClick={() => { onClose(); onEdit(srv); }} disabled={isRestricted}>
                  <Pencil className="w-3.5 h-3.5" /> {t('bot.edit_server')}
                </Button>
                <Button size="sm" className="gap-1.5 flex-1 h-10 text-xs font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 transition-shadow" onClick={() => { onScan(srv); onClose(); }} disabled={isScanning !== null || isRestricted}>
                  {isScanning === srv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  {isScanning === srv.id ? 'Scanning…' : t('bot.full_scan')}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 h-10 text-xs text-muted-foreground hover:text-foreground px-3" onClick={() => onTestWebhook(srv)} disabled={isTesting === srv.id || isRestricted}>
                  {isTesting === srv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Webhook className="w-3.5 h-3.5" />}
                  {isTesting === srv.id ? 'Testing…' : t('bot.test_webhook')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 h-10 text-xs border-border/20 hover:border-border/40 px-3" onClick={handleResendWelcome} disabled={isResendingWelcome || isRestricted}>
                  {isResendingWelcome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {isResendingWelcome ? 'Sending…' : 'Resend welcome'}
                </Button>
              </div>
            </TabsContent>

            {/* ── Members Tab ── */}
            <TabsContent value="members" className="mt-0">
              <ServerMembersPanel serverId={srv.id} isOwner={isOwner} />
            </TabsContent>

            {/* ── Audit Tab ── */}
            <TabsContent value="audit" className="space-y-3 mt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-semibold text-foreground">Server audit log</span>
                  <span className="text-[10px] font-mono text-muted-foreground/40">{auditRows.length} entries</span>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchAudit} disabled={auditLoading} className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1.5">
                  {auditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Refresh
                </Button>
              </div>

              {auditLoading ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
                  <span className="text-[11px] text-muted-foreground/50">{t('common.loading')}</span>
                </div>
              ) : auditRows.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                    <History className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                  <p className="text-[11px] text-muted-foreground/50 text-center max-w-[240px]">
                    No audit entries yet. Actions like “Resend welcome” will appear here.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/15 bg-card/15 divide-y divide-border/10 overflow-hidden">
                  {auditRows.map((row) => {
                    const tone =
                      row.status === 'success' ? 'border-emerald-500/30 text-emerald-400'
                        : row.status === 'partial' ? 'border-amber-500/30 text-amber-400'
                        : 'border-destructive/30 text-destructive';
                    const Icon =
                      row.status === 'success' ? CheckCircle2
                        : row.status === 'partial' ? AlertTriangle
                        : XCircle;
                    const actorLabel = row.actor?.display_name || row.actor?.email || (row.user_id ? row.user_id.slice(0, 8) + '…' : 'system');
                    return (
                      <details key={row.id} className="group">
                        <summary className="list-none cursor-pointer flex items-start gap-3 px-3.5 py-2.5 hover:bg-muted/10 transition-colors">
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${
                            row.status === 'success' ? 'text-emerald-400'
                              : row.status === 'partial' ? 'text-amber-400'
                              : 'text-destructive'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[12px] font-semibold text-foreground">{row.action.replace(/_/g, ' ')}</span>
                              <Badge variant="outline" className={`text-[9px] h-[16px] px-1.5 ${tone}`}>{row.status}</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/60">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(row.created_at).toLocaleString()}</span>
                              <span className="text-muted-foreground/30">•</span>
                              <Users className="w-3 h-3" />
                              <span className="truncate">{actorLabel}</span>
                            </div>
                            {row.error_message && (
                              <p className="mt-1 text-[10px] text-destructive/80 truncate">{row.error_message}</p>
                            )}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 mt-1 shrink-0 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="px-3.5 pb-3 pt-1 space-y-2 bg-background/40">
                          {Array.isArray(row.details?.welcome_results) && row.details.welcome_results.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                Per-channel results
                              </p>
                              <div className="rounded-lg border border-border/15 divide-y divide-border/10 overflow-hidden">
                                {row.details.welcome_results.map((r: any) => (
                                  <div key={r.channel_id} className="flex items-start gap-2 px-2.5 py-1.5">
                                    {r.ok
                                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                      : <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-semibold text-foreground">#{r.channel}</span>
                                        <Badge variant="outline" className="text-[9px] h-[15px] px-1.5">HTTP {r.status || '—'}</Badge>
                                        {r.attempts > 1 && (
                                          <Badge variant="outline" className="text-[9px] h-[15px] px-1.5">{r.attempts} attempts</Badge>
                                        )}
                                        {r.rate_limited && (
                                          <Badge variant="outline" className="text-[9px] h-[15px] px-1.5 border-amber-500/30 text-amber-400">rate-limited</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Raw details</p>
                            <pre className="text-[10px] text-muted-foreground/80 bg-card/40 border border-border/20 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-[240px]">
                              {JSON.stringify(row.details, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Access Tab ── */}
            <TabsContent value="access" className="relative space-y-5 mt-0">
              {isRestricted && (
                <div className="absolute inset-0 z-20 flex items-start justify-center rounded-xl bg-background/60 pt-8 backdrop-blur-[2px] cursor-not-allowed">
                  <Badge variant="outline" className="border-border/30 bg-card/80 text-muted-foreground">Access management locked</Badge>
                </div>
              )}
              {isOwner && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                    <UserPlus className="w-4 h-4 text-primary" />
                    Invite User
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                      <Input
                        placeholder="user@example.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleInvite()}
                        className="pl-9 h-9 text-xs bg-card/30 border-border/20"
                      />
                    </div>
                    <Select value={invitePermission} onValueChange={(v: 'view' | 'manage') => setInvitePermission(v)}>
                      <SelectTrigger className="w-[110px] h-9 text-[11px] bg-card/30 border-border/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view"><span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> {t('share.can_view')}</span></SelectItem>
                        <SelectItem value="manage"><span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-primary" /> {t('share.can_manage')}</span></SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim() || isRestricted} size="sm" className="h-9 px-4 gap-1.5 text-xs">
                      {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Invite
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground/50" /> {t('share.shared_with')}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/40">{shares.length} users</span>
                </div>

                {sharesLoading ? (
                  <div className="flex flex-col items-center py-10 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
                    <span className="text-[11px] text-muted-foreground/50">{t('common.loading')}</span>
                  </div>
                ) : shares.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-[11px] text-muted-foreground/50 text-center max-w-[200px]">{t('share.not_shared')}</p>
                  </div>
                ) : (
                  <div className="space-y-1 rounded-xl border border-border/15 bg-card/15 divide-y divide-border/10 overflow-hidden">
                    {shares.map(share => (
                      <div key={share.id} className="group flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/10 transition-colors">
                        <Avatar className="h-7 w-7 ring-1 ring-border/20 shrink-0">
                          <AvatarImage src={share.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">
                            {(share.profile?.display_name || share.profile?.email || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
                            {share.profile?.display_name || share.profile?.email || 'Unknown'}
                          </p>
                          {share.profile?.email && share.profile?.display_name && (
                            <p className="text-[10px] text-muted-foreground/40 truncate leading-tight">{share.profile.email}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOwner ? (
                            <>
                              <Select value={share.permission} onValueChange={(v) => handleUpdatePermission(share.id, v)}>
                                <SelectTrigger className="h-7 text-[10px] w-[90px] border-border/20 bg-card/30">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="view">{t('share.can_view')}</SelectItem>
                                  <SelectItem value="manage">{t('share.can_manage')}</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveShare(share.id)} className="h-7 w-7 p-0 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Badge variant="outline" className={`text-[9px] h-[18px] px-2 font-semibold ${share.permission === 'manage' ? 'border-primary/20 text-primary bg-primary/5' : 'border-border/20 text-muted-foreground/60'}`}>
                              {share.permission === 'manage' ? 'Manager' : 'Viewer'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Settings Tab ── */}
            <TabsContent value="settings" className="relative space-y-4 mt-0">
              {isRestricted && (
                <div className="absolute inset-0 z-20 flex items-start justify-center rounded-xl bg-background/60 pt-8 backdrop-blur-[2px] cursor-not-allowed">
                  <Badge variant="outline" className="border-border/30 bg-card/80 text-muted-foreground">Settings locked</Badge>
                </div>
              )}
              {settingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
                </div>
              ) : settings ? (
                <>
                  {/* Cheater Role */}
                  <SettingSection icon={ShieldAlert} title="Cheater Role" desc="Auto-assign a role to confirmed cheaters" accent="bg-destructive/10 text-destructive">
                    <SettingRow label="Auto-assign role on detection">
                      <Switch checked={settings.auto_assign_role} onCheckedChange={v => updateSetting('auto_assign_role', v)} />
                    </SettingRow>

                    {settings.auto_assign_role && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground/60 font-semibold">Discord Role</Label>
                          <Select
                            value={settings.cheater_role_id || ''}
                            onValueChange={v => {
                              updateSetting('cheater_role_id', v);
                              const role = discordRoles.find(r => r.id === v);
                              if (role) updateSetting('cheater_role_name', role.name);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-card/30 border-border/20">
                              <SelectValue placeholder={rolesLoading ? 'Loading roles...' : 'Select role'} />
                            </SelectTrigger>
                            <SelectContent>
                              {discordRoles.map(role => (
                                <SelectItem key={role.id} value={role.id}>
                                  <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'hsl(var(--muted-foreground))' }} />
                                    {role.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground/60 font-semibold">Role name (if creating new)</Label>
                          <Input value={settings.cheater_role_name} onChange={e => updateSetting('cheater_role_name', e.target.value)} placeholder="Cheater Confirmed" className="h-8 text-xs bg-card/30 border-border/20" />
                        </div>
                      </>
                    )}
                  </SettingSection>

                  {/* Auto-moderation */}
                  <SettingSection icon={Zap} title="Auto-Moderation" desc="Automatic actions on cheater detection" accent="bg-amber-500/10 text-amber-400">
                    <SettingRow icon={UserX} label="Auto-kick cheaters">
                      <Switch checked={settings.auto_kick_cheaters} onCheckedChange={v => { updateSetting('auto_kick_cheaters', v); if (v) updateSetting('auto_ban_cheaters', false); }} />
                    </SettingRow>
                    <SettingRow icon={Ban} label="Auto-ban cheaters">
                      <Switch checked={settings.auto_ban_cheaters} onCheckedChange={v => { updateSetting('auto_ban_cheaters', v); if (v) updateSetting('auto_kick_cheaters', false); }} />
                    </SettingRow>

                    {(settings.auto_kick_cheaters || settings.auto_ban_cheaters) && (
                      <div className="rounded-lg bg-destructive/5 border border-destructive/15 p-2.5 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                        <p className="text-[10px] text-destructive/80 leading-relaxed">
                          {settings.auto_ban_cheaters ? 'Cheaters will be automatically BANNED from the server.' : 'Cheaters will be automatically KICKED from the server.'}
                        </p>
                      </div>
                    )}
                  </SettingSection>

                  {/* Alerts */}
                  <SettingSection icon={Bell} title="Alerts & Notifications" desc="Configure when and how alerts are sent" accent="bg-primary/10 text-primary">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground/60 font-semibold">Minimum bans before alert</Label>
                      <Select value={String(settings.min_bans_for_alert)} onValueChange={v => updateSetting('min_bans_for_alert', parseInt(v))}>
                        <SelectTrigger className="h-8 text-xs bg-card/30 border-border/20 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1+ bans (all cheaters)</SelectItem>
                          <SelectItem value="2">2+ bans</SelectItem>
                          <SelectItem value="3">3+ bans</SelectItem>
                          <SelectItem value="5">5+ bans (worst only)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground/60 font-semibold">Mention role on alerts</Label>
                      <Select value={settings.alert_mention_role_id || 'none'} onValueChange={v => updateSetting('alert_mention_role_id', v === 'none' ? null : v)}>
                        <SelectTrigger className="h-8 text-xs bg-card/30 border-border/20 w-full">
                          <SelectValue placeholder="No mention" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No mention</SelectItem>
                          {discordRoles.map(role => (
                            <SelectItem key={role.id} value={role.id}>
                              <span className="flex items-center gap-2">
                                <AtSign className="w-3 h-3" />
                                {role.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator className="opacity-20" />

                    <SettingRow icon={Bell} label="Notify on clean joins">
                      <Switch checked={settings.notify_on_clean_join} onCheckedChange={v => updateSetting('notify_on_clean_join', v)} />
                    </SettingRow>
                  </SettingSection>

                  {/* Logging */}
                  <SettingSection icon={ScrollText} title="Logging & Scanning" desc="Control what gets logged and scanned" accent="bg-sky-500/10 text-sky-400">
                    <SettingRow icon={ScrollText} label="Log all joins (not just cheaters)">
                      <Switch checked={settings.log_all_joins} onCheckedChange={v => updateSetting('log_all_joins', v)} />
                    </SettingRow>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground/60 font-semibold flex items-center gap-1.5">
                        <Timer className="w-3 h-3" /> Auto-scan interval
                      </Label>
                      <Select value={settings.scan_interval_hours ? String(settings.scan_interval_hours) : 'off'} onValueChange={v => updateSetting('scan_interval_hours', v === 'off' ? null : parseInt(v))}>
                        <SelectTrigger className="h-8 text-xs bg-card/30 border-border/20 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Disabled</SelectItem>
                          <SelectItem value="6">Every 6 hours</SelectItem>
                          <SelectItem value="12">Every 12 hours</SelectItem>
                          <SelectItem value="24">Daily</SelectItem>
                          <SelectItem value="48">Every 2 days</SelectItem>
                          <SelectItem value="168">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </SettingSection>

                  {/* Webhook info in settings */}
                  <div className="rounded-xl border border-border/15 bg-card/15 divide-y divide-border/10 overflow-hidden">
                    <InfoRow icon={Webhook} label="Auto-Scan Webhook">
                      <span className="font-mono text-muted-foreground/60 text-[10px]">{srv.auto_scan_webhook_url || srv.webhook_url ? '••••••' + (srv.auto_scan_webhook_url || srv.webhook_url).slice(-22) : t('bot.not_set')}</span>
                    </InfoRow>
                    <InfoRow icon={Webhook} label="Full-Scan Webhook">
                      <span className="font-mono text-muted-foreground/60 text-[10px]">{srv.full_scan_webhook_url || srv.manual_webhook_url ? '••••••' + (srv.full_scan_webhook_url || srv.manual_webhook_url || '').slice(-22) : t('bot.not_set')}</span>
                    </InfoRow>
                    {srv.info_channel_id && (
                      <InfoRow icon={Hash} label="Info Channel">
                        <span className="font-mono text-muted-foreground/60">{srv.info_channel_id}</span>
                      </InfoRow>
                    )}
                    <InfoRow icon={Shield} label="Status">
                      <Switch checked={srv.is_active} onCheckedChange={() => onToggle(srv)} disabled={isRestricted} />
                    </InfoRow>
                  </div>

                  {/* Save */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button onClick={saveSettings} disabled={isSavingSettings || isRestricted} className="gap-1.5 flex-1 h-9 text-xs">
                      {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Save Settings
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs border-border/20" onClick={() => { onClose(); onEdit(srv); }} disabled={isRestricted}>
                      <Pencil className="w-3.5 h-3.5" /> {t('bot.edit_server')}
                    </Button>
                  </div>
                </>
              ) : null}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>

      {/* ── Resend welcome — detailed error dialog ── */}
      <Dialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((s) => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              {errorDialog.title}
            </DialogTitle>
            <DialogDescription className="text-foreground/80">
              {errorDialog.summary}
            </DialogDescription>
          </DialogHeader>

          {/* Per-channel results */}
          {Array.isArray(errorDialog.details?.welcome_results) && errorDialog.details.welcome_results.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Per-channel results
              </p>
              <div className="rounded-lg border border-border/20 divide-y divide-border/10 overflow-hidden">
                {errorDialog.details.welcome_results.map((r: any) => (
                  <div key={r.channel_id} className="flex items-start gap-3 px-3 py-2.5 bg-card/30">
                    {r.ok
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-foreground">#{r.channel}</span>
                        <Badge variant="outline" className="text-[9px] h-[16px] px-1.5">
                          HTTP {r.status || '—'}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] h-[16px] px-1.5">
                          {r.attempts} attempt{r.attempts === 1 ? '' : 's'}
                        </Badge>
                        {r.rate_limited && (
                          <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 border-amber-500/30 text-amber-400">
                            rate-limited
                          </Badge>
                        )}
                      </div>
                      {!r.ok && r.error && (
                        <pre className="mt-1.5 text-[10px] text-muted-foreground/80 bg-background/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                          {typeof r.error === 'string' ? r.error : JSON.stringify(r.error, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw response */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Raw response
            </p>
            <pre className="text-[10px] text-muted-foreground/80 bg-card/40 border border-border/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-[280px]">
              {JSON.stringify(errorDialog.details, null, 2)}
            </pre>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(errorDialog.details, null, 2));
                toast.success('Error details copied');
              }}
            >
              <Copy className="w-3.5 h-3.5" /> Copy details
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setErrorDialog((s) => ({ ...s, open: false }));
                handleResendWelcome();
              }}
              disabled={isResendingWelcome || isRestricted}
            >
              {isResendingWelcome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default ServerDetailPanel;
