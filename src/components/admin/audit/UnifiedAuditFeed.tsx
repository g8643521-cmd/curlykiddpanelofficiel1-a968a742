import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Activity, RefreshCw, Search, Trash2, Download, Filter, Radio,
  Database, Shield, Bot, FileSearch, AlertTriangle, Bug, UserCircle,
  Globe, Zap, ScrollText, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

interface Entry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_display_name: string | null;
  category: string;
  action: string;
  description: string | null;
  metadata: any;
  page_path: string | null;
  user_agent: string | null;
  severity: 'info' | 'warning' | 'error' | 'critical';
  created_at: string;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Activity; tone: string }> = {
  auth:       { label: 'Auth',        icon: Shield,      tone: 'text-purple-300 bg-purple-500/10 border-purple-500/25' },
  navigation: { label: 'Navigation',  icon: Globe,       tone: 'text-sky-300 bg-sky-500/10 border-sky-500/25' },
  database:   { label: 'Database',    icon: Database,    tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25' },
  bot:        { label: 'Bot',         icon: Bot,         tone: 'text-blue-300 bg-blue-500/10 border-blue-500/25' },
  scan:       { label: 'Scan',        icon: FileSearch,  tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' },
  cheater:    { label: 'Cheater',     icon: AlertTriangle, tone: 'text-red-300 bg-red-500/10 border-red-500/25' },
  mod:        { label: 'Mod',         icon: ScrollText,  tone: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
  admin:      { label: 'Admin',       icon: Shield,      tone: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/25' },
  webhook:    { label: 'Webhook',     icon: Zap,         tone: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/25' },
  profile:    { label: 'Profile',     icon: UserCircle,  tone: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/25' },
  search:     { label: 'Search',      icon: Search,      tone: 'text-teal-300 bg-teal-500/10 border-teal-500/25' },
  system:     { label: 'System',      icon: Activity,    tone: 'text-slate-300 bg-slate-500/10 border-slate-500/25' },
  error:      { label: 'Error',       icon: Bug,         tone: 'text-rose-300 bg-rose-500/10 border-rose-500/25' },
};

const SEVERITY_TONE: Record<string, string> = {
  info:     'text-muted-foreground bg-muted/40 border-border/40',
  warning:  'text-amber-300 bg-amber-500/10 border-amber-500/30',
  error:    'text-rose-300 bg-rose-500/10 border-rose-500/30',
  critical: 'text-red-200 bg-red-500/15 border-red-500/40 ring-1 ring-red-500/30',
};

const PAGE_SIZE = 200;

export default function UnifiedAuditFeed() {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    category: 'all',
    severity: 'all',
    user: '',
    q: '',
  });
  const [live, setLive] = useState(true);
  const [selected, setSelected] = useState<Entry | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) toast.error('Failed to load activity');
    else setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  // Realtime subscription
  useEffect(() => {
    if (!live) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }
    const ch = supabase
      .channel('activity_log_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          setEntries((prev) => [payload.new as Entry, ...prev].slice(0, PAGE_SIZE));
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [live]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.category));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    const u = filter.user.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter.category !== 'all' && e.category !== filter.category) return false;
      if (filter.severity !== 'all' && e.severity !== filter.severity) return false;
      if (u) {
        const hay = `${e.user_email || ''} ${e.user_display_name || ''}`.toLowerCase();
        if (!hay.includes(u)) return false;
      }
      if (q) {
        const blob = `${e.action} ${e.description || ''} ${e.page_path || ''} ${JSON.stringify(e.metadata || {})}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [entries, filter]);

  const stats = useMemo(() => {
    const byCat = new Map<string, number>();
    let warn = 0, err = 0, crit = 0;
    entries.forEach((e) => {
      byCat.set(e.category, (byCat.get(e.category) || 0) + 1);
      if (e.severity === 'warning') warn++;
      if (e.severity === 'error') err++;
      if (e.severity === 'critical') crit++;
    });
    return { total: entries.length, byCat, warn, err, crit };
  }, [entries]);

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Delete entire activity log?',
      description: 'Alle entries fjernes permanent. Dette kan ikke fortrydes.',
      confirmText: 'Delete all',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    const { error } = await supabase.from('activity_log').delete().not('id', 'is', null);
    if (error) toast.error(error.message);
    else { toast.success('Activity log cleared'); setEntries([]); }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `activity-log-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatTile label="Events" value={stats.total} icon={Activity} tone="text-foreground" />
        <StatTile label="Warnings" value={stats.warn} icon={AlertTriangle} tone="text-amber-300" />
        <StatTile label="Errors" value={stats.err} icon={Bug} tone="text-rose-300" />
        <StatTile label="Critical" value={stats.crit} icon={Shield} tone="text-red-300" />
        <StatTile label="Live" value={live ? 'ON' : 'OFF'} icon={Radio} tone={live ? 'text-emerald-300' : 'text-muted-foreground'} pulse={live} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/40 p-2.5 backdrop-blur">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filter.q}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search in action, description, metadata…"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Input
          value={filter.user}
          onChange={(e) => setFilter((f) => ({ ...f, user: e.target.value }))}
          placeholder="Filter by user / email"
          className="h-9 w-[200px] text-xs"
        />
        <Select value={filter.category} onValueChange={(v) => setFilter((f) => ({ ...f, category: v }))}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_META[c]?.label || c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.severity} onValueChange={(v) => setFilter((f) => ({ ...f, severity: v }))}>
          <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle severity</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant={live ? 'default' : 'outline'} onClick={() => setLive((v) => !v)} className="h-9 gap-1.5">
            <Radio className={cn('h-3.5 w-3.5', live && 'animate-pulse')} />
            {live ? 'Live' : 'Paused'}
          </Button>
          <Button size="sm" variant="outline" onClick={fetchEntries} className="h-9 gap-1.5" disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportJson} className="h-9 gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll} className="h-9 gap-1.5 text-rose-300 hover:text-rose-200">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Viser <span className="font-semibold text-foreground">{filtered.length}</span>
            {' '}af <span className="font-semibold text-foreground">{entries.length}</span> events
          </div>
        </div>
        <ScrollArea className="h-[640px]">
          <div className="divide-y divide-border/30">
            {loading && (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Ingen events matcher filtrene.
              </div>
            )}
            {!loading && filtered.map((e) => (
              <FeedRow key={e.id} entry={e} onSelect={setSelected} />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && <EntryDetail entry={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, tone, pulse }: {
  label: string; value: number | string; icon: typeof Activity; tone: string; pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-2.5 backdrop-blur">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-muted/40', tone)}>
        <Icon className={cn('h-4 w-4', pulse && 'animate-pulse')} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <div className={cn('text-sm font-semibold tabular-nums', tone)}>{value}</div>
      </div>
    </div>
  );
}

function FeedRow({ entry, onSelect }: { entry: Entry; onSelect: (e: Entry) => void }) {
  const meta = CATEGORY_META[entry.category] || { label: entry.category, icon: Activity, tone: SEVERITY_TONE.info };
  const Icon = meta.icon;
  const sev = SEVERITY_TONE[entry.severity] || SEVERITY_TONE.info;
  return (
    <button
      onClick={() => onSelect(entry)}
      className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors group"
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', meta.tone)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-semibold text-foreground truncate">{entry.action}</span>
          <Badge variant="outline" className={cn('h-4 px-1.5 text-[10px] font-medium', sev)}>
            {entry.severity}
          </Badge>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground border-border/40">
            {meta.label}
          </Badge>
        </div>
        {entry.description && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">{entry.description}</div>
        )}
        <div className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-2 flex-wrap">
          <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
          {entry.user_email && <><span>•</span><span className="truncate">{entry.user_display_name || entry.user_email}</span></>}
          {entry.page_path && <><span>•</span><span className="font-mono truncate">{entry.page_path}</span></>}
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
    </button>
  );
}

function EntryDetail({ entry }: { entry: Entry }) {
  const meta = CATEGORY_META[entry.category] || { label: entry.category, icon: Activity, tone: SEVERITY_TONE.info };
  const sev = SEVERITY_TONE[entry.severity] || SEVERITY_TONE.info;
  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-mono text-sm">{entry.action}</SheetTitle>
        <SheetDescription className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn('h-5', meta.tone)}>{meta.label}</Badge>
          <Badge variant="outline" className={cn('h-5', sev)}>{entry.severity}</Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(entry.created_at), 'PPpp')}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="mt-4 space-y-4 text-sm">
        {entry.description && (
          <DetailField label="Description">{entry.description}</DetailField>
        )}

        <div className="grid grid-cols-2 gap-3">
          {entry.user_email && (
            <DetailField label="User">
              <div>{entry.user_display_name || '—'}</div>
              <div className="text-xs text-muted-foreground font-mono">{entry.user_email}</div>
            </DetailField>
          )}
          {entry.page_path && (
            <DetailField label="Page"><span className="font-mono text-xs">{entry.page_path}</span></DetailField>
          )}
        </div>

        {entry.user_agent && (
          <DetailField label="User-Agent">
            <div className="text-xs text-muted-foreground font-mono break-all">{entry.user_agent}</div>
          </DetailField>
        )}

        {entry.metadata && (
          <DetailField label="Metadata">
            <pre className="text-[11px] leading-relaxed bg-muted/40 border border-border/40 rounded-lg p-3 overflow-auto max-h-[400px] font-mono">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </DetailField>
        )}

        <DetailField label="Event ID">
          <code className="text-[11px] text-muted-foreground">{entry.id}</code>
        </DetailField>
      </div>
    </>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}