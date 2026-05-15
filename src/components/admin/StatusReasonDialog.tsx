import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, PauseCircle, ShieldOff, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusVariant = 'pause' | 'blacklist' | 'suspend' | 'ban' | 'reactivate';

const VARIANT_META: Record<StatusVariant, {
  title: string;
  description: string;
  confirmLabel: string;
  Icon: typeof AlertTriangle;
  ring: string;
  iconWrap: string;
  iconColor: string;
  confirmClass: string;
  requiresReason: boolean;
  placeholder: string;
}> = {
  pause: {
    title: 'Pause Server',
    description: 'The server owner will see a Paused overlay. Scans will be blocked until reactivated.',
    confirmLabel: 'Pause Server',
    Icon: PauseCircle,
    ring: 'ring-amber-500/30',
    iconWrap: 'bg-amber-500/15 ring-amber-500/40',
    iconColor: 'text-amber-400',
    confirmClass: 'bg-amber-500 text-black hover:bg-amber-400',
    requiresReason: true,
    placeholder: 'e.g. Suspicious activity detected, awaiting review.',
  },
  blacklist: {
    title: 'Blacklist Server',
    description: 'The server will be permanently blocked. The owner will see a red Blacklisted overlay.',
    confirmLabel: 'Blacklist Server',
    Icon: ShieldOff,
    ring: 'ring-red-500/30',
    iconWrap: 'bg-red-500/15 ring-red-500/40',
    iconColor: 'text-red-400',
    confirmClass: 'bg-red-500 text-white hover:bg-red-400',
    requiresReason: true,
    placeholder: 'e.g. Repeated terms-of-service violations.',
  },
  suspend: {
    title: 'Suspend Account',
    description: 'The user will be locked out with a full-screen suspended notice until reinstated.',
    confirmLabel: 'Suspend Account',
    Icon: PauseCircle,
    ring: 'ring-amber-500/30',
    iconWrap: 'bg-amber-500/15 ring-amber-500/40',
    iconColor: 'text-amber-400',
    confirmClass: 'bg-amber-500 text-black hover:bg-amber-400',
    requiresReason: true,
    placeholder: 'e.g. Pending investigation of reported behavior.',
  },
  ban: {
    title: 'Permanently Ban Account',
    description: 'The user will be permanently locked out with a red banned notice on every page.',
    confirmLabel: 'Ban Account',
    Icon: ShieldOff,
    ring: 'ring-red-500/30',
    iconWrap: 'bg-red-500/15 ring-red-500/40',
    iconColor: 'text-red-400',
    confirmClass: 'bg-red-500 text-white hover:bg-red-400',
    requiresReason: true,
    placeholder: 'e.g. Severe terms-of-service violation.',
  },
  reactivate: {
    title: 'Reactivate',
    description: 'Lift the current restriction and restore normal access immediately.',
    confirmLabel: 'Reactivate',
    Icon: PlayCircle,
    ring: 'ring-emerald-500/30',
    iconWrap: 'bg-emerald-500/15 ring-emerald-500/40',
    iconColor: 'text-emerald-400',
    confirmClass: 'bg-emerald-500 text-black hover:bg-emerald-400',
    requiresReason: false,
    placeholder: '',
  },
};

interface Props {
  open: boolean;
  variant: StatusVariant;
  targetName: string;
  defaultReason?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
}

export default function StatusReasonDialog({
  open, variant, targetName, defaultReason, loading, onCancel, onConfirm,
}: Props) {
  const meta = VARIANT_META[variant];
  const [reason, setReason] = useState(defaultReason || '');

  useEffect(() => {
    if (open) setReason(defaultReason || '');
  }, [open, defaultReason]);

  const trimmed = reason.trim();
  const canConfirm = !meta.requiresReason || trimmed.length >= 3;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onCancel(); }}>
      <DialogContent className="border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-2', meta.iconWrap)}>
              <meta.Icon className={cn('h-5 w-5', meta.iconColor)} strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold tracking-tight">
                {meta.title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Target: <span className="font-medium text-foreground">{targetName}</span>
              </DialogDescription>
              <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
                {meta.description}
              </p>
            </div>
          </div>
        </DialogHeader>

        {meta.requiresReason && (
          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Reason {meta.requiresReason && <span className="text-destructive">*</span>}
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={meta.placeholder}
              rows={4}
              autoFocus
              disabled={loading}
              className="resize-none bg-background/50"
            />
            <p className="text-[10px] text-muted-foreground/70">
              This message will be visible to the {variant === 'suspend' || variant === 'ban' ? 'user' : 'server owner'}.
            </p>
          </div>
        )}

        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            className={meta.confirmClass}
            disabled={!canConfirm || loading}
            onClick={() => onConfirm(meta.requiresReason ? trimmed : null)}
          >
            {loading ? 'Working…' : meta.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}