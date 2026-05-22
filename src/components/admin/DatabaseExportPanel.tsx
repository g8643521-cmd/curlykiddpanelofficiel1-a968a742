import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Download, Upload, Loader2, Database, FileJson, FileSpreadsheet, CheckCircle2, Shield,
  HardDrive, Table2, Info, RefreshCw, AlertTriangle, TimerOff, Search, Lock, Unlock, FileArchive,
  Hash, History, Eye, Trash2, FileWarning, Sparkles, Check, X, ChevronRight,
  ShieldAlert, Zap, Calendar, FileCheck2, GitCompareArrows, BellRing, Heart, Activity,
  FileSearch, Pencil, Copy as CopyIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuthReady } from '@/hooks/useAuthReady';

const FALLBACK_TABLES = [
  'admin_settings', 'audit_log', 'bot_detected_cheaters', 'bot_server_settings',
  'cheater_reports', 'discord_alerted_members', 'discord_bot_servers',
  'discord_member_joins', 'fivem_mods', 'mod_categories',
  'notification_settings', 'profiles', 'scan_history', 'search_history',
  'server_favorites', 'server_shares', 'user_roles', 'visitor_logs',
];

const SYSTEM_TABLE_PREFIXES = ['admin_', 'audit_', 'user_roles', 'server_creation_keys'];

type ConflictStrategy = 'upsert' | 'skip' | 'replace';
type TableError = { type: 'timeout' | 'error'; message: string; durationMs: number; at: string };
type BackupHistoryEntry = {
  id: string;
  filename: string;
  createdAt: string;
  tableCount: number;
  rowCount: number;
  sizeBytes: number;
  format: 'json' | 'csv';
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
  tables?: string[];
  rawBytes?: number;
  note?: string;
};
type ImportPreview = {
  dryRun: boolean;
  strategy: ConflictStrategy;
  tablesImported: number;
  rowsImported: number;
  tableResults: Array<{ table: string; rows: number; errors?: number }>;
  ignoredKeys: string[];
};
type VerifyResult = {
  filename: string;
  sizeBytes: number;
  checksum: string;
  expected?: string;
  match?: boolean;
  format: 'json' | 'gzip' | 'encrypted' | 'unknown';
  tables?: string[];
  rowCount?: number;
  parsedOk?: boolean;
  error?: string;
};
type ScheduleConfig = {
  enabled: boolean;
  intervalDays: number;
  lastReminderAt: string | null;
};

const HISTORY_KEY = 'ck_backup_history_v1';
const SCHEDULE_KEY = 'ck_backup_schedule_v1';
const MAX_HISTORY = 25;

