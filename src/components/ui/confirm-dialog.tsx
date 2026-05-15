import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Info, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConfirmVariant = 'default' | 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve?: (value: boolean) => void;
}

const ConfirmCtx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

const VARIANT_STYLES: Record<ConfirmVariant, { icon: typeof AlertTriangle; iconWrap: string; confirm: string }> = {
  default: {
    icon: Info,
    iconWrap: 'bg-primary/15 text-primary ring-1 ring-primary/30',
    confirm: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
  danger: {
    icon: Trash2,
    iconWrap: 'bg-destructive/15 text-destructive ring-1 ring-destructive/30',
    confirm: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
    confirm: 'bg-amber-500 text-black hover:bg-amber-400',
  },
  info: {
    icon: Zap,
    iconWrap: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
    confirm: 'bg-sky-500 text-white hover:bg-sky-400',
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ open: false });

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, ...opts, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    state.resolve?.(result);
    setState((s) => ({ ...s, open: false }));
  };

  const variant = state.variant ?? 'default';
  const v = VARIANT_STYLES[variant];
  const Icon = v.icon;

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) close(false); }}>
        <AlertDialogContent className="border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-start gap-4">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', v.iconWrap)}>
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <AlertDialogTitle className="text-base font-semibold tracking-tight">
                  {state.title ?? 'Er du sikker?'}
                </AlertDialogTitle>
                {state.description && (
                  <AlertDialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {state.description}
                  </AlertDialogDescription>
                )}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel onClick={() => close(false)} className="mt-0">
              {state.cancelText ?? 'Annuller'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => close(true)} className={v.confirm}>
              {state.confirmText ?? 'Bekræft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}