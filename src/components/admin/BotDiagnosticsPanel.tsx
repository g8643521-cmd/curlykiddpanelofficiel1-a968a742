import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Play, CheckCircle2, XCircle, AlertTriangle, Loader2, Clock, Download, Wrench, Zap, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface CheckResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  durationMs: number;
  details?: any;
}

interface DiagReport {
  summary: { total: number; passed: number; warnings: number; failed: number; durationMs: number };
  checks: CheckResult[];
}

interface FixResult { name: string; status: 'fixed' | 'skipped' | 'failed'; message: string; }
interface FixReport {
  summary: { total: number; fixed: number; skipped: number; failed: number };
  fixes: FixResult[];
}

interface LoadTestReport {
  loadTest: {
    total: number;
    concurrency: number;
    success: number;
    failed: number;
    errorRate: number;
    durationMs: number;
    durationSec: number;
    rps: number;
    latency: { avg: number; min: number; max: number; p50: number; p95: number; p99: number };
    verdict: 'excellent' | 'good' | 'degraded' | 'poor';
    errorSamples: string[];
  };
}

const CAT_LABEL: Record<string, string> = {
  env: 'Environment', discord: 'Discord API', database: 'Database',
  edge: 'Edge functions', webhooks: 'Webhooks', scans: 'Scans',
};

const STATUS_STYLE: Record<string, string> = {
  pass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  warn: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  fail: 'text-destructive bg-destructive/10 border-destructive/20',
};