// ---------- Utilities ----------
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buf =
    typeof data === 'string' ? new TextEncoder().encode(data) :
    data instanceof Uint8Array ? data : new Uint8Array(data);
  const hash = await crypto.subtle.digest('SHA-256', buf as any);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function gzipCompress(input: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([input as BlobPart]).stream().pipeThrough(new (window as any).CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function gzipDecompress(input: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([input as BlobPart]).stream().pipeThrough(new (window as any).DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 200_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptPayload(plain: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource));
  // Format: magic(4) | salt(16) | iv(12) | ct
  const magic = new TextEncoder().encode('CKE1');
  const out = new Uint8Array(magic.length + salt.length + iv.length + ct.length);
  out.set(magic, 0);
  out.set(salt, 4);
  out.set(iv, 20);
  out.set(ct, 32);
  return out;
}

async function decryptPayload(blob: Uint8Array, password: string): Promise<Uint8Array> {
  const magic = new TextDecoder().decode(blob.slice(0, 4));
  if (magic !== 'CKE1') throw new Error('Not an encrypted CurlyKidd backup');
  const salt = blob.slice(4, 20);
  const iv = blob.slice(20, 32);
  const ct = blob.slice(32);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
  return new Uint8Array(plain);
}

function loadHistory(): BackupHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(entries: BackupHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Component ----------
const DatabaseExportPanel = () => {
  const { isReady, isAuthenticated } = useAuthReady();

  // Core
  const [tables, setTables] = useState<string[]>(FALLBACK_TABLES);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [tableErrors, setTableErrors] = useState<Record<string, TableError>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  // Selection
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'user' | 'system' | 'empty' | 'failing'>('all');

  // Export options
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [compress, setCompress] = useState(true);
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  // Import
  const [isImporting, setIsImporting] = useState(false);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('upsert');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingBackup, setPendingBackup] = useState<any | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>('');
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History
  const [history, setHistory] = useState<BackupHistoryEntry[]>(() => loadHistory());

  // ----- Data loading -----
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) { setIsLoadingTables(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_tables');
        if (!error && data && Array.isArray(data)) {
          const names = data.map((r: any) => r.table_name || r).filter(Boolean).sort();
          if (names.length > 0) setTables(names);
        }
      } catch { /* fallback */ }
      setIsLoadingTables(false);
    })();
  }, [isAuthenticated, isReady]);

  // Default selection = all tables once loaded
  useEffect(() => {
    if (!isLoadingTables && selectedTables.size === 0) {
      setSelectedTables(new Set(tables));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingTables, tables]);

  const fetchCounts = useCallback(async (tableList: string[]) => {
    setIsLoadingCounts(true);
    const errors: Record<string, TableError> = {};
    try {
      const results = await Promise.all(tableList.map(async (table) => {
        const start = performance.now();
        try {
          const countPromise = supabase.from(table).select('*', { count: 'exact', head: true }).then((res: any) => {
            if (res.error) throw res.error; return res;
          });
          const res: any = await Promise.race([
            countPromise,
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Query exceeded 8s timeout')), 8000)),
          ]);
          return [table, res?.count || 0] as const;
        } catch (e: any) {
          const durationMs = Math.round(performance.now() - start);
          const message = e?.message || String(e) || 'Unknown error';
          errors[table] = {
            type: message.toLowerCase().includes('timeout') ? 'timeout' : 'error',
            message, durationMs, at: new Date().toISOString(),
          };
          return [table, 0] as const;
        }
      }));
      setTableCounts(Object.fromEntries(results));
      setTableErrors(errors);
    } finally { setIsLoadingCounts(false); }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && !isLoadingTables) fetchCounts(tables);
  }, [tables, isLoadingTables, fetchCounts, isAuthenticated, isReady]);

  // ----- Derived -----
  const totalRows = useMemo(() => Object.values(tableCounts).reduce((a, b) => a + b, 0), [tableCounts]);
  const selectedRows = useMemo(
    () => Array.from(selectedTables).reduce((sum, t) => sum + (tableCounts[t] || 0), 0),
    [selectedTables, tableCounts],
  );
  const estimatedSize = useMemo(() => selectedRows * 512, [selectedRows]); // ~512B per row heuristic

  const filteredTables = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    return tables.filter(t => {
      if (q && !t.toLowerCase().includes(q)) return false;
      const isSystem = SYSTEM_TABLE_PREFIXES.some(p => t.startsWith(p));
      if (filterMode === 'system' && !isSystem) return false;
      if (filterMode === 'user' && isSystem) return false;
      if (filterMode === 'empty' && (tableCounts[t] || 0) > 0) return false;
      if (filterMode === 'failing' && !tableErrors[t]) return false;
      return true;
    });
  }, [tables, tableFilter, filterMode, tableCounts, tableErrors]);

  const toggleTable = (t: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };
  const selectAll = () => setSelectedTables(new Set(tables));
  const selectNone = () => setSelectedTables(new Set());
  const selectVisible = () => setSelectedTables(prev => {
    const next = new Set(prev); filteredTables.forEach(t => next.add(t)); return next;
  });
  const invertSelection = () => setSelectedTables(prev => {
    const next = new Set<string>();
    tables.forEach(t => { if (!prev.has(t)) next.add(t); });
    return next;
  });

  // ----- Export -----
  const handleExport = async () => {
    if (selectedTables.size === 0) { toast.error('Select at least one table'); return; }
    if (encrypt && password.length < 8) { toast.error('Encryption requires a password (min. 8 chars)'); return; }

    setIsExporting(true);
    setExportProgress('Requesting backup from server…');

    try {
      const tablesToExport = Array.from(selectedTables);
      const { data, error } = await supabase.functions.invoke('export-database', {
        body: { tables: tablesToExport, format },
      });

      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || 'Export failed');
        setIsExporting(false); setExportProgress(''); return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = `curlykidd-backup-${timestamp}`;

      if (format === 'csv') {
        setExportProgress('Writing CSV files…');
        for (const [table, csvString] of Object.entries(data as Record<string, string>)) {
          if (!csvString || typeof csvString !== 'string') continue;
          downloadBlob(new Blob([csvString], { type: 'text/csv' }), `${table}-${timestamp}.csv`);
        }
        toast.success(`Exported ${tablesToExport.length} CSV files`);
        setIsExporting(false); setExportProgress(''); return;
      }

      // JSON path: serialize → checksum → optional gzip → optional encrypt
      setExportProgress('Serializing JSON…');
      const json = JSON.stringify(data, null, 2);
      let bytes: Uint8Array = new TextEncoder().encode(json);
      const rawSize = bytes.length;
      const checksum = await sha256Hex(json);
      let mime = 'application/json';
      let filename = `${baseName}.json`;

      if (compress) {
        setExportProgress('Compressing (gzip)…');
        bytes = await gzipCompress(bytes);
        mime = 'application/gzip';
        filename = `${baseName}.json.gz`;
      }
      if (encrypt) {
        setExportProgress('Encrypting (AES-256-GCM)…');
        bytes = await encryptPayload(bytes, password);
        mime = 'application/octet-stream';
        filename = `${baseName}${compress ? '.json.gz' : '.json'}.enc`;
      }

      const blob = new Blob([bytes as BlobPart], { type: mime });
      downloadBlob(blob, filename);

      // Save sidecar checksum
      const sidecar = JSON.stringify({
        filename, checksum_sha256: checksum, raw_bytes: rawSize, stored_bytes: bytes.length,
        compressed: compress, encrypted: encrypt, created_at: new Date().toISOString(),
        tables: tablesToExport, rows: selectedRows,
      }, null, 2);
      downloadBlob(new Blob([sidecar], { type: 'application/json' }), `${baseName}.manifest.json`);

      // History
      const entry: BackupHistoryEntry = {
        id: crypto.randomUUID(),
        filename, createdAt: new Date().toISOString(),
        tableCount: tablesToExport.length, rowCount: selectedRows,
        sizeBytes: bytes.length, format, compressed: compress, encrypted: encrypt, checksum,
      };
      const next = [entry, ...history];
      setHistory(next); saveHistory(next);

      toast.success(`Backup ready — ${formatBytes(bytes.length)} • SHA-256 ${checksum.slice(0, 8)}…`);
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    }
    setIsExporting(false); setExportProgress('');
  };

  // ----- Import -----
  const triggerFile = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await ingestFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const ingestFile = async (file: File, pw?: string) => {
    setIsImporting(true);
    try {
      let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
      const name = file.name.toLowerCase();

      if (name.endsWith('.enc')) {
        if (!pw) { setNeedsPassword(file); setIsImporting(false); return; }
        try { bytes = await decryptPayload(bytes, pw); }
        catch { toast.error('Decryption failed — wrong password or corrupted file'); setIsImporting(false); return; }
      }
      if (name.includes('.gz') || name.endsWith('.gz.enc') || name.endsWith('.gz')) {
        try { bytes = await gzipDecompress(bytes); } catch { /* maybe already decompressed */ }
      }

      const text = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) {
        toast.error('Invalid backup file'); setIsImporting(false); return;
      }

      setPendingBackup(parsed);
      setPendingFilename(file.name);
      setNeedsPassword(null); setImportPassword('');

      // Auto dry-run preview
      await runDryRun(parsed);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to parse backup file');
    }
    setIsImporting(false);
  };

  const runDryRun = async (backup: any) => {
    const { data, error } = await supabase.functions.invoke('import-database', {
      body: { backup, dryRun: true, strategy: conflictStrategy },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Preview failed'); return;
    }
    setImportPreview(data as ImportPreview);
  };

  const handleConfirmImport = async () => {
    if (!pendingBackup) return;
    if (conflictStrategy === 'replace' && !confirmReplaceOpen) {
      setConfirmReplaceOpen(true); return;
    }
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-database', {
        body: {
          backup: pendingBackup,
          strategy: conflictStrategy,
          tables: Array.from(selectedTables),
        },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || 'Import failed'); setIsImporting(false); return;
      }
      const res = data as ImportPreview;
      toast.success(`Imported ${res.tablesImported} tables • ${res.rowsImported.toLocaleString()} rows (${conflictStrategy})`);
      setImportPreview(res); setPendingBackup(null); setPendingFilename('');
      await fetchCounts(tables);
    } catch (e: any) {
      toast.error(e?.message || 'Import failed');
    }
    setIsImporting(false); setConfirmReplaceOpen(false);
  };

  const clearPending = () => { setPendingBackup(null); setImportPreview(null); setPendingFilename(''); };

  const removeHistoryEntry = (id: string) => {
    const next = history.filter(h => h.id !== id);
    setHistory(next); saveHistory(next);
  };
  const clearHistory = () => { setHistory([]); saveHistory([]); toast.success('History cleared'); };

  // ----- Render -----
  return (
    <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/20 px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--purple))]/20 bg-[hsl(var(--purple))]/10 text-[hsl(var(--purple))] shadow-sm">
            <Database className="h-5 w-5" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--purple))]/70">Data Management</p>
              <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-bold border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                ENTERPRISE
              </Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Database Backup &amp; Recovery
              <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--purple))]" />
            </h3>
            <p className="text-xs text-muted-foreground">
              Encrypted backups, gzip compression, SHA-256 verification, selective restore and dry-run preview.
            </p>
          </div>
          <Button
            variant="outline" size="sm" onClick={() => fetchCounts(tables)} disabled={isLoadingCounts}
            className="h-8 rounded-lg text-xs font-semibold border-border/40 shrink-0 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCounts ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={<Table2 className="h-4 w-4" />} label="Tables" value={isLoadingTables ? null : tables.length} />
          <StatCard icon={<Check className="h-4 w-4" />} label="Selected" value={selectedTables.size} accent />
          <StatCard icon={<HardDrive className="h-4 w-4" />} label="Total Rows" value={isLoadingCounts ? null : totalRows.toLocaleString()} />
          <StatCard icon={<FileArchive className="h-4 w-4" />} label="Est. Size" value={formatBytes(estimatedSize)} />
          <StatCard icon={<Shield className="h-4 w-4" />} label="RLS" value="Protected" />
        </div>
      </div>

      {/* Tabs */}
      <div className="p-6">
        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="export" className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Import</TabsTrigger>
            <TabsTrigger value="tables" className="gap-1.5"><Table2 className="h-3.5 w-3.5" />Tables</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" />History
              {history.length > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">{history.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* === EXPORT === */}
          <TabsContent value="export" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Format & options */}
              <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-4">
                <SectionLabel icon={<FileJson className="h-3 w-3" />}>Output Format</SectionLabel>
                <div className="flex gap-2">
                  <FormatButton active={format === 'json'} onClick={() => setFormat('json')} icon={<FileJson className="h-4 w-4" />} label="JSON" desc="Full backup" />
                  <FormatButton active={format === 'csv'} onClick={() => setFormat('csv')} icon={<FileSpreadsheet className="h-4 w-4" />} label="CSV" desc="Per-table files" />
                </div>

                <div className="border-t border-border/20 pt-4 space-y-3">
                  <SectionLabel icon={<Zap className="h-3 w-3" />}>Processing Pipeline</SectionLabel>
                  <ToggleRow
                    icon={<FileArchive className="h-4 w-4 text-emerald-400" />}
                    title="GZIP Compression" desc="~70% smaller. Recommended for large backups."
                    checked={compress} onCheckedChange={setCompress} disabled={format === 'csv'}
                  />
                  <ToggleRow
                    icon={<Lock className="h-4 w-4 text-amber-400" />}
                    title="AES-256-GCM Encryption" desc="Password-protected backup. Sidecar manifest stays clear."
                    checked={encrypt} onCheckedChange={setEncrypt} disabled={format === 'csv'}
                  />
                  {encrypt && (
                    <div className="space-y-1.5 pl-7">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Password (min. 8 chars)</Label>
                      <Input
                        type="password" value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Choose a strong passphrase"
                        className="h-8 text-xs bg-background/60"
                      />
                      <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Lost passwords cannot be recovered. Store it in a password manager.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary & action */}
              <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-4 flex flex-col">
                <SectionLabel icon={<FileCheck2 className="h-3 w-3" />}>Backup Summary</SectionLabel>
                <div className="space-y-2 text-xs flex-1">
                  <SummaryRow label="Tables to export" value={`${selectedTables.size} / ${tables.length}`} />
                  <SummaryRow label="Rows" value={selectedRows.toLocaleString()} />
                  <SummaryRow label="Estimated size" value={formatBytes(estimatedSize)} />
                  <SummaryRow label="Format" value={format.toUpperCase()} />
                  <SummaryRow label="Pipeline" value={[format === 'json' ? 'JSON' : 'CSV', compress && format === 'json' ? 'GZIP' : null, encrypt && format === 'json' ? 'AES-256' : null].filter(Boolean).join(' → ')} />
                  <SummaryRow label="Integrity" value="SHA-256 manifest" />
                </div>
                <Button
                  onClick={handleExport}
                  disabled={isExporting || selectedTables.size === 0}
                  className="h-11 rounded-xl font-semibold shadow-lg shadow-primary/20 w-full"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  {isExporting ? (exportProgress || 'Exporting…') : `Export ${selectedTables.size} table${selectedTables.size !== 1 ? 's' : ''}`}
                </Button>
                {selectedTables.size === 0 && (
                  <p className="text-[10px] text-amber-400/80 flex items-center gap-1 -mt-2">
                    <Info className="h-3 w-3" /> Select tables in the Tables tab first.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* === IMPORT === */}
          <TabsContent value="import" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-4">
                <SectionLabel icon={<GitCompareArrows className="h-3 w-3" />}>Conflict Strategy</SectionLabel>
                <div className="grid grid-cols-1 gap-2">
                  <StrategyOption
                    active={conflictStrategy === 'upsert'} onClick={() => setConflictStrategy('upsert')}
                    icon={<RefreshCw className="h-4 w-4 text-primary" />}
                    title="Upsert (recommended)"
                    desc="Insert new rows, update existing ones by primary key."
                  />
                  <StrategyOption
                    active={conflictStrategy === 'skip'} onClick={() => setConflictStrategy('skip')}
                    icon={<ChevronRight className="h-4 w-4 text-emerald-400" />}
                    title="Insert only"
                    desc="Skip any rows that already exist. Safe — non-destructive."
                  />
                  <StrategyOption
                    active={conflictStrategy === 'replace'} onClick={() => setConflictStrategy('replace')}
                    icon={<Trash2 className="h-4 w-4 text-destructive" />}
                    title="Replace (destructive)"
                    desc="Truncate target tables before restoring. Requires confirmation."
                    danger
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-4 flex flex-col">
                <SectionLabel icon={<Upload className="h-3 w-3" />}>Backup File</SectionLabel>

                {!pendingBackup ? (
                  <button
                    onClick={triggerFile} disabled={isImporting}
                    className="flex-1 min-h-[140px] rounded-xl border-2 border-dashed border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-center px-4"
                  >
                    {isImporting ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    )}
                    <p className="text-xs font-semibold text-foreground">Select backup file</p>
                    <p className="text-[10px] text-muted-foreground">.json, .json.gz, .json.gz.enc — auto-detected</p>
                  </button>
                ) : (
                  <div className="flex-1 rounded-lg bg-background/40 border border-border/30 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-foreground truncate">{pendingFilename}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Ready to restore</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearPending}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {importPreview && (
                      <div className="text-[10px] grid grid-cols-2 gap-1 pt-2 border-t border-border/20">
                        <span className="text-muted-foreground">Tables</span>
                        <span className="text-right font-semibold text-foreground">{importPreview.tablesImported}</span>
                        <span className="text-muted-foreground">Rows</span>
                        <span className="text-right font-semibold text-foreground">{importPreview.rowsImported.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                <input ref={fileInputRef} type="file" accept=".json,.gz,.enc" onChange={handleFileSelected} className="hidden" />

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={triggerFile} disabled={isImporting} className="h-10 rounded-lg text-xs">
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> {pendingBackup ? 'Replace file' : 'Choose file'}
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={!pendingBackup || isImporting}
                    className={`h-10 rounded-lg text-xs font-semibold ${conflictStrategy === 'replace' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                  >
                    {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                    Run import
                  </Button>
                </div>
              </div>
            </div>

            {importPreview && pendingBackup && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Eye className="h-4 w-4" />
                  Dry-run preview — {importPreview.tablesImported} tables, {importPreview.rowsImported.toLocaleString()} rows
                </div>
                <p className="text-[11px] text-muted-foreground">
                  No data has been written yet. Review per-table counts below, then click "Run import" to apply.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {importPreview.tableResults.map(t => (
                    <div key={t.table} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2">
                      <span className="text-[11px] font-mono text-muted-foreground truncate">{t.table}</span>
                      <span className="text-[10px] font-bold ml-2 shrink-0 text-primary">+{t.rows.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* === TABLES === */}
          <TabsContent value="tables" className="space-y-4 mt-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={tableFilter} onChange={e => setTableFilter(e.target.value)}
                  placeholder="Filter tables…" className="h-8 pl-8 text-xs bg-background/40"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'user', 'system', 'empty', 'failing'] as const).map(m => (
                  <Button key={m} variant={filterMode === m ? 'default' : 'outline'} size="sm"
                    className="h-8 text-[10px] capitalize" onClick={() => setFilterMode(m)}>
                    {m}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1 ml-auto">
                <Button variant="outline" size="sm" onClick={selectAll} className="h-8 text-[10px]">All</Button>
                <Button variant="outline" size="sm" onClick={selectVisible} className="h-8 text-[10px]">Visible</Button>
                <Button variant="outline" size="sm" onClick={invertSelection} className="h-8 text-[10px]">Invert</Button>
                <Button variant="outline" size="sm" onClick={selectNone} className="h-8 text-[10px]">None</Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/30 overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 font-semibold">Table</th>
                      <th className="px-3 py-2 font-semibold text-right">Rows</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTables.map(t => {
                      const isSystem = SYSTEM_TABLE_PREFIXES.some(p => t.startsWith(p));
                      const err = tableErrors[t];
                      const selected = selectedTables.has(t);
                      return (
                        <tr key={t} className={`border-t border-border/20 hover:bg-secondary/30 cursor-pointer ${selected ? 'bg-primary/5' : ''}`}
                            onClick={() => toggleTable(t)}>
                          <td className="px-3 py-2">
                            <div className={`h-4 w-4 rounded border flex items-center justify-center ${selected ? 'bg-primary border-primary' : 'border-border/60'}`}>
                              {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-foreground">{t}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {tableCounts[t]?.toLocaleString() ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={`h-4 px-1.5 text-[9px] ${isSystem ? 'border-amber-500/30 text-amber-400' : 'border-emerald-500/30 text-emerald-400'}`}>
                              {isSystem ? 'SYSTEM' : 'USER'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            {err ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${err.type === 'timeout' ? 'text-amber-400' : 'text-destructive'}`}>
                                {err.type === 'timeout' ? <TimerOff className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                {err.type.toUpperCase()}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTables.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-xs">No tables match the filter</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* === HISTORY === */}
          <TabsContent value="history" className="space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Backup History</p>
                <p className="text-[11px] text-muted-foreground">Local record of backups created from this browser. Stored in localStorage.</p>
              </div>
              {history.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearHistory} className="h-8 text-xs gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
                <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No backups yet. Create your first export to see it here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="rounded-lg border border-border/30 bg-secondary/10 p-3 flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                      h.encrypted ? 'bg-amber-500/10 text-amber-400' : h.compressed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'
                    }`}>
                      {h.encrypted ? <Lock className="h-4 w-4" /> : h.compressed ? <FileArchive className="h-4 w-4" /> : <FileJson className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-foreground truncate">{h.filename}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(h.createdAt).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><Table2 className="h-2.5 w-2.5" />{h.tableCount} tables</span>
                        <span className="flex items-center gap-1"><HardDrive className="h-2.5 w-2.5" />{h.rowCount.toLocaleString()} rows</span>
                        <span>{formatBytes(h.sizeBytes)}</span>
                      </div>
                      <p className="text-[9px] font-mono text-muted-foreground/70 mt-0.5 truncate">
                        <Hash className="h-2.5 w-2.5 inline mr-1" />{h.checksum}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {h.compressed && <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-emerald-500/30 text-emerald-400">GZIP</Badge>}
                      {h.encrypted && <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-500/30 text-amber-400">AES-256</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeHistoryEntry(h.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Failing queries banner */}
      {Object.keys(tableErrors).length > 0 && (
        <div className="mx-6 mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-3">
          <FileWarning className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-[11px] text-muted-foreground flex-1">
            <strong className="text-destructive">{Object.keys(tableErrors).length} tables</strong> could not be counted. Check the Tables tab → filter "failing".
          </p>
          <Button variant="outline" size="sm" onClick={() => fetchCounts(tables)} disabled={isLoadingCounts}
            className="h-7 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10">
            <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingCounts ? 'animate-spin' : ''}`} />Retry
          </Button>
        </div>
      )}

      {/* Encrypted file password dialog */}
      <Dialog open={!!needsPassword} onOpenChange={(o) => !o && setNeedsPassword(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" /> Encrypted backup
            </DialogTitle>
            <DialogDescription>
              This backup is encrypted with AES-256-GCM. Enter the password used during export.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password" value={importPassword} onChange={e => setImportPassword(e.target.value)}
            placeholder="Password" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && needsPassword && importPassword) ingestFile(needsPassword, importPassword); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNeedsPassword(null); setImportPassword(''); }}>Cancel</Button>
            <Button onClick={() => needsPassword && ingestFile(needsPassword, importPassword)} disabled={!importPassword}>
              <Unlock className="h-4 w-4 mr-1.5" /> Decrypt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm destructive restore */}
      <Dialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-4 w-4" /> Destructive operation
            </DialogTitle>
            <DialogDescription>
              <strong>Replace mode</strong> will truncate the affected tables before restoring data from the backup. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground">
            About to affect <strong>{importPreview?.tablesImported ?? 0}</strong> tables and replace <strong>{(importPreview?.rowsImported ?? 0).toLocaleString()}</strong> rows.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReplaceOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmImport}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Truncate &amp; restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------- Subcomponents ----------
