import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, Loader2, Database, FileJson, FileSpreadsheet, CheckCircle2, Shield, Clock, HardDrive, Table2, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const FALLBACK_TABLES = [
  'admin_settings', 'audit_log', 'bot_detected_cheaters', 'bot_server_settings',
  'cheater_reports', 'discord_alerted_members', 'discord_bot_servers',
  'discord_member_joins', 'fivem_mods', 'mod_categories',
  'notification_settings', 'profiles', 'scan_history', 'search_history',
  'server_favorites', 'server_shares', 'user_roles', 'visitor_logs',
];

const DatabaseExportPanel = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [importResult, setImportResult] = useState<{ tables: number; rows: number; tableResults?: Array<{ table: string; rows: number }>; ignoredKeys?: string[] } | null>(null);
  const [tables, setTables] = useState<string[]>(FALLBACK_TABLES);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_tables');
        if (!error && data && Array.isArray(data)) {
          const tableNames = data.map((r: any) => r.table_name || r).filter(Boolean).sort();
          if (tableNames.length > 0) setTables(tableNames);
        }
      } catch {
        // Use fallback
      }
      setIsLoadingTables(false);
    };
    fetchTables();
  }, []);

  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  const fetchCounts = useCallback(async (tableList: string[]) => {
    setIsLoadingCounts(true);
    const results = await Promise.all(
      tableList.map(async (table) => {
        try {
          const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
          return [table, count || 0] as const;
        } catch {
          return [table, 0] as const;
        }
      })
    );
    setTableCounts(Object.fromEntries(results));
    setIsLoadingCounts(false);
  }, []);

  useEffect(() => {
    if (!isLoadingTables) fetchCounts(tables);
  }, [tables, isLoadingTables, fetchCounts]);

  const totalRows = Object.values(tableCounts).reduce((a, b) => a + b, 0);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-database', {
        body: { tables, format },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Export failed');
        setIsExporting(false);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `curlykidd-full-backup-${timestamp}.json`);
      } else {
        for (const [table, csvString] of Object.entries(data as Record<string, string>)) {
          if (!csvString) continue;
          const blob = new Blob([csvString], { type: 'text/csv' });
          downloadBlob(blob, `${table}-${timestamp}.csv`);
        }
      }

      const authCount = data?._auth_users?.length ?? 0;
      const storageCount = data?._storage ? Object.values(data._storage).reduce((sum: number, files: any) => sum + (Array.isArray(files) ? files.length : 0), 0) : 0;
      toast.success(`Full backup exported: ${tables.length} tables, ${authCount} users, ${storageCount} storage files`);
    } catch {
      toast.error('Export failed');
    }
    setIsExporting(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Only JSON backup files are supported for import');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (typeof parsed !== 'object' || parsed === null) {
        toast.error('Invalid backup file format');
        setIsImporting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('import-database', {
        body: { backup: parsed },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Import failed');
        setIsImporting(false);
        return;
      }

      const importedTables = Number(data?.tablesImported ?? 0);
      const importedRows = Number(data?.rowsImported ?? 0);
      const tableResults = data?.tableResults as Array<{ table: string; rows: number }> | undefined;
      const ignoredKeys = data?.ignoredKeys as string[] | undefined;

      setImportResult({ tables: importedTables, rows: importedRows, tableResults, ignoredKeys });
      toast.success(`Imported ${importedTables} tables and ${importedRows.toLocaleString()} rows`);

      await fetchCounts(tables);
    } catch {
      toast.error('Failed to parse backup file');
    }

    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="border-b border-border/20 px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--purple))]/20 bg-[hsl(var(--purple))]/10 text-[hsl(var(--purple))] shadow-sm">
            <Database className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-1 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--purple))]/70">Data Management</p>
            <h3 className="text-sm font-semibold text-foreground">Database Backup & Recovery</h3>
            <p className="text-xs text-muted-foreground">Export live data, restore from backups, and manage your database with confidence.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCounts(tables)}
            disabled={isLoadingCounts}
            className="h-8 rounded-lg text-xs font-semibold border-border/40 shrink-0 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCounts ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 text-center">
            <Table2 className="h-4 w-4 mx-auto text-primary mb-1" />
            {isLoadingTables ? (
              <div className="h-6 w-10 mx-auto rounded bg-muted/40 animate-pulse my-0.5" />
            ) : (
              <p className="text-lg font-bold text-foreground tabular-nums">{tables.length}</p>
            )}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tables</p>
          </div>
          <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 text-center">
            <HardDrive className="h-4 w-4 mx-auto text-primary mb-1" />
            {isLoadingCounts ? (
              <div className="h-6 w-16 mx-auto rounded bg-muted/40 animate-pulse my-0.5" />
            ) : (
              <p className="text-lg font-bold text-foreground tabular-nums">{totalRows.toLocaleString()}</p>
            )}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Rows</p>
          </div>
          <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 text-center">
            <Shield className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">RLS</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Protected</p>
          </div>
          <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">Live</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Export Format</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setFormat('json')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  format === 'json'
                    ? 'bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))] ring-1 ring-[hsl(var(--purple))]/30'
                    : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <FileJson className="h-4 w-4" />
                JSON
              </button>
              <button
                onClick={() => setFormat('csv')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  format === 'csv'
                    ? 'bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))] ring-1 ring-[hsl(var(--purple))]/30'
                    : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="h-11 rounded-xl font-semibold shadow-lg shadow-primary/20"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExporting ? 'Exporting…' : 'Export Data'}
              </Button>
              <Button
                variant="outline"
                onClick={handleImportClick}
                disabled={isImporting}
                className="h-11 rounded-xl font-semibold border-border/40"
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isImporting ? 'Importing…' : 'Import Backup'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">How It Works</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Download className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <span><strong className="text-foreground">Export</strong> downloads a snapshot of your live database in JSON or CSV format.</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <span><strong className="text-foreground">Import</strong> runs server-side, restores every included table, and temporarily suspends foreign-key enforcement during restore.</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <span><strong className="text-foreground">Safety</strong> — constraints are restored automatically after import completes.</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <span><strong className="text-foreground">Full Backup</strong> — table data is restored even when related auth users are missing in the new environment.</span>
              </div>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelected}
          className="hidden"
        />

        {importResult && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                Import complete — {importResult.tables} table{importResult.tables !== 1 ? 's' : ''}, {importResult.rows.toLocaleString()} rows restored
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportResult(null);
                  handleImportClick();
                }}
                className="h-8 rounded-lg text-xs font-semibold border-border/40"
              >
                <Upload className="h-3.5 w-3.5" />
                Restart Import
              </Button>
            </div>

            {importResult.tableResults && importResult.tableResults.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                {importResult.tableResults.map((t) => (
                  <div key={t.table} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                    <span className="text-[11px] font-mono text-muted-foreground truncate">{t.table}</span>
                    <span className={`text-[10px] font-bold ml-2 shrink-0 ${t.rows > 0 ? 'text-primary' : 'text-muted-foreground/50'}`}>
                      {t.rows > 0 ? `+${t.rows.toLocaleString()}` : '0'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {importResult.ignoredKeys && importResult.ignoredKeys.length > 0 && (
              <div className="rounded-lg bg-secondary/30 border border-border/20 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Backup metadata (not imported to tables)</p>
                {importResult.ignoredKeys.map((key) => (
                  <div key={key} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                    <span>
                      <strong className="text-foreground font-mono">{key}</strong>
                      {' — '}
                      {key === '_export_metadata' && 'Timestamp and info about when the backup was created.'}
                      {key === '_auth_users' && 'User accounts from the original database. These cannot be imported automatically — users must create new accounts.'}
                      {key === '_storage' && 'File metadata from storage buckets. Files must be uploaded separately.'}
                      {!['_export_metadata', '_auth_users', '_storage'].includes(key) && 'Unknown metadata key, ignored.'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl bg-secondary/20 border border-border/20 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
            Included Tables ({tables.length})
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {tables.map((t) => (
              <div key={t} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <span className="text-[11px] font-mono text-muted-foreground truncate">{t}</span>
                {tableCounts[t] !== undefined && (
                  <span className="text-[10px] font-semibold text-foreground/60 ml-2 shrink-0">
                    {tableCounts[t]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default DatabaseExportPanel;
