import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Database, Zap, Globe, RefreshCw, CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

type Status = 'checking' | 'operational' | 'degraded' | 'down';

interface Check {
  key: string;
  label: string;
  description: string;
  icon: typeof Database;
  status: Status;
  latency: number | null;
  error?: string;
}

interface EdgeProbe {
  timestamp: number;
  fn: string;
  status: number | null;       // HTTP status (null if network failure)
  ok: boolean;                  // runtime reachable
  latency: number;
  errorBody?: string;           // raw response body for failed calls
  errorMessage?: string;        // network / fetch level error
}

interface EdgeFnSpec {
  name: string;
  method: 'GET' | 'POST' | 'OPTIONS';
  body?: unknown;
  /** HTTP statuses that mean "function reachable & healthy" beyond 2xx (e.g. 400 for validation). */
  okStatuses?: number[];
}

/**
 * Curated probes per edge function. We send harmless payloads — a 4xx response
 * still proves the runtime is up, so we treat it as "operational" via okStatuses.
 */
const EDGE_FUNCTIONS: EdgeFnSpec[] = [
  { name: 'cfx-lookup',         method: 'POST', body: { serverCode: '__healthcheck__' }, okStatuses: [200, 400, 404] },
  { name: 'cfx-icon',           method: 'POST', body: { serverCode: '__healthcheck__' }, okStatuses: [200, 400, 404] },
  { name: 'screensharex-lookup',method: 'POST', body: { query: 'ping', type: 'discord' }, okStatuses: [200, 400, 404] },
  // POST with empty/healthcheck payload — a 4xx response still proves the runtime is up.
  { name: 'discord-setup',       method: 'POST', body: { healthcheck: true }, okStatuses: [200, 400, 401, 403, 404, 405, 422] },
  { name: 'discord-member-check',method: 'POST', body: { healthcheck: true }, okStatuses: [200, 400, 401, 403, 404, 405, 422] },
  { name: 'cheater-webhook',     method: 'POST', body: { healthcheck: true }, okStatuses: [200, 400, 401, 403, 404, 405, 422] },
];
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const MAX_HISTORY = 10;

const initialChecks: Check[] = [
  { key: 'db', label: 'Database', description: 'Postgres read latency', icon: Database, status: 'checking', latency: null },
  { key: 'auth', label: 'Authentication', description: 'Session service', icon: Globe, status: 'checking', latency: null },
];

const statusMeta: Record<Status, { label: string; dot: string; text: string; bg: string }> = {
  checking:    { label: 'Checking',    dot: 'bg-muted-foreground/40 animate-pulse', text: 'text-muted-foreground/70', bg: 'bg-muted/30' },
  operational: { label: 'Operational', dot: 'bg-[hsl(var(--green))]',                text: 'text-[hsl(var(--green))]',  bg: 'bg-[hsl(var(--green))]/10' },
  degraded:    { label: 'Degraded',    dot: 'bg-[hsl(var(--yellow))]',               text: 'text-[hsl(var(--yellow))]', bg: 'bg-[hsl(var(--yellow))]/10' },
  down:        { label: 'Down',        dot: 'bg-destructive',                        text: 'text-destructive',          bg: 'bg-destructive/10' },
};

const latencyToStatus = (ms: number, ok: boolean, thresholds = { good: 400, warn: 1200 }): Status => {
  if (!ok) return 'down';
  if (ms <= thresholds.good) return 'operational';
  if (ms <= thresholds.warn) return 'degraded';
  return 'degraded';
};

