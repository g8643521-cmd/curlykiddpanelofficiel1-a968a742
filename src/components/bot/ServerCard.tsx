import { memo, useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Shield, PowerOff, Users, CheckCircle, XCircle,
  AlertTriangle, Webhook, Clock, Hash, Copy, Loader2,
  Trash2, Pencil, Eye, Radio, ShieldCheck, Zap, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { AnimatedStat } from '@/components/AnimatedStat';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export type ServerScanSummary = {
  checked: number;
  skipped: number;
  alerts: number;
  totalMembers: number;
  time: Date;
};

export interface BotServer {
  id: string;
  user_id: string;
  guild_id: string;
  guild_name: string | null;
  guild_icon: string | null;
  member_count: number | null;
  webhook_url: string;
  manual_webhook_url: string | null;
  auto_scan_webhook_url: string | null;
  full_scan_webhook_url: string | null;
  info_channel_id: string | null;
  alert_channel_name: string | null;
  is_active: boolean;
  last_checked_at: string;
  created_at: string;
  status?: 'active' | 'paused' | 'blacklisted' | string | null;
  status_reason?: string | null;
  status_changed_at?: string | null;
}

interface JoinEntry {
  id: string;
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  guild_id: string;
  guild_name: string | null;
  is_cheater: boolean;
  is_flagged: boolean;
  total_bans: number;
  total_tickets: number;
  summary_text: string | null;
  cheater_summary?: string | null;
  joined_at: string | null;
  logged_at: string | null;
}

interface ScanProgress {
  checked: number;
  skipped: number;
  alerts: number;
  totalMembers: number;
  batch: number;
  lastBatchLatency: number;
  startedAt: Date;
  scanId?: string;
}

interface ServerCardProps {
  server: BotServer;
  scanResult: ServerScanSummary | null;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  onToggle: (server: BotServer) => void;
  onDelete: (serverId: string) => void;
  onTestWebhook: (server: BotServer) => void;
  onVerifyWebhook: (server: BotServer) => void;
  onScanAll: (server: BotServer) => void;
  onStopScan: () => void;
  onEdit: (server: BotServer) => void;
  onDetail: (server: BotServer) => void;
  onShare?: (server: BotServer) => void;
  isTesting: boolean;
  isVerifying: boolean;
  isScanDisabled: boolean;
  // Joins data
  joins: JoinEntry[];
  joinsLoading: boolean;
  onFetchJoins: () => void;
  onClearJoins: (guildId: string) => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] as const } },
};

