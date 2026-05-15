import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Users, AlertTriangle, Shield, Activity, Clock, BarChart3,
  Power, PowerOff, Trash2, RefreshCw, Eye, ChevronDown, Search,
  Bot, Zap, Timer, Hash, CheckCircle, XCircle, Loader2, MoreHorizontal, Settings,
  Copy, Send, Edit3, Download, Link, Unlink,
  ArrowUpDown, Filter, RotateCcw, UserX, ScanLine,
  TrendingUp, TrendingDown, Flame, AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuTrigger, ContextMenuLabel, ContextMenuSub, ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const ScanHistory = lazy(() => import('@/components/ScanHistory'));

interface BotServer {
  id: string;
  guild_id: string;
  guild_name: string | null;
  guild_icon: string | null;
  webhook_url: string;
  manual_webhook_url: string | null;
  full_scan_webhook_url: string | null;
  auto_scan_webhook_url: string | null;
  is_active: boolean | null;
  member_count: number | null;
  user_id: string;
  created_at: string;
  last_checked_at: string | null;
  alert_channel_name: string | null;
}

interface ScanRecord {
  id: string;
  guild_id: string;
  guild_name: string | null;
  server_id: string;
  total_checked: number;
  total_skipped: number;
  total_alerts: number;
  total_members: number;
  total_failed: number;
  duration_seconds: number;
  status: string;
  finished_at: string;
}

interface DetectedCheater {
  id: string;
  guild_id: string;
  guild_name: string | null;
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  total_bans: number | null;
  total_tickets: number | null;
  detected_at: string;
  is_flagged: boolean | null;
  summary_text: string | null;
}

type SortMode = 'newest' | 'oldest' | 'name' | 'members' | 'alerts';
type FilterMode = 'all' | 'active' | 'inactive' | 'high_flagged' | 'no_scans';

interface EnrichedCheater extends DetectedCheater {
  join_count?: number;
}

