import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { claimImportedDataForCurrentUser } from '@/lib/claimImportedData';
import {
  Clock, Users, AlertTriangle, CheckCircle, XCircle, BarChart3,
  Timer, RefreshCw, ChevronDown, Shield, Hash, Trash2, Activity,
  Copy, Download, ArrowRight, UserX, TrendingUp, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuTrigger, ContextMenuLabel,
} from '@/components/ui/context-menu';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { logActivity } from '@/lib/activityLog';
import { runAsync } from '@/lib/asyncRequest';
import { ErrorCard } from '@/components/feedback/ErrorCard';

// ── Types ──────────────────────────────────────────────

interface DetectedCheater {
  id: string;
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  total_bans: number | null;
  total_tickets: number | null;
  detected_at: string;
  is_flagged: boolean | null;
  summary_text: string | null;
  join_count?: number;
}

interface ScanRecord {
  id: string;
  guild_id: string;
  guild_name: string | null;
  scan_type: string;
  total_checked: number;
  total_skipped: number;
  total_alerts: number;
  total_members: number;
  total_failed: number;
  duration_seconds: number;
  status: string;
  started_at: string;
  finished_at: string;
  // Diagnostics (added for retry/heartbeat/stage visibility)
  error_message?: string | null;
  rate_limit_info?: string | null;
  retry_count?: number | null;
  last_heartbeat_at?: string | null;
  current_stage?: string | null;
}

// ── Helpers ────────────────────────────────────────────

const getScanDedupKey = (scan: ScanRecord) =>
  `${scan.guild_id}:${scan.scan_type}:${scan.status}:${scan.started_at}`;

const dedupeScans = (items: ScanRecord[]) => {
  const seen = new Set<string>();
  return items.filter((scan) => {
    const key = getScanDedupKey(scan);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isVisibleHistoryScan = (scan: ScanRecord) => {
  const processed = (scan.total_checked || 0) + (scan.total_skipped || 0) + (scan.total_alerts || 0);
  return scan.status !== 'failed' || processed > 0;
};

const STAGE_LABELS: Record<string, string> = {
  initializing: 'Initializing',
  fetching_members: 'Fetching members',
  processing: 'Processing members',
  batch_complete: 'Batch complete',
  chaining_next_batch: 'Chaining next batch',
  retrying: 'Retrying',
  retrying_rate_limited: 'Rate limited — retrying',
  failed_chain: 'Chain failure',
  failed_initial_batch: 'Initial batch failure',
  failed_all_lookups: 'All lookups failed',
  completed: 'Completed',
  stopped: 'Stopped',
};

const cleanDisplayText = (value: string) => {
  const legacyName = ['Screen', 'ShareX'].join('');
  return value.replace(new RegExp(legacyName, 'gi'), 'Screenshare');
};

const humanStage = (stage?: string | null) =>
  stage ? STAGE_LABELS[stage] || stage.replace(/_/g, ' ') : null;

// ── Animated Number ────────────────────────────────────

function AnimatedValue({ value, className, suffix = '' }: { value: number; className?: string; suffix?: string }) {
  const animated = useAnimatedNumber(value, 800);
  return <span className={className}>{animated.toLocaleString()}{suffix}</span>;
}

// ── Stat Card ──────────────────────────────────────────

function StatCard({ icon, label, value, numValue, suffix, accent, isFirst }: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  numValue?: number;
  suffix?: string;
  accent?: 'destructive' | 'success' | 'warning';
  isFirst?: boolean;
}) {
  const colorMap = {
    destructive: { bg: 'bg-destructive/10', text: 'text-destructive', icon: 'text-destructive' },
    success: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'text-emerald-400' },
    warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'text-amber-400' },
  };
  const colors = accent ? colorMap[accent] : { bg: 'bg-primary/10', text: 'text-foreground', icon: 'text-primary' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: isFirst ? 0 : 0.05 }}
      className="group relative flex flex-col items-center justify-center p-5 min-h-[100px] bg-card/60 backdrop-blur-sm rounded-xl border border-border/20 hover:border-border/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 transition-all duration-200"
    >
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110', colors.bg)}>
        <span className={colors.icon}>{icon}</span>
      </div>
      <p className={cn('text-2xl font-bold leading-none tabular-nums', colors.text)}>
        {numValue !== undefined ? <AnimatedValue value={numValue} suffix={suffix} /> : value}
      </p>
      <p className="text-[10px] text-muted-foreground/50 mt-2 font-semibold uppercase tracking-widest">{label}</p>
    </motion.div>
  );
}

