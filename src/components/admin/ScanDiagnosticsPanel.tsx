import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Activity, AlertCircle, CheckCircle, Clock, Filter, RefreshCw, Search,
  Stethoscope, Timer, XCircle, Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DiagnosticScan {
  id: string;
  guild_id: string | null;
  guild_name: string | null;
  scan_type: string | null;
  status: string;
  total_members: number;
  total_checked: number;
  total_skipped: number;
  total_alerts: number;
  total_failed: number;
  duration_seconds: number;
  started_at: string | null;
  finished_at: string | null;
  last_heartbeat_at: string | null;
  current_stage: string | null;
  error_message: string | null;
  rate_limit_info: string | null;
  retry_count: number | null;
  user_id: string | null;
}

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
  watchdog_stall: 'Watchdog stall',
};

const humanStage = (s?: string | null) =>
  s ? STAGE_LABELS[s] || s.replace(/_/g, ' ') : '—';

const STUCK_THRESHOLD_MS = 3 * 60 * 1000;

function StatusDot({ status, stuck }: { status: string; stuck: boolean }) {
  const color =
    status === 'completed' ? 'bg-emerald-400'
    : status === 'running' ? (stuck ? 'bg-amber-400 animate-pulse' : 'bg-blue-400 animate-pulse')
    : status === 'failed' ? 'bg-destructive'
    : 'bg-muted-foreground/40';
  return <span className={cn('inline-block w-2 h-2 rounded-full', color)} />;
}