export default function BotDiagnosticsPanel() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiagReport | null>(null);
  const [progress, setProgress] = useState('');
  const [fixing, setFixing] = useState(false);
  const [fixReport, setFixReport] = useState<FixReport | null>(null);
  const [loadTesting, setLoadTesting] = useState(false);
  const [loadReport, setLoadReport] = useState<LoadTestReport['loadTest'] | null>(null);
  const confirm = useConfirm();

  // ── Progress + ETA tracking ─────────────────────────────────
  // Estimated total durations in seconds (tuned from typical runs)
  const EST = { diagnostics: 90, autofix: 25, loadtest: 90 };
  const [pct, setPct] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<number | null>(null);

  const startProgress = (estSec: number) => {
    const t0 = Date.now();
    setPct(0); setEta(estSec); setElapsed(0);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      const sec = (Date.now() - t0) / 1000;
      setElapsed(sec);
      // Asymptotic curve: approaches 95% as sec → estSec, never exceeds 99%
      const ratio = sec / estSec;
      const p = Math.min(99, Math.round((1 - Math.exp(-ratio * 1.5)) * 100));
      setPct(p);
      const remaining = Math.max(0, estSec - sec);
      setEta(remaining);
    }, 250);
  };

  const finishProgress = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setPct(100); setEta(0);
  };

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const fmtTime = (s: number | null) => {
    if (s == null) return '—';
    if (s < 60) return `${Math.ceil(s)}s`;
    const m = Math.floor(s / 60);
    const r = Math.ceil(s % 60);
    return `${m}m ${r}s`;
  };

  const run = async () => {
    setRunning(true);
    setReport(null);
    setFixReport(null);
    setProgress('Initializing diagnostics…');
    startProgress(EST.diagnostics);
    const t0 = Date.now();
    try {
      setProgress('Running checks (this can take 1-4 minutes)…');
      const { data, error } = await supabase.functions.invoke('bot-diagnostics', { body: {} });
      if (error) throw error;
      const r = data as DiagReport;
      setReport(r);
      const elapsed = Math.round((Date.now() - t0) / 1000);
      if (r.summary.failed > 0) {
        toast.error(`Diagnostics finished in ${elapsed}s — ${r.summary.failed} failure(s)`);
      } else if (r.summary.warnings > 0) {
        toast.warning(`Diagnostics finished in ${elapsed}s — ${r.summary.warnings} warning(s)`);
      } else {
        toast.success(`All ${r.summary.total} checks passed in ${elapsed}s`);
      }
    } catch (e: any) {
      toast.error(`Diagnostics failed: ${e.message}`);
    } finally {
      finishProgress();
      setRunning(false);
      setProgress('');
    }
  };

  const autoFix = async () => {
    setFixing(true);
    setFixReport(null);
    startProgress(EST.autofix);
    try {
      const { data, error } = await supabase.functions.invoke('bot-diagnostics', {
        body: { action: 'auto-fix' },
      });
      if (error) throw error;
      const r = data as FixReport;
      setFixReport(r);
      if (r.summary.failed > 0) {
        toast.error(`Auto-fix: ${r.summary.fixed} fixed, ${r.summary.failed} failed`);
      } else if (r.summary.fixed > 0) {
        toast.success(`Auto-fix: ${r.summary.fixed} issue(s) fixed`);
      } else {
        toast.info('Auto-fix: nothing to fix');
      }
      // Re-run diagnostics to show updated state
      await run();
    } catch (e: any) {
      toast.error(`Auto-fix failed: ${e.message}`);
    } finally {
      finishProgress();
      setFixing(false);
    }
  };

  const loadTest = async () => {
    const ok = await confirm({
      title: 'Run load test?',
      description: '15,000 requests with 50 concurrent. Takes 1–3 minutes and puts real pressure on the database.',
      confirmText: 'Start load test',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!ok) return;
    setLoadTesting(true);
    setLoadReport(null);
    startProgress(EST.loadtest);
    try {
      const { data, error } = await supabase.functions.invoke('bot-diagnostics', {
        body: { action: 'load-test', total: 15000, concurrency: 50 },
      });
      if (error) throw error;
      const r = (data as LoadTestReport).loadTest;
      setLoadReport(r);
      const msg = `${r.success}/${r.total} OK · ${r.rps} req/s · p95 ${r.latency.p95}ms`;
      if (r.verdict === 'poor') toast.error(`Load test: POOR — ${msg}`);
      else if (r.verdict === 'degraded') toast.warning(`Load test: DEGRADED — ${msg}`);
      else toast.success(`Load test: ${r.verdict.toUpperCase()} — ${msg}`);
    } catch (e: any) {
      toast.error(`Load test failed: ${e.message}`);
    } finally {
      finishProgress();
      setLoadTesting(false);
    }
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bot-diagnostics-${new Date().toISOString().slice(0,19)}.json`;
    a.click();
  };

  const grouped = report?.checks.reduce<Record<string, CheckResult[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Bot Diagnostics</h3>
            <p className="text-xs text-muted-foreground/70">
              Checks all bot and backend functions: env, Discord API, database, edge functions, webhooks and scans.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {report && <Button variant="ghost" size="sm" onClick={download} className="gap-1"><Download className="w-3.5 h-3.5" />Export</Button>}
          <Button
            onClick={loadTest}
            disabled={running || fixing || loadTesting}
            variant="secondary"
            className={cn('gap-2 transition-all', loadTesting && 'bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/40 animate-pulse')}
          >
            {loadTesting ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} /> : <Zap className="w-4 h-4" />}
            {loadTesting ? 'Load testing…' : 'Load test (15k)'}
          </Button>
          <Button
            onClick={autoFix}
            disabled={running || fixing || loadTesting}
            variant="secondary"
            className={cn('gap-2 transition-all', fixing && 'bg-primary/20 text-primary ring-2 ring-primary/40 animate-pulse')}
          >
            {fixing ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} /> : <Wrench className="w-4 h-4" />}
            {fixing ? 'Fixing…' : 'Auto-fix'}
          </Button>
          <Button
            onClick={run}
            disabled={running || fixing || loadTesting}
            className={cn('gap-2 transition-all', running && 'bg-primary/80 ring-2 ring-primary/50 animate-pulse')}
          >
            {running ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} /> : <Play className="w-4 h-4" />}
            {running ? 'Running…' : 'Run diagnostics'}
          </Button>
        </div>
      </div>

      {(running || fixing || loadTesting) && (
        <ProgressBanner
          variant={loadTesting ? 'amber' : 'primary'}
          title={
            loadTesting ? 'Running load test (15,000 requests, 50 concurrent)…'
            : fixing ? 'Auto-fix running…'
            : 'Running diagnostics…'
          }
          subtitle={
            loadTesting ? 'Measuring throughput, latency and error rate.'
            : fixing ? 'Clearing stale scans, re-enabling webhooks and checking edge functions.'
            : 'Checking env, Discord, database, edge functions, webhooks and scans.'
          }
          pct={pct}
          elapsed={elapsed}
          eta={eta}
          fmtTime={fmtTime}
        />
      )}

      {loadReport && !loadTesting && (
        <div className={cn(
          'rounded-xl border px-4 py-4 space-y-3',
          loadReport.verdict === 'excellent' && 'border-emerald-500/30 bg-emerald-500/5',
          loadReport.verdict === 'good' && 'border-emerald-500/20 bg-emerald-500/5',
          loadReport.verdict === 'degraded' && 'border-amber-500/30 bg-amber-500/5',
          loadReport.verdict === 'poor' && 'border-destructive/30 bg-destructive/5',
        )}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="w-4 h-4" />
              Load test results
              <Badge variant="outline" className={cn(
                'text-[10px] uppercase',
                loadReport.verdict === 'excellent' && 'text-emerald-400 border-emerald-500/40',
                loadReport.verdict === 'good' && 'text-emerald-400 border-emerald-500/30',
                loadReport.verdict === 'degraded' && 'text-amber-400 border-amber-500/40',
                loadReport.verdict === 'poor' && 'text-destructive border-destructive/40',
              )}>{loadReport.verdict}</Badge>
            </div>
            <span className="text-[11px] text-muted-foreground/60">
              {loadReport.total.toLocaleString()} requests · {loadReport.concurrency} concurrent · {loadReport.durationSec}s
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SummaryCard label="Throughput" value={`${loadReport.rps} req/s`} accent={loadReport.rps > 200 ? 'success' : loadReport.rps > 50 ? 'warn' : 'fail'} />
            <SummaryCard label="Success" value={`${loadReport.success.toLocaleString()}`} accent={loadReport.errorRate < 1 ? 'success' : 'warn'} />
            <SummaryCard label="Failed" value={`${loadReport.failed} (${loadReport.errorRate}%)`} accent={loadReport.errorRate < 1 ? 'success' : loadReport.errorRate < 5 ? 'warn' : 'fail'} />
            <SummaryCard label="Avg latency" value={`${loadReport.latency.avg}ms`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <SummaryCard label="Min" value={`${loadReport.latency.min}ms`} />
            <SummaryCard label="p50" value={`${loadReport.latency.p50}ms`} />
            <SummaryCard label="p95" value={`${loadReport.latency.p95}ms`} accent={loadReport.latency.p95 > 800 ? 'fail' : loadReport.latency.p95 > 300 ? 'warn' : 'success'} />
            <SummaryCard label="p99" value={`${loadReport.latency.p99}ms`} accent={loadReport.latency.p99 > 1500 ? 'fail' : loadReport.latency.p99 > 600 ? 'warn' : 'success'} />
            <SummaryCard label="Max" value={`${loadReport.latency.max}ms`} />
          </div>
          {loadReport.errorSamples.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground/70">Error samples ({loadReport.errorSamples.length})</summary>
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-destructive/80">
                {loadReport.errorSamples.map((m, i) => <li key={i}>• {m}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {fixReport && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="w-4 h-4 text-primary" />
            Auto-fix results
            <Badge variant="outline" className="text-[10px]">
              {fixReport.summary.fixed} fixed · {fixReport.summary.skipped} skipped · {fixReport.summary.failed} failed
            </Badge>
          </div>
          <div className="space-y-1">
            {fixReport.fixes.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {f.status === 'fixed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                {f.status === 'skipped' && <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />}
                {f.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
                <span className="font-medium">{f.name}:</span>
                <span className="text-muted-foreground/80">{f.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report && !running && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Total" value={report.summary.total} />
            <SummaryCard label="Passed" value={report.summary.passed} accent="success" />
            <SummaryCard label="Warnings" value={report.summary.warnings} accent="warn" />
            <SummaryCard label="Failed" value={report.summary.failed} accent="fail" />
            <SummaryCard label="Duration" value={`${(report.summary.durationMs / 1000).toFixed(1)}s`} />
          </div>

          {grouped && Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {CAT_LABEL[cat] || cat}
              </h4>
              <div className="space-y-1.5">
                {items.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border/20 bg-card/40 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {c.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                        {c.status === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                        {c.status === 'fail' && <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{c.name}</span>
                            <Badge variant="outline" className={cn('text-[10px]', STATUS_STYLE[c.status])}>{c.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground/70 mt-0.5 break-words">{c.message}</p>
                          {c.details && (
                            <details className="mt-1">
                              <summary className="text-[10px] text-muted-foreground/60 cursor-pointer">details</summary>
                              <pre className="text-[10px] bg-muted/10 rounded p-2 mt-1 overflow-x-auto">{typeof c.details === 'string' ? c.details : JSON.stringify(c.details, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground/50 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />{c.durationMs}ms
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {!report && !running && (
        <div className="rounded-xl border border-dashed border-border/30 bg-card/30 px-6 py-12 text-center">
          <Stethoscope className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Ready to run diagnostics</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Tjekker ~20+ funktioner og rapporterer hver enkelt med pass/warn/fail.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent?: 'success' | 'warn' | 'fail' }) {
  const color = accent === 'success' ? 'text-emerald-400'
    : accent === 'warn' ? 'text-amber-400'
    : accent === 'fail' ? 'text-destructive'
    : 'text-foreground';
  return (
    <div className="rounded-xl border border-border/20 bg-card/40 px-4 py-3 text-center">
      <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mt-1">{label}</p>
    </div>
  );
}

function ProgressBanner({
  variant, title, subtitle, pct, elapsed, eta, fmtTime,
}: {
  variant: 'primary' | 'amber';
  title: string;
  subtitle: string;
  pct: number;
  elapsed: number;
  eta: number | null;
  fmtTime: (s: number | null) => string;
}) {
  const color = variant === 'amber' ? 'amber' : 'primary';
  const borderC = color === 'amber' ? 'border-amber-500/30' : 'border-primary/30';
  const bgC = color === 'amber' ? 'bg-amber-500/5' : 'bg-primary/5';
  const textC = color === 'amber' ? 'text-amber-400' : 'text-primary';
  const fillC = color === 'amber' ? 'bg-amber-400' : 'bg-primary';
  return (
    <div className={cn('rounded-xl border px-6 py-5 space-y-3', borderC, bgC)}>
      <div className="flex items-center gap-3">
        <Loader2 className={cn('w-6 h-6 animate-spin shrink-0', textC)} strokeWidth={2.5} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-muted-foreground/70 truncate">{subtitle}</p>
        </div>
        <div className={cn('text-2xl font-bold tabular-nums shrink-0', textC)}>{pct}%</div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/30">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out', fillC)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 tabular-nums">
        <span>Elapsed: <span className="font-medium text-foreground">{fmtTime(elapsed)}</span></span>
        <span>ETA: <span className="font-medium text-foreground">{fmtTime(eta)}</span></span>
      </div>
    </div>
  );
}