export default function SystemStatusPanel() {
  const [checks, setChecks] = useState<Check[]>(initialChecks);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  // Map of edge function name -> probe history (latest first)
  const [edgeHistories, setEdgeHistories] = useState<Record<string, EdgeProbe[]>>({});
  const [detailsFn, setDetailsFn] = useState<string | null>(null);

  const probeEdge = useCallback(async (spec: EdgeFnSpec): Promise<EdgeProbe> => {
    const start = performance.now();
    const ts = Date.now();
    const url = `${SUPABASE_URL}/functions/v1/${spec.name}`;
    try {
      const res = await fetch(url, {
        method: spec.method,
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: spec.method === 'GET' || spec.method === 'OPTIONS' ? undefined : JSON.stringify(spec.body ?? {}),
      });
      const latency = Math.round(performance.now() - start);
      const allowed = new Set([200, 201, 202, 204, ...(spec.okStatuses ?? [])]);
      const healthy = allowed.has(res.status) || (res.status >= 200 && res.status < 300);
      let body: string | undefined;
      if (!healthy) {
        try { body = (await res.text()).slice(0, 4000); } catch { /* noop */ }
      } else {
        try { await res.text(); } catch { /* noop */ }
      }
      return { timestamp: ts, fn: spec.name, status: res.status, ok: true, latency, errorBody: body };
    } catch (e: any) {
      return {
        timestamp: ts,
        fn: spec.name,
        status: null,
        ok: false,
        latency: Math.round(performance.now() - start),
        errorMessage: e?.message ?? 'Network error',
      };
    }
  }, []);

  const runChecks = useCallback(async () => {
    setIsChecking(true);
    setChecks(initialChecks.map(c => ({ ...c, status: 'checking', latency: null, error: undefined })));

    // Run database, auth and per-function probes in parallel
    const [dbResult, authResult, ...edgeResults] = await Promise.all([
      // Database: lightweight count query
      (async () => {
        const start = performance.now();
        try {
          const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
          const latency = Math.round(performance.now() - start);
          return { ok: !error, latency, error: error?.message };
        } catch (e: any) {
          return { ok: false, latency: Math.round(performance.now() - start), error: e?.message ?? 'Network error' };
        }
      })(),
      // Auth: get current session
      (async () => {
        const start = performance.now();
        try {
          const { error } = await supabase.auth.getSession();
          const latency = Math.round(performance.now() - start);
          return { ok: !error, latency, error: error?.message };
        } catch (e: any) {
          return { ok: false, latency: Math.round(performance.now() - start), error: e?.message ?? 'Unreachable' };
        }
      })(),
      ...EDGE_FUNCTIONS.map(spec => probeEdge(spec)),
    ]);

    setEdgeHistories(prev => {
      const next = { ...prev };
      edgeResults.forEach(r => {
        next[r.fn] = [r, ...(prev[r.fn] ?? [])].slice(0, MAX_HISTORY);
      });
      return next;
    });

    setChecks([
      { ...initialChecks[0], status: latencyToStatus(dbResult.latency, dbResult.ok), latency: dbResult.latency, error: dbResult.error },
      { ...initialChecks[1], status: latencyToStatus(authResult.latency, authResult.ok), latency: authResult.latency, error: authResult.error },
    ]);
    setLastChecked(new Date());
    setIsChecking(false);
  }, [probeEdge]);

  useEffect(() => {
    runChecks();
    const id = setInterval(runChecks, 60_000); // refresh every 60s
    return () => clearInterval(id);
  }, [runChecks]);

  // Per-edge-function statuses derived from the latest probe in each history
  const edgeStatuses = EDGE_FUNCTIONS.map(spec => {
    const latest = edgeHistories[spec.name]?.[0];
    if (!latest) return { spec, status: 'checking' as Status, latest: null as EdgeProbe | null };
    const allowed = new Set([200, 201, 202, 204, ...(spec.okStatuses ?? [])]);
    const healthy = latest.ok && latest.status !== null && (allowed.has(latest.status) || (latest.status >= 200 && latest.status < 300));
    const status: Status = !latest.ok
      ? 'down'
      : healthy
      ? latencyToStatus(latest.latency, true, { good: 800, warn: 2500 })
      : (latest.status !== null && latest.status >= 500) ? 'down' : 'degraded';
    return { spec, status, latest };
  });

  const allStatuses: Status[] = [...checks.map(c => c.status), ...edgeStatuses.map(e => e.status)];
  const overall: Status = allStatuses.some(s => s === 'down')
    ? 'down'
    : allStatuses.some(s => s === 'checking')
    ? 'checking'
    : allStatuses.some(s => s === 'degraded')
    ? 'degraded'
    : 'operational';

  const overallMeta = statusMeta[overall];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.32 }}
      className="rounded-xl border border-border/15 bg-card/40 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground tracking-tight">System Status</h3>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Running checks…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${overallMeta.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${overallMeta.dot}`} />
            <span className={`text-[11px] font-medium ${overallMeta.text}`}>{overallMeta.label}</span>
          </div>
          <button
            onClick={runChecks}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="p-2">
        {checks.map((check) => (
          <StatusRow key={check.key} status={check.status} icon={check.icon} label={check.label} description={check.description} latency={check.latency} error={check.error} />
        ))}
      </div>

      {/* Per-edge-function subcards */}
      <div className="px-3 pb-3 pt-1 border-t border-border/10">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[hsl(var(--yellow))]" />
            <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">Edge Functions</span>
          </div>
          <span className="text-[10.5px] text-muted-foreground/55">{EDGE_FUNCTIONS.length} probed</span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {edgeStatuses.map(({ spec, status, latest }) => {
            const meta = statusMeta[status];
            const errorText = latest && !latest.ok
              ? latest.errorMessage ?? 'Unreachable'
              : latest && latest.status !== null && latest.status >= 500
              ? `HTTP ${latest.status}`
              : latest && latest.status !== null && latest.status >= 400 && !(spec.okStatuses ?? []).includes(latest.status)
              ? `HTTP ${latest.status}`
              : undefined;
            return (
              <button
                key={spec.name}
                type="button"
                onClick={() => setDetailsFn(spec.name)}
                className="text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/10 bg-secondary/10 hover:bg-secondary/25 hover:border-border/20 transition-colors"
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground/90 truncate font-mono">{spec.name}</p>
                  <p className="text-[10.5px] text-muted-foreground/55 truncate">
                    {errorText ?? (latest ? `${spec.method} · ${latest.status ?? 'NET'}` : 'Probing…')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {latest && (
                    <span className="text-[10.5px] tabular-nums text-muted-foreground/65">{latest.latency}ms</span>
                  )}
                  <span className={`text-[10px] font-medium ${meta.text}`}>{meta.label}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <EdgeDetailsDialog
        open={detailsFn !== null}
        onOpenChange={(v) => !v && setDetailsFn(null)}
        fnName={detailsFn}
        history={detailsFn ? (edgeHistories[detailsFn] ?? []) : []}
      />
    </motion.div>
  );
}

function StatusRow({
  status, icon: Icon, label, description, latency, error,
}: {
  status: Status; icon: typeof Database; label: string; description: string; latency: number | null; error?: string;
}) {
  const meta = statusMeta[status];
  return (
    <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/15 transition-colors">
      <div className="w-7 h-7 rounded-md bg-secondary/30 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/70" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground/90 truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground/55 truncate">{error ?? description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {latency !== null && (
          <span className="text-[11px] tabular-nums text-muted-foreground/70">{latency}ms</span>
        )}
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${meta.bg}`}>
          {status === 'checking' ? (
            <Loader2 className={`w-3 h-3 ${meta.text} animate-spin`} />
          ) : status === 'down' ? (
            <XCircle className={`w-3 h-3 ${meta.text}`} />
          ) : (
            <CheckCircle2 className={`w-3 h-3 ${meta.text}`} />
          )}
          <span className={`text-[10.5px] font-medium ${meta.text}`}>{meta.label}</span>
        </div>
      </div>
    </div>
  );
}

