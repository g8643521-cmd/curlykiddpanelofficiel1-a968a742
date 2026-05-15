import { useEffect, useState, useCallback } from 'react';
import { Key, Plus, Copy, Check, Trash2, Loader2, ShieldCheck, Mail, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type CreationKey = {
  id: string;
  key_code: string;
  issued_to: string | null;
  issued_to_email: string | null;
  used_at: string | null;
  used_by: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
};

const generateKeyCode = (): string => {
  // CKP-XXXX-XXXX-XXXX (uppercase alphanumeric, no ambiguous chars)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `CKP-${block(4)}-${block(4)}-${block(4)}`;
};

const ServerCreationKeysPanel = () => {
  const [keys, setKeys] = useState<CreationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('server_creation_keys')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setKeys(data as CreationKey[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleGenerate = async () => {
    setIssuing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.error('Not signed in');
        return;
      }

      let issuedTo: string | null = null;
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', trimmedEmail)
          .maybeSingle();
        if (profile?.user_id) issuedTo = profile.user_id;
      }

      const code = generateKeyCode();
      const { data, error } = await supabase
        .from('server_creation_keys')
        .insert({
          key_code: code,
          issued_to: issuedTo,
          issued_to_email: trimmedEmail || null,
          created_by: session.session.user.id,
          note: note.trim() || null,
        })
        .select()
        .single();

      if (error) {
        toast.error(`Could not generate key: ${error.message}`);
        return;
      }

      toast.success('Key generated', { description: code });
      setEmail('');
      setNote('');
      setKeys((prev) => [data as CreationKey, ...prev]);
      // Auto-copy
      navigator.clipboard.writeText(code).catch(() => {});
      setCopiedId((data as CreationKey).id);
      setTimeout(() => setCopiedId(null), 2000);
    } finally {
      setIssuing(false);
    }
  };

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('server_creation_keys').delete().eq('id', id);
    if (error) {
      toast.error('Could not delete key');
      return;
    }
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success('Key revoked');
  };

  const unused = keys.filter((k) => !k.used_at);
  const used = keys.filter((k) => k.used_at);

  return (
    <div className="space-y-6">
      {/* Header / generator */}
      <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
            <Key className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Server Creation Keys</h3>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Personal one-time keys required to create a Discord server. Each key can be used once.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchKeys} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Issue to (email, optional)</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 pl-9 text-sm bg-background/50 border-border/40"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Input
                placeholder="e.g. for John's gaming server"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-10 text-sm bg-background/50 border-border/40"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={issuing}
              className="h-10 gap-1.5 sm:min-w-[150px]"
            >
              {issuing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Plus className="w-4 h-4" /> Generate key</>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            Leave email empty for an open key anyone can use. Otherwise, only the matching account will see the key.
          </p>
        </div>
      </div>

      {/* Unused keys */}
      <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Active keys
          </h4>
          <Badge variant="outline" className="text-[10px] h-5 px-2 bg-primary/10 border-primary/20 text-primary">
            {unused.length}
          </Badge>
        </div>
        {loading ? (
          <div className="p-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : unused.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/60">No active keys. Generate one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {unused.map((k) => (
              <div key={k.id} className="px-5 py-3 flex items-center gap-3">
                <code className="text-xs font-mono px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border/30 text-foreground tracking-wider">
                  {k.key_code}
                </code>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {k.issued_to_email ? (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-border/40 bg-secondary/30">
                        <Mail className="w-2.5 h-2.5 mr-1" />
                        {k.issued_to_email}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-border/40 bg-secondary/30">
                        Open key
                      </Badge>
                    )}
                    {k.note && (
                      <span className="text-[11px] text-muted-foreground/70 truncate">{k.note}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 inline-flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    Created {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(k.id, k.key_code)}
                  className="h-7 w-7 p-0"
                >
                  {copiedId === k.id ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(k.id)}
                  className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Used keys */}
      {used.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Used keys
            </h4>
            <Badge variant="outline" className="text-[10px] h-5 px-2 border-border/40">
              {used.length}
            </Badge>
          </div>
          <div className="divide-y divide-border/20">
            {used.slice(0, 25).map((k) => (
              <div key={k.id} className="px-5 py-2.5 flex items-center gap-3 opacity-60">
                <code className="text-xs font-mono px-2.5 py-1 rounded-md bg-secondary/20 border border-border/20 text-muted-foreground line-through">
                  {k.key_code}
                </code>
                <div className="flex-1 min-w-0 text-[11px] text-muted-foreground/60">
                  <ShieldCheck className="w-3 h-3 inline mr-1 text-primary/60" />
                  Used {k.used_at && formatDistanceToNow(new Date(k.used_at), { addSuffix: true })}
                  {k.issued_to_email && <span className="ml-2">· {k.issued_to_email}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerCreationKeysPanel;
