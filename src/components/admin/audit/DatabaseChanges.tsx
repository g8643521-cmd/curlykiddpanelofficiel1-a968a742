import { useState, useEffect } from 'react';
import { RefreshCw, Loader2, Filter, Shield, Settings, Package, Bot, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
}

const TABLE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  cheater_reports: { icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  user_roles: { icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  admin_settings: { icon: <Settings className="w-3.5 h-3.5" />, color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  fivem_mods: { icon: <Package className="w-3.5 h-3.5" />, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  discord_bot_servers: { icon: <Bot className="w-3.5 h-3.5" />, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  profiles: { icon: <UserCircle className="w-3.5 h-3.5" />, color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  insert: { label: 'Created', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  update: { label: 'Updated', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  delete: { label: 'Deleted', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

function actionStyle(action: string) {
  const a = action.toLowerCase();
  if (ACTION_LABELS[a]) return ACTION_LABELS[a];
  if (a.includes('delete') || a.includes('remove')) return { label: action, color: 'text-red-400 bg-red-500/10 border-red-500/20' };
  if (a.includes('update') || a.includes('edit') || a.includes('change')) return { label: action, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
  if (a.includes('upload') || a.includes('create') || a.includes('insert') || a.includes('add')) return { label: action, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  return { label: action, color: 'text-muted-foreground bg-secondary/30 border-border/20' };
}

function summarizeChange(entry: AuditEntry): string {
  const { table_name, new_data, old_data } = entry;
  const data = new_data || old_data;
  if (!data) return `${table_name} record`;
  switch (table_name) {
    case 'cheater_reports': return data.player_name ? `${data.player_name} — ${data.status || 'pending'}` : 'Cheater report';
    case 'user_roles': return `${data.role} role`;
    case 'admin_settings': return data.key || 'Setting';
    case 'fivem_mods': return data.name || 'Mod';
    case 'discord_bot_servers': return data.guild_name || data.guild_id || 'Server';
    case 'profiles': return data.display_name || data.email || 'Profile';
    default: return `${table_name} record`;
  }
}

export default function DatabaseChanges() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTable, setFilterTable] = useState<string | 'all'>('all');
  const [filterAction, setFilterAction] = useState<string | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setEntries(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = entries.filter(e =>
    (filterTable === 'all' || e.table_name === filterTable) &&
    (filterAction === 'all' || e.action === filterAction)
  );

  const activeTables = [...new Set(entries.map(e => e.table_name))];
  const activeActions = [...new Set(entries.map(e => e.action))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground/70">Before/after snapshots of every change in the database</p>
        <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={isLoading} className="gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilterTable('all')} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${filterTable === 'all' ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
          All ({entries.length})
        </button>
        {activeTables.map(table => {
          const count = entries.filter(e => e.table_name === table).length;
          return (
            <button key={table} onClick={() => setFilterTable(table)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${filterTable === table ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
              {table.replace(/_/g, ' ')} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex gap-1.5">
        {['all', ...activeActions].map(action => {
          const count = action === 'all' ? entries.length : entries.filter(e => e.action === action).length;
          const actionInfo = action === 'all' ? null : actionStyle(action);
          return (
            <button key={action} onClick={() => setFilterAction(action)} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
              filterAction === action
                ? (actionInfo?.color || 'bg-primary/15 text-primary border-primary/30')
                : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 border-transparent'
            }`}>
              {action === 'all' ? 'All Actions' : actionInfo?.label || action} ({count})
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading audit log...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No audit entries found</div>
      ) : (
        <ScrollArea className="max-h-[520px]">
          <div className="space-y-1">
            {filtered.map((entry) => {
              const tableConfig = TABLE_ICONS[entry.table_name] || { icon: <Filter className="w-3.5 h-3.5" />, color: 'bg-secondary/30 text-muted-foreground border-border/20' };
              const actionInfo = actionStyle(entry.action);
              const isExpanded = expanded === entry.id;
              return (
                <div key={entry.id}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${tableConfig.color}`}>
                      {tableConfig.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                        <span className="text-xs text-foreground truncate">{summarizeChange(entry)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{entry.table_name}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-10 mr-3 mb-2 p-3 rounded-lg bg-secondary/10 border border-border/10 text-[11px] font-mono space-y-2 overflow-x-auto">
                      {entry.old_data && entry.new_data && (
                        <div>
                          <p className="text-muted-foreground/60 mb-1 font-sans text-[10px] uppercase tracking-wider">Before</p>
                          <pre className="text-red-400/80 whitespace-pre-wrap break-all">{JSON.stringify(entry.old_data, null, 2)}</pre>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground/60 mb-1 font-sans text-[10px] uppercase tracking-wider">
                          {!entry.new_data && entry.old_data ? 'Deleted data' : entry.old_data && entry.new_data ? 'After' : 'Data'}
                        </p>
                        <pre className="text-emerald-400/80 whitespace-pre-wrap break-all">
                          {JSON.stringify(entry.new_data || entry.old_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
