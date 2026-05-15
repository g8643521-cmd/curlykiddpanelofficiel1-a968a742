import { FormEvent, useMemo, useRef, useState, useEffect } from 'react';
import { Mail, UserPlus, Loader2, Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AddRoleByEmailProps {
  onRoleAssigned?: () => void;
}

type AssignableRole = 'admin' | 'moderator' | 'user' | 'mod_creator' | 'integrations_manager' | 'server_owner';

const ROLE_OPTIONS: { value: AssignableRole; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Full management access' },
  { value: 'moderator', label: 'Moderator', hint: 'Review reports & moderate' },
  { value: 'mod_creator', label: 'Mod Creator', hint: 'Upload and manage mods' },
  { value: 'integrations_manager', label: 'Integrations Manager', hint: 'Manage integrations & webhooks' },
  { value: 'server_owner', label: 'Server Owner', hint: 'Can register & manage Discord bot servers' },
  { value: 'user', label: 'Regular user', hint: 'Standard access' },
];

const isValidEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);

const AddRoleByEmail = ({ onRoleAssigned }: AddRoleByEmailProps) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus email input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = email.trim().toLowerCase();
  const emailValid = useMemo(() => isValidEmail(trimmed), [trimmed]);
  const showError = touched && trimmed.length > 0 && !emailValid;
  const canSubmit = emailValid && !isLoading;

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    setTouched(true);

    if (!trimmed) {
      toast.error('Please enter a user email');
      inputRef.current?.focus();
      return;
    }
    if (!emailValid) {
      toast.error('That email doesn’t look right');
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('assign-role', {
        body: { email: trimmed, role },
      });

      if (error) {
        toast.error(error.message || 'Could not give access');
      } else if (data?.error) {
        toast.error(typeof data.error === 'string' ? data.error : 'Could not give access');
      } else {
        const roleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
        toast.success(`Access granted`, {
          description: `${trimmed} is now a ${roleLabel}.`,
        });
        setEmail('');
        setTouched(false);
        inputRef.current?.focus();
        onRoleAssigned?.();
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="self-start rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">Give access</h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Grant a role to an existing account
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4 p-5">
        <div className="space-y-1.5">
          <label htmlFor="assign-role-email" className="text-xs font-medium text-muted-foreground">
            User email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              ref={inputRef}
              id="assign-role-email"
              placeholder="user@example.com"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={showError}
              className={`h-10 rounded-lg bg-background/50 pl-10 pr-9 text-sm transition-colors ${
                showError
                  ? 'border-destructive/50 focus-visible:ring-destructive/30'
                  : 'border-border/40'
              }`}
            />
            {emailValid && (
              <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary animate-in fade-in zoom-in-50 duration-150" />
            )}
          </div>
          {showError ? (
            <p className="text-[11px] text-destructive/80 mt-1">
              That email doesn’t look right
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              They’ll get access immediately
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger className="h-10 rounded-lg border-border/40 bg-background/50 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="py-2">
                    <div className="flex flex-col">
                      <span className="text-sm">{opt.label}</span>
                      <span className="text-[11px] text-muted-foreground/60">{opt.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-10 rounded-lg px-5 font-medium sm:min-w-[130px] transition-transform active:scale-[0.97] disabled:active:scale-100"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Granting…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Give access
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default AddRoleByEmail;
