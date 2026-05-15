import { FormEvent, useState } from 'react';
import { Mail, Crown, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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

interface TransferOwnershipProps {
  onTransferred?: () => void;
}

const TransferOwnership = ({ onTransferred }: TransferOwnershipProps) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error('That email doesn’t look right');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('transfer-ownership', {
        body: { email: email.trim().toLowerCase() },
      });

      if (error) {
        toast.error(error.message || 'Transfer failed');
      } else if (data?.error) {
        toast.error(typeof data.error === 'string' ? data.error : 'Transfer failed');
      } else {
        toast.success(data?.message || 'Ownership transferred');
        setEmail('');
        onTransferred?.();
      }
    } catch {
      toast.error('Something went wrong');
    }
    setIsLoading(false);
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="self-start rounded-xl border border-destructive/30 bg-card/40 backdrop-blur-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-destructive/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <Crown className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              Make someone else owner
            </h3>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Hands over full control of the workspace
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive/80 leading-relaxed">
              You’ll be downgraded to admin and the new owner will have full control. This isn’t easy to undo.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="transfer-email" className="text-xs font-medium text-muted-foreground">
              New owner email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                id="transfer-email"
                placeholder="newowner@example.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-lg border-border/40 bg-background/50 pl-10 text-sm"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="destructive"
            disabled={isLoading}
            className="h-10 rounded-lg px-5 font-medium w-full transition-transform active:scale-[0.98] disabled:active:scale-100"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Transferring…
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 mr-1.5" />
                Transfer ownership
              </>
            )}
          </Button>
        </div>
      </form>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this user the new owner?</AlertDialogTitle>
            <AlertDialogDescription>
              You’re about to hand over ownership to{' '}
              <strong className="text-foreground">{email.trim().toLowerCase()}</strong>. You’ll be
              downgraded to admin and won’t be able to easily reverse this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep ownership</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TransferOwnership;
