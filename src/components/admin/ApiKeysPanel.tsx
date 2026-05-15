import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Key, Save, CheckCircle, Eye, EyeOff, AlertTriangle, Wifi, WifiOff, Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const secretSchema = z.string().trim().min(1, 'Field cannot be empty').max(4000, 'Value is too long');
const urlSchema = z
  .string()
  .trim()
  .min(1, 'URL cannot be empty')
  .max(500, 'URL is too long')
  .url('Enter a valid URL')
  .refine((value) => value.startsWith('https://') || value.startsWith('http://'), 'URL must start with http:// or https://');

interface ApiKeyField {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  dbKey: string;
  validation: z.ZodType<string>;
  isSecret?: boolean;
  testFn?: () => Promise<boolean>;
}

const ApiKeysPanel = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState<Record<string, boolean | null | undefined>>({});

  const getStoredValue = async (key: string) => {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    return typeof data?.value === 'string' ? data.value : '';
  };

  const testDiscordWebhook = async (): Promise<boolean> => {
    try {
      const webhookUrl = await getStoredValue('discord_webhook_url');
      if (!webhookUrl) {
        toast.error('Save webhook URL first');
        return false;
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'CurlyKiddPanel',
          avatar_url: 'https://svmulnlysrsmxolvgxnw.supabase.co/storage/v1/object/public/public-assets/bot-avatar.png',
          embeds: [{
            title: '✅ CurlyKiddPanel Connected',
            description: 'Discord webhook is working correctly.',
            color: 0x2dd4bf,
            timestamp: new Date().toISOString(),
            footer: { text: 'CurlyKiddPanel Test' },
          }],
        }),
      });

      return res.ok;
    } catch {
      return false;
    }
  };

  const testDiscordBot = async (): Promise<boolean> => {
    try {
      const botToken = await getStoredValue('discord_bot_token');
      if (!botToken) {
        toast.error('Save bot token first');
        return false;
      }

      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${botToken}` },
      });

      return res.ok;
    } catch {
      return false;
    }
  };

  const testScreenshare = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('screensharex-lookup', {
        body: { query: 'ping', discord_id: '665525545114664970' },
      });

      return !error && data?.success === true;
    } catch {
      return false;
    }
  };

  const API_KEY_FIELDS: ApiKeyField[] = [
    {
      id: 'discord_bot_token',
      label: 'Discord Bot Token',
      description: 'Token for your Discord bot.',
      placeholder: 'Paste your Discord bot token...',
      dbKey: 'discord_bot_token',
      validation: secretSchema,
      testFn: testDiscordBot,
    },
    {
      id: 'screensharex_api_key',
      label: 'ScreenshareAPI Key',
      description: 'API key for the Screenshare integration.',
      placeholder: 'Paste your API key...',
      dbKey: 'screensharex_api_key',
      validation: secretSchema,
      testFn: testScreenshare,
    },
  ];

  // Auto-load all saved keys on mount
  useEffect(() => {
    const loadAll = async () => {
      for (const field of API_KEY_FIELDS) {
        const value = await getStoredValue(field.dbKey);
        if (value) {
          setValues((prev) => ({ ...prev, [field.id]: value }));
          setLoaded((prev) => ({ ...prev, [field.id]: true }));
          setSaved((prev) => ({ ...prev, [field.id]: true }));
        } else {
          setLoaded((prev) => ({ ...prev, [field.id]: true }));
        }
      }
    };
    loadAll();
  }, []);

  const handleCopy = (field: ApiKeyField) => {
    const value = values[field.id];
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success(`${field.label} copied`);
    }
  };

  const handleSave = async (field: ApiKeyField, autoTest = true) => {
    const rawValue = values[field.id] ?? '';
    const parsed = field.validation.safeParse(rawValue);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? `Invalid value for ${field.label}`);
      return;
    }

    setSaving((prev) => ({ ...prev, [field.id]: true }));

    const { error } = await supabase
      .from('admin_settings')
      .upsert({ key: field.dbKey, value: parsed.data }, { onConflict: 'key' });

    if (error) {
      toast.error(`Could not save ${field.label}`);
      setSaving((prev) => ({ ...prev, [field.id]: false }));
      return;
    }

    toast.success(`${field.label} saved`);
    setSaved((prev) => ({ ...prev, [field.id]: true }));
    setSaving((prev) => ({ ...prev, [field.id]: false }));

    // Auto-test connection after save
    if (autoTest && field.testFn) {
      await handleTest(field);
    }
  };

  const handleDelete = async (field: ApiKeyField) => {
    const { error } = await supabase
      .from('admin_settings')
      .delete()
      .eq('key', field.dbKey);

    if (!error) {
      toast.success(`${field.label} removed`);
      setValues((prev) => ({ ...prev, [field.id]: '' }));
      setSaved((prev) => ({ ...prev, [field.id]: false }));
      setLoaded((prev) => ({ ...prev, [field.id]: false }));
      setConnected((prev) => ({ ...prev, [field.id]: null }));
    }
  };

  const handleTest = async (field: ApiKeyField) => {
    if (!field.testFn) return;

    setTesting((prev) => ({ ...prev, [field.id]: true }));
    const success = await field.testFn();
    setConnected((prev) => ({ ...prev, [field.id]: success }));

    if (success) {
      toast.success(`${field.label} connected`);
    } else {
      toast.error(`${field.label} failed — check key and URL`);
    }

    setTesting((prev) => ({ ...prev, [field.id]: false }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Key className="w-5 h-5 text-[hsl(var(--yellow))]" />
        <h2 className="text-xl font-bold text-foreground">API Keys & Tokens</h2>
      </div>

      <div className="bg-[hsl(var(--yellow))]/5 border border-[hsl(var(--yellow))]/20 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[hsl(var(--yellow))] shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Save your keys here and click <strong>Connect</strong> to test the connection.
        </p>
      </div>

      <div className="grid gap-6">
        {API_KEY_FIELDS.map((field) => {
          const isSecret = field.isSecret !== false;

          return (
            <div key={field.id} className="bg-card/50 backdrop-blur-sm border border-border/30 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-base font-semibold text-foreground">{field.label}</Label>
                  <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {connected[field.id] === true && (
                    <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/50">
                      <Wifi className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                  {connected[field.id] === false && (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/50">
                      <WifiOff className="w-3 h-3 mr-1" />
                      Failed
                    </Badge>
                  )}
                  {saved[field.id] && connected[field.id] === undefined && (
                    <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/50">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Saved
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input
                    type={isSecret && !visibility[field.id] ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={values[field.id] || ''}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, [field.id]: e.target.value }));
                      setConnected((prev) => ({ ...prev, [field.id]: undefined }));
                    }}
                    onBlur={() => {
                      if (values[field.id]?.trim()) void handleSave(field);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && values[field.id]?.trim()) void handleSave(field);
                    }}
                    className={isSecret ? 'pr-10 bg-background/50 border-border/50' : 'bg-background/50 border-border/50'}
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => setVisibility((prev) => ({ ...prev, [field.id]: !prev[field.id] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {visibility[field.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {saved[field.id] && values[field.id] && (
                  <Button variant="outline" size="icon" onClick={() => handleCopy(field)} className="shrink-0" title="Copy">
                    <Copy className="w-4 h-4" />
                  </Button>
                )}

                <Button
                  onClick={() => void handleSave(field)}
                  disabled={saving[field.id] || !values[field.id]?.trim()}
                  className="shrink-0 gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </Button>

                {saved[field.id] && field.testFn && (
                  <Button
                    variant="outline"
                    onClick={() => void handleTest(field)}
                    disabled={testing[field.id]}
                    className="shrink-0 gap-2"
                  >
                    {testing[field.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                    Connect
                  </Button>
                )}

                {saved[field.id] && (
                  <Button variant="destructive" size="icon" onClick={() => void handleDelete(field)} className="shrink-0">
                    ×
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApiKeysPanel;
