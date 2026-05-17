import { supabase } from '@/lib/supabase';

export type ActivityCategory =
  | 'auth' | 'navigation' | 'bot' | 'scan' | 'cheater' | 'mod'
  | 'admin' | 'webhook' | 'profile' | 'search' | 'system' | 'error';

export type ActivitySeverity = 'info' | 'warning' | 'error' | 'critical';

interface LogEntry {
  category: ActivityCategory;
  action: string;
  description?: string;
  metadata?: Record<string, unknown>;
  severity?: ActivitySeverity;
  pagePath?: string;
}

let cachedSession: { userId?: string; email?: string; name?: string } | null = null;

async function resolveSession() {
  if (cachedSession) return cachedSession;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  cachedSession = u
    ? {
        userId: u.id,
        email: u.email || undefined,
        name: (u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0]) as string | undefined,
      }
    : {};
  return cachedSession;
}

supabase.auth.onAuthStateChange(() => {
  cachedSession = null;
});

/**
 * Log an activity. Writes to activity_log and dispatches to matching system_webhooks
 * via the activity-dispatcher edge function. Deferred to idle time so it
 * never competes with navigation/render.
 */
export async function logActivity(entry: LogEntry): Promise<void> {
  const runWhenIdle = (fn: () => void) => {
    if (typeof window === 'undefined') return fn();
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') ric(fn, { timeout: 2000 });
    else setTimeout(fn, 0);
  };

  runWhenIdle(async () => {
    try {
      const sess = await resolveSession();
      const row = {
        user_id: sess.userId || null,
        user_email: sess.email || null,
        user_display_name: sess.name || null,
        category: entry.category,
        action: entry.action,
        description: entry.description || null,
        metadata: entry.metadata || null,
        page_path: entry.pagePath || (typeof window !== 'undefined' ? window.location.pathname : null),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        severity: entry.severity || 'info',
      };

      // Insert (fire & forget)
      void supabase.from('activity_log').insert(row).then(({ error }: any) => {
        if (error) console.warn('[activityLog] insert failed:', error.message);
      });

      // Dispatch to webhooks (fire & forget)
      void supabase.functions
        .invoke('activity-dispatcher', { body: row })
        .catch((e: any) => console.warn('[activityLog] dispatch failed:', e?.message || e));
    } catch (err) {
      console.warn('[activityLog] unexpected:', err);
    }
  });
}
