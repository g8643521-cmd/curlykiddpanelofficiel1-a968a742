import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Webhook, Plus, Trash2, Send, Edit, CheckCircle2, XCircle, Loader2, Activity,
  Eye, EyeOff, Copy, Power, AlertTriangle, ShieldCheck, BellRing, Filter,
} from 'lucide-react';
import DiscordAutoSetupPanel from './DiscordAutoSetupPanel';

interface SystemWebhook {
  id: string;
  name: string;
  category: string;
  webhook_url: string;
  description: string | null;
  enabled: boolean;
  mention_role_id: string | null;
  min_severity: string;
  last_used_at: string | null;
  last_status: string | null;
  last_error: string | null;
  total_sent: number;
  total_failed: number;
  created_at: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All events' },
  { value: 'auth', label: 'Auth (login/logout)' },
  { value: 'navigation', label: 'Navigation' },
  { value: 'bot', label: 'Bot' },
  { value: 'scan', label: 'Scans' },
  { value: 'cheater', label: 'Cheater reports' },
  { value: 'mod', label: 'FiveM mods' },
  { value: 'admin', label: 'Admin actions' },
  { value: 'webhook', label: 'Webhook events' },
  { value: 'profile', label: 'Profile changes' },
  { value: 'search', label: 'Searches' },
  { value: 'system', label: 'System' },
  { value: 'error', label: 'Errors' },
];

const SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'critical', label: 'Critical' },
];

const empty = {
  name: '',
  category: 'all',
  webhook_url: '',
  description: '',
  enabled: true,
  mention_role_id: '',
  min_severity: 'info',
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  error: 'bg-red-500/10 text-red-300 border-red-500/20',
  critical: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
};

const maskWebhook = (url: string) => {
  if (!url) return '';
  const tail = url.slice(-6);
  return `https://discord.com/api/webhooks/••••••••••${tail}`;
};

