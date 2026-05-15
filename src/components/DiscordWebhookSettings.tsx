import { useState, useEffect } from 'react';
import { Send, CheckCircle, XCircle, Loader2, Eye, EyeOff, RefreshCw, Bell, Hash, Webhook, Globe, Shield, UserPlus, Search, Server, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import DiscordEmbedBuilder, { type EmbedConfig, defaultEmbedConfig } from './DiscordEmbedBuilder';

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface WebhookChannel {
  id: string;
  label: string;
  description: string;
  dbKey: string;
  icon: React.ReactNode;
  color: string;
  variables: string[];
}

const CHANNEL_VARIABLES: Record<string, string[]> = {
  cheater_report: ['player_name', 'status', 'reason', 'server_name', 'server_code', 'evidence_url', 'reported_by', 'timestamp'],
  search_lookup: ['search_query', 'searched_by', 'results_count', 'sx_username', 'sx_tickets', 'sx_guilds', 'discord_id', 'discord_avatar_url', 'discord_profile_url', 'timestamp'],
  server_lookup: ['server_name', 'server_code', 'players', 'player_count', 'max_players', 'gametype', 'mapname', 'owner', 'owner_name', 'locale', 'premium', 'premium_tier', 'upvotes', 'upvote_power', 'ip', 'server_ip', 'onesync', 'txadmin', 'game_build', 'script_hook', 'pure_level', 'tags', 'server_version', 'resource_count', 'discord_guild_id', 'queue_count', 'searched_by', 'searched_by_email', 'timestamp'],
  signup: ['user_email', 'display_name', 'auth_provider', 'user_id', 'ip', 'country', 'region', 'city', 'location', 'isp', 'browser', 'os', 'device', 'language', 'platform', 'screen_resolution', 'timezone', 'referrer', 'created_at', 'last_sign_in', 'email_confirmed', 'phone', 'timestamp'],
  mod_upload: ['mod_name', 'mod_description', 'mod_category', 'mod_version', 'file_name', 'file_size', 'uploaded_by', 'is_featured', 'timestamp'],
};

const DiscordWebhookSettings = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [searchWebhookUrl, setSearchWebhookUrl] = useState('');
  const [signupWebhookUrl, setSignupWebhookUrl] = useState('');
  const [serverLookupWebhookUrl, setServerLookupWebhookUrl] = useState('');
  const [modUploadWebhookUrl, setModUploadWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [notifyNewReports, setNotifyNewReports] = useState(true);
  const [notifyStatusChanges, setNotifyStatusChanges] = useState(true);
  const [notifyRemovals, setNotifyRemovals] = useState(false);
  const [notifyVisitorLogs, setNotifyVisitorLogs] = useState(false);
  const [mentionRoleId, setMentionRoleId] = useState('');
  const [visitorLogRoleId, setVisitorLogRoleId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [testingChannel, setTestingChannel] = useState<string | null>(null);


  // Per-channel embed configs with professional defaults
  const [embedConfigs, setEmbedConfigs] = useState<Record<string, EmbedConfig>>({
    cheater_report: {
      ...defaultEmbedConfig,
      title: '⚠️ Cheater Report',
      description: '**{player_name}** has been reported.\n\n**Status:** {status}\n**Reason:** {reason}',
      color: '#DC2626',
      footer: 'CurlyKiddPanel • Cheater Reports',
      author_name: 'CurlyKiddPanel',
      fields: [
        { name: '🎮 Player', value: '{player_name}', inline: true },
        { name: '📊 Status', value: '{status}', inline: true },
        { name: '🖥️ Server', value: '{server_name}', inline: true },
        { name: '📝 Reason', value: '{reason}', inline: false },
        { name: '🔗 Evidence', value: '{evidence_url}', inline: false },
      ],
    },
    search_lookup: {
      ...defaultEmbedConfig,
      title: '🔍 Player Search',
      color: '#2563EB',
      footer: 'CurlyKiddPanel • Cheater Search',
      author_name: '{sx_username}',
      author_icon_url: '{discord_avatar_url}',
      thumbnail_url: '{discord_avatar_url}',
      fields: [
        { name: '🔍 Search Query', value: '`{search_query}`', inline: true },
        { name: '👤 Searched By', value: '{searched_by}', inline: true },
        { name: '📊 DB Matches', value: '{results_count}', inline: true },
        { name: '🆔 Discord ID', value: '`{discord_id}`', inline: true },
        { name: '🎮 Discord User', value: '<@{discord_id}>', inline: true },
        { name: '🎫 SX Tickets', value: '{sx_tickets}', inline: true },
        { name: '🏰 SX Guilds', value: '{sx_guilds}', inline: true },
      ],
    },
    server_lookup: {
      ...defaultEmbedConfig,
      title: '🖥️ Server Lookup',
      description: '**{server_name}**\nCode: `{server_code}`',
      color: '#16A34A',
      footer: 'CurlyKiddPanel • Server Lookup',
      fields: [
        { name: '🖥️ Server', value: '{server_name}', inline: true },
        { name: '📊 Players', value: '{players}/{max_players}', inline: true },
        { name: '👤 Searched By', value: '{searched_by}', inline: true },
      ],
    },
    signup: {
      ...defaultEmbedConfig,
      title: '👋 New Account',
      description: 'En ny bruger har oprettet en konto.',
      color: '#9333EA',
      footer: 'CurlyKiddPanel • Signups',
      fields: [
        { name: '📧 Email', value: '`{user_email}`', inline: true },
        { name: '👤 Display Name', value: '{display_name}', inline: true },
        { name: '🔐 Auth Method', value: '{auth_provider}', inline: true },
        { name: '🌐 IP Address', value: '`{ip}`', inline: true },
        { name: '📍 Location', value: '{location}', inline: true },
        { name: '🏢 ISP', value: '{isp}', inline: true },
        { name: '🖥️ Browser', value: '{browser}', inline: true },
        { name: '💻 OS', value: '{os}', inline: true },
        { name: '📱 Device', value: '{device}', inline: true },
        { name: '🌍 Language', value: '{language}', inline: true },
        { name: '🕐 Timezone', value: '{timezone}', inline: true },
        { name: '📐 Screen', value: '{screen_resolution}', inline: true },
        { name: '🔗 Referrer', value: '{referrer}', inline: true },
        { name: '✅ Email Confirmed', value: '{email_confirmed}', inline: true },
        { name: '📱 Phone', value: '`{phone}`', inline: true },
        { name: '🆔 User ID', value: '`{user_id}`', inline: false },
        { name: '📅 Created', value: '{created_at}', inline: true },
        { name: '🕑 Last Sign In', value: '{last_sign_in}', inline: true },
        { name: '⏰ Timestamp', value: '{timestamp}', inline: true },
      ],
    },
    mod_upload: {
      ...defaultEmbedConfig,
      title: '📦 New Mod Uploaded',
      description: '**{mod_name}** has been uploaded.',
      color: '#EA580C',
      footer: 'CurlyKiddPanel • FiveM Mods',
      fields: [
        { name: '📦 Mod Name', value: '{mod_name}', inline: true },
        { name: '📁 Category', value: '{mod_category}', inline: true },
        { name: '🔢 Version', value: '{mod_version}', inline: true },
        { name: '📄 File', value: '`{file_name}`', inline: true },
        { name: '💾 Size', value: '{file_size}', inline: true },
        { name: '👤 Uploaded By', value: '{uploaded_by}', inline: true },
        { name: '⭐ Featured', value: '{is_featured}', inline: true },
        { name: '📝 Description', value: '{mod_description}', inline: false },
      ],
    },
  });

  const webhookChannels: WebhookChannel[] = [
    {
      id: 'cheater_report',
      label: 'Cheater Reports',
      description: 'Receive notifications when a cheater is reported, updated or removed.',
      dbKey: 'discord_webhook_url',
      icon: <Shield className="w-4 h-4" />,
      color: 'text-destructive',
      variables: CHANNEL_VARIABLES.cheater_report,
    },
    {
      id: 'search_lookup',
      label: 'Cheater Search Lookup',
      description: 'Log when someone searches the cheater database.',
      dbKey: 'discord_search_webhook_url',
      icon: <Search className="w-4 h-4" />,
      color: 'text-[hsl(var(--cyan))]',
      variables: CHANNEL_VARIABLES.search_lookup,
    },
    {
      id: 'server_lookup',
      label: 'Server Lookup',
      description: 'Log when someone looks up a FiveM server.',
      dbKey: 'server_lookup_webhook_url',
      icon: <Server className="w-4 h-4" />,
      color: 'text-primary',
      variables: CHANNEL_VARIABLES.server_lookup,
    },
    {
      id: 'signup',
      label: 'New Account Signups',
      description: 'Log when a new user creates an account.',
      dbKey: 'discord_signup_webhook_url',
      icon: <UserPlus className="w-4 h-4" />,
      color: 'text-[hsl(var(--green))]',
      variables: CHANNEL_VARIABLES.signup,
    },
    {
      id: 'mod_upload',
      label: 'FiveM Mod Uploads',
      description: 'Notification when a new mod is uploaded to the library.',
      dbKey: 'discord_mod_upload_webhook_url',
      icon: <Package className="w-4 h-4" />,
      color: 'text-[hsl(var(--orange))]',
      variables: CHANNEL_VARIABLES.mod_upload,
    },
  ];

  const getWebhookValue = (id: string) => {
    switch (id) {
      case 'cheater_report': return webhookUrl;
      case 'search_lookup': return searchWebhookUrl;
      case 'server_lookup': return serverLookupWebhookUrl;
      case 'signup': return signupWebhookUrl;
      case 'mod_upload': return modUploadWebhookUrl;
      default: return '';
    }
  };

  const setWebhookValue = (id: string, value: string) => {
    switch (id) {
      case 'cheater_report': setWebhookUrl(value); break;
      case 'search_lookup': setSearchWebhookUrl(value); break;
      case 'server_lookup': setServerLookupWebhookUrl(value); break;
      case 'signup': setSignupWebhookUrl(value); break;
      case 'mod_upload': setModUploadWebhookUrl(value); break;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const EMBED_CONFIG_KEYS = ['cheater_report', 'search_lookup', 'server_lookup', 'signup', 'mod_upload'].map(id => `embed_config_${id}`);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', [
        'discord_webhook_url',
        'discord_webhook_enabled',
        'discord_notify_new_reports',
        'discord_notify_status_changes',
        'discord_notify_removals',
        'discord_notify_visitor_logs',
        'discord_mention_role_id',
        'discord_visitor_log_role_id',
        'discord_search_webhook_url',
        'discord_signup_webhook_url',
        'server_lookup_webhook_url',
        'discord_mod_upload_webhook_url',
        ...EMBED_CONFIG_KEYS,
      ]);

    if (error) {
      console.error('Error fetching webhook settings:', error);
      toast.error('Failed to load webhook settings');
    } else {
      const getValue = (key: string) => data?.find(s => s.key === key)?.value;
      const clean = (v: string | undefined) => typeof v === 'string' ? v.replace(/^"|"$/g, '') : '';

      setWebhookUrl(clean(getValue('discord_webhook_url')));
      setWebhookEnabled(getValue('discord_webhook_enabled') === 'true' || getValue('discord_webhook_enabled') === true as any);
      setNotifyNewReports(getValue('discord_notify_new_reports') !== 'false');
      setNotifyStatusChanges(getValue('discord_notify_status_changes') !== 'false');
      setNotifyRemovals(getValue('discord_notify_removals') === 'true');
      setNotifyVisitorLogs(getValue('discord_notify_visitor_logs') === 'true');
      setMentionRoleId(clean(getValue('discord_mention_role_id')));
      setVisitorLogRoleId(clean(getValue('discord_visitor_log_role_id')));
      setSearchWebhookUrl(clean(getValue('discord_search_webhook_url')));
      setSignupWebhookUrl(clean(getValue('discord_signup_webhook_url')));
      setServerLookupWebhookUrl(clean(getValue('server_lookup_webhook_url')));
      setModUploadWebhookUrl(clean(getValue('discord_mod_upload_webhook_url')));

      // Load per-channel embed configs
      const newConfigs = { ...embedConfigs };
      for (const channelId of ['cheater_report', 'search_lookup', 'server_lookup', 'signup', 'mod_upload']) {
        const raw = getValue(`embed_config_${channelId}`);
        if (raw) {
          try {
            newConfigs[channelId] = { ...defaultEmbedConfig, ...JSON.parse(raw) };
          } catch { /* use default */ }
        }
      }
      setEmbedConfigs(newConfigs);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('You must be logged in');
      setIsSaving(false);
      return;
    }

    const settings: { key: string; value: string }[] = [
      { key: 'discord_webhook_url', value: webhookUrl },
      { key: 'discord_webhook_enabled', value: String(webhookEnabled) },
      { key: 'discord_notify_new_reports', value: String(notifyNewReports) },
      { key: 'discord_notify_status_changes', value: String(notifyStatusChanges) },
      { key: 'discord_notify_removals', value: String(notifyRemovals) },
      { key: 'discord_notify_visitor_logs', value: String(notifyVisitorLogs) },
      { key: 'discord_mention_role_id', value: mentionRoleId },
      { key: 'discord_visitor_log_role_id', value: visitorLogRoleId },
      { key: 'discord_search_webhook_url', value: searchWebhookUrl },
      { key: 'discord_signup_webhook_url', value: signupWebhookUrl },
      { key: 'server_lookup_webhook_url', value: serverLookupWebhookUrl },
      { key: 'discord_mod_upload_webhook_url', value: modUploadWebhookUrl },
    ];

    // Save per-channel embed configs as JSON
    for (const channelId of ['cheater_report', 'search_lookup', 'server_lookup', 'signup', 'mod_upload']) {
      settings.push({
        key: `embed_config_${channelId}`,
        value: JSON.stringify(embedConfigs[channelId]),
      });
    }

    let hasError = false;
    for (const setting of settings) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          key: setting.key,
          value: setting.value,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) {
        console.error('Error saving setting:', setting.key, error);
        hasError = true;
      }
    }

    if (hasError) {
      toast.error('Failed to save some settings');
    } else {
      toast.success('Settings saved successfully');
    }
    setIsSaving(false);
  };

  const handleTestChannel = async (channel: WebhookChannel) => {
    const url = getWebhookValue(channel.id);
    if (!url) {
      toast.error('Add a webhook URL first');
      return;
    }

    setTestingChannel(channel.id);
    const cfg = embedConfigs[channel.id];
    const timestamp = new Date().toISOString();
    const sampleValuesByChannel: Record<string, Record<string, string>> = {
      cheater_report: {
        player_name: 'Test Player',
        status: 'pending',
        reason: 'This is a webhook test.',
        server_name: 'CurlyKidd RP',
        server_code: 'ckrp01',
        evidence_url: 'https://example.com/evidence',
        reported_by: 'admin@curlykiddpanel.com',
        timestamp,
      },
      search_lookup: {
        search_query: '118146760072434681402',
        searched_by: 'g8643521@gmail.com',
        results_count: '2',
        sx_username: 'General 2000',
        sx_tickets: '4',
        sx_guilds: '3',
        discord_id: '118146760072434681402',
        discord_avatar_url: 'https://svmulnlysrsmxolvgxnw.supabase.co/storage/v1/object/public/public-assets/bot-avatar.png',
        discord_profile_url: 'https://discord.com/users/118146760072434681402',
        timestamp,
      },
      server_lookup: {
        server_name: 'CurlyKidd Roleplay',
        server_code: 'ckrp42',
        players: '42',
        player_count: '42',
        max_players: '128',
        gametype: 'Roleplay',
        mapname: 'Los Santos',
        owner: 'CurlyKidd',
        owner_name: 'CurlyKidd',
        locale: 'da-DK',
        premium: 'true',
        premium_tier: 'Gold',
        upvotes: '128',
        upvote_power: '128',
        ip: '127.0.0.1:30120',
        server_ip: '127.0.0.1:30120',
        onesync: 'Enabled',
        txadmin: 'Enabled',
        game_build: '2944',
        script_hook: 'Disabled',
        pure_level: '1',
        tags: 'roleplay,dk,serious',
        server_version: '1.0.0',
        resource_count: '215',
        discord_guild_id: '123456789012345678',
        queue_count: '7',
        searched_by: 'g8643521@gmail.com',
        searched_by_email: 'g8643521@gmail.com',
        timestamp,
      },
      signup: {
        user_email: 'newuser@example.com',
        display_name: 'New User',
        auth_provider: 'google',
        user_id: 'cb39845c-8f98-405e-9639-89079ae20276',
        ip: '127.0.0.1',
        country: 'Denmark',
        region: 'Capital Region',
        city: 'Copenhagen',
        location: 'Copenhagen, Denmark',
        isp: 'Test ISP',
        browser: 'Chrome',
        os: 'Windows 11',
        device: 'Desktop',
        language: 'da',
        platform: 'web',
        screen_resolution: '1920x1080',
        timezone: 'Europe/Copenhagen',
        referrer: 'Direct',
        created_at: timestamp,
        last_sign_in: timestamp,
        email_confirmed: 'true',
        phone: 'N/A',
        timestamp,
      },
      mod_upload: {
        mod_name: 'Professional HUD Pack',
        mod_description: 'A test mod to verify the webhook setup.',
        mod_category: 'UI',
        mod_version: '1.0.0',
        file_name: 'professional-hud-pack.zip',
        file_size: '24 MB',
        uploaded_by: 'General 2000',
        is_featured: 'Yes',
        timestamp,
      },
    };

    const sampleValues = sampleValuesByChannel[channel.id] ?? { timestamp };
    const replaceTemplateVars = (value?: string) => {
      if (!value) return '';
      return value.replace(/\{(\w+)\}/g, (_, key) => sampleValues[key] ?? `Sample ${key}`);
    };
    const resolveUrl = (value?: string) => {
      const resolved = replaceTemplateVars(value).trim();
      return /^https?:\/\//i.test(resolved) ? resolved : undefined;
    };

    try {
      const parsedColor = parseInt((cfg.color || '#2563EB').replace('#', ''), 16);
      const fields = (cfg.fields ?? [])
        .map((field) => ({
          name: replaceTemplateVars(field.name).slice(0, 256),
          value: replaceTemplateVars(field.value).slice(0, 1024),
          inline: field.inline ?? false,
        }))
        .filter((field) => field.name.trim() && field.value.trim())
        .slice(0, 25);

      const embed: any = {
        title: (replaceTemplateVars(cfg.title) || `✅ ${channel.label} Webhook Connected`).slice(0, 256),
        description: (replaceTemplateVars(cfg.description) || `Denne kanal modtager nu ${channel.label.toLowerCase()} notifikationer.`).slice(0, 4096),
        color: Number.isFinite(parsedColor) ? parsedColor : 0x2563eb,
        timestamp,
        footer: { text: replaceTemplateVars(cfg.footer) || 'CurlyKiddPanel • Webhook Test' },
      };

      if (cfg.author_name) {
        const authorName = replaceTemplateVars(cfg.author_name).trim();
        if (authorName) {
          embed.author = { name: authorName };
          const authorIconUrl = resolveUrl(cfg.author_icon_url);
          if (authorIconUrl) embed.author.icon_url = authorIconUrl;
        }
      }

      const thumbnailUrl = resolveUrl(cfg.thumbnail_url);
      if (thumbnailUrl) embed.thumbnail = { url: thumbnailUrl };

      const imageUrl = resolveUrl(cfg.image_url);
      if (imageUrl) embed.image = { url: imageUrl };

      if (fields.length > 0) embed.fields = fields;

      const payload: any = {
        username: 'CurlyKiddPanel',
        avatar_url: 'https://svmulnlysrsmxolvgxnw.supabase.co/storage/v1/object/public/public-assets/bot-avatar.png',
        embeds: [embed],
      };

      const content = replaceTemplateVars(cfg.content).trim();
      if (content) payload.content = content;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();

      if (res.ok) {
        toast.success(`${channel.label} webhook virker!`);
      } else {
        const message = responseText ? `: ${responseText.slice(0, 140)}` : '';
        toast.error(`${channel.label} webhook failed (${res.status})${message}`);
      }
    } catch {
      toast.error(`Could not send to ${channel.label} webhook`);
    }
    setTestingChannel(null);
  };

  const updateEmbedConfig = (channelId: string, config: EmbedConfig) => {
    setEmbedConfigs(prev => ({ ...prev, [channelId]: config }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Master Toggle */}
      <div className="relative overflow-hidden rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20">
              <DiscordIcon className="w-6 h-6 text-[#5865F2]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Discord Webhooks</h3>
              <p className="text-sm text-muted-foreground">Send automatiske notifikationer til dine Discord kanaler</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={webhookEnabled ? "default" : "secondary"} className={webhookEnabled ? "bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/30" : ""}>
              {webhookEnabled ? "Active" : "Disabled"}
            </Badge>
            <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
          </div>
        </div>
      </div>

      {/* Webhook Channels */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Webhook className="w-3.5 h-3.5 text-primary" />
            </div>
            <h4 className="text-sm font-semibold text-foreground tracking-tight">Webhook Channels</h4>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono bg-card/50 border border-border/20">
            {webhookChannels.filter(c => !!getWebhookValue(c.id)?.trim()).length}/{webhookChannels.length} connected
          </Badge>
        </div>

        <div className="grid gap-3">
          {webhookChannels.map((channel) => {
            const value = getWebhookValue(channel.id);
            const isVisible = visibility[channel.id];
            const isTesting = testingChannel === channel.id;
            const hasUrl = !!value?.trim();

            return (
              <div key={channel.id} className="rounded-xl border border-border/20 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-border/30">
                {/* Channel Header */}
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    hasUrl ? 'bg-[hsl(var(--green))]/10' : 'bg-muted/50'
                  }`}>
                    <span className={hasUrl ? 'text-[hsl(var(--green))]' : 'text-muted-foreground/60'}>{channel.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{channel.label}</p>
                      {hasUrl && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--green))]/10">
                          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--green))] animate-pulse" />
                          <span className="text-[10px] font-medium text-[hsl(var(--green))]">Live</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{channel.description}</p>
                  </div>
                  {hasUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestChannel(channel)}
                      disabled={isTesting}
                      className="h-8 text-xs gap-1.5 border-border/20 hover:bg-primary/5 hover:text-primary hover:border-primary/30 shrink-0"
                    >
                      {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Test
                    </Button>
                  )}
                </div>

                {/* URL Input */}
                <div className="px-5 pb-4">
                  <div className="relative">
                    <Input
                      type={isVisible ? 'text' : 'password'}
                      value={value}
                      onChange={(e) => setWebhookValue(channel.id, e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="pr-10 h-9 text-sm bg-background/30 border-border/15 focus:border-primary/40 rounded-lg font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setVisibility(prev => ({ ...prev, [channel.id]: !prev[channel.id] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Embed Builder */}
                <div className="border-t border-border/10 px-5 py-3">
                  <DiscordEmbedBuilder
                    channelId={channel.id}
                    channelLabel={channel.label}
                    config={embedConfigs[channel.id]}
                    onChange={(cfg) => updateEmbedConfig(channel.id, cfg)}
                    availableVariables={channel.variables}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notification Events */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-3.5 h-3.5 text-primary" />
          </div>
          <h4 className="text-sm font-semibold text-foreground tracking-tight">Notification Events</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { label: 'New Reports', desc: 'When a cheater is reported', checked: notifyNewReports, onChange: setNotifyNewReports, icon: <Shield className="w-3.5 h-3.5 text-destructive" /> },
            { label: 'Status Changes', desc: 'When a cheater status changes', checked: notifyStatusChanges, onChange: setNotifyStatusChanges, icon: <RefreshCw className="w-3.5 h-3.5 text-[hsl(var(--yellow))]" /> },
            { label: 'Removals', desc: 'When a cheater is removed', checked: notifyRemovals, onChange: setNotifyRemovals, icon: <XCircle className="w-3.5 h-3.5 text-muted-foreground" /> },
            
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3.5 rounded-xl bg-card/50 backdrop-blur-sm border border-border/20 hover:border-border/30 transition-all duration-150">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Switch checked={item.checked} onCheckedChange={item.onChange} />
            </div>
          ))}
        </div>
      </div>

      {/* Role Mentions */}
      <div className="rounded-xl border border-border/20 bg-card/50 backdrop-blur-sm p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Hash className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <Label className="text-sm font-semibold text-foreground">Role Mentions</Label>
            <p className="text-[11px] text-muted-foreground">Ping specific roles when notifications are sent</p>
          </div>
        </div>
        <div className="space-y-2">
          <Input
            value={mentionRoleId}
            onChange={(e) => setMentionRoleId(e.target.value)}
            placeholder="Cheater report role ID"
            className="h-9 text-sm bg-background/30 border-border/15 rounded-lg font-mono text-xs"
            maxLength={20}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 px-8 h-11 rounded-xl font-semibold">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Save All Settings
        </Button>

        <Button variant="outline" size="icon" onClick={fetchSettings} disabled={isLoading} className="h-11 w-11 rounded-xl border-border/20">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
};

export default DiscordWebhookSettings;
