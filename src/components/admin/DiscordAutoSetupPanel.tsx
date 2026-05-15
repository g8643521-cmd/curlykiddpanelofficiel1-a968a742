import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Bot, Hash, Loader2, RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { Send, Lock, Globe, Link2, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Guild { id: string; name: string; icon: string | null }
interface Preset {
  key: string;
  label: string;
  category: string;
  channels: Array<{ name: string; whName: string; target: string }>;
}
interface ChannelRow {
  channel_id: string;
  channel_name: string;
  webhook_id: string;
  webhook_url: string;
  wh_name?: string;
  system_webhook_id?: string;
}
interface Setup {
  key: string;
  guild_id: string;
  category_id: string;
  category_name: string;
  preset: string;
  visibility?: 'public' | 'private';
  allowed_role_ids?: string[];
  created_at: string;
  channels: ChannelRow[];
}

interface Role { id: string; name: string; color: number; position: number }

export default function DiscordAutoSetupPanel({ onChanged }: { onChanged?: () => void }) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string>('');
  const [presetKey, setPresetKey] = useState<string>('complete');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const invoke = async (action: string, body?: any) => {
    const { data, error } = await supabase.functions.invoke('discord-webhook-setup', {
      body: { action, ...(body || {}) },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [g, p, s] = await Promise.all([
        invoke('list-guilds'),
        invoke('presets'),
        invoke('list-setups'),
      ]);
      setGuilds(g.guilds || []);
      setPresets(p.presets || []);
      setSetups(s.setups || []);
      if (!guildId && g.guilds?.[0]) setGuildId(g.guilds[0].id);
    } catch (e: any) {
      toast.error(`Kunne ikke hente bot data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  // Re-fetch roles whenever guild changes
  useEffect(() => {
    if (!guildId) { setRoles([]); setAllowedRoleIds([]); return; }
    let cancelled = false;
    setRolesLoading(true);
    invoke('list-roles', { guild_id: guildId })
      .then(res => { if (!cancelled) setRoles(res.roles || []); })
      .catch(e => toast.error(`Could not fetch roles: ${e.message}`))
      .finally(() => { if (!cancelled) setRolesLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [guildId]);

  const create = async () => {
    if (!guildId) return toast.error('Select a server');
    if (visibility === 'private' && allowedRoleIds.length === 0) {
      return toast.error('Select at least one role allowed to view the channels (or switch to Public)');
    }
    setCreating(true);
    try {
      const res = await invoke('create', {
        guild_id: guildId,
        preset: presetKey,
        visibility,
        allowed_role_ids: visibility === 'private' ? allowedRoleIds : [],
      });
      toast.success(`Created "${res.setup.category_name}" with ${res.setup.channels.length} channels`);
      setAllowedRoleIds([]);
      await refresh();
      onChanged?.();
    } catch (e: any) {
      toast.error(`Setup fejlede: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const testSetup = async (key: string) => {
    setTestingKey(key);
    try {
      const res = await invoke('test-setup', { setup_key: key });
      const errs = (res.errors || []).length;
      if (errs > 0) toast.warning(`Sendte ${res.sent}/${res.total} · ${errs} fejlede`);
      else toast.success(`Test sent to all ${res.sent} channels`);
    } catch (e: any) {
      toast.error(`Test fejlede: ${e.message}`);
    } finally {
      setTestingKey(null);
    }
  };

  const removeSetup = async (key: string) => {
    setDeletingKey(key);
    try {
      const res = await invoke('delete', { setup_key: key });
      const errCount = (res.errors || []).length;
      if (errCount > 0) toast.warning(`Deleted with ${errCount} errors — check logs`);
      else toast.success(`Removed ${res.removedChannels} channels & ${res.removedWebhooks} webhooks`);
      await refresh();
      onChanged?.();
    } catch (e: any) {
      toast.error(`Deletion failed: ${e.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const selectedPreset = presets.find(p => p.key === presetKey);

  return (
    <div className="space-y-5 rounded-xl border border-primary/15 bg-primary/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              Auto-setup via bot
              <Badge variant="outline" className="text-[10px]">
                <Sparkles className="w-3 h-3 mr-1" /> Anbefalet
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground/70">
              Let the bot create the category, channels and webhooks in one operation.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Existing setups */}
      {setups.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground/70">Aktive bot-setups</Label>
          {setups.map(s => (
            <div key={s.key} className="rounded-lg border border-border/30 bg-card/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Hash className="w-3.5 h-3.5 text-primary/70" />
                    <span className="font-medium text-sm">{s.category_name}</span>
                    <Badge variant="outline" className="text-[10px]">{s.preset}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {guilds.find(g => g.id === s.guild_id)?.name || s.guild_id}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {s.visibility === 'private'
                        ? <><Lock className="w-3 h-3" /> Private · {(s.allowed_role_ids || []).length} role(s)</>
                        : <><Globe className="w-3 h-3" /> Public</>}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {s.channels.length} channels · created {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => setExpandedKey(expandedKey === s.key ? null : s.key)}
                  >
                    {expandedKey === s.key
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />}
                    Webhooks
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => testSetup(s.key)}
                    disabled={testingKey === s.key}
                  >
                    {testingKey === s.key
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Send className="w-3.5 h-3.5" />}
                    Test
                  </Button>
                  <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deletingKey === s.key}
                    >
                      {deletingKey === s.key
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all channels?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The bot will delete the category <strong>{s.category_name}</strong>, all {s.channels.length} channels
                        in it, and their webhooks in Discord. The corresponding rows in the webhook database are also removed.
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeSetup(s.key)} className="bg-destructive hover:bg-destructive/90">
                        Slet alt
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {expandedKey === s.key && (
                <div className="mt-3 pt-3 border-t border-border/20 space-y-1.5">
                  {s.channels.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60">No channels / webhooks registered.</p>
                  ) : s.channels.map(ch => (
                    <div key={ch.channel_id} className="flex items-center gap-2 text-[11px] rounded-md bg-card/40 border border-border/20 px-2 py-1.5">
                      <Hash className="w-3 h-3 text-primary/60 shrink-0" />
                      <span className="font-medium shrink-0">{ch.channel_name}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <Link2 className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      <span className="text-muted-foreground/70 shrink-0">{ch.wh_name || 'webhook'}</span>
                      <code className="flex-1 truncate text-muted-foreground/50 font-mono text-[10px]">
                        {ch.webhook_url}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(ch.webhook_url);
                          toast.success('Webhook URL kopieret');
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create new */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground/70">Create new setup</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Discord server</Label>
            <Select value={guildId} onValueChange={setGuildId} disabled={loading || guilds.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={guilds.length === 0 ? 'Bot is not in any servers' : 'Select server'} />
              </SelectTrigger>
              <SelectContent>
                {guilds.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-2">
                      <Bot className="w-3 h-3" /> {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Preset</Label>
            <Select value={presetKey} onValueChange={setPresetKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {presets.map(p => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedPreset && (
          <div className="rounded-lg border border-border/20 bg-card/30 p-3">
            <p className="text-[11px] text-muted-foreground/70 mb-2">
              The bot will create the category <strong>{selectedPreset.category}</strong> with these channels:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedPreset.channels.map(c => (
                <Badge key={c.name} variant="outline" className="text-[10px] gap-1">
                  <Hash className="w-3 h-3" />{c.name.replace(/^[^\w]+/, '')}
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground/70">{c.target}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Visibility */}
        <div className="space-y-2">
          <Label className="text-xs">Who can see the channels?</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`rounded-lg border p-3 text-left transition ${
                visibility === 'public'
                  ? 'border-primary bg-primary/10'
                  : 'border-border/30 hover:border-border/60'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="w-4 h-4" /> Public
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">Visible to everyone in the server</p>
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`rounded-lg border p-3 text-left transition ${
                visibility === 'private'
                  ? 'border-primary bg-primary/10'
                  : 'border-border/30 hover:border-border/60'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="w-4 h-4" /> Private
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">Only selected roles</p>
            </button>
          </div>

          {visibility === 'private' && (
            <div className="rounded-lg border border-border/30 bg-card/40 p-2 mt-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] text-muted-foreground/70">
                  Select roles allowed to view the channels
                </span>
                <span className="text-[11px] text-muted-foreground/60">
                  {allowedRoleIds.length} selected
                </span>
              </div>
              {rolesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : roles.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 px-1 py-2">Ingen roller fundet</p>
              ) : (
                <ScrollArea className="h-40">
                  <div className="space-y-1 pr-2">
                    {roles.map(r => {
                      const checked = allowedRoleIds.includes(r.id);
                      const colorHex = r.color
                        ? `#${r.color.toString(16).padStart(6, '0')}`
                        : 'hsl(var(--muted-foreground))';
                      return (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setAllowedRoleIds(prev =>
                                v ? [...prev, r.id] : prev.filter(id => id !== r.id)
                              );
                            }}
                          />
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: colorHex }}
                          />
                          <span className="text-sm">{r.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <Button onClick={create} disabled={creating || !guildId} className="gap-2 w-full md:w-auto">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Run auto-setup
        </Button>
      </div>
    </div>
  );
}