import { useState, useEffect } from 'react';
import { Save, Key, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const DiscordCredentialsPanel = () => {
  const [clientId, setClientId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .eq('key', 'discord_client_id');
      if (data) {
        for (const row of data) {
          if (row.key === 'discord_client_id') setClientId(row.value ?? '');
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const entry = { key: 'discord_client_id', value: clientId.trim() };
      const { data: existing } = await supabase
        .from('admin_settings')
        .select('id')
        .eq('key', entry.key)
        .maybeSingle();
      if (existing) {
        await supabase
          .from('admin_settings')
          .update({ value: entry.value, updated_at: new Date().toISOString() })
          .eq('key', entry.key);
      } else {
        await supabase.from('admin_settings').insert({ key: entry.key, value: entry.value });
      }
      toast.success('Discord client ID saved');
    } catch (e) {
      console.error(e);
      toast.error('Could not save credentials');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/30 bg-card/50 p-5 animate-pulse h-full">
        <div className="h-5 w-40 bg-secondary/40 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-9 bg-secondary/20 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border/20 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--magenta))]/10 flex items-center justify-center">
          <Key className="w-4 h-4 text-[hsl(var(--magenta))]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Discord Credentials</h3>
          <p className="text-xs text-muted-foreground">Client ID for OAuth login</p>
        </div>
      </div>
      <div className="p-5 flex-1 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="discord-client-id" className="text-xs text-muted-foreground">Client ID</Label>
          <Input
            id="discord-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="1234567890123456789"
            className="bg-secondary/30 border-border/30 h-8 text-sm font-mono"
          />
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-border/30 bg-secondary/20 p-3">
          <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The <b>Client Secret</b> is stored as a server-side secret (<code className="text-[10px]">DISCORD_CLIENT_SECRET</code>) and is no longer kept in the database. Update it from the project secrets panel — never paste it into a form here.
          </p>
        </div>
      </div>
      <div className="px-5 pb-5">
        <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full gap-1.5 h-8">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isSaving ? 'Saving...' : 'Save client ID'}
        </Button>
      </div>
    </div>
  );
};

export default DiscordCredentialsPanel;