export default function ScanDiagnosticsPanel() {
  const [scans, setScans] = useState<DiagnosticScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [guildFilter, setGuildFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('scan_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(500);
    setScans((data as DiagnosticScan[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('scan-diagnostics-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scan_history' }, () => {
        void load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const guilds = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of scans) {
      if (s.guild_id) map.set(s.guild_id, s.guild_name || s.guild_id);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [scans]);

  const filtered = useMemo(() => {
    return scans.filter((s) => {
      if (guildFilter !== 'all' && s.guild_id !== guildFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(s.guild_name || '').toLowerCase().includes(q) &&
          !(s.guild_id || '').toLowerCase().includes(q) &&
          !(s.error_message || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [scans, guildFilter, statusFilter, search]);

  const stuckScans = useMemo(() => {
    const now = Date.now();
    return filtered.filter((s) => {
      if (s.status !== 'running') return false;
      const hb = s.last_heartbeat_at ? new Date(s.last_heartbeat_at).getTime() : 0;
      return !hb || now - hb > STUCK_THRESHOLD_MS;
    });
  }, [filtered]);

  const counts = useMemo(() => ({
    total: filtered.length,
    running: filtered.filter((s) => s.status === 'running').length,
    completed: filtered.filter((s) => s.status === 'completed').length,
    failed: filtered.filter((s) => s.status === 'failed').length,
    stuck: stuckScans.length,
  }), [filtered, stuckScans]);

  const lastRun = scans[0] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Scan Diagnostics</h3>
            <p className="text-xs text-muted-foreground/60">
              {lastRun
                ? `Last edge-function run ${formatDistanceToNow(new Date(lastRun.last_heartbeat_at || lastRun.started_at || lastRun.finished_at || new Date().toISOString()), { addSuffix: true })}`
                : 'No scans yet'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: <Zap className="w-4 h-4" />, label: 'Total', value: counts.total, tint: 'text-foreground' },
          { icon: <Activity className="w-4 h-4" />, label: 'Running', value: counts.running, tint: 'text-blue-400' },
          { icon: <CheckCircle className="w-4 h-4" />, label: 'Completed', value: counts.completed, tint: 'text-emerald-400' },
          { icon: <XCircle className="w-4 h-4" />, label: 'Failed', value: counts.failed, tint: 'text-destructive' },
          { icon: <AlertCircle className="w-4 h-4" />, label: 'Stuck', value: counts.stuck, tint: 'text-amber-400' },
        ].map((c) => (
          <div key={c.label} className="p-4 bg-card/60 backdrop-blur-sm rounded-xl border border-border/20">
            <div className={cn('flex items-center gap-2 mb-2', c.tint)}>
              {c.icon}
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {c.label}
              </span>
            </div>
            <p className={cn('text-2xl font-bold tabular-nums', c.tint)}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card/40 backdrop-blur-sm border border-border/20 rounded-xl">
        <Filter className="w-4 h-4 text-muted-foreground/50 ml-1" />
        <div className="min-w-[200px]">
          <Select value={guildFilter} onValueChange={setGuildFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Filter by guild" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All guilds</SelectItem>
              {guilds.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[150px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="stopped">Stopped</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guild name / ID / error…"
            className="h-9 pl-9"
          />
        </div>
      </div>

      {/* Stuck scans callout */}
      {stuckScans.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">
              {stuckScans.length} stuck scan{stuckScans.length !== 1 ? 's' : ''} detected
            </span>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Running scans that have not produced a heartbeat in over {Math.round(STUCK_THRESHOLD_MS / 60_000)} minutes.
            These will be automatically marked as failed by the next chain attempt or the browser watchdog.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_110px_140px_100px_130px_40px] items-center px-5 py-3 border-b border-border/15 bg-card/80 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
          <span>Guild</span>
          <span>Status</span>
          <span>Stage</span>
          <span className="text-right">Retries</span>
          <span className="text-right">Last heartbeat</span>
          <span />
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {loading && filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground/50">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground/50">No scans match these filters.</div>
          ) : filtered.map((s) => {
            const now = Date.now();
            const hb = s.last_heartbeat_at ? new Date(s.last_heartbeat_at).getTime() : 0;
            const isStuck = s.status === 'running' && (!hb || now - hb > STUCK_THRESHOLD_MS);
            const hbAge = hb ? formatDistanceToNow(new Date(hb), { addSuffix: true }) : '—';
            return (
              <div
                key={s.id}
                className={cn(
                  'grid grid-cols-[1fr_110px_140px_100px_130px_40px] items-center px-5 py-3 border-b border-border/8 last:border-b-0',
                  isStuck && 'bg-amber-500/5'
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {s.guild_name || s.guild_id || 'Unknown guild'}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 font-mono truncate">
                    {s.guild_id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={s.status} stuck={isStuck} />
                  <span className="text-xs capitalize text-foreground/80">
                    {isStuck ? 'Stuck' : s.status}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground/80 truncate">{humanStage(s.current_stage)}</p>
                  {s.error_message && (
                    <p className="text-[10px] text-destructive/80 truncate" title={s.error_message}>
                      {s.error_message}
                    </p>
                  )}
                  {s.rate_limit_info && !s.error_message && (
                    <p className="text-[10px] text-amber-400/80 truncate" title={s.rate_limit_info}>
                      {s.rate_limit_info}
                    </p>
                  )}
                </div>
                <p className={cn(
                  'text-sm tabular-nums text-right',
                  (s.retry_count || 0) > 0 ? 'text-amber-400 font-semibold' : 'text-muted-foreground/40'
                )}>
                  {s.retry_count || 0}
                </p>
                <div className="text-right">
                  <p className={cn(
                    'text-xs tabular-nums',
                    isStuck ? 'text-amber-400' : 'text-foreground/70'
                  )}>
                    {hbAge}
                  </p>
                  <p className="text-[10px] text-muted-foreground/30">
                    {s.total_checked.toLocaleString()} / {(s.total_members || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-end">
                  {isStuck && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/30 text-center">
        Showing the {scans.length.toLocaleString()} most recent scans. A scan is marked <span className="text-amber-400">Stuck</span> after {Math.round(STUCK_THRESHOLD_MS / 60_000)} minutes without a heartbeat.
      </p>
    </div>
  );
}