function EdgeDetailsDialog({
  open,
  onOpenChange,
  fnName,
  history,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fnName: string | null;
  history: EdgeProbe[];
}) {
  const failures = history.filter(h => !h.ok || (h.status !== null && h.status >= 500));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[14px] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[hsl(var(--yellow))]" />
            Edge Function — recent probes
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Last {history.length} ping{history.length === 1 ? '' : 's'} of <code className="font-mono text-foreground/70">{fnName ?? '—'}</code>.
            {failures.length > 0 && ` ${failures.length} failure${failures.length === 1 ? '' : 's'}.`}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3 -mr-3">
          {history.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-muted-foreground/60">
              No probes recorded yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {history.map((h, i) => {
                const isFail = !h.ok || (h.status !== null && h.status >= 500);
                const statusLabel = h.status === null ? 'NETWORK' : `HTTP ${h.status}`;
                return (
                  <li
                    key={`${h.timestamp}-${i}`}
                    className={`rounded-lg border p-3 ${
                      isFail
                        ? 'border-destructive/30 bg-destructive/5'
                        : 'border-border/15 bg-secondary/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono tabular-nums px-1.5 py-0.5 rounded ${
                            isFail
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-[hsl(var(--green))]/10 text-[hsl(var(--green))]'
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <span className="text-muted-foreground/70 tabular-nums">{h.latency}ms</span>
                      </div>
                      <span className="text-muted-foreground/55 tabular-nums">
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {(h.errorMessage || h.errorBody) && (
                      <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground/75 bg-background/40 rounded p-2 max-h-40 overflow-auto">
                        {h.errorMessage ?? h.errorBody}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
