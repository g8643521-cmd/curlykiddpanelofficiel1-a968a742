import { useState } from 'react';
import { format, subDays, subMonths } from 'date-fns';
import { Download, FileJson, FileSpreadsheet, Loader2, Calendar, Server, Filter, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type DataSet = 'cheaters' | 'joins';
type ExportFormat = 'csv' | 'json';
type DateRange = '7d' | '30d' | '90d' | 'all' | 'custom';

interface BotExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: { guild_id: string; guild_name: string | null }[];
}

export default function BotExportDialog({ open, onOpenChange, servers }: BotExportDialogProps) {
  const [datasets, setDatasets] = useState<Record<DataSet, boolean>>({ cheaters: true, joins: true });
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const [cheatersOnly, setCheatersOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ name: string; size: string; url: string }[] | null>(null);

  const getDateFilter = (): string | null => {
    const now = new Date();
    switch (dateRange) {
      case '7d': return subDays(now, 7).toISOString();
      case '30d': return subMonths(now, 1).toISOString();
      case '90d': return subMonths(now, 3).toISOString();
      case 'custom': return customFrom ? new Date(customFrom).toISOString() : null;
      default: return null;
    }
  };

  const getDateTo = (): string | null => {
    if (dateRange === 'custom' && customTo) return new Date(customTo + 'T23:59:59').toISOString();
    return null;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const toCsv = (rows: Record<string, any>[]) => {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const v = r[h];
        const s = v === null || v === undefined ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
    ];
    return lines.join('\n');
  };

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { name: filename, size: formatSize(blob.size), url: '' };
  };

  const handleExport = async () => {
    const activeSets = Object.entries(datasets).filter(([, v]) => v).map(([k]) => k as DataSet);
    if (activeSets.length === 0) { toast.error('Select at least one dataset'); return; }

    setIsExporting(true);
    setExportResult(null);
    const results: { name: string; size: string; url: string }[] = [];
    const dateFrom = getDateFilter();
    const dateTo = getDateTo();
    const ts = format(new Date(), 'yyyy-MM-dd_HHmm');

    try {
      for (const ds of activeSets) {
        const table = ds === 'cheaters' ? 'bot_detected_cheaters' : 'discord_member_joins';
        const dateCol = ds === 'cheaters' ? 'detected_at' : 'logged_at';

        let query = supabase.from(table).select('*').order(dateCol, { ascending: false }).limit(5000);
        if (dateFrom) query = query.gte(dateCol, dateFrom);
        if (dateTo) query = query.lte(dateCol, dateTo);
        if (selectedServer !== 'all') query = query.eq('guild_id', selectedServer);
        if (ds === 'joins' && cheatersOnly) query = query.eq('is_cheater', true);

        const { data, error } = await query;
        if (error) { toast.error(`Failed to fetch ${ds}: ${error.message}`); continue; }
        if (!data || data.length === 0) { toast.info(`No ${ds} data to export`); continue; }

        const filename = `curlykidd_${ds}_${ts}.${exportFormat}`;
        if (exportFormat === 'json') {
          results.push(downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json'));
        } else {
          results.push(downloadBlob(toCsv(data), filename, 'text/csv'));
        }
      }

      if (results.length > 0) {
        setExportResult(results);
        toast.success(`Exported ${results.length} file(s)`);
      }
    } catch {
      toast.error('Export failed');
    }
    setIsExporting(false);
  };

  const totalActive = Object.values(datasets).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Export bot detection data and server join logs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Datasets */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Datasets</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'cheaters' as DataSet, label: 'Detected Cheaters', icon: '🚨' },
                { key: 'joins' as DataSet, label: 'Server Joins', icon: '👥' },
              ]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setDatasets(d => ({ ...d, [key]: !d[key] }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    datasets[key]
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/30 bg-card/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className="text-xs font-medium text-foreground">{label}</span>
                    {datasets[key] && <CheckCircle className="w-3.5 h-3.5 text-primary ml-auto" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Format</Label>
            <div className="flex gap-2">
              {([
                { key: 'csv' as ExportFormat, label: 'CSV', icon: FileSpreadsheet, desc: 'Excel-compatible' },
                { key: 'json' as ExportFormat, label: 'JSON', icon: FileJson, desc: 'Developer-friendly' },
              ]).map(({ key, label, icon: Icon, desc }) => (
                <button
                  key={key}
                  onClick={() => setExportFormat(key)}
                  className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                    exportFormat === key
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/30 bg-card/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${exportFormat === key ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <span className="text-xs font-medium text-foreground block">{label}</span>
                      <span className="text-[10px] text-muted-foreground">{desc}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Date Range
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: '7d' as DateRange, label: '7 days' },
                { key: '30d' as DateRange, label: '30 days' },
                { key: '90d' as DateRange, label: '90 days' },
                { key: 'all' as DateRange, label: 'All time' },
                { key: 'custom' as DateRange, label: 'Custom' },
              ]).map(({ key, label }) => (
                <Button
                  key={key}
                  variant={dateRange === key ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setDateRange(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">From</Label>
                  <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            )}
          </div>

          {/* Server Filter */}
          {servers.length > 1 && (
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Server className="w-3 h-3" /> Server
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={selectedServer === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setSelectedServer('all')}
                >
                  All Servers
                </Button>
                {servers.map(s => (
                  <Button
                    key={s.guild_id}
                    variant={selectedServer === s.guild_id ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setSelectedServer(s.guild_id)}
                  >
                    {s.guild_name || s.guild_id}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Joins filter */}
          {datasets.joins && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/30">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground">Joins: cheaters only</span>
              </div>
              <Switch checked={cheatersOnly} onCheckedChange={setCheatersOnly} />
            </div>
          )}

          {/* Result */}
          {exportResult && (
            <div className="space-y-2">
              {exportResult.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground block truncate">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground">{f.size}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleExport} disabled={isExporting || totalActive === 0} className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export {totalActive} dataset{totalActive !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
