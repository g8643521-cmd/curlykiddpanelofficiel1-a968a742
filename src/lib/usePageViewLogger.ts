import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { logActivity } from '@/lib/activityLog';

/**
 * Logs every client-side route change to activity_log.
 * Mounted once at the App level.
 */
export function usePageViewLogger() {
  const loc = useLocation();
  const last = useRef<string>('');

  useEffect(() => {
    const path = loc.pathname + loc.search;
    if (path === last.current) return;
    last.current = path;

    void logActivity({
      category: 'navigation',
      action: 'page_view',
      description: `Visited ${loc.pathname}`,
      severity: 'info',
      metadata: {
        path: loc.pathname,
        search: loc.search || null,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      },
      pagePath: loc.pathname,
    });
  }, [loc.pathname, loc.search]);
}

/** Install global window.error / unhandledrejection listeners (idempotent). */
let installed = false;
export function installGlobalErrorLogger() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (ev) => {
    void logActivity({
      category: 'error',
      action: 'window.error',
      description: ev.message || 'Uncaught error',
      severity: 'error',
      metadata: {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        stack: ev.error?.stack?.slice(0, 4000) || null,
      },
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason: any = ev.reason;
    void logActivity({
      category: 'error',
      action: 'unhandled_rejection',
      description: typeof reason === 'string' ? reason : (reason?.message || 'Unhandled promise rejection'),
      severity: 'error',
      metadata: {
        stack: reason?.stack?.slice(0, 4000) || null,
      },
    });
  });
}