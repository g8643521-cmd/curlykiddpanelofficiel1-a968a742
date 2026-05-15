// @ts-nocheck
import { useState, useEffect } from 'react';
import { Upload, Settings, CheckCircle, AlertCircle, Loader2, ExternalLink, Bot, Hash, Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ModUploadConfig {
  channel_id: string;
  notification_webhook_url: string;
  configured_at: string;
}

const DiscordModUploadPanel = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [config, setConfig] = useState<ModUploadConfig | null>(null);
  const [channelId, setChannelId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-mod-webhook', {
        body: { action: 'get_config' },
      });

      if (error) throw error;
      
      if (data?.config) {
        setConfig(data.config);
        setChannelId(data.config.channel_id || '');
        setWebhookUrl(data.config.notification_webhook_url || '');
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!channelId.trim()) {
      toast.error('Please enter a channel ID');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-mod-webhook', {
        body: {
          action: 'configure',
          channel_id: channelId.trim(),
          notification_webhook_url: webhookUrl.trim() || null,
        },
      });

      if (error) throw error;
      
      toast.success('Configuration saved successfully');
      fetchConfig();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-mod-webhook', {
        body: { action: 'test' },
      });

      if (error) throw error;
      
      toast.success('Webhook is working correctly!');
    } catch (error) {
      console.error('Test failed:', error);
      toast.error('Webhook test failed');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Discord Mod Upload</CardTitle>
              <CardDescription>
                Auto-create mods from Discord file uploads with AI
              </CardDescription>
            </div>
          </div>
          <Badge variant={config ? 'default' : 'secondary'}>
            {config ? (
              <><CheckCircle className="w-3 h-3 mr-1" /> Configured</>
            ) : (
              <><AlertCircle className="w-3 h-3 mr-1" /> Not Configured</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* How it works */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            How it works
          </h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Upload a mod file (.rpf, .zip, etc.) to the configured Discord channel</li>
            <li>Your Discord bot detects the file and sends it to our webhook</li>
            <li>AI analyzes the file and generates name, description & category</li>
            <li>The mod is automatically created in your FiveM Mods library</li>
          </ol>
        </div>

        {/* Configuration form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel_id" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Discord Channel ID
            </Label>
            <Input
              id="channel_id"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="e.g., 1234567890123456789"
            />
            <p className="text-xs text-muted-foreground">
              Right-click the channel in Discord and select "Copy Channel ID"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_url" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notification Webhook URL (optional)
            </Label>
            <Input
              id="webhook_url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
            />
            <p className="text-xs text-muted-foreground">
              Receive confirmation messages when mods are auto-created
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Settings className="w-4 h-4 mr-2" /> Save Configuration</>
            )}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Test'
            )}
          </Button>
        </div>

        {/* Bot setup instructions */}
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <h4 className="font-semibold text-amber-600 dark:text-amber-400 mb-2">
            ⚠️ Bot Setup Required
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            To enable automatic mod uploads, your Discord bot needs to listen for messages 
            in the configured channel and forward file attachments to the webhook endpoint.
          </p>
          <div className="text-xs font-mono bg-background/50 p-3 rounded border">
            <p className="text-muted-foreground mb-1">Webhook URL:</p>
            <code className="text-primary break-all">
              {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-mod-webhook`}
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Send POST requests with <code className="text-primary">action: "process_upload"</code> and 
            the Discord message object containing file attachments.
          </p>
        </div>

        {/* Last configured */}
        {config?.configured_at && (
          <p className="text-xs text-muted-foreground text-center">
            Last configured: {new Date(config.configured_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default DiscordModUploadPanel;
