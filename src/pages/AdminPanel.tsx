// @ts-nocheck
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { motion, useInView, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, AlertTriangle, BarChart3, RefreshCw,
  Activity, Eye, Bot, Key, Crown, ShieldCheck,
  ChevronRight, Settings2, Zap, TrendingUp, Globe, Webhook, Database, ScrollText,
  ArrowUpRight, Clock, Search, PanelLeftClose, PanelLeft, Stethoscope,
  Pin, PinOff, Command as CommandIcon, ChevronDown
} from 'lucide-react';
import BotPanel from '@/components/admin/BotPanel';
import BotOverviewPanel from '@/components/admin/BotOverviewPanel';
import ApiKeysPanel from '@/components/admin/ApiKeysPanel';
import DiscordCredentialsPanel from '@/components/admin/DiscordCredentialsPanel';
import CheaterManagement from '@/components/CheaterManagement';
import SocialLinksPanel from '@/components/admin/SocialLinksPanel';
import DatabaseExportPanel from '@/components/admin/DatabaseExportPanel';
import StatsOverridePanel from '@/components/admin/StatsOverridePanel';
import AuditActivityPanel from '@/components/admin/AuditActivityPanel';
import ServerCreationKeysPanel from '@/components/admin/ServerCreationKeysPanel';
import HiddenCheatersPanel from '@/components/admin/HiddenCheatersPanel';
import DiscordWebhookSettings from '@/components/DiscordWebhookSettings';
import SystemWebhooksPanel from '@/components/admin/SystemWebhooksPanel';
import BotDiagnosticsPanel from '@/components/admin/BotDiagnosticsPanel';
import ScanDiagnosticsPanel from '@/components/admin/ScanDiagnosticsPanel';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { supabase } from '@/lib/supabase';
import { getSessionWithTimeout } from '@/lib/authSession';
import UserLifecyclePanel from '@/components/admin/UserLifecyclePanel';
import HeroImagePanel from '@/components/admin/HeroImagePanel';
import ManagedImagePanel from '@/components/admin/ManagedImagePanel';
import SystemStatusPanel from '@/components/admin/SystemStatusPanel';
import AuthMethodsPanel from '@/components/admin/AuthMethodsPanel';
import { toast } from 'sonner';
import { runAsync } from '@/lib/asyncRequest';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';

// Animated counter
const AnimatedNumber = ({ value, duration = 1.5 }: { value: number; duration?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { duration: duration * 1000 });
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    if (isInView) spring.set(value);
  }, [isInView, value, spring]);

  return <motion.span ref={ref}>{display}</motion.span>;
};

interface Stats {
  totalUsers: number;
  totalAdmins: number;
  totalModerators: number;
  totalCheaterReports: number;
  recentActivity: Array<{ action: string; table_name: string; created_at: string; user_id: string | null }>;
}