// ── Progress Bar ───────────────────────────────────────

function ScanProgressBar({ clean, alerts, skipped, failed }: {
  clean: number; alerts: number; skipped: number; failed: number;
}) {
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted/10 gap-px">
      {clean > 0 && (
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${clean}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="bg-emerald-500/70 rounded-full"
        />
      )}
      {alerts > 0 && (
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${alerts}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-destructive/60"
        />
      )}
      {skipped > 0 && (
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${skipped}%` }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="bg-muted-foreground/15"
        />
      )}
      {failed > 0 && (
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${failed}%` }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-amber-500/50"
        />
      )}
    </div>
  );
}

// ── Info Row ───────────────────────────────────────────

function InfoRow({ label, value, mono, capitalize, highlight, copyable, onCopy }: {
  label: string; value: string; mono?: boolean; capitalize?: boolean; highlight?: boolean; copyable?: boolean; onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 group/row">
      <span className="text-xs text-muted-foreground/70">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={cn(
          'text-xs font-medium',
          highlight ? 'text-destructive' : 'text-foreground/90',
          mono && 'font-mono text-[11px] bg-muted/15 px-1.5 py-0.5 rounded',
          capitalize && 'capitalize'
        )}>
          {value}
        </span>
        {copyable && onCopy && (
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5"
          >
            <Copy className="w-3 h-3 text-muted-foreground/40 hover:text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export default function ScanHistory({
  cheatersFoundCount,
  guildIdFilter,
  guildNameLabel,
  hideHeader = false,
  refreshSignal,
}: {
  cheatersFoundCount?: number;
  /** When set, only scans for this guild_id are shown (admin "view as owner" mode). */
  guildIdFilter?: string;
  /** Optional friendly name shown in the header when guildIdFilter is set. */
  guildNameLabel?: string;
  /** Hide the top heading (when used inside a dialog that already has a title). */
  hideHeader?: boolean;
  /** Increment this value when a parent needs the history to refetch immediately. */
  refreshSignal?: number;
}) {
  const navigate = useNavigate();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanCheaters, setScanCheaters] = useState<Record<string, DetectedCheater[]>>({});
  const [loadingCheaters, setLoadingCheaters] = useState<string | null>(null);
  const tableHeaderRef = useRef<HTMLDivElement>(null);

  const fetchCheaters = useCallback(async (guildId: string) => {
    if (loadingCheaters === guildId) return;
    setLoadingCheaters(guildId);

    let rawCheaters: DetectedCheater[] = [];
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
      rawCheaters = rawCheaters.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Deduplicate by discord_user_id — keeps the most recent detection per user
    // (rows are already ordered by detected_at desc).
    const seen = new Set<string>();
    const allCheaters: DetectedCheater[] = [];
    for (const c of rawCheaters) {
      const key = c.discord_user_id || c.id;
      if (seen.has(key)) continue;
      seen.add(key);
      allCheaters.push(c);
    }

    if (allCheaters.length > 0) {
      const userIds = [...new Set(allCheaters.map((c) => c.discord_user_id))];
      const batchSize = 100;
      const serverSets: Record<string, Set<string>> = {};

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

      const enriched = allCheaters.map((c) => ({
        ...c,
        join_count: Math.max(serverSets[c.discord_user_id]?.size || 0, 1),
      }));

      setScanCheaters((prev) => ({ ...prev, [guildId]: enriched }));
    } else {
      setScanCheaters((prev) => ({ ...prev, [guildId]: [] }));
    }

    setLoadingCheaters(null);
  }, [loadingCheaters]);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setLoadError(null);

    const outcome = await runAsync(async (signal) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (userId) await claimImportedDataForCurrentUser(userId);

      let query = supabase
        .from('scan_history')
        .select('*')
        .order('finished_at', { ascending: false })
        .limit(guildIdFilter ? 100 : 25);
      if (guildIdFilter) query = query.eq('guild_id', guildIdFilter);
      const { data, error } = await query.abortSignal(signal);
      if (error) throw new Error(error.message);
      return data as ScanRecord[] | null;
    }, { timeoutMs: 8000, label: 'ScanHistory:fetch' });

    if (outcome.ok) {
      if (outcome.data) setScans(dedupeScans(outcome.data.filter(isVisibleHistoryScan)));
    } else {
      setLoadError(outcome.error.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, [guildIdFilter]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory, refreshSignal]);

  useEffect(() => {
    const channel = supabase
      .channel(`scan-history-realtime:${guildIdFilter || 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_history' }, (payload: any) => {
        const row = payload.new as ScanRecord;
        if (guildIdFilter && row.guild_id !== guildIdFilter) return;
        if (!isVisibleHistoryScan(row)) return;
        setScans((prev) => dedupeScans([row, ...prev]).slice(0, 50));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scan_history' }, (payload: any) => {
        const updated = payload.new as ScanRecord;
        if (guildIdFilter && updated.guild_id !== guildIdFilter) return;
        if (!isVisibleHistoryScan(updated)) {
          setScans((prev) => prev.filter((scan) => scan.id !== updated.id));
          return;
        }
        setScans((prev) => {
          const idx = prev.findIndex((s) => s.id === updated.id);
          if (idx === -1) return dedupeScans([updated, ...prev]).slice(0, 50);
          const next = [...prev];
          next[idx] = updated;
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guildIdFilter]);

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const deleteScan = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const target = scans.find(s => s.id === id);
    const { error } = await supabase.from('scan_history').delete().eq('id', id);
    if (error) {
      toast.error('Could not delete scan record');
      void logActivity({ category: 'scan', action: 'Failed to delete scan', severity: 'error', description: error.message, metadata: { scan_id: id } });
    }
    else {
      setScans(prev => prev.filter(s => s.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success('Scan record deleted');
      void logActivity({
        category: 'scan',
        action: 'Scan deleted',
        severity: 'info',
        description: `Scan from ${target?.guild_name || target?.guild_id || 'unknown'} removed.`,
        metadata: { scan_id: id, guild_id: target?.guild_id, guild_name: target?.guild_name },
      });
    }
  };

  const exportScan = (scan: ScanRecord) => {
    const blob = new Blob([JSON.stringify(scan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-${scan.guild_name || scan.guild_id}-${format(new Date(scan.finished_at), 'yyyyMMdd-HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Aggregates ─────────────────────────────────────

  const totalScans = scans.length;
  const totalAlerts = scans.reduce((sum, s) => sum + s.total_alerts, 0);
  const totalChecked = scans.reduce((sum, s) => sum + s.total_checked, 0);
  const totalMembers = scans.reduce((sum, s) => sum + s.total_members, 0);
  const totalFailed = scans.reduce((sum, s) => sum + (s.total_failed || 0), 0);
  const avgDuration = totalScans > 0 ? Math.round(scans.reduce((sum, s) => sum + s.duration_seconds, 0) / totalScans) : 0;
  const successRate = totalChecked > 0 ? Math.round(((totalChecked - totalFailed) / totalChecked) * 100) : 100;
  const lastScan = scans.length > 0 ? scans[0] : null;

  // ── Loading State ──────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <div className="h-4 w-28 bg-muted/20 rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted/10 rounded animate-pulse mt-1.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-[100px] bg-card/40 border border-border/10 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="rounded-xl border border-border/20 bg-card/40 overflow-hidden">
          <div className="h-10 bg-muted/5 border-b border-border/10" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 border-b border-border/5 animate-pulse">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="w-2 h-2 rounded-full bg-muted/20" />
                <div className="flex-1">
                  <div className="h-3.5 w-32 bg-muted/15 rounded" />
                  <div className="h-2.5 w-20 bg-muted/10 rounded mt-1.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────

  if (loadError && scans.length === 0) {
    return (
      <ErrorCard
        title="Could not load scan history"
        message={loadError}
        onRetry={() => { void fetchHistory(true); }}
        isRetrying={refreshing}
      />
    );
  }

  // ── Empty State ────────────────────────────────────

  if (scans.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Scan History</h3>
            <p className="text-xs text-muted-foreground/60">No activity yet</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border/15 bg-card/30 backdrop-blur-sm">
          <div className="w-14 h-14 rounded-2xl bg-muted/10 flex items-center justify-center mb-4">
            <BarChart3 className="w-7 h-7 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-medium text-muted-foreground/60">No scans recorded yet</p>
          <p className="text-xs text-muted-foreground/30 mt-1">Scans will appear here once your bot starts scanning</p>
        </div>
      </div>
    );
  }

  // ── Main Render ────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {guildIdFilter ? `Scan History · ${guildNameLabel || guildIdFilter}` : 'Scan History'}
            </h3>
            <p className="text-xs text-muted-foreground/60">
              {totalScans} scan{totalScans !== 1 ? 's' : ''} · {lastScan && `Last ${formatDistanceToNow(new Date(lastScan.finished_at), { addSuffix: true })}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchHistory(true)}
          disabled={refreshing}
          className="p-2.5 rounded-lg hover:bg-muted/30 text-muted-foreground/50 hover:text-foreground transition-all duration-200 disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />} label="Checked" numValue={totalChecked} isFirst />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Cheaters Found" numValue={cheatersFoundCount ?? totalAlerts} accent={(cheatersFoundCount ?? totalAlerts) > 0 ? 'destructive' : undefined} />
        <StatCard icon={<Timer className="w-4 h-4" />} label="Avg Duration" value={fmtDuration(avgDuration)} />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Success Rate" numValue={successRate} suffix="%" accent="success" />
        <StatCard icon={<Shield className="w-4 h-4" />} label="Members" numValue={totalMembers} />
        <StatCard icon={<Zap className="w-4 h-4" />} label="Total Scans" numValue={totalScans} />
      </div>

      {/* Scan Table */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
        {/* Sticky Header */}
        <div
          ref={tableHeaderRef}
          className="grid grid-cols-[1fr_90px_80px_150px_28px] items-center px-5 py-3 border-b border-border/15 bg-card/80 backdrop-blur-md sticky top-0 z-10"
        >
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Server</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-right">Checked</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-right">Alerts</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-right">Date</span>
          <span />
        </div>

        {/* Rows */}
        <div className="max-h-[520px] overflow-y-auto">
          {scans.map((scan, index) => {
            const isExpanded = expandedId === scan.id;
            const isRunning = scan.status === 'running';
            const hasLookupFailure = scan.total_checked > 0 && (scan.total_failed || 0) >= scan.total_checked;
            const scanTotalFailed = scan.total_failed || 0;
            const processed = (scan.total_checked || 0) + (scan.total_skipped || 0);
            const isInterrupted = scan.status === 'failed' && scanTotalFailed === 0 && processed > 0 && processed < (scan.total_members || 0);
            const isFailed = (scan.status === 'failed' && !isInterrupted) || hasLookupFailure;
            const isCompleted = scan.status === 'completed' && !isFailed;
            const hasHighFailure = scanTotalFailed > 0 && scan.total_checked > 0 && (scanTotalFailed / scan.total_checked) > 0.05;
            const successfullyChecked = scan.total_checked - scanTotalFailed;
            const cleanPct = !isFailed && successfullyChecked > 0
              ? Math.round(((successfullyChecked - scan.total_alerts) / successfullyChecked) * 100) : 0;
            const rate = scan.duration_seconds > 0 ? Math.round(scan.total_checked / (scan.duration_seconds / 60)) : 0;
            const alertPct = successfullyChecked > 0 ? Math.round((scan.total_alerts / successfullyChecked) * 100) : 0;
            const skippedPct = scan.total_members > 0 ? Math.round((scan.total_skipped / scan.total_members) * 100) : 0;
            const failedPct = scan.total_checked > 0 ? Math.round((scanTotalFailed / scan.total_checked) * 100) : 0;
            const statusLabel = isRunning ? 'Scanning…' : hasLookupFailure ? 'Lookup failed' : isCompleted ? 'Completed' : isInterrupted ? 'Interrupted' : isFailed ? 'Failed' : 'Stopped';
            const isRecent = index === 0;
            const retryCount = scan.retry_count || 0;
            const stageLabel = humanStage(scan.current_stage);
            const liveSubtext = isRunning
              ? `${scan.total_checked.toLocaleString()} / ${(scan.total_members || 0).toLocaleString()} members${stageLabel ? ` · ${stageLabel}` : ''}${retryCount > 0 ? ` · retry ${retryCount}` : ''}`
              : null;

            return (
              <ContextMenu key={scan.id}>
                <ContextMenuTrigger asChild>
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.03 }}
                    className={cn(
                      'border-b border-border/8 last:border-b-0 transition-all duration-200 cursor-pointer',
                      isExpanded ? 'bg-muted/8' : 'hover:bg-muted/5 hover:-translate-y-px',
                      isRecent && !isExpanded && 'bg-primary/[0.02]'
                    )}
                    onClick={() => {
                      const next = isExpanded ? null : scan.id;
                      setExpandedId(next);
                      if (next && scan.total_alerts > 0) fetchCheaters(scan.guild_id);
                    }}
                  >
                    {/* Row */}
                    <div className="grid grid-cols-[1fr_90px_80px_150px_28px] items-center px-5 py-3.5">
                      {/* Server + status */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <div className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            isRunning && 'bg-blue-400 animate-pulse',
                            isCompleted && 'bg-emerald-400',
                            isFailed && 'bg-destructive',
                            !isRunning && !isCompleted && !isFailed && 'bg-amber-400'
                          )} />
                          {isRecent && !isRunning && (
                            <div className="absolute -inset-1 rounded-full bg-emerald-400/20 animate-ping" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate leading-tight">
                            {scan.guild_name || scan.guild_id}
                          </p>
                          <p className="text-[11px] text-muted-foreground/40 leading-none mt-1">
                            {statusLabel}
                            {liveSubtext && <span className="text-blue-300/70"> · {liveSubtext}</span>}
                            {isCompleted && <span className="text-muted-foreground/30"> · {cleanPct}% clean</span>}
                            {isCompleted && hasHighFailure && (
                              <span className="text-amber-400/70 ml-1">⚠ {scanTotalFailed} failed</span>
                            )}
                            {!isRunning && retryCount > 0 && (
                              <span className="text-amber-400/70 ml-1">⟳ {retryCount} {retryCount === 1 ? 'retry' : 'retries'}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Checked */}
                      <p className="text-sm tabular-nums text-foreground/80 text-right font-semibold">
                        {scan.total_checked.toLocaleString()}
                      </p>

                      {/* Alerts */}
                      <div className="flex items-center justify-end gap-1.5">
                        {scan.total_alerts > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
                        )}
                        <p className={cn(
                          'text-sm tabular-nums text-right font-bold',
                          scan.total_alerts > 0 ? 'text-destructive' : 'text-muted-foreground/20'
                        )}>
                          {scan.total_alerts}
                        </p>
                      </div>

                      {/* Date */}
                      <div className="text-right">
                        <p className="text-xs tabular-nums text-foreground/60 font-medium">
                          {format(new Date(scan.finished_at), 'MMM dd, HH:mm')}
                        </p>
                        <p className="text-[10px] tabular-nums text-muted-foreground/30 mt-0.5">
                          {fmtDuration(scan.duration_seconds)}
                        </p>
                      </div>

                      {/* Chevron */}
                      <ChevronDown className={cn(
                        'w-4 h-4 text-muted-foreground/20 mx-auto transition-transform duration-200',
                        isExpanded && 'rotate-180 text-muted-foreground/40'
                      )} />
                    </div>

                    {/* Progress bar under each row */}
                    {!isExpanded && isCompleted && (
                      <div className="px-5 pb-2.5 -mt-1">
                        <ScanProgressBar clean={cleanPct} alerts={alertPct} skipped={skippedPct} failed={failedPct} />
                      </div>
                    )}

                    {/* Expanded Panel */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/10 px-5 pb-5 pt-4 space-y-5">
                            {/* Failure reason / rate limit info */}
                            {(isFailed || isInterrupted || scan.error_message || scan.rate_limit_info) && (
                              <div className="rounded-lg bg-destructive/5 border border-destructive/15 px-3.5 py-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <XCircle className="w-3.5 h-3.5 text-destructive/70 shrink-0" />
                                  <span className="text-[11px] font-semibold text-destructive/90 uppercase tracking-widest">
                                    {isInterrupted ? 'Scan interrupted' : 'Failure details'}
                                  </span>
                                </div>
                                {scan.error_message && (
                                  <p className="text-[11px] text-foreground/80 leading-relaxed break-words">
                                    <span className="text-muted-foreground/60">Reason: </span>
                                    {cleanDisplayText(scan.error_message)}
                                  </p>
                                )}
                                {scan.rate_limit_info && (
                                  <p className="text-[11px] text-amber-300/80 leading-relaxed break-words">
                                    <span className="text-muted-foreground/60">Rate limit: </span>
                                    {scan.rate_limit_info}
                                  </p>
                                )}
                                {(scan.retry_count || 0) > 0 && (
                                  <p className="text-[11px] text-muted-foreground/60">
                                    <span className="text-muted-foreground/50">Retries attempted: </span>
                                    <span className="text-foreground/80 font-semibold">{scan.retry_count}</span>
                                  </p>
                                )}
                                {scan.current_stage && (
                                  <p className="text-[11px] text-muted-foreground/60">
                                    <span className="text-muted-foreground/50">Last stage: </span>
                                    <span className="text-foreground/80">{humanStage(scan.current_stage)}</span>
                                  </p>
                                )}
                                {!scan.error_message && !scan.rate_limit_info && isInterrupted && (
                                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                                    Scan stopped making progress before completing. This usually means the background chain was
                                    cancelled by the platform. Partial results are preserved.
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Health bar */}
                            <div>
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-[11px] font-medium text-muted-foreground/60 flex items-center gap-1.5">
                                  <Shield className="w-3.5 h-3.5 text-primary/70" /> Server Health
                                </span>
                                <span className={cn(
                                  'text-xs font-bold tabular-nums',
                                  cleanPct >= 95 ? 'text-emerald-400' : cleanPct >= 80 ? 'text-amber-400' : 'text-destructive'
                                )}>
                                  {cleanPct}% clean
                                </span>
                              </div>
                              <ScanProgressBar clean={cleanPct} alerts={alertPct} skipped={skippedPct} failed={failedPct} />
                              <div className="flex items-center gap-4 mt-2">
                                {[
                                  { label: 'Clean', color: 'bg-emerald-500/70', pct: cleanPct },
                                  { label: 'Alerts', color: 'bg-destructive/60', pct: alertPct },
                                  { label: 'Skipped', color: 'bg-muted-foreground/15', pct: skippedPct },
                                  { label: 'Failed', color: 'bg-amber-500/50', pct: failedPct },
                                ].filter(i => i.pct > 0).map(item => (
                                  <div key={item.label} className="flex items-center gap-1.5">
                                    <div className={cn('w-2 h-2 rounded-sm', item.color)} />
                                    <span className="text-[10px] text-muted-foreground/40">{item.label} {item.pct}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Warning */}
                            {hasHighFailure && (
                              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                <AlertTriangle className="w-4 h-4 text-amber-400/70 shrink-0" />
                                <span className="text-[11px] text-amber-300/70">
                                  {scanTotalFailed.toLocaleString()} lookups failed — clean % based on {successfullyChecked.toLocaleString()} successfully checked.
                                </span>
                              </div>
                            )}

                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-3">
                                <h4 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Coverage</h4>
                                <div className="space-y-0">
                                  <InfoRow label="Total members" value={scan.total_members.toLocaleString()} />
                                  <InfoRow label="Checked" value={scan.total_checked.toLocaleString()} />
                                  <InfoRow label="Skipped" value={scan.total_skipped.toLocaleString()} />
                                </div>
                                <h4 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest pt-1">Issues</h4>
                                <div className="space-y-0">
                                  <InfoRow label="Alerts" value={scan.total_alerts.toString()} highlight={scan.total_alerts > 0} />
                                  <InfoRow label="Failed" value={scanTotalFailed.toString()} highlight={scanTotalFailed > 0} />
                                </div>
                              </div>
                              <div className="space-y-3">
                                <h4 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Scan Info</h4>
                                <div className="space-y-0">
                                  <InfoRow label="Type" value={scan.scan_type} capitalize />
                                  <InfoRow label="Guild ID" value={scan.guild_id.slice(0, 12) + '…'} mono copyable onCopy={() => copyText(scan.guild_id, 'Guild ID')} />
                                  <InfoRow label="Scan ID" value={scan.id.slice(0, 12) + '…'} mono copyable onCopy={() => copyText(scan.id, 'Scan ID')} />
                                </div>
                                <h4 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest pt-1">Performance</h4>
                                <div className="space-y-0">
                                  <InfoRow label="Duration" value={fmtDuration(scan.duration_seconds)} />
                                  <InfoRow label="Throughput" value={`${rate.toLocaleString()} members/min`} />
                                </div>
                              </div>
                            </div>

                            {/* Timeline */}
                            <div>
                              <h4 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-3">Timeline</h4>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2.5 bg-card/60 border border-border/15 rounded-lg px-3.5 py-2.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                                  <div>
                                    <p className="text-[9px] text-muted-foreground/40 font-medium uppercase tracking-wider">Started</p>
                                    <p className="text-xs font-semibold text-foreground/80 tabular-nums">{format(new Date(scan.started_at), 'HH:mm:ss')}</p>
                                  </div>
                                </div>
                                <div className="flex-1 flex items-center gap-1">
                                  <div className="flex-1 h-px bg-border/15" />
                                  <span className="text-[10px] text-muted-foreground/30 px-2 font-medium">{fmtDuration(scan.duration_seconds)}</span>
                                  <div className="flex-1 h-px bg-border/15" />
                                  <ArrowRight className="w-3 h-3 text-muted-foreground/20" />
                                </div>
                                <div className="flex items-center gap-2.5 bg-card/60 border border-border/15 rounded-lg px-3.5 py-2.5">
                                  <div className={cn('w-1.5 h-1.5 rounded-full', isCompleted ? 'bg-emerald-400' : 'bg-destructive')} />
                                  <div>
                                    <p className="text-[9px] text-muted-foreground/40 font-medium uppercase tracking-wider">Finished</p>
                                    <p className="text-xs font-semibold text-foreground/80 tabular-nums">{format(new Date(scan.finished_at), 'HH:mm:ss')}</p>
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground/25 mt-1.5 text-center">{format(new Date(scan.started_at), 'MMMM dd, yyyy')}</p>
                            </div>

                            {/* Detected cheaters (filtered to this scan's window) */}
                            {scan.total_alerts > 0 && (() => {
                              const all = scanCheaters[scan.guild_id] || [];
                              const startMs = new Date(scan.started_at).getTime() - 2000;
                              const endMs = scan.finished_at
                                ? new Date(scan.finished_at).getTime() + 2000
                                : Date.now();
                              const inWindow = all.filter(c => {
                                if (!c.detected_at) return false;
                                const t = new Date(c.detected_at).getTime();
                                return t >= startMs && t <= endMs;
                              });
                              // Fall back to all known cheaters on the server when no
                              // detections fall inside this scan's exact window.
                              const scanScoped = inWindow.length > 0 ? inWindow : all;
                              const isFallback = inWindow.length === 0 && all.length > 0;
                              return (
                              <div>
                                <h4 className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-3 flex items-center gap-1.5 flex-wrap">
                                  <UserX className="w-3.5 h-3.5 text-destructive/70" />
                                  Detected Cheaters ({scanScoped.length})
                                  {isFallback && (
                                    <span className="ml-1 text-[9px] font-medium normal-case tracking-normal text-muted-foreground/40">
                                      · all-time on this server
                                    </span>
                                  )}
                                  {!isFallback && all.length > scanScoped.length && (
                                    <span className="ml-1 text-[9px] font-medium normal-case tracking-normal text-muted-foreground/40">
                                      · {all.length} known on this server (all-time)
                                    </span>
                                  )}
                                </h4>
                                {loadingCheaters === scan.guild_id ? (
                                  <div className="text-xs text-muted-foreground/30 py-6 text-center">Loading…</div>
                                ) : scanScoped.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[320px] overflow-y-auto">
                                    {scanScoped.map(ch => {
                                      const avUrl = ch.discord_avatar
                                        ? `https://cdn.discordapp.com/avatars/${ch.discord_user_id}/${ch.discord_avatar}.png?size=32`
                                        : null;
                                      return (
                                        <div
                                          key={ch.id}
                                          onClick={(e) => { e.stopPropagation(); navigate(`/cheaters?q=${encodeURIComponent(ch.discord_user_id)}`); }}
                                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-destructive/[0.03] border border-destructive/8 cursor-pointer hover:bg-destructive/[0.06] transition-all duration-200 group/ch"
                                        >
                                          {avUrl ? (
                                            <img src={avUrl} alt="" className="w-6 h-6 rounded-full" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-destructive/15 flex items-center justify-center">
                                              <AlertTriangle className="w-3 h-3 text-destructive/60" />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <span className="text-[11px] font-semibold text-foreground/90 truncate block">
                                              {ch.discord_username || ch.discord_user_id}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground/35">
                                              {ch.join_count || 0} servers · {ch.total_bans || 0} bans · {ch.total_tickets || 0} tickets
                                            </span>
                                          </div>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); copyText(ch.discord_user_id, 'Discord ID'); }}
                                            className="opacity-0 group-hover/ch:opacity-100 transition-opacity p-0.5"
                                          >
                                            <Copy className="w-3 h-3 text-muted-foreground/30 hover:text-foreground" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground/25 py-6 text-center">No cheater records found</div>
                                )}
                              </div>
                              );
                            })()}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2 border-t border-border/8">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1.5 border-border/15 text-muted-foreground/60 hover:text-foreground hover:border-border/30 transition-all duration-200"
                                onClick={(e) => { e.stopPropagation(); exportScan(scan); }}
                              >
                                <Download className="w-3 h-3" /> Export
                              </Button>
                              <div className="flex-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs gap-1.5 text-muted-foreground/30 hover:text-destructive transition-all duration-200"
                                onClick={(e) => deleteScan(scan.id, e)}
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                  <ContextMenuLabel className="text-[10px]">Scan Actions</ContextMenuLabel>
                  <ContextMenuItem onClick={() => copyText(scan.id, 'Scan ID')} className="gap-2 text-xs">
                    <Copy className="w-3.5 h-3.5" /> Copy Scan ID
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => copyText(scan.guild_id, 'Guild ID')} className="gap-2 text-xs">
                    <Copy className="w-3.5 h-3.5" /> Copy Guild ID
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => exportScan(scan)} className="gap-2 text-xs">
                    <Download className="w-3.5 h-3.5" /> Export Scan
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => deleteScan(scan.id)} className="gap-2 text-xs text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Scan
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
    </div>
  );
}