const ServerCard = memo(function ServerCard({
  server,
  scanResult,
  isScanning,
  scanProgress,
  onToggle,
  onDelete,
  onTestWebhook,
  onVerifyWebhook,
  onScanAll,
  onStopScan,
  onEdit,
  onDetail,
  onShare,
  isTesting,
  isVerifying,
  isScanDisabled,
  joins,
  joinsLoading,
  onFetchJoins,
  onClearJoins,
}: ServerCardProps) {
  const navigate = useNavigate();
  const [expandedJoins, setExpandedJoins] = useState(false);
  const [joinsFilter, setJoinsFilter] = useState<'all' | 'cheaters'>('cheaters');
  const [joinsSort, setJoinsSort] = useState<'newest' | 'oldest'>('newest');
  const [expandedJoinId, setExpandedJoinId] = useState<string | null>(null);

  const isActive = server.is_active;

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }, []);

  const handleToggleJoins = useCallback(() => {
    const isOpen = expandedJoins;
    setExpandedJoins(!isOpen);
    if (!isOpen) {
      setJoinsFilter('cheaters');
      if (joins.length === 0) onFetchJoins();
    }
  }, [expandedJoins, joins.length, onFetchJoins]);

  // Memoize filtered/sorted joins
  const filteredJoins = useMemo(() => {
    const serverJoins = joins
      .filter(j => joinsFilter === 'cheaters' ? j.is_cheater : true)
      .sort((a, b) => {
        const da = new Date(a.logged_at || a.joined_at || 0).getTime();
        const db = new Date(b.logged_at || b.joined_at || 0).getTime();
        return joinsSort === 'newest' ? db - da : da - db;
      });
    return serverJoins;
  }, [joins, joinsFilter, joinsSort]);

  // Memoize scan progress calculations
  const scanProgressData = useMemo(() => {
    if (!isScanning || !scanProgress) return null;
    const p = scanProgress;
    const processed = p.checked + p.skipped;
    const total = p.totalMembers || server.member_count || 0;
    const progressPct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
    const elapsed = Math.max(1, (Date.now() - p.startedAt.getTime()) / 1000);
    const rate = processed / elapsed;
    const remaining = total > 0 ? total - processed : 0;
    const etaSeconds = rate > 0 && remaining > 0 ? Math.round(remaining / rate) : null;
    const etaLabel = etaSeconds && etaSeconds > 0
      ? etaSeconds > 60 ? `~${Math.ceil(etaSeconds / 60)} min left` : `~${etaSeconds}s left`
      : total > 0 ? 'Almost done…' : 'Calculating…';
    return { processed, total, progressPct, etaLabel, p };
  }, [isScanning, scanProgress, server.member_count]);

  // Stats for join panel header
  const joinStats = useMemo(() => {
    if (scanProgressData) {
      return {
        flagged: scanProgressData.p.alerts,
        total: scanProgressData.processed,
        label: 'scanned',
      };
    }
    if (scanResult) {
      return {
        flagged: scanResult.alerts,
        total: scanResult.totalMembers || (scanResult.checked + scanResult.skipped),
        label: 'members',
      };
    }
    return {
      flagged: joins.filter(j => j.is_cheater).length,
      total: joins.length,
      label: 'recent',
    };
  }, [scanProgressData, scanResult, joins]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          variants={fadeUp}
          exit={{ opacity: 0, y: -10 }}
          layout
          className="group rounded-xl border border-white/[0.06] bg-card/50 hover:bg-card/70 hover:border-white/[0.1] transition-all duration-300 hover:scale-[1.005] hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.2)] overflow-hidden cursor-pointer relative"
          onClick={() => onDetail(server)}
        >
          {/* Status bar at top */}
          <div className={`h-[3px] w-full ${
            !isActive ? 'bg-muted-foreground/20' :
            (scanResult?.alerts || 0) > 100 ? 'bg-gradient-to-r from-red-500 to-red-400' :
            (scanResult?.alerts || 0) > 10 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
            'bg-gradient-to-r from-emerald-500 to-primary'
          }`} />

          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

          {/* Main row */}
          <div className="p-6 pb-4 flex items-start justify-between gap-5">
            <div className="flex items-start gap-5 min-w-0">
              {server.guild_icon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${server.guild_id}/${server.guild_icon}.${server.guild_icon.startsWith('a_') ? 'gif' : 'webp'}?size=96`}
                  alt={server.guild_name || 'Server'}
                  className="w-14 h-14 rounded-xl object-cover shrink-0 ring-1 ring-white/[0.06]"
                  loading="lazy"
                />
              ) : (
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors ring-1 ring-white/[0.06] ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'
                }`}>
                  <Server className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-foreground text-lg truncate tracking-tight">
                    {server.guild_name || 'Unknown Server'}
                  </h3>
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className={`text-[10px] shrink-0 px-2.5 py-0.5 ${
                      isActive
                        ? 'bg-primary/15 text-primary border-primary/20 hover:bg-primary/20 shadow-[0_0_12px_-4px_hsl(var(--primary)/0.3)]'
                        : ''
                    }`}
                  >
                    {isActive ? (
                      <><Shield className="w-3 h-3 mr-1" /><span className="w-1.5 h-1.5 rounded-full bg-primary mr-1 inline-block animate-pulse" /> Protected</>
                    ) : (
                      <><PowerOff className="w-3 h-3 mr-1" /> Paused</>
                    )}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(server.guild_id); }}
                        className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1 font-mono"
                      >
                        <Hash className="w-3 h-3" />
                        {server.guild_id}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Copy Server ID</TooltipContent>
                  </Tooltip>
                  {server.alert_channel_name && (
                    <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                      #{server.alert_channel_name}
                    </span>
                  )}
                  {(server.member_count != null && server.member_count > 0) && (
                    <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {server.member_count.toLocaleString()}
                    </span>
                  )}
                </div>

                {scanResult && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/20 border border-border/15 text-[11px] text-muted-foreground">
                      <Users className="w-3 h-3 text-primary/60" />
                      <span className="font-semibold text-foreground/80">{scanResult.totalMembers.toLocaleString()}</span> members
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/20 border border-border/15 text-[11px] text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-emerald-500/60" />
                      <span className="font-semibold text-foreground/80">{scanResult.checked.toLocaleString()}</span> checked
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] ${
                      scanResult.alerts > 0
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                        : 'bg-muted/20 border border-border/15 text-muted-foreground'
                    }`}>
                      <AlertTriangle className="w-3 h-3" />
                      <span className="font-semibold">{scanResult.alerts.toLocaleString()}</span> alerts
                    </span>
                    <span className="text-[10px] text-muted-foreground/30">
                      {timeAgo(scanResult.time.toISOString())}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5">
                {isScanning ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="destructive" onClick={onStopScan} className="gap-1.5 text-xs h-8 px-4">
                        <XCircle className="w-3.5 h-3.5" /> Stop Scan
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop the running scan</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => onScanAll(server)}
                        disabled={isScanDisabled}
                        className="gap-1.5 text-xs h-8 px-4"
                      >
                        <Users className="w-3.5 h-3.5" /> Start Scan
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Scan all members against the cheater database</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onTestWebhook(server)} disabled={isTesting} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground">
                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Webhook className="w-3.5 h-3.5" />}
                      Test
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send a test alert to your webhook</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => onVerifyWebhook(server)} disabled={isVerifying || isScanDisabled} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground">
                      {isVerifying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…</> : <><ShieldCheck className="w-3.5 h-3.5" /> Verify</>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Verify all flagged members are in the webhook channel</TooltipContent>
                </Tooltip>

                {onShare && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => onShare(server)} className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground">
                        <Users className="w-3.5 h-3.5" /> Del
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Del server med andre admins</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="w-px h-6 bg-border/20 mx-1" />

              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <Switch checked={server.is_active} onCheckedChange={() => onToggle(server)} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{isActive ? 'Pause auto-scan' : 'Enable auto-scan'}</TooltipContent>
                </Tooltip>

                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-muted-foreground/40 hover:text-destructive h-8 w-8 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Remove server</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove server?</AlertDialogTitle>
                      <AlertDialogDescription>
                        CurlyKidd Bot will stop monitoring <strong>{server.guild_name}</strong>. You can always add it again later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(server.id)}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-muted/[0.03] border-t border-border/15 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
            <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Last scan: {server.last_checked_at ? timeAgo(server.last_checked_at) : 'Never'}
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant={expandedJoins ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 text-[11px] gap-1.5 px-3 transition-all duration-200 ${!expandedJoins ? 'hover:bg-primary/10 hover:text-primary' : ''}`}
                onClick={handleToggleJoins}
              >
                <Eye className="w-3 h-3" />
                {expandedJoins ? 'Hide Feed' : isScanning ? 'Live Feed' : 'Scan Results'}
              </Button>
              <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" />
                DB linked
              </span>
            </div>
          </div>

          {/* Scan progress panel */}
          <AnimatePresence>
            {scanProgressData && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4 bg-primary/[0.03] border-t border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3" style={{ animation: 'spin 1s linear infinite' }} />
                      {scanProgressData.processed === 0 ? 'Initializing scan…' : 'Full scan in progress'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {scanProgressData.processed === 0
                        ? 'Fetching member list…'
                        : `${scanProgressData.processed.toLocaleString()} / ${scanProgressData.total > 0 ? scanProgressData.total.toLocaleString() : '?'} members — ${scanProgressData.etaLabel}`
                      }
                    </span>
                  </div>
                  <Progress value={scanProgressData.processed === 0 ? undefined : (scanProgressData.total > 0 ? scanProgressData.progressPct : 2)} className="h-1.5 mb-3" />
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { value: scanProgressData.total, label: 'Members', color: 'text-primary' },
                      { value: scanProgressData.processed, label: 'Processed', color: 'text-foreground' },
                      { value: scanProgressData.p.checked, label: 'New Checks', color: 'text-foreground' },
                      { value: scanProgressData.p.skipped, label: 'Skipped', color: 'text-foreground' },
                      { value: scanProgressData.p.alerts, label: 'Flagged', color: scanProgressData.p.alerts > 0 ? 'text-destructive' : 'text-foreground' },
                    ].map(({ value, label, color }) => (
                      <div key={label} className="text-center cursor-default">
                        <AnimatedStat value={value} className={`text-sm font-bold ${color}`} />
                        <div className="text-[10px] text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Joins panel */}
          <AnimatePresence>
            {expandedJoins && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4 border-t border-border/20 bg-card/20" onClick={(e) => e.stopPropagation()}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {isScanning ? (
                        <Radio className="w-4 h-4 text-primary animate-pulse" />
                      ) : (
                        <Shield className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-sm font-semibold text-foreground">
                        {isScanning ? 'Live Feed' : 'Scan Results'}
                      </span>
                      {isScanning && (
                        <Badge className="text-[9px] bg-primary/15 text-primary border-primary/20 animate-pulse">LIVE</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => onClearJoins(server.guild_id)}
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </Button>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
                      <button
                        className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${
                          joinsFilter === 'cheaters' ? 'bg-destructive/15 text-destructive shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setJoinsFilter('cheaters')}
                      >
                        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Flagged</span>
                      </button>
                      <button
                        className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${
                          joinsFilter === 'all' ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setJoinsFilter('all')}
                      >
                        All Members
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/60">
                        {joinStats.flagged.toLocaleString()} flagged / {joinStats.total.toLocaleString()} {joinStats.label}
                      </span>
                      <button
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        onClick={() => setJoinsSort(s => s === 'newest' ? 'oldest' : 'newest')}
                      >
                        <Clock className="w-3 h-3" />
                        {joinsSort === 'newest' ? 'Newest' : 'Oldest'}
                      </button>
                    </div>
                  </div>

                  {joinsLoading ? (
                    <div className="py-8 text-center">
                      <Loader2 className="w-5 h-5 mx-auto text-primary animate-spin" />
                    </div>
                  ) : filteredJoins.length === 0 ? (
                    <div className="py-8 text-center">
                      <Shield className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground/60 font-medium">
                        {joinsFilter === 'cheaters' ? 'No flagged players found' : 'No scan results yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-1 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                      {filteredJoins.slice(0, 200).map((join) => (
                        <JoinRow
                          key={join.id}
                          join={join}
                          isExpanded={expandedJoinId === join.id}
                          onToggle={() => setExpandedJoinId(expandedJoinId === join.id ? null : join.id)}
                          onCopy={copyToClipboard}
                          onNavigate={(q) => navigate(`/cheaters?q=${q}`)}
                        />
                      ))}
                      {filteredJoins.length > 200 && (
                        <div className="py-2 text-center text-[10px] text-muted-foreground/50">
                          Showing 200 of {filteredJoins.length} results
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onEdit(server)}>
          <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={() => copyToClipboard(server.guild_id)}>
          <Copy className="w-3.5 h-3.5 mr-2" /> Copy ID
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onTestWebhook(server)}>
          <Webhook className="w-3.5 h-3.5 mr-2" /> Test Webhook
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

// Memoized join row to avoid re-renders of entire list
const JoinRow = memo(function JoinRow({
  join,
  isExpanded,
  onToggle,
  onCopy,
  onNavigate,
}: {
  join: JoinEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  onNavigate: (query: string) => void;
}) {
  const avatarUrl = join.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${join.discord_user_id}/${join.discord_avatar}.${join.discord_avatar.startsWith('a_') ? 'gif' : 'png'}?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(join.discord_user_id) % BigInt(5))}.png`;

  return (
    <div className="rounded-lg border transition-all overflow-hidden border-border/10">
      <button
        onClick={onToggle}
        className={`w-full text-left p-2.5 flex items-center gap-3 transition-all cursor-pointer ${
          join.is_cheater ? 'bg-destructive/[0.03] hover:bg-destructive/[0.07] border-destructive/20' : 'bg-card/10 hover:bg-card/30'
        }`}
      >
        <div className="relative">
          <Avatar className="w-7 h-7 shrink-0 ring-2 ring-border/10">
            <AvatarImage src={avatarUrl} loading="lazy" />
            <AvatarFallback className="bg-muted/30 text-muted-foreground text-[10px]">
              {(join.discord_username || '?')[0]}
            </AvatarFallback>
          </Avatar>
          {join.is_cheater && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-destructive flex items-center justify-center ring-2 ring-card">
              <AlertTriangle className="w-1.5 h-1.5 text-destructive-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground truncate">
              {join.discord_username || join.discord_user_id}
            </span>
            {join.is_cheater && (
              <Badge className="text-[8px] bg-destructive/15 text-destructive border-destructive/20 px-1.5 py-0 uppercase tracking-wider font-bold">
                Flagged
              </Badge>
            )}
          </div>
        </div>
        <svg className={`w-3.5 h-3.5 text-muted-foreground/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-3 py-2.5 border-t border-border/10 bg-card/5 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <div>
              <span className="text-muted-foreground/50">Discord ID</span>
              <button onClick={(e) => { e.stopPropagation(); onCopy(join.discord_user_id); }} className="block font-mono text-foreground/80 hover:text-primary transition-colors">
                {join.discord_user_id}
              </button>
            </div>
            <div>
              <span className="text-muted-foreground/50">Username</span>
              <p className="text-foreground/80">{join.discord_username || 'Unknown'}</p>
            </div>
            {(join.summary_text || (join as any).cheater_summary) && (
              <div className="col-span-2">
                <span className="text-muted-foreground/50">Summary</span>
                <p className="text-destructive/80 flex items-center gap-1">
                  <Shield className="w-3 h-3 shrink-0" />
                  {join.summary_text || (join as any).cheater_summary}
                </p>
              </div>
            )}
            {join.total_bans > 0 && (
              <div>
                <span className="text-muted-foreground/50">Bans</span>
                <p className="text-destructive/80 font-semibold">{join.total_bans}</p>
              </div>
            )}
            {join.total_tickets > 0 && (
              <div>
                <span className="text-muted-foreground/50">Tickets</span>
                <p className="text-destructive/80 font-semibold">{join.total_tickets}</p>
              </div>
            )}
          </div>
          {join.is_cheater && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/10">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); onNavigate(join.discord_user_id); }}>
                <Search className="w-3 h-3" /> Cheater DB
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onCopy(join.discord_user_id); }}>
                <Copy className="w-3 h-3" /> Copy ID
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ServerCard;
export { timeAgo };