const NAV_GROUPS = [
  {
    label: 'General',
    items: [
      { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Stats & quick actions' },
      { id: 'users-roles', label: 'Users & Roles', icon: Users, description: 'Lifecycle, flags, risk & staff roles' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'data', label: 'Data Management', icon: Database, description: 'Export & backup' },
      { id: 'audit', label: 'Audit & Activity', icon: ScrollText, description: 'Activity feed + database changes' },
      { id: 'cheaters', label: 'Cheater DB', icon: AlertTriangle, description: 'Manage reports' },
      { id: 'appearance', label: 'Appearance', icon: Eye, description: 'Hero image & layout' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'bot-overview', label: 'Bot Overview', icon: Eye, description: 'Server & scan overview' },
      { id: 'webhooks', label: 'Discord Webhooks', icon: Webhook, description: 'System & content webhooks' },
      { id: 'diagnostics', label: 'Bot Diagnostics', icon: Stethoscope, description: 'Run a full self-test' },
      { id: 'scan-diagnostics', label: 'Scan Diagnostics', icon: Activity, description: 'Live scan health, retries & stuck scans' },
      { id: 'bot', label: 'Bot Config', icon: Bot, description: 'Discord bot setup' },
      { id: 'api-keys', label: 'API Keys', icon: Key, description: 'Manage access tokens' },
      { id: 'server-keys', label: 'Server Keys', icon: ShieldCheck, description: 'Personal server creation keys' },
    ],
  },
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isAdmin, isLoading: adminLoading } = useAdminStatus();
  const { getVisibility, updateSetting, isLoading: settingsLoading } = useSystemSettings();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pinned, setPinned] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('admin:pinned') || '[]'); } catch { return []; }
  });
  const [now, setNow] = useState(new Date());
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const togglePin = (id: string) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('admin:pinned', JSON.stringify(next));
      return next;
    });
  };

  const allItems = useMemo(() => NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), []);
  const pinnedItems = useMemo(() => pinned.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as any[], [pinned, allItems]);

  const filteredGroups = NAV_GROUPS;

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error('Access denied. Admin privileges required.');
      navigate('/dashboard');
    }
  }, [adminLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) fetchData();
    return () => abortRef.current?.abort();
  }, [isAdmin]);

  const fetchData = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestSeqRef.current;
    setIsLoading(true);
    try {
      await fetchStats(controller.signal, requestId);
    } catch (err) {
      console.error('[AdminPanel] fetchStats failed:', err);
    } finally {
      if (requestSeqRef.current === requestId && !controller.signal.aborted) setIsLoading(false);
    }
  };

  const safeQuery = async <T,>(query: (signal: AbortSignal) => Promise<T>, label: string, fallback: T, signal: AbortSignal): Promise<T> => {
    try {
      const outcome = await runAsync((scopedSignal) => query(scopedSignal), { timeoutMs: 8000, retries: 0, signal, label: `admin:${label}` });
      return outcome.ok ? outcome.data : fallback;
    } catch (err) {
      console.error(`[AdminPanel] ${label} failed:`, err);
      return fallback;
    }
  };

  const fetchStats = async (signal: AbortSignal, requestId: number) => {
    const { data: { session } } = await getSessionWithTimeout();
    if (signal.aborted || requestSeqRef.current !== requestId) return;
    if (!session) {
      setStats({ totalUsers: 0, totalAdmins: 0, totalModerators: 0, totalCheaterReports: 0, recentActivity: [] });
      return;
    }

    const [usersCount, cheatersCount, rolesData, recentAudit] = await Promise.all([
      safeQuery((s) => supabase.from('profiles').select('id', { count: 'exact', head: true }).abortSignal(s), 'profiles count', { count: 0, error: null } as any, signal),
      safeQuery((s) => supabase.from('cheater_reports').select('id', { count: 'exact', head: true }).abortSignal(s), 'cheaters count', { count: 0, error: null } as any, signal),
      safeQuery((s) => supabase.from('user_roles').select('role').abortSignal(s), 'roles', { data: [], error: null } as any, signal),
      safeQuery((s) => supabase.from('audit_log').select('action, table_name, created_at, user_id').order('created_at', { ascending: false }).limit(8).abortSignal(s), 'audit_log', { data: [], error: null } as any, signal),
    ]);
    if (signal.aborted || requestSeqRef.current !== requestId) return;
    if ((recentAudit as any).error) {
      console.error('[AdminPanel] audit_log fetch error:', (recentAudit as any).error);
    }
    const roles = (rolesData as any).data || [];
    setStats({
      totalUsers: (usersCount as any).count || 0,
      totalCheaterReports: (cheatersCount as any).count || 0,
      totalAdmins: roles.filter((r: any) => r.role === 'admin').length,
      totalModerators: roles.filter((r: any) => r.role === 'moderator').length,
      recentActivity: (recentAudit as any).data || [],
    });
  };

  const handleVisibilityChange = async (key: string, value: 'all' | 'admin' | 'disabled') => {
    const success = await updateSetting(key, value);
    if (success) {
      const labels = { all: 'visible to all', admin: 'admin only', disabled: 'disabled' };
      toast.success(`Updated: ${labels[value]}`);
    }
  };

  const currentNavItem = useMemo(() => {
    for (const g of NAV_GROUPS) {
      const found = g.items.find(i => i.id === selectedTab);
      if (found) return found;
    }
    return null;
  }, [selectedTab]);

  const currentGroupLabel = useMemo(() => {
    for (const g of NAV_GROUPS) {
      if (g.items.find((i) => i.id === selectedTab)) return g.label;
    }
    return null;
  }, [selectedTab]);

  if (adminLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground font-medium">Loading admin panel…</span>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'primary', hint: 'Registered accounts' },
    { label: 'Administrators', value: stats?.totalAdmins || 0, icon: Crown, color: 'yellow', hint: 'Full access' },
    { label: 'Moderators', value: stats?.totalModerators || 0, icon: ShieldCheck, color: 'cyan', hint: 'Limited access' },
    { label: 'Cheater Reports', value: stats?.totalCheaterReports || 0, icon: AlertTriangle, color: 'magenta', hint: 'Total submitted' },
  ];

  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    primary: { bg: 'bg-primary/10', text: 'text-primary', ring: 'ring-primary/15' },
    yellow: { bg: 'bg-[hsl(var(--yellow))]/10', text: 'text-[hsl(var(--yellow))]', ring: 'ring-[hsl(var(--yellow))]/15' },
    cyan: { bg: 'bg-[hsl(var(--cyan))]/10', text: 'text-[hsl(var(--cyan))]', ring: 'ring-[hsl(var(--cyan))]/15' },
    magenta: { bg: 'bg-[hsl(var(--magenta))]/10', text: 'text-[hsl(var(--magenta))]', ring: 'ring-[hsl(var(--magenta))]/15' },
  };

  const formatTimeAgo = (date: string) => {
    if (!date) return '—';
    const diff = Date.now() - new Date(date).getTime();
    if (isNaN(diff)) return '—';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const renderContent = () => {
    switch (selectedTab) {
      case 'overview':
        return (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* Section heading */}
            <div className="pb-1">
              <h2 className="text-[22px] font-semibold tracking-tight text-foreground">Overview</h2>
              <p className="text-[13px] text-muted-foreground/70 mt-1">Platform health and key metrics at a glance.</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {isLoading
                ? [0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-border/15 bg-card/40 p-5 animate-pulse h-[112px]" />
                  ))
                : statCards.map((card, i) => {
                    const c = colorMap[card.color];
                    return (
                      <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                        className="relative rounded-xl border border-border/15 bg-card/40 p-5 hover:border-border/30 transition-colors duration-200"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">{card.label}</span>
                          <div className={`w-8 h-8 rounded-lg ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
                            <card.icon className={`w-4 h-4 ${c.text}`} />
                          </div>
                        </div>
                        <p className="text-[28px] font-semibold text-foreground tabular-nums leading-none">
                          <AnimatedNumber value={card.value} />
                        </p>
                        <p className="text-[11px] text-muted-foreground/55 mt-2">{card.hint}</p>
                      </motion.div>
                    );
                  })}
            </div>

            {/* Two-column: Quick Actions + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="lg:col-span-2 rounded-xl border border-border/15 bg-card/40 overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-border/10">
                  <h3 className="text-[13px] font-semibold text-foreground tracking-tight">Quick Actions</h3>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">Jump to common tasks</p>
                </div>
                <div className="p-2">
                  {[
                    { label: 'Manage Roles', icon: Crown, tab: 'users-roles', color: 'yellow' },
                    { label: 'Cheater Database', icon: AlertTriangle, tab: 'cheaters', color: 'magenta' },
                    { label: 'Discord Webhooks', icon: Webhook, tab: 'webhooks', color: 'cyan' },
                    { label: 'Export Data', icon: Database, tab: 'data', color: 'primary' },
                    { label: 'Bot Configuration', icon: Bot, tab: 'bot', color: 'primary' },
                    { label: 'API Keys', icon: Key, tab: 'api-keys', color: 'yellow' },
                  ].map((action) => {
                    const c = colorMap[action.color];
                    return (
                      <button
                        key={action.tab}
                        onClick={() => setSelectedTab(action.tab)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/25 transition-colors text-left group"
                      >
                        <div className={`w-7 h-7 rounded-md ${c.bg} flex items-center justify-center shrink-0`}>
                          <action.icon className={`w-3.5 h-3.5 ${c.text}`} />
                        </div>
                        <span className="text-[13px] font-medium text-foreground/85 group-hover:text-foreground transition-colors flex-1">{action.label}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/70 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-3 rounded-xl border border-border/15 bg-card/40 overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-border/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-[13px] font-semibold text-foreground tracking-tight">Recent Activity</h3>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">Latest changes across the system</p>
                  </div>
                  <button
                    onClick={() => setSelectedTab('audit')}
                    className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                  >
                    View audit log <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-2">
                  {isLoading ? (
                    [0, 1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-7 h-7 rounded-md bg-secondary/30 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-32 rounded bg-secondary/30 animate-pulse" />
                          <div className="h-2.5 w-20 rounded bg-secondary/20 animate-pulse" />
                        </div>
                      </div>
                    ))
                  ) : (!stats?.recentActivity || stats.recentActivity.length === 0) ? (
                    <div className="py-12 text-center">
                      <Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-[12px] text-muted-foreground/60">No recent activity recorded</p>
                      <button
                        onClick={fetchData}
                        className="mt-3 text-[11px] font-medium text-primary hover:text-primary/80 inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Try again
                      </button>
                    </div>
                  ) : (
                    stats.recentActivity.map((event, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedTab('audit')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/25 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-md bg-secondary/30 flex items-center justify-center shrink-0">
                          <Activity className="w-3.5 h-3.5 text-muted-foreground/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground/90 truncate capitalize">
                            {(event.action || 'unknown').replace(/_/g, ' ')}
                          </p>
                          <p className="text-[11px] text-muted-foreground/55 truncate">
                            {event.table_name || 'system'}
                          </p>
                        </div>
                        <span className="text-[11px] text-muted-foreground/45 tabular-nums whitespace-nowrap shrink-0">
                          {formatTimeAgo(event.created_at)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </div>

            {/* System Status */}
            <SystemStatusPanel />

            {/* Social links */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <SocialLinksPanel />
            </motion.div>
          </motion.div>
        );

      case 'users-roles':
      case 'users':
      case 'roles':
        return (
          <motion.div
            key="users-roles"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <AuthMethodsPanel />
            <UserLifecyclePanel />
          </motion.div>
        );

      case 'data':
        return (
          <motion.div key="data" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <DatabaseExportPanel />
            <StatsOverridePanel />
          </motion.div>
        );

      case 'appearance':
        return (
          <motion.div key="appearance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="rounded-xl border border-border/20 bg-card/50 p-6">
              <HeroImagePanel />
            </div>
            <div className="rounded-xl border border-border/20 bg-card/50 p-6 space-y-1">
              <h2 className="text-base font-semibold text-foreground">Landing page images</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Replace the showcase images visible on the public landing page (when users are not logged in).
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ManagedImagePanel
                  settingKey="landing_feature_server_lookup"
                  storagePrefix="feature-server-lookup"
                  title="Server Lookup showcase"
                  description="Image shown for the Server Lookup feature"
                  fallbackPreview="/images/showcase-server-details.png"
                />
                <ManagedImagePanel
                  settingKey="landing_feature_players"
                  storagePrefix="feature-players"
                  title="Online Players showcase"
                  description="Image shown for the Online Players feature"
                />
                <ManagedImagePanel
                  settingKey="landing_feature_cheaters"
                  storagePrefix="feature-cheaters"
                  title="Cheater Database showcase"
                  description="Image shown for the Cheater DB feature"
                />
                <ManagedImagePanel
                  settingKey="landing_feature_mods"
                  storagePrefix="feature-mods"
                  title="FiveM Mods showcase"
                  description="Image shown for the FiveM Mods feature"
                />
              </div>
            </div>
          </motion.div>
        );

      case 'cheaters':
        return (
          <motion.div key="cheaters" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <HiddenCheatersPanel />
            <CheaterManagement />
          </motion.div>
        );

      case 'bot':
        return (
          <motion.div key="bot" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BotPanel />
          </motion.div>
        );

      case 'bot-overview':
        return (
          <motion.div key="bot-overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BotOverviewPanel />
          </motion.div>
        );

      case 'api-keys':
        return (
          <motion.div key="api-keys" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid gap-6 md:grid-cols-2 items-start">
              <ApiKeysPanel />
              <DiscordCredentialsPanel />
            </div>
          </motion.div>
        );

      case 'webhooks':
        return (
          <motion.div key="webhooks" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-10">
              <SystemWebhooksPanel />
              <div className="border-t border-border/20 pt-8">
                <DiscordWebhookSettings />
              </div>
            </div>
          </motion.div>
        );

      case 'diagnostics':
        return (
          <motion.div key="diagnostics" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BotDiagnosticsPanel />
          </motion.div>
        );

      case 'scan-diagnostics':
        return (
          <motion.div key="scan-diagnostics" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ScanDiagnosticsPanel />
          </motion.div>
        );

      case 'audit':
        return (
          <motion.div key="audit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AuditActivityPanel />
          </motion.div>
        );

      case 'server-keys':
        return (
          <motion.div key="server-keys" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ServerCreationKeysPanel />
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-background">
      <MaintenanceBanner />
      <AppHeader />

      {/* ⌘K Command Palette */}
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Jump to section, search settings…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {pinnedItems.length > 0 && (
            <>
              <CommandGroup heading="Pinned">
                {pinnedItems.map((item) => (
                  <CommandItem
                    key={`pin-${item.id}`}
                    value={`pinned ${item.label} ${item.description}`}
                    onSelect={() => { setSelectedTab(item.id); setPaletteOpen(false); }}
                  >
                    <item.icon className="w-3.5 h-3.5 mr-2 text-primary" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground/50">{item.group}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          {NAV_GROUPS.map((g) => (
            <CommandGroup key={g.label} heading={g.label}>
              {g.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.description}`}
                  onSelect={() => { setSelectedTab(item.id); setPaletteOpen(false); }}
                >
                  <item.icon className="w-3.5 h-3.5 mr-2 text-muted-foreground/70" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/50">{item.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem value="refresh data" onSelect={() => { fetchData(); setPaletteOpen(false); }}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Refresh data
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside
          className={`shrink-0 border-r border-border/15 bg-card/20 backdrop-blur-xl flex flex-col transition-all duration-300 ${
            sidebarCollapsed ? 'w-[60px]' : 'w-[260px]'
          }`}
        >
          {/* Sidebar header */}
          <div className={`px-4 py-4 border-b border-border/10 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/15 ring-1 ring-primary/20 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground leading-tight">Admin</p>
                  <p className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-[0.2em]">Control Center</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-7 h-7 rounded-md hover:bg-secondary/40 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
            >
              {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Search + ⌘K hint */}
          {!sidebarCollapsed && (
            <div className="px-3 pt-3">
              <button
                onClick={() => setPaletteOpen(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-secondary/20 hover:bg-secondary/30 border border-border/10 transition-colors text-left group"
              >
                <Search className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-[11px] text-muted-foreground/60 flex-1">Search panels…</span>
                <kbd className="text-[9px] font-mono text-muted-foreground/50 bg-background/50 px-1.5 py-0.5 rounded border border-border/20">
                  ⌘K
                </kbd>
              </button>
            </div>
          )}

          {/* Pinned */}
          {!sidebarCollapsed && pinnedItems.length > 0 && (
            <div className="px-2 pt-3">
              <p className="px-3 mb-1.5 text-[9px] font-bold text-muted-foreground/30 uppercase tracking-[0.25em]">Pinned</p>
              <div className="space-y-0.5">
                {pinnedItems.map((item) => {
                  const isActive = selectedTab === item.id;
                  return (
                    <button
                      key={`pin-side-${item.id}`}
                      onClick={() => setSelectedTab(item.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-foreground ring-1 ring-primary/15'
                          : 'text-muted-foreground/70 hover:text-foreground hover:bg-secondary/20'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto scrollbar-thin">
            {filteredGroups.map((group) => (
              <div key={group.label}>
                {!sidebarCollapsed && (
                  <p className="px-3 mb-1.5 text-[9px] font-bold text-muted-foreground/30 uppercase tracking-[0.25em]">{group.label}</p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = selectedTab === item.id;
                    const isPinned = pinned.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedTab(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 rounded-lg text-left transition-all duration-200 group cursor-pointer ${
                          sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-primary/10 text-foreground ring-1 ring-primary/15'
                            : 'text-muted-foreground/70 hover:text-foreground hover:bg-secondary/20'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-all ${
                          isActive
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground/50 group-hover:text-foreground'
                        }`}>
                          <item.icon className="w-[15px] h-[15px]" />
                        </div>
                        {!sidebarCollapsed && (
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12px] font-medium truncate ${isActive ? 'text-foreground' : ''}`}>{item.label}</p>
                            <p className={`text-[10px] truncate ${isActive ? 'text-primary/60' : 'text-muted-foreground/40'}`}>{item.description}</p>
                          </div>
                        )}
                        {!sidebarCollapsed && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); togglePin(item.id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(item.id); } }}
                            className={`shrink-0 p-1 rounded-md transition-all ${
                              isPinned
                                ? 'text-primary opacity-100'
                                : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground'
                            }`}
                            title={isPinned ? 'Unpin' : 'Pin to top'}
                          >
                            {isPinned ? <Pin className="w-3 h-3 fill-current" /> : <Pin className="w-3 h-3" />}
                          </span>
                        )}
                        {isActive && !sidebarCollapsed && (
                          <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          {!sidebarCollapsed && (
            <div className="px-4 py-3 border-t border-border/10 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-medium">
                <div className="flex items-center gap-1.5 text-muted-foreground/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
                  <span>All systems operational</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] text-muted-foreground/30 font-medium uppercase tracking-[0.2em]">
                <span>CurlyKidd · v2.0</span>
                <span className="tabular-nums">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Content header bar */}
          <div className="sticky top-0 z-10 border-b border-border/10 bg-background/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {currentNavItem && (
                <>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0">
                    <currentNavItem.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    {/* breadcrumbs */}
                    <nav className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-[0.14em] mb-0.5">
                      <Shield className="w-2.5 h-2.5" />
                      <span>Admin</span>
                      {currentGroupLabel && (
                        <>
                          <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/30" />
                          <span>{currentGroupLabel}</span>
                        </>
                      )}
                      <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/30" />
                      <span className="text-primary/80">{currentNavItem.label}</span>
                    </nav>
                    <h1 className="text-[15px] font-bold text-foreground leading-tight tracking-tight truncate">{currentNavItem.label}</h1>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/20 text-[10px] font-semibold text-emerald-400 uppercase tracking-[0.1em]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Production
              </span>
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden md:inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border/20 bg-card/30 hover:bg-card/60 text-muted-foreground hover:text-foreground transition-colors text-[11px]"
                title="Command palette"
              >
                <CommandIcon className="w-3 h-3" />
                <span>Command</span>
                <kbd className="text-[9px] font-mono bg-background/60 px-1 py-0.5 rounded border border-border/20">⌘K</kbd>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchData}
                disabled={isLoading}
                className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="p-6 pb-20 md:pb-6">
            <AnimatePresence mode="wait">
              {renderContent()}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