function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode | null; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${accent ? 'border-primary/30 bg-primary/5' : 'border-border/20 bg-secondary/20'}`}>
      <div className={`mx-auto mb-1 ${accent ? 'text-primary' : 'text-primary'}`}>{icon}</div>
      {value === null ? (
        <div className="h-6 w-10 mx-auto rounded bg-muted/40 animate-pulse my-0.5" />
      ) : (
        <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
      )}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
      {icon}{children}
    </p>
  );
}

function FormatButton({ active, onClick, icon, label, desc }: any) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all ${
        active ? 'bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))] ring-1 ring-[hsl(var(--purple))]/30'
               : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
      {icon}
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px] opacity-70">{desc}</p>
      </div>
    </button>
  );
}

function ToggleRow({ icon, title, desc, checked, onCheckedChange, disabled }: any) {
  return (
    <div className={`flex items-start gap-3 ${disabled ? 'opacity-40' : ''}`}>
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

function StrategyOption({ active, onClick, icon, title, desc, danger }: any) {
  return (
    <button onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
        active
          ? danger ? 'border-destructive/40 bg-destructive/5'
                  : 'border-primary/40 bg-primary/5'
          : 'border-border/30 bg-background/30 hover:bg-secondary/30'}`}>
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {title}
          {active && <CheckCircle2 className={`h-3 w-3 ${danger ? 'text-destructive' : 'text-primary'}`} />}
        </p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/10 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default DatabaseExportPanel;