export default function BotOverviewPanel() {
  const [servers, setServers] = useState<BotServer[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [cheaters, setCheaters] = useState<DetectedCheater[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set());
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null);
  const [editingAutoWebhook, setEditingAutoWebhook] = useState<string | null>(null);
  const [editingFullScanWebhook, setEditingFullScanWebhook] = useState<string | null>(null);
  const [editingAutoScanWebhook, setEditingAutoScanWebhook] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState('');
  const [autoWebhookInput, setAutoWebhookInput] = useState('');
  const [fullScanWebhookInput, setFullScanWebhookInput] = useState('');
  const [autoScanWebhookInput, setAutoScanWebhookInput] = useState('');
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState(false);
  const [guildCheaters, setGuildCheaters] = useState<Record<string, EnrichedCheater[]>>({});
  const [loadingGuildCheaters, setLoadingGuildCheaters] = useState<string | null>(null);
  const [scanViewer, setScanViewer] = useState<{ guildId: string; guildName: string } | null>(null);

  const fetchGuildCheaters = useCallback(async (guildId: string) => {
    if (loadingGuildCheaters === guildId || guildCheaters[guildId]) return;
    setLoadingGuildCheaters(guildId);

    let allCheaters: DetectedCheater[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from('bot_detected_cheaters')
        .select('*')
        .eq('guild_id', guildId)
        .order('detected_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      allCheaters = allCheaters.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (allCheaters.length > 0) {
      const userIds = [...new Set(allCheaters.map(c => c.discord_user_id))];
      const serverSets: Record<string, Set<string>> = {};
      const batchSize = 100;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const [detectedRes, joinsRes] = await Promise.all([
          supabase.from('bot_detected_cheaters').select('discord_user_id, guild_id').in('discord_user_id', batch),
          supabase.from('discord_member_joins').select('discord_user_id, guild_id').in('discord_user_id', batch),
        ]);
        [...(detectedRes.data || []), ...(joinsRes.data || [])].forEach((row: { discord_user_id: string; guild_id: string }) => {
          if (!serverSets[row.discord_user_id]) serverSets[row.discord_user_id] = new Set();
          serverSets[row.discord_user_id].add(row.guild_id);
        });
      }
      const enriched: EnrichedCheater[] = allCheaters.map(c => ({
        ...c,
        join_count: Math.max(serverSets[c.discord_user_id]?.size || 0, 1),
      }));
      setGuildCheaters(prev => ({ ...prev, [guildId]: enriched }));
    } else {
      setGuildCheaters(prev => ({ ...prev, [guildId]: [] }));
    }
    setLoadingGuildCheaters(null);
  }, [loadingGuildCheaters, guildCheaters]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [serversRes, scansRes, cheatersRes] = await Promise.all([
      supabase.from('discord_bot_servers').select('*').order('created_at', { ascending: false }),
      supabase.from('scan_history').select('*').order('finished_at', { ascending: false }).limit(100),
      supabase.from('bot_detected_cheaters').select('*').order('detected_at', { ascending: false }).limit(1000),
    ]);
    if (serversRes.data) {
      // Webhook URL columns are protected; admins fetch them via secure RPC.
      let merged = serversRes.data as any[];
      try {
        const { data: webhooks } = await supabase.rpc('get_my_server_webhooks');
        if (Array.isArray(webhooks) && webhooks.length > 0) {
          const map = new Map<string, any>(webhooks.map((w: any) => [w.id, w]));
          merged = merged.map((s: any) => {
            const w = map.get(s.id);
            return w ? { ...s, ...w } : s;
          });
        }
      } catch (e) {
        console.warn('BotOverviewPanel: webhook RPC failed', e);
      }
      setServers(merged);
    }
    if (scansRes.data) setScans(scansRes.data);
    if (cheatersRes.data) setCheaters(cheatersRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- Actions ---
  const toggleServer = async (server: BotServer) => {
    const newActive = !server.is_active;
    const { error } = await supabase.from('discord_bot_servers').update({ is_active: newActive }).eq('id', server.id);
    if (error) toast.error('Failed to update server');
    else {
      setServers(prev => prev.map(s => s.id === server.id ? { ...s, is_active: newActive } : s));
      toast.success(newActive ? 'Server activated' : 'Server deactivated');
    }
  };

  const deleteServer = async (server: BotServer) => {
    const { error } = await supabase.from('discord_bot_servers').delete().eq('id', server.id);
    if (error) toast.error('Failed to delete server');
    else {
      setServers(prev => prev.filter(s => s.id !== server.id));
      toast.success('Server removed');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const testWebhook = async (server: BotServer) => {
    const url = server.manual_webhook_url || server.webhook_url;
    if (!url) { toast.error('No webhook URL configured'); return; }
    setTestingWebhook(server.id);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🧪 Webhook Test',
            description: 'Test message from admin panel.',
            color: 0x5865F2,
            timestamp: new Date().toISOString(),
          }]
        }),
      });
      if (res.ok) toast.success('Test message sent!');
      else toast.error(`Webhook failed: ${res.status}`);
    } catch {
      toast.error('Webhook request failed');
    }
    setTestingWebhook(null);
  };

  const saveWebhook = async (serverId: string) => {
    if (!webhookInput.trim()) { toast.error('URL cannot be empty'); return; }
    const { error } = await supabase.from('discord_bot_servers').update({ manual_webhook_url: webhookInput.trim() }).eq('id', serverId);
    if (error) toast.error('Failed to save');
    else {
      setServers(prev => prev.map(s => s.id === serverId ? { ...s, manual_webhook_url: webhookInput.trim() } : s));
      toast.success('Webhook updated');
    }
    setEditingWebhook(null);
  };

  const saveAutoWebhook = async (serverId: string) => {
    if (!autoWebhookInput.trim()) { toast.error('URL cannot be empty'); return; }
    const { error } = await supabase.from('discord_bot_servers').update({ webhook_url: autoWebhookInput.trim() }).eq('id', serverId);
    if (error) toast.error('Failed to save');
    else {
      setServers(prev => prev.map(s => s.id === serverId ? { ...s, webhook_url: autoWebhookInput.trim() } : s));
      toast.success('Auto webhook updated');
    }
    setEditingAutoWebhook(null);
  };

  const clearManualWebhook = async (server: BotServer) => {
    const { error } = await supabase.from('discord_bot_servers').update({ manual_webhook_url: null }).eq('id', server.id);
    if (error) toast.error('Failed to clear');
    else {
      setServers(prev => prev.map(s => s.id === server.id ? { ...s, manual_webhook_url: null } : s));
      toast.success('Webhook removed');
    }
  };

  const clearAutoWebhook = async (server: BotServer) => {
    const { error } = await supabase.from('discord_bot_servers').update({ webhook_url: '' }).eq('id', server.id);
    if (error) toast.error('Failed to clear');
    else {
      setServers(prev => prev.map(s => s.id === server.id ? { ...s, webhook_url: '' } : s));
      toast.success('Auto webhook removed');
    }
  };

  const bulkToggle = async (activate: boolean) => {
    const ids = Array.from(selectedServers);
    if (ids.length === 0) return;
    const { error } = await supabase.from('discord_bot_servers').update({ is_active: activate }).in('id', ids);
    if (error) toast.error('Bulk update failed');
    else {
      setServers(prev => prev.map(s => ids.includes(s.id) ? { ...s, is_active: activate } : s));
      toast.success(`${ids.length} servers ${activate ? 'activated' : 'deactivated'}`);
      setSelectedServers(new Set());
      setBulkAction(false);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedServers);
    if (ids.length === 0) return;
    const { error } = await supabase.from('discord_bot_servers').delete().in('id', ids);
    if (error) toast.error('Bulk delete failed');
    else {
      setServers(prev => prev.filter(s => !ids.includes(s.id)));
      toast.success(`${ids.length} servers deleted`);
      setSelectedServers(new Set());
      setBulkAction(false);
    }
  };

  const exportServerData = (server: BotServer) => {
    const serverScans = scans.filter(s => s.guild_id === server.guild_id);
    const serverCheaters = cheaters.filter(c => c.guild_id === server.guild_id);
    const data = { server: { guild_id: server.guild_id, guild_name: server.guild_name, member_count: server.member_count, is_active: server.is_active, created_at: server.created_at }, scans: serverScans, detected_cheaters: serverCheaters };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-server-${server.guild_name || server.guild_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  const exportAllData = () => {
    const data = { servers, scans, detected_cheaters: cheaters, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-overview-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('All data exported');
  };

  const clearScanHistory = async (guildId: string) => {
    const { error } = await supabase.from('scan_history').delete().eq('guild_id', guildId);
    if (error) toast.error('Failed to clear scan history');
    else {
      setScans(prev => prev.filter(s => s.guild_id !== guildId));
      toast.success('Scan history cleared');
    }
  };

  const clearDetectedCheaters = async (guildId: string) => {
    const { error } = await supabase.from('bot_detected_cheaters').delete().eq('guild_id', guildId);
    if (error) toast.error('Failed to clear');
    else {
      setCheaters(prev => prev.filter(c => c.guild_id !== guildId));
      toast.success('Flagged accounts cleared');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedServers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // --- Computed ---
  const totalMembers = servers.reduce((sum, s) => sum + (s.member_count || 0), 0);
  const totalScansCount = scans.length;
  const totalDetected = cheaters.length;
  const activeServers = servers.filter(s => s.is_active !== false).length;
  const avgScanDuration = scans.length > 0 ? Math.round(scans.reduce((sum, s) => sum + s.duration_seconds, 0) / scans.length) : 0;

  // Servers needing attention: high flagged or inactive
  const needsAttention = useMemo(() => {
    return servers.filter(s => {
      const flagged = cheaters.filter(c => c.guild_id === s.guild_id).length;
      return flagged > 50 || s.is_active === false;
    });
  }, [servers, cheaters]);

  const highRiskServers = useMemo(() => {
    return servers.filter(s => cheaters.filter(c => c.guild_id === s.guild_id).length > 100);
  }, [servers, cheaters]);

  // Recent 24h cheaters for trend
  const recent24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return cheaters.filter(c => new Date(c.detected_at).getTime() > cutoff).length;
  }, [cheaters]);

  // Sorting
  const sortedServers = [...servers].sort((a, b) => {
    switch (sortMode) {
      case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'name': return (a.guild_name || '').localeCompare(b.guild_name || '');
      case 'members': return (b.member_count || 0) - (a.member_count || 0);
      case 'alerts': {
        const aAlerts = cheaters.filter(c => c.guild_id === a.guild_id).length;
        const bAlerts = cheaters.filter(c => c.guild_id === b.guild_id).length;
        return bAlerts - aAlerts;
      }
      default: return 0;
    }
  });

  // Filtering
  const filteredServers = sortedServers.filter(s => {
    if (filterMode === 'active' && s.is_active === false) return false;
    if (filterMode === 'inactive' && s.is_active !== false) return false;
    if (filterMode === 'high_flagged') {
      const flagged = cheaters.filter(c => c.guild_id === s.guild_id).length;
      if (flagged < 10) return false;
    }
    if (filterMode === 'no_scans') {
      const hasScans = scans.some(sc => sc.guild_id === s.guild_id);
      if (hasScans) return false;
    }
    if (search && !(s.guild_name || s.guild_id).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectAll = () => {
    if (selectedServers.size === filteredServers.length) setSelectedServers(new Set());
    else setSelectedServers(new Set(filteredServers.map(s => s.id)));
  };

  const getServerIcon = (s: BotServer) =>
    s.guild_icon
      ? `https://cdn.discordapp.com/icons/${s.guild_id}/${s.guild_icon}.${s.guild_icon.startsWith('a_') ? 'gif' : 'webp'}?size=64`
      : null;

  const getServerScans = (guildId: string) => scans.filter(s => s.guild_id === guildId);
  const getServerCheaters = (guildId: string) => cheaters.filter(c => c.guild_id === guildId);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/10 bg-card/40 p-6 space-y-3">
              <Skeleton className="h-4 w-10 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/10 bg-card/40 p-6 space-y-3">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-60 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ═══════ Global Alert Bar ═══════ */}
      {(needsAttention.length > 0 || highRiskServers.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-sm"
        >
          <div className="flex items-center gap-4 flex-1 flex-wrap">
            {needsAttention.length > 0 && (
              <button
                onClick={() => setFilterMode(filterMode === 'inactive' ? 'all' : 'inactive')}
                className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">{needsAttention.length} server{needsAttention.length !== 1 ? 's' : ''} need attention</span>
              </button>
            )}
            {highRiskServers.length > 0 && (
              <button
                onClick={() => setFilterMode(filterMode === 'high_flagged' ? 'all' : 'high_flagged')}
                className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
              >
                <Flame className="w-4 h-4" />
                <span className="font-medium">{highRiskServers.length} high-risk server{highRiskServers.length !== 1 ? 's' : ''}</span>
              </button>
            )}
          </div>
          {filterMode !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setFilterMode('all')} className="text-xs text-muted-foreground">
              Clear filter
            </Button>
          )}
        </motion.div>
      )}

      {/* ═══════ Metric Cards ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Servers', value: servers.length, icon: Server, color: 'text-primary', accent: 'bg-primary/8', border: 'border-primary/10' },
          { label: 'Active', value: activeServers, icon: Zap, color: 'text-emerald-400', accent: 'bg-emerald-500/8', border: 'border-emerald-500/10' },
          { label: 'Members', value: totalMembers, icon: Users, color: 'text-sky-400', accent: 'bg-sky-500/8', border: 'border-sky-500/10' },
          { label: 'Flagged Accounts', value: totalDetected, icon: AlertTriangle, color: 'text-destructive', accent: 'bg-destructive/8', border: 'border-destructive/10', trend: recent24h > 0 ? `+${recent24h} today` : undefined },
          { label: 'Total Scans', value: totalScansCount, icon: ScanLine, color: 'text-violet-400', accent: 'bg-violet-500/8', border: 'border-violet-500/10' },
          { label: 'Avg Scan Time', value: `${avgScanDuration}s`, icon: Timer, color: 'text-amber-400', accent: 'bg-amber-500/8', border: 'border-amber-500/10' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className={`rounded-2xl border ${stat.border} bg-card/40 backdrop-blur-sm p-6 group/stat hover:shadow-lg hover:shadow-black/5 transition-shadow duration-300`}
          >
            <div className={`inline-flex p-2.5 rounded-xl ${stat.accent} mb-4`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-[36px] font-bold text-foreground tracking-tight leading-none">
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">{stat.label}</p>
              {'trend' in stat && stat.trend && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-destructive/80">
                  <TrendingUp className="w-3 h-3" />
                  {stat.trend}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══════ Toolbar ═══════ */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              placeholder="Search servers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card/40 border-border/20 rounded-xl h-10"
            />
          </div>

          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-[150px] bg-card/40 border-border/20 rounded-xl h-10">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="members">Most Members</SelectItem>
              <SelectItem value="alerts">Most Risky</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => setBulkAction(!bulkAction)} className={`gap-2 border-border/20 rounded-xl h-10 ${bulkAction ? 'bg-primary/10 border-primary/30 text-primary' : ''}`}>
            <CheckCircle className="w-3.5 h-3.5" />
            Bulk
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="border-border/20 rounded-xl h-10 w-10">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-[10px]">Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={fetchAll} className="gap-2 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportAllData} className="gap-2 text-xs">
                <Download className="w-3.5 h-3.5" /> Export All Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'all' as FilterMode, label: 'All', count: servers.length },
            { id: 'active' as FilterMode, label: 'Active', count: activeServers },
            { id: 'inactive' as FilterMode, label: 'Inactive', count: servers.length - activeServers },
            { id: 'high_flagged' as FilterMode, label: 'High Flagged', count: servers.filter(s => cheaters.filter(c => c.guild_id === s.guild_id).length >= 10).length },
            { id: 'no_scans' as FilterMode, label: 'No Scans', count: servers.filter(s => !scans.some(sc => sc.guild_id === s.guild_id)).length },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setFilterMode(chip.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                filterMode === chip.id
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'bg-card/40 text-muted-foreground/70 border border-border/15 hover:border-border/30 hover:text-foreground'
              }`}
            >
              {chip.label}
              <span className={`text-[10px] ${filterMode === chip.id ? 'text-primary/70' : 'text-muted-foreground/40'}`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ Bulk Action Bar ═══════ */}
      <AnimatePresence>
        {bulkAction && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/[0.04] border border-primary/15">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                {selectedServers.size === filteredServers.length ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-xs text-muted-foreground">{selectedServers.size} selected</span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => bulkToggle(true)} disabled={selectedServers.size === 0} className="text-xs gap-1.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 rounded-lg">
                <Power className="w-3.5 h-3.5" /> Activate
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulkToggle(false)} disabled={selectedServers.size === 0} className="text-xs gap-1.5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 rounded-lg">
                <PowerOff className="w-3.5 h-3.5" /> Deactivate
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selectedServers.size === 0} className="text-xs gap-1.5 border-destructive/20 text-destructive hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedServers.size} servers?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove the selected servers.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={bulkDelete}>Delete All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Server List ═══════ */}
      <div className="space-y-4">
        {filteredServers.length === 0 ? (
          <div className="text-center py-16">
            <Server className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/50">No servers found</p>
          </div>
        ) : filteredServers.map((server) => {
          const iconUrl = getServerIcon(server);
          const serverScans = getServerScans(server.guild_id);
          const serverCheaters = getServerCheaters(server.guild_id);
          const isExpanded = expandedServer === server.id;
          const isActive = server.is_active !== false;
          const latestScan = serverScans[0];
          const isSelected = selectedServers.has(server.id);
          const isHighRisk = serverCheaters.length > 100;
          const isWarning = serverCheaters.length > 10 && !isHighRisk;

          return (
            <ContextMenu key={server.id}>
              <ContextMenuTrigger>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.002 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-2xl border bg-card/40 backdrop-blur-sm overflow-hidden transition-all duration-300 ${
                    isSelected ? 'border-primary/30 ring-1 ring-primary/15 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]' :
                    isHighRisk ? 'border-destructive/15 shadow-[0_0_30px_-8px_hsl(var(--destructive)/0.08)]' :
                    isActive ? 'border-border/10 hover:border-border/20 hover:shadow-lg hover:shadow-black/5' : 'border-border/10 opacity-50'
                  }`}
                >
                  {/* ── Status bar ── */}
                  <div className={`h-[2px] w-full ${
                    !isActive ? 'bg-muted-foreground/15' :
                    isHighRisk ? 'bg-gradient-to-r from-destructive via-destructive/80 to-destructive/60' :
                    isWarning ? 'bg-gradient-to-r from-amber-500 to-amber-400/60' :
                    'bg-gradient-to-r from-emerald-500/80 to-emerald-400/40'
                  }`} />

                  {/* ── ZONE 1: Header ── */}
                  <div className="px-6 py-5 flex items-center gap-5 cursor-pointer" onClick={() => setExpandedServer(isExpanded ? null : server.id)}>
                    {bulkAction && (
                      <div
                        onClick={(e) => { e.stopPropagation(); toggleSelect(server.id); }}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                          isSelected ? 'bg-primary border-primary' : 'border-border/30 hover:border-border/60'
                        }`}
                      >
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />}
                      </div>
                    )}

                    {/* Server Icon */}
                    <div className="relative shrink-0">
                      {iconUrl ? (
                        <img src={iconUrl} alt="" className="w-12 h-12 rounded-2xl object-cover ring-1 ring-white/[0.04]" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-muted/10 flex items-center justify-center ring-1 ring-white/[0.04]">
                          <Server className="w-5 h-5 text-muted-foreground/25" />
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                    </div>

                    {/* Name + Quick Stats */}
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-[15px] text-foreground truncate tracking-tight">{server.guild_name || server.guild_id}</span>
                        {!isActive && (
                          <Badge variant="outline" className="text-[9px] border-muted-foreground/15 text-muted-foreground/60 bg-muted/5 px-2 py-0 rounded-md">
                            OFFLINE
                          </Badge>
                        )}
                        {isHighRisk && (
                          <Badge variant="outline" className="text-[9px] border-destructive/20 text-destructive/80 bg-destructive/[0.06] px-2 py-0 rounded-md gap-1">
                            <Flame className="w-2.5 h-2.5" /> HIGH RISK
                          </Badge>
                        )}
                        {isWarning && !isHighRisk && (
                          <Badge variant="outline" className="text-[9px] border-amber-500/20 text-amber-400/80 bg-amber-500/[0.06] px-2 py-0 rounded-md">
                            NEEDS REVIEW
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <QuickStat icon={Users} value={server.member_count?.toLocaleString() || '0'} label="members" />
                        <QuickStat icon={BarChart3} value={String(serverScans.length)} label="scans" />
                        <QuickStat
                          icon={AlertTriangle}
                          value={String(serverCheaters.length)}
                          label="flagged"
                          danger={serverCheaters.length > 0}
                        />
                        {server.alert_channel_name && (
                          <span className="text-[10px] text-muted-foreground/30 pl-1">#{server.alert_channel_name}</span>
                        )}
                      </div>
                    </div>

                    <ChevronDown className={`w-4 h-4 text-muted-foreground/25 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* ── Inline webhook editing ── */}
                  <AnimatePresence>
                    {editingWebhook === server.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-6 pb-4 flex gap-2">
                          <Input value={webhookInput} onChange={(e) => setWebhookInput(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="text-xs bg-card/50 border-border/20 rounded-lg" />
                          <Button size="sm" onClick={() => saveWebhook(server.id)} className="text-xs shrink-0 rounded-lg">Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingWebhook(null)} className="text-xs shrink-0">Cancel</Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── ZONE 2 & 3: Expanded Details ── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 space-y-6 border-t border-border/[0.06] pt-5">
                          {/* Info Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <InfoCard label="Guild ID" value={server.guild_id} icon={Hash} copyable onCopy={() => copyToClipboard(server.guild_id, 'Guild ID')} />
                            <InfoCard label="Owner" value={server.user_id.slice(0, 8) + '...'} icon={Shield} copyable onCopy={() => copyToClipboard(server.user_id, 'Owner ID')} />
                            <InfoCard label="Added" value={format(new Date(server.created_at), 'MMM dd, yyyy')} icon={Clock} />
                            <InfoCard label="Last Scan" value={latestScan ? format(new Date(latestScan.finished_at), 'MMM dd, HH:mm') : 'No scans yet'} icon={Activity} />
                          </div>

                          {/* Tabs */}
                          <Tabs defaultValue="scans" className="w-full">
                            <TabsList className="bg-muted/[0.06] border border-border/10 p-1 rounded-xl">
                              <TabsTrigger value="scans" className="text-xs gap-1.5 data-[state=active]:bg-card/80 rounded-lg px-4">
                                <BarChart3 className="w-3.5 h-3.5" /> Scans <span className="text-muted-foreground/40 ml-0.5">{serverScans.length}</span>
                              </TabsTrigger>
                              <TabsTrigger value="cheaters" className="text-xs gap-1.5 data-[state=active]:bg-card/80 rounded-lg px-4">
                                <AlertTriangle className="w-3.5 h-3.5" /> Flagged <span className="text-muted-foreground/40 ml-0.5">{serverCheaters.length}</span>
                              </TabsTrigger>
                              <TabsTrigger value="config" className="text-xs gap-1.5 data-[state=active]:bg-card/80 rounded-lg px-4">
                                <Settings className="w-3.5 h-3.5" /> Config
                              </TabsTrigger>
                            </TabsList>

                            {/* ── Scans Tab ── */}
                            <TabsContent value="scans" className="mt-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                                  Quick view · last 15 scans
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setScanViewer({
                                      guildId: server.guild_id,
                                      guildName: server.guild_name || server.guild_id,
                                    });
                                  }}
                                  className="h-7 text-[11px] gap-1.5 rounded-lg border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:text-primary"
                                >
                                  <Eye className="w-3 h-3" />
                                  Open detailed scan view
                                </Button>
                              </div>
                              {serverScans.length > 0 ? (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {serverScans.slice(0, 15).map(scan => {
                                    const isCompleted = scan.status === 'completed';
                                    const totalFailed = scan.total_failed || 0;
                                    const successfullyChecked = scan.total_checked - totalFailed;
                                    const cleanPct = successfullyChecked > 0
                                      ? Math.round(((successfullyChecked - scan.total_alerts) / successfullyChecked) * 100) : 100;
                                    return (
                                      <div key={scan.id} className="rounded-xl border border-border/10 bg-card/30 hover:bg-card/50 transition-colors overflow-hidden group/scan">
                                        <div className="px-4 py-3 flex items-center gap-3">
                                          <div className={`w-2 h-2 rounded-full shrink-0 ${isCompleted ? 'bg-emerald-400' : scan.status === 'failed' ? 'bg-destructive' : 'bg-amber-400'}`} />
                                          <div className="min-w-0">
                                            <p className="text-xs font-medium text-foreground">{format(new Date(scan.finished_at), 'MMM dd, yyyy · HH:mm')}</p>
                                            <p className="text-[10px] text-muted-foreground/50 capitalize">{scan.status}</p>
                                          </div>
                                          <div className="flex-1" />
                                          <div className="hidden md:flex items-center gap-2">
                                            <StatChip icon={Users} value={scan.total_members.toLocaleString()} />
                                            <StatChip icon={CheckCircle} value={scan.total_checked.toLocaleString()} />
                                            <StatChip icon={AlertTriangle} value={String(scan.total_alerts)} danger={scan.total_alerts > 0} />
                                            <StatChip icon={Timer} value={`${scan.duration_seconds}s`} />
                                          </div>
                                          {isCompleted && (
                                            <span className={`text-[10px] font-bold shrink-0 ${
                                              cleanPct >= 95 ? 'text-emerald-400' : cleanPct >= 80 ? 'text-amber-400' : 'text-destructive'
                                            }`}>
                                              {cleanPct}% clean
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-10">
                                  <BarChart3 className="w-6 h-6 mx-auto mb-2 text-muted-foreground/15" />
                                  <p className="text-xs text-muted-foreground/40">No scans yet</p>
                                </div>
                              )}
                            </TabsContent>

                            {/* ── Cheaters Tab ── */}
                            <TabsContent value="cheaters" className="mt-4">
                              <CheaterTabContent
                                guildId={server.guild_id}
                                guildCheaters={guildCheaters[server.guild_id]}
                                loading={loadingGuildCheaters === server.guild_id}
                                onLoad={() => fetchGuildCheaters(server.guild_id)}
                                onCopy={copyToClipboard}
                              />
                            </TabsContent>

                            {/* ── Config Tab ── */}
                            <TabsContent value="config" className="mt-4">
                              <div className="space-y-4">
                                {/* Webhook Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <WebhookCard
                                    label="Auto Webhook"
                                    icon={Link}
                                    url={server.webhook_url}
                                    isEditing={editingAutoWebhook === server.id}
                                    inputValue={autoWebhookInput}
                                    onInputChange={setAutoWebhookInput}
                                    onEdit={() => { setEditingAutoWebhook(server.id); setAutoWebhookInput(server.webhook_url || ''); }}
                                    onSave={() => saveAutoWebhook(server.id)}
                                    onCancel={() => setEditingAutoWebhook(null)}
                                    onRemove={() => clearAutoWebhook(server)}
                                    onCopy={() => copyToClipboard(server.webhook_url, 'Auto Webhook')}
                                  />
                                  <WebhookCard
                                    label="Full Scan"
                                    icon={ScanLine}
                                    url={server.full_scan_webhook_url || ''}
                                    isEditing={editingFullScanWebhook === server.id}
                                    inputValue={fullScanWebhookInput}
                                    onInputChange={setFullScanWebhookInput}
                                    onEdit={() => { setEditingFullScanWebhook(server.id); setFullScanWebhookInput(server.full_scan_webhook_url || ''); }}
                                    onSave={async () => {
                                      if (!fullScanWebhookInput.trim()) { toast.error('URL cannot be empty'); return; }
                                      const { error } = await supabase.from('discord_bot_servers').update({ full_scan_webhook_url: fullScanWebhookInput.trim() }).eq('id', server.id);
                                      if (error) toast.error('Failed to save');
                                      else { setServers(prev => prev.map(s => s.id === server.id ? { ...s, full_scan_webhook_url: fullScanWebhookInput.trim() } : s)); toast.success('Full Scan webhook updated'); }
                                      setEditingFullScanWebhook(null);
                                    }}
                                    onCancel={() => setEditingFullScanWebhook(null)}
                                    onRemove={async () => {
                                      const { error } = await supabase.from('discord_bot_servers').update({ full_scan_webhook_url: null }).eq('id', server.id);
                                      if (error) toast.error('Failed to clear');
                                      else { setServers(prev => prev.map(s => s.id === server.id ? { ...s, full_scan_webhook_url: null } : s)); toast.success('Webhook removed'); }
                                    }}
                                    onCopy={() => copyToClipboard(server.full_scan_webhook_url || '', 'Full Scan Webhook')}
                                  />
                                  <WebhookCard
                                    label="Auto-Scan"
                                    icon={Zap}
                                    url={server.auto_scan_webhook_url || ''}
                                    isEditing={editingAutoScanWebhook === server.id}
                                    inputValue={autoScanWebhookInput}
                                    onInputChange={setAutoScanWebhookInput}
                                    onEdit={() => { setEditingAutoScanWebhook(server.id); setAutoScanWebhookInput(server.auto_scan_webhook_url || ''); }}
                                    onSave={async () => {
                                      if (!autoScanWebhookInput.trim()) { toast.error('URL cannot be empty'); return; }
                                      const { error } = await supabase.from('discord_bot_servers').update({ auto_scan_webhook_url: autoScanWebhookInput.trim() }).eq('id', server.id);
                                      if (error) toast.error('Failed to save');
                                      else { setServers(prev => prev.map(s => s.id === server.id ? { ...s, auto_scan_webhook_url: autoScanWebhookInput.trim() } : s)); toast.success('Auto-Scan webhook updated'); }
                                      setEditingAutoScanWebhook(null);
                                    }}
                                    onCancel={() => setEditingAutoScanWebhook(null)}
                                    onRemove={async () => {
                                      const { error } = await supabase.from('discord_bot_servers').update({ auto_scan_webhook_url: null }).eq('id', server.id);
                                      if (error) toast.error('Failed to clear');
                                      else { setServers(prev => prev.map(s => s.id === server.id ? { ...s, auto_scan_webhook_url: null } : s)); toast.success('Webhook removed'); }
                                    }}
                                    onCopy={() => copyToClipboard(server.auto_scan_webhook_url || '', 'Auto-Scan Webhook')}
                                  />
                                </div>

                                {/* Alert Channel + Server ID */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="px-4 py-3 rounded-xl bg-muted/[0.04] border border-border/10">
                                    <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Alert Channel</span>
                                    <span className="text-xs font-medium text-foreground block mt-1">{server.alert_channel_name ? `#${server.alert_channel_name}` : 'Default'}</span>
                                  </div>
                                  <div className="px-4 py-3 rounded-xl bg-muted/[0.04] border border-border/10">
                                    <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Record ID</span>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <code className="text-[10px] text-muted-foreground/60 font-mono truncate">{server.id}</code>
                                      <button onClick={() => copyToClipboard(server.id, 'Record ID')} className="shrink-0 hover:text-foreground transition-colors">
                                        <Copy className="w-3 h-3 text-muted-foreground/30 hover:text-foreground" />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex gap-2 flex-wrap pt-1">
                                  <Button size="sm" variant="outline" className="text-xs gap-1.5 border-border/15 rounded-lg hover:bg-card/80" onClick={() => testWebhook(server)} disabled={testingWebhook === server.id}>
                                    {testingWebhook === server.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    Test Webhook
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-xs gap-1.5 border-border/15 rounded-lg hover:bg-card/80" onClick={() => exportServerData(server)}>
                                    <Download className="w-3 h-3" /> Export
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-xs gap-1.5 border-border/15 rounded-lg hover:bg-card/80" onClick={() => toggleServer(server)}>
                                    {isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                                    {isActive ? 'Deactivate' : 'Activate'}
                                  </Button>
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-56">
                <ContextMenuLabel className="text-[10px]">Server Actions</ContextMenuLabel>
                <ContextMenuItem onClick={() => copyToClipboard(server.guild_id, 'Guild ID')} className="gap-2 text-xs">
                  <Copy className="w-3.5 h-3.5" /> Copy Guild ID
                </ContextMenuItem>
                <ContextMenuItem onClick={() => copyToClipboard(server.user_id, 'Owner ID')} className="gap-2 text-xs">
                  <Copy className="w-3.5 h-3.5" /> Copy Owner ID
                </ContextMenuItem>
                <ContextMenuItem onClick={() => copyToClipboard(server.webhook_url, 'Webhook URL')} className="gap-2 text-xs">
                  <Link className="w-3.5 h-3.5" /> Copy Webhook URL
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => testWebhook(server)} className="gap-2 text-xs">
                  <Send className="w-3.5 h-3.5" /> Test Webhook
                </ContextMenuItem>
                <ContextMenuItem onClick={() => { setEditingFullScanWebhook(server.id); setFullScanWebhookInput(server.full_scan_webhook_url || ''); }} className="gap-2 text-xs">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Full Scan Webhook
                </ContextMenuItem>
                <ContextMenuItem onClick={() => { setEditingAutoScanWebhook(server.id); setAutoScanWebhookInput(server.auto_scan_webhook_url || ''); }} className="gap-2 text-xs">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Auto-Scan Webhook
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => exportServerData(server)} className="gap-2 text-xs">
                  <Download className="w-3.5 h-3.5" /> Export Data
                </ContextMenuItem>
                <ContextMenuItem onClick={() => toggleServer(server)} className="gap-2 text-xs">
                  {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {isActive ? 'Deactivate' : 'Activate'}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger className="gap-2 text-xs text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Danger Zone
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    <ContextMenuItem onClick={() => clearScanHistory(server.guild_id)} className="gap-2 text-xs text-amber-400">
                      <RotateCcw className="w-3.5 h-3.5" /> Clear Scan History
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => clearDetectedCheaters(server.guild_id)} className="gap-2 text-xs text-amber-400">
                      <UserX className="w-3.5 h-3.5" /> Clear Flagged Accounts
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => deleteServer(server)} className="gap-2 text-xs text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Server
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      {/* ── Detailed scan viewer (admin "view as owner") ── */}
      <Dialog open={!!scanViewer} onOpenChange={(open) => !open && setScanViewer(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScanLine className="w-4 h-4 text-primary" />
              {scanViewer?.guildName} · Full scan history
            </DialogTitle>
            <DialogDescription className="text-xs">
              Owner-style view: every scan, expandable with detected cheaters.
            </DialogDescription>
          </DialogHeader>
          {scanViewer && (
            <Suspense fallback={<div className="py-12 text-center text-xs text-muted-foreground">Loading scan history…</div>}>
              <ScanHistory
                guildIdFilter={scanViewer.guildId}
                guildNameLabel={scanViewer.guildName}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════ Sub-components ═══════ */

function QuickStat({ icon: Icon, value, label, danger }: { icon: any; value: string; label: string; danger?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
      danger
        ? 'bg-destructive/[0.06] border border-destructive/10 text-destructive/80'
        : 'bg-muted/[0.06] border border-border/[0.06] text-muted-foreground/50'
    }`}>
      <Icon className="w-3 h-3" />
      <span className="font-semibold text-foreground/70">{value}</span>
      {label}
    </span>
  );
}

function StatChip({ icon: Icon, value, danger }: { icon: any; value: string; danger?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
      danger ? 'bg-destructive/10 text-destructive' : 'bg-muted/15 text-muted-foreground'
    }`}>
      <Icon className="w-3 h-3" /> {value}
    </span>
  );
}

function InfoCard({ label, value, icon: Icon, copyable, onCopy }: { label: string; value: string; icon: any; copyable?: boolean; onCopy?: () => void }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-muted/[0.04] border border-border/10 group/info hover:border-border/20 transition-colors">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/30" />
        <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">{label}</span>
        {copyable && onCopy && (
          <button onClick={onCopy} className="ml-auto opacity-0 group-hover/info:opacity-100 transition-opacity">
            <Copy className="w-3 h-3 text-muted-foreground/30 hover:text-foreground" />
          </button>
        )}
      </div>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function WebhookCard({ label, icon: Icon, url, isEditing, inputValue, onInputChange, onEdit, onSave, onCancel, onRemove, onCopy }: {
  label: string;
  icon: any;
  url: string;
  isEditing: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onCopy: () => void;
}) {
  const isSet = !!url;

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all ${
      isSet ? 'border-emerald-500/10 bg-emerald-500/[0.02]' : 'border-border/10 bg-muted/[0.02]'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isSet ? 'bg-emerald-500/10' : 'bg-muted/10'}`}>
            <Icon className={`w-3.5 h-3.5 ${isSet ? 'text-emerald-400' : 'text-muted-foreground/30'}`} />
          </div>
          <span className="text-[11px] font-bold text-foreground/80">{label}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${isSet ? 'bg-emerald-400' : 'bg-muted-foreground/20'}`} />
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Input
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="text-[10px] bg-background/30 border-border/20 font-mono h-8 rounded-lg"
          />
          <div className="flex gap-1.5">
            <Button size="sm" onClick={onSave} className="text-[10px] h-7 rounded-lg flex-1">Save</Button>
            <Button size="sm" variant="ghost" onClick={onCancel} className="text-[10px] h-7 rounded-lg">Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground/50 font-mono truncate">
            {isSet ? url.replace(/^https:\/\/discord\.com\/api\/webhooks\//, '…/') : 'Not configured'}
          </p>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] rounded-md" onClick={onEdit}>
              <Edit3 className="w-2.5 h-2.5 mr-1" /> {isSet ? 'Edit' : 'Set'}
            </Button>
            {isSet && (
              <>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] rounded-md" onClick={onCopy}>
                  <Copy className="w-2.5 h-2.5 mr-1" /> Copy
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-amber-400 rounded-md" onClick={onRemove}>
                  <Unlink className="w-2.5 h-2.5 mr-1" /> Remove
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CheaterTabContent({ guildId, guildCheaters, loading, onLoad, onCopy }: {
  guildId: string;
  guildCheaters?: EnrichedCheater[];
  loading: boolean;
  onLoad: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  useEffect(() => { onLoad(); }, [guildId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-2 w-48 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!guildCheaters || guildCheaters.length === 0) {
    return (
      <div className="text-center py-10">
        <Shield className="w-6 h-6 mx-auto mb-2 text-emerald-400/20" />
        <p className="text-xs text-muted-foreground/40">All clear — no flagged accounts</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] text-muted-foreground/40 mb-3">{guildCheaters.length} flagged account{guildCheaters.length !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[350px] overflow-y-auto pr-1">
        {guildCheaters.map(ch => {
          const avUrl = ch.discord_avatar
            ? `https://cdn.discordapp.com/avatars/${ch.discord_user_id}/${ch.discord_avatar}.png?size=32`
            : null;
          return (
            <div key={ch.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border/10 bg-card/30 hover:bg-card/50 transition-colors group/cheater">
              {avUrl ? (
                <img src={avUrl} alt="" className="w-7 h-7 rounded-full ring-1 ring-border/10" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-3 h-3 text-destructive/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium text-foreground truncate block">{ch.discord_username || ch.discord_user_id}</span>
                <span className="text-[9px] text-muted-foreground/40">
                  {ch.join_count || 0} servers · {ch.total_bans || 0} bans · {ch.total_tickets || 0} tickets · {format(new Date(ch.detected_at), 'MMM dd')}
                </span>
              </div>
              <Button
                variant="ghost" size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover/cheater:opacity-100 transition-opacity"
                onClick={() => onCopy(ch.discord_user_id, 'Discord ID')}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