export default function SystemWebhooksPanel() {
  const [webhooks, setWebhooks] = useState<SystemWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SystemWebhook | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [revealUrl, setRevealUrl] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<SystemWebhook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled' | 'failing'>('all');

  useEffect(() => { fetchWebhooks(); }, []);

  const fetchWebhooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_webhooks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load webhooks');
    else setWebhooks(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (wh: SystemWebhook) => {
    setEditing(wh);
    setForm({
      name: wh.name,
      category: wh.category,
      webhook_url: wh.webhook_url,
      description: wh.description || '',
      enabled: wh.enabled,
      mention_role_id: wh.mention_role_id || '',
      min_severity: wh.min_severity,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.webhook_url.trim()) {
      toast.error('Name and webhook URL are required');
      return;
    }
    if (!/^https:\/\/(discord(app)?\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\//.test(form.webhook_url)) {
      toast.error('Must be a valid Discord webhook URL');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      webhook_url: form.webhook_url.trim(),
      description: form.description.trim() || null,
      enabled: form.enabled,
      mention_role_id: form.mention_role_id.trim() || null,
      min_severity: form.min_severity,
    };
    if (editing) {
      const { error } = await supabase.from('system_webhooks').update(payload).eq('id', editing.id);
      if (error) toast.error(error.message);
      else { toast.success('Webhook updated'); setOpen(false); fetchWebhooks(); }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('system_webhooks').insert({ ...payload, created_by: user?.id });
      if (error) toast.error(error.message);
      else { toast.success('Webhook created'); setOpen(false); fetchWebhooks(); }
    }
    setSaving(false);
  };

  const removeWebhook = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('system_webhooks').delete().eq('id', confirmDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Webhook deleted');
      setWebhooks(prev => prev.filter(w => w.id !== confirmDelete.id));
    }
    setDeleting(false);
    setConfirmDelete(null);
  };

  const toggleEnabled = async (wh: SystemWebhook) => {
    const next = !wh.enabled;
    const { error } = await supabase.from('system_webhooks').update({ enabled: next }).eq('id', wh.id);
    if (error) { toast.error(error.message); return; }
    setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, enabled: next } : w));
    toast.success(next ? 'Webhook enabled' : 'Webhook paused');
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Webhook URL copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const testWebhook = async (wh: SystemWebhook) => {
    setTestingId(wh.id);
    try {
      const { data, error } = await supabase.functions.invoke('activity-dispatcher', {
        body: {
          category: wh.category === 'all' ? 'system' : wh.category,
          action: 'Test webhook',
          description: `This is a test message from "${wh.name}".`,
          severity: 'info',
          metadata: { webhook_id: wh.id, sent_from: 'admin_panel' },
        },
      });
      if (error) throw error;
      if ((data as any)?.dispatched > 0) toast.success(`Test sent · dispatched to ${(data as any).dispatched} webhook(s)`);
      else toast.warning('Test ran but no webhooks matched the category/severity filter');
      fetchWebhooks();
    } catch (e: any) {
      toast.error(`Test failed: ${e.message}`);
    } finally {
      setTestingId(null);
    }
  };

  // ── derived ──
  const stats = {
    total: webhooks.length,
    enabled: webhooks.filter(w => w.enabled).length,
    sent: webhooks.reduce((a, w) => a + (w.total_sent || 0), 0),
    failed: webhooks.reduce((a, w) => a + (w.total_failed || 0), 0),
  };

  const filtered = webhooks.filter(w => {
    if (filter === 'enabled') return w.enabled;
    if (filter === 'disabled') return !w.enabled;
    if (filter === 'failing') return w.last_status && w.last_status !== 'success';
    return true;
  });

  const openCreateAndReset = () => {
    setRevealUrl(false);
    openCreate();
  };

  const openEditAndReset = (wh: SystemWebhook) => {
    setRevealUrl(false);
    openEdit(wh);
  };

  return (
    <div className="space-y-6">
      <DiscordAutoSetupPanel onChanged={fetchWebhooks} />

      {/* Header */}
      <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/60 via-card/30 to-card/60 backdrop-blur p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center">
              <Webhook className="w-6 h-6 text-primary" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Discord Webhooks</h3>
              <p className="text-xs text-muted-foreground/80 max-w-md">
                Route activity from across the platform into Discord channels with per-category and severity filters.
              </p>
            </div>
          </div>
          <Button onClick={openCreateAndReset} size="sm" className="gap-2 shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add webhook
          </Button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          {[
            { label: 'Configured', value: stats.total, icon: Webhook, tone: 'text-foreground' },
            { label: 'Active', value: stats.enabled, icon: ShieldCheck, tone: 'text-emerald-400' },
            { label: 'Delivered', value: stats.sent, icon: CheckCircle2, tone: 'text-sky-400' },
            { label: 'Failed', value: stats.failed, icon: AlertTriangle, tone: stats.failed ? 'text-red-400' : 'text-muted-foreground' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border/20 bg-background/40 px-3 py-2.5 flex items-center gap-3">
              <s.icon className={`w-4 h-4 ${s.tone}`} />
              <div className="min-w-0">
                <div className={`text-base font-semibold leading-none ${s.tone}`}>{s.value.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter row */}
      {webhooks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground/60" />
          {([
            { v: 'all', label: `All (${stats.total})` },
            { v: 'enabled', label: `Active (${stats.enabled})` },
            { v: 'disabled', label: `Paused (${stats.total - stats.enabled})` },
            { v: 'failing', label: 'Failing' },
          ] as const).map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                filter === f.v
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-card/30 border-border/20 text-muted-foreground hover:border-border/40 hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
          </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading webhooks…</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/20 px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-4">
            <Webhook className="w-7 h-7 text-primary/70" />
          </div>
          <p className="text-sm font-semibold">No webhooks configured</p>
          <p className="text-xs text-muted-foreground/70 mt-1.5 max-w-sm mx-auto">
            Add your first Discord webhook to start streaming platform activity into a channel of your choice.
          </p>
          <Button onClick={openCreateAndReset} size="sm" className="gap-2 mt-5">
            <Plus className="w-4 h-4" /> Add your first webhook
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/20 bg-card/20 px-4 py-10 text-center text-xs text-muted-foreground">
          No webhooks match this filter.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((wh) => {
            const failing = wh.last_status && wh.last_status !== 'success';
            const sevStyle = SEVERITY_STYLES[wh.min_severity] ?? SEVERITY_STYLES.info;
            const isSecretShown = !!showSecret[wh.id];
            return (
              <div
                key={wh.id}
                className={`group relative rounded-xl border bg-gradient-to-br from-card/60 to-card/30 p-4 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 ${
                  failing ? 'border-red-500/30' : 'border-border/20'
                }`}
              >
                {/* Status accent bar */}
                <div
                  className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${
                    !wh.enabled ? 'bg-muted-foreground/40'
                      : failing ? 'bg-red-500'
                      : 'bg-emerald-500'
                  }`}
                />

                <div className="flex items-start justify-between gap-4 pl-2">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{wh.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{wh.category}</Badge>
                      <Badge variant="outline" className={`text-[10px] capitalize ${sevStyle}`}>≥ {wh.min_severity}</Badge>
                      {wh.enabled ? (
                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 mr-1.5" />
                          Paused
                        </Badge>
                      )}
                      {wh.mention_role_id && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <BellRing className="w-2.5 h-2.5" /> mention
                        </Badge>
                      )}
                    </div>

                    {wh.description && (
                      <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-2">{wh.description}</p>
                    )}

                    {/* Webhook URL pill */}
                    <div className="mt-2.5 flex items-center gap-1.5 max-w-full">
                      <code className="text-[10px] font-mono px-2 py-1 rounded-md bg-background/60 border border-border/20 text-muted-foreground truncate flex-1 min-w-0">
                        {isSecretShown ? wh.webhook_url : maskWebhook(wh.webhook_url)}
                      </code>
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => setShowSecret(p => ({ ...p, [wh.id]: !p[wh.id] }))}
                        title={isSecretShown ? 'Hide URL' : 'Reveal URL'}
                      >
                        {isSecretShown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => copyUrl(wh.webhook_url)}
                        title="Copy URL"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground/70 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="font-medium text-foreground/80">{wh.total_sent.toLocaleString()}</span> delivered
                      </span>
                      <span className="flex items-center gap-1.5">
                        <XCircle className={`w-3 h-3 ${wh.total_failed ? 'text-red-400' : 'text-muted-foreground/40'}`} />
                        <span className={`font-medium ${wh.total_failed ? 'text-red-300' : 'text-foreground/60'}`}>
                          {wh.total_failed.toLocaleString()}
                        </span> failed
                      </span>
                      {wh.last_used_at && (
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3 h-3" />
                          {new Date(wh.last_used_at).toLocaleString()}
                        </span>
                      )}
                      {failing && (
                        <span className="flex items-center gap-1.5 text-red-400">
                          <AlertTriangle className="w-3 h-3" /> {wh.last_status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => testWebhook(wh)}
                      disabled={testingId === wh.id}
                      className="gap-1.5 h-8"
                      title="Send test message"
                    >
                      {testingId === wh.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline text-xs">Test</span>
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => toggleEnabled(wh)}
                      title={wh.enabled ? 'Pause' : 'Activate'}
                    >
                      <Power className={`w-3.5 h-3.5 ${wh.enabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditAndReset(wh)} title="Edit">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete(wh)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">{editing ? 'Edit webhook' : 'Add Discord webhook'}</DialogTitle>
                <DialogDescription className="text-xs">
                  Activity matching the chosen category & severity will be delivered to this Discord channel.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Errors → #alerts" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Discord webhook URL</Label>
              <div className="relative">
                <Input
                  type={revealUrl ? 'text' : 'password'}
                  value={form.webhook_url}
                  onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setRevealUrl(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  tabIndex={-1}
                >
                  {revealUrl ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                Server Settings → Integrations → Webhooks in Discord. The URL is stored securely.
              </p>
            </div>

            <Separator className="bg-border/20" />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Min severity</Label>
                <Select value={form.min_severity} onValueChange={(v) => setForm({ ...form, min_severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description <span className="text-muted-foreground/40 normal-case">(optional)</span></Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this webhook used for?"
                className="resize-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mention role ID <span className="text-muted-foreground/40 normal-case">(optional)</span></Label>
              <Input value={form.mention_role_id} onChange={(e) => setForm({ ...form, mention_role_id: e.target.value })} placeholder="123456789012345678" />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/20 bg-card/30 p-3.5">
              <div className="flex items-center gap-3">
                <Power className={`w-4 h-4 ${form.enabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                <div>
                  <Label className="text-sm">Enabled</Label>
                  <p className="text-[11px] text-muted-foreground/70">Pause delivery without deleting the webhook.</p>
                </div>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2 min-w-[140px]">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>{editing ? 'Save changes' : 'Create webhook'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}>
        <AlertDialogContent className="backdrop-blur-xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 ring-1 ring-destructive/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs">
                  <span className="font-semibold text-foreground">{confirmDelete?.name}</span> will be permanently removed. Activity matching this filter will no longer be delivered to Discord.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); removeWebhook(); }}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 gap-2 min-w-[120px]"
            >
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : <>Delete</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
