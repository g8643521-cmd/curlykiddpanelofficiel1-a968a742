import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Download, Upload, Loader2, Database, FileJson, FileSpreadsheet, CheckCircle2, Shield,
  HardDrive, Table2, Info, RefreshCw, AlertTriangle, TimerOff, Search, Lock, Unlock, FileArchive,
  Hash, History, Eye, Trash2, FileWarning, Sparkles, Check, X, ChevronRight,
  ShieldAlert, Zap, Calendar, FileCheck2, GitCompareArrows, BellRing, Heart, Activity,
  FileSearch, Pencil, Copy as CopyIcon, FileCode2,
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
  format: 'json' | 'csv' | 'html';
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
function loadSchedule(): ScheduleConfig {
  try {
    const s = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || 'null');
    if (s && typeof s === 'object') return { enabled: !!s.enabled, intervalDays: Number(s.intervalDays) || 7, lastReminderAt: s.lastReminderAt || null };
  } catch { /* noop */ }
  return { enabled: false, intervalDays: 7, lastReminderAt: null };
}
function saveSchedule(s: ScheduleConfig) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s));
}
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function renderCellHtml(v: any): string {
  if (v === null || v === undefined) return '<span class="null">null</span>';
  if (typeof v === 'boolean') return `<span class="bool ${v ? 'true' : 'false'}">${v}</span>`;
  if (typeof v === 'number') return `<span class="num">${v}</span>`;
  if (typeof v === 'object') return `<pre class="json">${escapeHtml(JSON.stringify(v, null, 2))}</pre>`;
  const s = String(v);
  if (/^https?:\/\//.test(s)) return `<a href="${escapeHtml(s)}" target="_blank" rel="noopener">${escapeHtml(s.length > 60 ? s.slice(0, 57) + '…' : s)}</a>`;
  return escapeHtml(s);
}

function buildHtmlReport(data: Record<string, any>, meta: { checksum: string; rawBytes: number; tables: string[] }): string {
  const generated = new Date().toISOString();
  const totalRows = meta.tables.reduce((n, t) => n + (Array.isArray(data[t]) ? data[t].length : 0), 0);

  const toc = meta.tables.map(t => {
    const rows = Array.isArray(data[t]) ? data[t].length : 0;
    return `<li><a href="#tbl-${escapeHtml(t)}"><span class="toc-name">${escapeHtml(t)}</span><span class="toc-count">${rows.toLocaleString()}</span></a></li>`;
  }).join('');

  const sections = meta.tables.map(t => {
    const rows: any[] = Array.isArray(data[t]) ? data[t] : [];
    if (rows.length === 0) {
      return `<section id="tbl-${escapeHtml(t)}" class="card"><header class="card-h"><h2>${escapeHtml(t)}</h2><span class="pill">0 rows</span></header><div class="empty">No rows</div></section>`;
    }
    const cols = Array.from(rows.reduce((s: Set<string>, r) => { Object.keys(r ?? {}).forEach(k => s.add(k)); return s; }, new Set<string>()));
    const thead = cols.map(c => `<th>${escapeHtml(c)}</th>`).join('');
    const tbody = rows.map(r => `<tr>${cols.map(c => `<td>${renderCellHtml(r[c])}</td>`).join('')}</tr>`).join('');
    return `<section id="tbl-${escapeHtml(t)}" class="card">
      <header class="card-h">
        <h2>${escapeHtml(t)}</h2>
        <div class="card-meta"><span class="pill">${rows.length.toLocaleString()} rows</span><span class="pill">${cols.length} cols</span></div>
      </header>
      <div class="tbl-wrap"><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CurlyKidd Database Backup — ${generated.slice(0, 10)}</title>
<style>
  :root {
    --bg: #07100f; --bg-2: #0c1a18; --panel: #0f2422; --border: #1a3a36;
    --fg: #e6fbf6; --muted: #7da89f; --primary: #1de9c3; --accent: #6ee7d3;
    --danger: #ef4444; --warn: #f59e0b; --true: #34d399; --false: #fb7185;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: radial-gradient(ellipse at top, #0d2421 0%, var(--bg) 60%); color: var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, sans-serif; }
  .wrap { max-width: 1400px; margin: 0 auto; padding: 32px 24px 80px; }
  header.hero { display: flex; align-items: center; justify-content: space-between; padding: 28px; border-radius: 20px; background: linear-gradient(135deg, rgba(29,233,195,.12), rgba(29,233,195,.02)); border: 1px solid var(--border); margin-bottom: 28px; box-shadow: 0 20px 60px -30px rgba(29,233,195,.4); }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, var(--primary), #0c8f7a); display: grid; place-items: center; font-weight: 800; color: #04110f; font-size: 22px; box-shadow: 0 10px 30px -10px rgba(29,233,195,.6); }
  h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }
  .stat { padding: 16px; border-radius: 14px; background: var(--panel); border: 1px solid var(--border); }
  .stat .k { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  .stat .v { font-size: 22px; font-weight: 700; margin-top: 6px; color: var(--accent); }
  .layout { display: grid; grid-template-columns: 240px 1fr; gap: 24px; align-items: start; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .stats { grid-template-columns: repeat(2, 1fr); } }
  nav.toc { position: sticky; top: 16px; background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 14px; max-height: calc(100vh - 32px); overflow: auto; }
  nav.toc h3 { margin: 0 0 10px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  nav.toc ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
  nav.toc a { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 8px; text-decoration: none; color: var(--fg); font-size: 12px; transition: background .15s; }
  nav.toc a:hover { background: rgba(29,233,195,.08); color: var(--accent); }
  .toc-count { font-size: 10px; color: var(--muted); background: rgba(255,255,255,.04); padding: 2px 7px; border-radius: 10px; }
  .filter { width: 100%; background: var(--bg-2); border: 1px solid var(--border); color: var(--fg); padding: 8px 10px; border-radius: 8px; font-size: 12px; margin-bottom: 10px; outline: none; }
  .filter:focus { border-color: var(--primary); }
  main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
  .card-h { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, rgba(29,233,195,.04), transparent); }
  .card-h h2 { margin: 0; font-size: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--accent); }
  .card-meta { display: flex; gap: 6px; }
  .pill { font-size: 10px; padding: 3px 9px; border-radius: 999px; background: rgba(29,233,195,.1); color: var(--accent); border: 1px solid rgba(29,233,195,.2); }
  .tbl-wrap { overflow-x: auto; max-height: 600px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { position: sticky; top: 0; background: var(--bg-2); color: var(--muted); text-transform: uppercase; font-size: 10px; letter-spacing: .06em; padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
  tbody td { padding: 8px 12px; border-bottom: 1px solid rgba(26,58,54,.5); vertical-align: top; max-width: 360px; overflow: hidden; text-overflow: ellipsis; }
  tbody tr:hover { background: rgba(29,233,195,.03); }
  tbody tr:last-child td { border-bottom: none; }
  .null { color: var(--muted); font-style: italic; opacity: .6; }
  .bool.true { color: var(--true); font-weight: 600; }
  .bool.false { color: var(--false); font-weight: 600; }
  .num { color: var(--accent); font-variant-numeric: tabular-nums; }
  .json { margin: 0; max-height: 160px; overflow: auto; font-size: 11px; background: rgba(0,0,0,.3); padding: 6px 8px; border-radius: 6px; color: #b6f0e0; }
  a { color: var(--primary); text-decoration: none; } a:hover { text-decoration: underline; }
  .empty { padding: 28px; color: var(--muted); text-align: center; font-size: 12px; }
  footer { margin-top: 40px; text-align: center; color: var(--muted); font-size: 11px; }
  code.chk { font-family: ui-monospace, monospace; background: var(--bg-2); padding: 2px 6px; border-radius: 4px; color: var(--accent); }
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="brand">
      <div class="logo">CK</div>
      <div>
        <h1>CurlyKidd Database Backup</h1>
        <div class="sub">Generated ${generated} · Self-contained HTML report</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="sub">SHA-256</div>
      <code class="chk">${meta.checksum.slice(0, 16)}…</code>
    </div>
  </header>

  <div class="stats">
    <div class="stat"><div class="k">Tables</div><div class="v">${meta.tables.length}</div></div>
    <div class="stat"><div class="k">Total Rows</div><div class="v">${totalRows.toLocaleString()}</div></div>
    <div class="stat"><div class="k">Raw Size</div><div class="v">${(meta.rawBytes / 1024).toFixed(1)} KB</div></div>
    <div class="stat"><div class="k">Generated</div><div class="v" style="font-size:14px">${generated.slice(0, 10)}</div></div>
  </div>

  <div class="layout">
    <nav class="toc">
      <h3>Tables</h3>
      <input class="filter" placeholder="Filter tables…" oninput="(function(e){var q=e.target.value.toLowerCase();document.querySelectorAll('nav.toc li').forEach(function(li){li.style.display=li.innerText.toLowerCase().includes(q)?'':'none'})})(event)" />
      <ul>${toc}</ul>
    </nav>
    <main>${sections}</main>
  </div>

  <footer>CurlyKiddPanel · Database Snapshot · ${meta.tables.length} tables · ${totalRows.toLocaleString()} rows</footer>
</div>
</body>
</html>`;
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
  const [format, setFormat] = useState<'json' | 'csv' | 'html'>('json');
  const [compress, setCompress] = useState(true);
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [exportPct, setExportPct] = useState(0);

  // Verify
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyExpected, setVerifyExpected] = useState('');
  const verifyInputRef = useRef<HTMLInputElement>(null);

  // Schedule
  const [schedule, setSchedule] = useState<ScheduleConfig>(() => loadSchedule());

  // Notes
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

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

    const step = (pct: number, msg: string) => { setExportPct(pct); setExportProgress(msg); };

    setIsExporting(true);
    step(5, 'Requesting backup from server…');

    try {
      const tablesToExport = Array.from(selectedTables);
      const serverFormat = format === 'html' ? 'json' : format;
      const { data, error } = await supabase.functions.invoke('export-database', {
        body: { tables: tablesToExport, format: serverFormat },
      });

      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || 'Export failed');
        setIsExporting(false); setExportProgress(''); setExportPct(0); return;
      }

      step(40, 'Server payload received');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = `curlykidd-backup-${timestamp}`;

      if (format === 'csv') {
        step(80, 'Writing CSV files…');
        for (const [table, csvString] of Object.entries(data as Record<string, string>)) {
          if (!csvString || typeof csvString !== 'string') continue;
          downloadBlob(new Blob([csvString], { type: 'text/csv' }), `${table}-${timestamp}.csv`);
        }
        step(100, 'Done');
        toast.success(`Exported ${tablesToExport.length} CSV files`);
        setIsExporting(false); setExportProgress(''); setExportPct(0); return;
      }

      if (format === 'html') {
        step(55, 'Computing SHA-256 checksum…');
        const jsonStr = JSON.stringify(data);
        const rawSize = new TextEncoder().encode(jsonStr).length;
        const checksum = await sha256Hex(jsonStr);
        step(75, 'Rendering HTML report…');
        const filteredTables = tablesToExport.filter(t => !t.startsWith('_'));
        const html = buildHtmlReport(data as Record<string, any>, { checksum, rawBytes: rawSize, tables: filteredTables });
        const htmlBytes = new TextEncoder().encode(html);
        step(95, 'Writing file…');
        const filename = `${baseName}.html`;
        downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);

        const entry: BackupHistoryEntry = {
          id: crypto.randomUUID(),
          filename, createdAt: new Date().toISOString(),
          tableCount: filteredTables.length, rowCount: selectedRows,
          sizeBytes: htmlBytes.length, format: 'html', compressed: false, encrypted: false, checksum,
          tables: filteredTables, rawBytes: rawSize,
        };
        const next = [entry, ...history];
        setHistory(next); saveHistory(next);
        const nextSchedule = { ...schedule, lastReminderAt: new Date().toISOString() };
        setSchedule(nextSchedule); saveSchedule(nextSchedule);

        step(100, 'Done');
        toast.success(`HTML report ready — ${formatBytes(htmlBytes.length)}`);
        setIsExporting(false); setExportProgress(''); setExportPct(0); return;
      }

      step(50, 'Serializing JSON…');
      const json = JSON.stringify(data, null, 2);
      let bytes: Uint8Array = new TextEncoder().encode(json);
      const rawSize = bytes.length;
      step(60, 'Computing SHA-256 checksum…');
      const checksum = await sha256Hex(json);
      let mime = 'application/json';
      let filename = `${baseName}.json`;

      if (compress) {
        step(70, 'Compressing (gzip)…');
        bytes = await gzipCompress(bytes);
        mime = 'application/gzip';
        filename = `${baseName}.json.gz`;
      }
      if (encrypt) {
        step(85, 'Encrypting (AES-256-GCM)…');
        bytes = await encryptPayload(bytes, password);
        mime = 'application/octet-stream';
        filename = `${baseName}${compress ? '.json.gz' : '.json'}.enc`;
      }

      step(95, 'Writing file…');
      // Slice into a fresh ArrayBuffer so Blob never sees a view into a larger buffer.
      const safeBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([safeBuf], { type: mime });
      downloadBlob(blob, filename);
      // NOTE: manifest sidecar is NOT auto-downloaded — browsers block consecutive
      // downloads and users were only receiving the tiny manifest (~1KB) instead of
      // the actual backup. Manifest can be regenerated from the History tab.

      const entry: BackupHistoryEntry = {
        id: crypto.randomUUID(),
        filename, createdAt: new Date().toISOString(),
        tableCount: tablesToExport.length, rowCount: selectedRows,
        sizeBytes: bytes.length, format, compressed: compress, encrypted: encrypt, checksum,
        tables: tablesToExport, rawBytes: rawSize,
      };
      const next = [entry, ...history];
      setHistory(next); saveHistory(next);

      const nextSchedule = { ...schedule, lastReminderAt: new Date().toISOString() };
      setSchedule(nextSchedule); saveSchedule(nextSchedule);

      step(100, 'Done');
      toast.success(`Backup ready — ${formatBytes(bytes.length)} • SHA-256 ${checksum.slice(0, 8)}…`);
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    }
    setIsExporting(false); setExportProgress(''); setExportPct(0);
  };

  // ----- Verify -----
  const triggerVerify = () => verifyInputRef.current?.click();
  const handleVerifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsVerifying(true); setVerifyResult(null);
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const storedChecksum = await sha256Hex(raw);
      const name = file.name.toLowerCase();
      let format: VerifyResult['format'] = 'unknown';
      if (name.endsWith('.enc')) format = 'encrypted';
      else if (name.endsWith('.gz')) format = 'gzip';
      else if (name.endsWith('.json')) format = 'json';

      let tables: string[] | undefined;
      let rowCount: number | undefined;
      let parsedOk: boolean | undefined;
      let parseError: string | undefined;
      try {
        let working: Uint8Array = raw;
        if (format === 'gzip') working = (await gzipDecompress(raw)) as Uint8Array;
        if (format === 'json' || format === 'gzip') {
          const parsed = JSON.parse(new TextDecoder().decode(working));
          parsedOk = typeof parsed === 'object' && parsed !== null;
          if (parsedOk) {
            tables = Object.keys(parsed).filter(k => !k.startsWith('_') && Array.isArray(parsed[k]));
            rowCount = tables.reduce((s, k) => s + (Array.isArray(parsed[k]) ? parsed[k].length : 0), 0);
          }
        }
      } catch (err: any) {
        parsedOk = false; parseError = err?.message || 'Parse failed';
      }

      const expected = verifyExpected.trim().toLowerCase();
      const match = expected ? expected === storedChecksum.toLowerCase() : undefined;

      setVerifyResult({
        filename: file.name, sizeBytes: raw.length, checksum: storedChecksum,
        expected: expected || undefined, match, format, tables, rowCount, parsedOk, error: parseError,
      });
      if (expected) {
        match ? toast.success('Checksum matches — file is intact')
              : toast.error('Checksum mismatch — file is corrupted or modified');
      } else {
        toast.success('Verification complete');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Verification failed');
    }
    setIsVerifying(false);
    if (verifyInputRef.current) verifyInputRef.current.value = '';
  };

  // ----- History notes / actions -----
  const updateNote = (id: string, note: string) => {
    const next = history.map(h => h.id === id ? { ...h, note } : h);
    setHistory(next); saveHistory(next);
    setEditingNoteId(null); setNoteDraft('');
  };
  const copyChecksum = async (checksum: string) => {
    try { await navigator.clipboard.writeText(checksum); toast.success('Checksum copied'); }
    catch { toast.error('Copy failed'); }
  };
  const redownloadManifest = (h: BackupHistoryEntry) => {
    const manifest = JSON.stringify({
      filename: h.filename, checksum_sha256: h.checksum,
      raw_bytes: h.rawBytes ?? null, stored_bytes: h.sizeBytes,
      compressed: h.compressed, encrypted: h.encrypted,
      created_at: h.createdAt, tables: h.tables ?? [], rows: h.rowCount,
      note: h.note ?? null,
    }, null, 2);
    downloadBlob(new Blob([manifest], { type: 'application/json' }),
      h.filename.replace(/\.(json|gz|enc)+$/i, '') + '.manifest.json');
  };

  // ----- Schedule -----
  const lastBackupAt = history[0]?.createdAt ?? null;
  const lastBackupAgeDays = daysSince(lastBackupAt);
  const scheduleDue = schedule.enabled && lastBackupAgeDays !== null && lastBackupAgeDays >= schedule.intervalDays;
  const backupHealth: 'fresh' | 'aging' | 'stale' | 'none' =
    lastBackupAgeDays === null ? 'none'
    : lastBackupAgeDays <= 1 ? 'fresh'
    : lastBackupAgeDays <= 7 ? 'aging' : 'stale';

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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard icon={<Table2 className="h-4 w-4" />} label="Tables" value={isLoadingTables ? null : tables.length} />
          <StatCard icon={<Check className="h-4 w-4" />} label="Selected" value={selectedTables.size} accent />
          <StatCard icon={<HardDrive className="h-4 w-4" />} label="Total Rows" value={isLoadingCounts ? null : totalRows.toLocaleString()} />
          <StatCard icon={<FileArchive className="h-4 w-4" />} label="Est. Size" value={formatBytes(estimatedSize)} />
          <StatCard icon={<Shield className="h-4 w-4" />} label="RLS" value="Protected" />
          <StatCard
            icon={<Heart className={`h-4 w-4 ${backupHealth === 'fresh' ? 'text-emerald-400' : backupHealth === 'aging' ? 'text-amber-400' : 'text-destructive'}`} />}
            label="Backup Health"
            value={lastBackupAgeDays === null ? 'No backup' : lastBackupAgeDays === 0 ? 'Today' : `${lastBackupAgeDays}d ago`}
          />
        </div>
        {scheduleDue && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-[11px] text-foreground flex-1">
              Scheduled backup is due — last backup was <strong>{lastBackupAgeDays}d</strong> ago (interval {schedule.intervalDays}d).
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="p-6">
        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="export" className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Import</TabsTrigger>
            <TabsTrigger value="verify" className="gap-1.5"><FileSearch className="h-3.5 w-3.5" />Verify</TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5"><BellRing className="h-3.5 w-3.5" />Schedule
              {scheduleDue && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
            </TabsTrigger>
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
                <div className="grid grid-cols-3 gap-2">
                  <FormatButton active={format === 'json'} onClick={() => setFormat('json')} icon={<FileJson className="h-4 w-4" />} label="JSON" desc="Full backup" />
                  <FormatButton active={format === 'html'} onClick={() => setFormat('html')} icon={<FileCode2 className="h-4 w-4" />} label="HTML" desc="Pretty report" />
                  <FormatButton active={format === 'csv'} onClick={() => setFormat('csv')} icon={<FileSpreadsheet className="h-4 w-4" />} label="CSV" desc="Per-table files" />
                </div>

                <div className="border-t border-border/20 pt-4 space-y-3">
                  <SectionLabel icon={<Zap className="h-3 w-3" />}>Processing Pipeline</SectionLabel>
                  <ToggleRow
                    icon={<FileArchive className="h-4 w-4 text-emerald-400" />}
                    title="GZIP Compression" desc="~70% smaller. Recommended for large backups."
                    checked={compress} onCheckedChange={setCompress} disabled={format !== 'json'}
                  />
                  <ToggleRow
                    icon={<Lock className="h-4 w-4 text-amber-400" />}
                    title="AES-256-GCM Encryption" desc="Password-protected backup. Sidecar manifest stays clear."
                    checked={encrypt} onCheckedChange={setEncrypt} disabled={format !== 'json'}
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
                  <SummaryRow label="Pipeline" value={[format.toUpperCase(), compress && format === 'json' ? 'GZIP' : null, encrypt && format === 'json' ? 'AES-256' : null].filter(Boolean).join(' → ')} />
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
                {isExporting && (
                  <div className="space-y-1 -mt-2">
                    <Progress value={exportPct} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{exportProgress}</span>
                      <span className="tabular-nums">{exportPct}%</span>
                    </p>
                  </div>
                )}
                {selectedTables.size === 0 && !isExporting && (
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

          {/* === VERIFY === */}
          <TabsContent value="verify" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-4">
                <SectionLabel icon={<FileSearch className="h-3 w-3" />}>Integrity Verification</SectionLabel>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Recompute the SHA-256 of any backup file and compare it to the checksum from its manifest.
                  Detects bit-rot, corrupted downloads and tampered backups. Also reports table count and row totals.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected SHA-256 (optional)</Label>
                  <Input
                    value={verifyExpected} onChange={e => setVerifyExpected(e.target.value)}
                    placeholder="Paste checksum from manifest…"
                    className="h-8 text-[11px] font-mono bg-background/60"
                  />
                </div>
                <input ref={verifyInputRef} type="file" onChange={handleVerifyFile} className="hidden" />
                <Button onClick={triggerVerify} disabled={isVerifying} className="w-full h-10 rounded-lg">
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSearch className="h-4 w-4 mr-2" />}
                  Select file to verify
                </Button>
              </div>

              <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-3">
                <SectionLabel icon={<Hash className="h-3 w-3" />}>Result</SectionLabel>
                {!verifyResult ? (
                  <div className="rounded-lg border border-dashed border-border/40 p-6 text-center">
                    <FileSearch className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground">No file verified yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <SummaryRow label="File" value={<span className="font-mono text-[10px] truncate max-w-[180px] inline-block align-bottom">{verifyResult.filename}</span>} />
                    <SummaryRow label="Size" value={formatBytes(verifyResult.sizeBytes)} />
                    <SummaryRow label="Format" value={verifyResult.format.toUpperCase()} />
                    {verifyResult.tables && (
                      <SummaryRow label="Tables in file" value={verifyResult.tables.length} />
                    )}
                    {verifyResult.rowCount !== undefined && (
                      <SummaryRow label="Rows in file" value={verifyResult.rowCount.toLocaleString()} />
                    )}
                    <div className="rounded-lg bg-background/50 p-2 mt-2">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">SHA-256</p>
                      <p className="text-[10px] font-mono break-all text-foreground">{verifyResult.checksum}</p>
                    </div>
                    {verifyResult.expected && (
                      <div className={`rounded-lg p-2 flex items-center gap-2 ${verifyResult.match ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                        {verifyResult.match
                          ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-[11px] font-semibold text-emerald-400">Checksum matches — file intact</span></>
                          : <><AlertTriangle className="h-4 w-4 text-destructive" /><span className="text-[11px] font-semibold text-destructive">Mismatch — file corrupted or tampered</span></>}
                      </div>
                    )}
                    {verifyResult.error && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-2 text-[10px] text-destructive">
                        Parse error: {verifyResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* === SCHEDULE === */}
          <TabsContent value="schedule" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-4">
                <SectionLabel icon={<BellRing className="h-3 w-3" />}>Backup Reminder</SectionLabel>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Get reminded in the admin panel when a fresh backup is overdue.
                  Reminders are visual only — no automatic exports are performed on this client.
                </p>
                <ToggleRow
                  icon={<BellRing className="h-4 w-4 text-amber-400" />}
                  title="Enable reminder"
                  desc="Show a banner when the last backup is older than the interval below."
                  checked={schedule.enabled}
                  onCheckedChange={(v: boolean) => { const n = { ...schedule, enabled: v }; setSchedule(n); saveSchedule(n); }}
                />
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Interval (days)</Label>
                  <div className="flex gap-1.5">
                    {[1, 3, 7, 14, 30].map(d => (
                      <Button
                        key={d}
                        variant={schedule.intervalDays === d ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 text-[11px] flex-1"
                        onClick={() => { const n = { ...schedule, intervalDays: d }; setSchedule(n); saveSchedule(n); }}
                      >
                        {d}d
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/30 bg-secondary/10 p-4 space-y-3">
                <SectionLabel icon={<Activity className="h-3 w-3" />}>Status</SectionLabel>
                <div className="space-y-2 text-xs">
                  <SummaryRow label="Reminder" value={schedule.enabled ? <Badge className="h-4 px-1.5 text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">ON</Badge> : <Badge variant="outline" className="h-4 px-1.5 text-[9px]">OFF</Badge>} />
                  <SummaryRow label="Interval" value={`${schedule.intervalDays} days`} />
                  <SummaryRow label="Last backup" value={lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'Never'} />
                  <SummaryRow label="Age" value={lastBackupAgeDays === null ? '—' : `${lastBackupAgeDays}d`} />
                  <SummaryRow label="Next due in" value={
                    !schedule.enabled || lastBackupAgeDays === null ? '—'
                    : `${Math.max(0, schedule.intervalDays - lastBackupAgeDays)}d`
                  } />
                </div>
                {scheduleDue && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-start gap-2">
                    <BellRing className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-foreground">
                      A backup is overdue. Open the Export tab and run a backup to refresh the schedule.
                    </p>
                  </div>
                )}
              </div>
            </div>
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
                  <div key={h.id} className="rounded-lg border border-border/30 bg-secondary/10 p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                        h.encrypted ? 'bg-amber-500/10 text-amber-400' : h.compressed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'
                      }`}>
                        {h.encrypted ? <Lock className="h-4 w-4" /> : h.compressed ? <FileArchive className="h-4 w-4" /> : <FileJson className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-foreground truncate">{h.filename}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(h.createdAt).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Table2 className="h-2.5 w-2.5" />{h.tableCount} tables</span>
                          <span className="flex items-center gap-1"><HardDrive className="h-2.5 w-2.5" />{h.rowCount.toLocaleString()} rows</span>
                          <span>{formatBytes(h.sizeBytes)}</span>
                        </div>
                        <button
                          onClick={() => copyChecksum(h.checksum)}
                          className="text-[9px] font-mono text-muted-foreground/70 mt-0.5 truncate hover:text-primary transition-colors flex items-center gap-1 w-full text-left"
                          title="Click to copy"
                        >
                          <Hash className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{h.checksum}</span>
                          <CopyIcon className="h-2.5 w-2.5 shrink-0 opacity-50" />
                        </button>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {h.compressed && <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-emerald-500/30 text-emerald-400">GZIP</Badge>}
                        {h.encrypted && <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-500/30 text-amber-400">AES-256</Badge>}
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => redownloadManifest(h)} title="Re-download manifest">
                          <FileCheck2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingNoteId(h.id); setNoteDraft(h.note || ''); }} title="Edit note">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeHistoryEntry(h.id)} title="Delete">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {editingNoteId === h.id ? (
                      <div className="flex gap-1.5 pl-12">
                        <Input
                          value={noteDraft}
                          onChange={e => setNoteDraft(e.target.value)}
                          placeholder="Add a note (e.g. pre-migration snapshot)…"
                          className="h-7 text-[11px]"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') updateNote(h.id, noteDraft); if (e.key === 'Escape') { setEditingNoteId(null); setNoteDraft(''); } }}
                        />
                        <Button size="sm" className="h-7 text-[10px]" onClick={() => updateNote(h.id, noteDraft)}>Save</Button>
                      </div>
                    ) : h.note ? (
                      <p className="pl-12 text-[10px] text-muted-foreground italic">"{h.note}"</p>
                    ) : null}
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
