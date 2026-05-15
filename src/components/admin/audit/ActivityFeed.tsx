import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, RefreshCw, Search, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useConfirm } from '@/components/ui/confirm-dialog';

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
  severity: string;
  created_at: string;
}

const severityColor: Record<string, string> = {
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  error: 'text-destructive bg-destructive/10 border-destructive/20',
  critical: 'text-destructive bg-destructive/20 border-destructive/40 font-bold',
};

const CATS = ['all','auth','navigation','bot','scan','cheater','mod','admin','webhook','profile','search','system','error'];

export default function ActivityFeed() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: 'all', severity: 'all', q: '' });
  const confirm = useConfirm();

  useEffect(() => { fetchEntries(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('activity-log-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
        setEntries((prev) => [payload.new as Entry, ...prev].slice(0, 200));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error('Failed to load activity');
    else setEntries(data || []);
    setLoading(false);
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Delete entire activity log?',
      description: 'Alle activity log entries fjernes permanent. Dette kan ikke fortrydes.',
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
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `activity-log-${new Date().toISOString().slice(0,19)}.json`;
    a.click();
  };

  const filtered = entries.filter(e => {
    if (filter.category !== 'all' && e.category !== filter.category) return false;
    if (filter.severity !== 'all' && e.severity !== filter.severity) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      const hay = `${e.action} ${e.description||''} ${e.user_email||''} ${e.page_path||''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground/70">Live feed: login, scans, uploads, navigation, errors and more.</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchEntries} className="gap-1"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
          <Button variant="ghost" size="sm" onClick={exportJson} className="gap-1"><Download className="w-3.5 h-3.5" />Export</Button>
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-destructive"><Trash2 className="w-3.5 h-3.5" />Clear</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="Search…" className="pl-8" />
        </div>
        <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filter.severity} onValueChange={(v) => setFilter({ ...filter, severity: v })}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/30 bg-card/30 px-6 py-12 text-center">
          <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/20 bg-card/30 overflow-hidden">
          <div className="divide-y divide-border/10 max-h-[600px] overflow-y-auto">
            {filtered.map(e => (
              <div key={e.id} className="px-4 py-3 hover:bg-muted/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor[e.severity] || severityColor.info}`}>{e.severity}</span>
                      <Badge variant="outline" className="text-[10px]">{e.category}</Badge>
                      <span className="text-sm font-medium">{e.action}</span>
                    </div>
                    {e.description && <p className="text-xs text-muted-foreground/70 mt-1">{e.description}</p>}
                    <div className="text-[11px] text-muted-foreground/50 mt-1.5 flex flex-wrap gap-3">
                      {e.user_email && <span>👤 {e.user_email}</span>}
                      {e.page_path && <span>📍 {e.page_path}</span>}
                      <span>🕐 {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                    </div>
                    {e.metadata && (
                      <details className="mt-1.5">
                        <summary className="text-[10px] text-muted-foreground/60 cursor-pointer">metadata</summary>
                        <pre className="text-[10px] bg-muted/10 rounded p-2 mt-1 overflow-x-auto">{JSON.stringify(e.metadata, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
