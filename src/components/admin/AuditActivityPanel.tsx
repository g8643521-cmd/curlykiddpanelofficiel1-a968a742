import { ScrollText } from 'lucide-react';
import UnifiedAuditFeed from './audit/UnifiedAuditFeed';

export default function AuditActivityPanel() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <ScrollText className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/70">Audit</p>
          <h3 className="text-base font-semibold text-foreground">Audit & Activity</h3>
          <p className="text-xs text-muted-foreground">
            Unified event timeline — auth, navigation, database, scans, webhooks, errors. Live, filtrerbar, eksporterbar.
          </p>
        </div>
      </div>

      <UnifiedAuditFeed />
    </div>
  );
}
