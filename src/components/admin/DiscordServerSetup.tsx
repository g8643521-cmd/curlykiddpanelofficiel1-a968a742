// @ts-nocheck
import { useState, useEffect } from 'react';
import { 
  Bot, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  ExternalLink, 
  Hash, 
  Loader2, 
  MessageSquare,
  Server,
  Settings2,
  Shield,
  Calendar,
  Trash2,
  Users,
  Volume2,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useDiscordSetupStore } from '@/stores/discordSetupStore';
import DiscordSetupWizard, { type CategoryPermission } from '@/components/admin/DiscordSetupWizard';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface BotInfo {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

interface StructurePreview {
  roles: Array<{ name: string; color: number; hoist: boolean }>;
  categories: Array<{
    name: string;
    staffOnly?: boolean;
    channels: Array<{ name: string; type: number; topic: string }>;
  }>;
}

export default function DiscordServerSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [showWizard, setShowWizard] = useState(false);
  const [structurePreview, setStructurePreview] = useState<StructurePreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Use persistent store for logs and processing state
  const { 
    logs: setupLogs, 
    isProcessing, 
    operationType,
    startOperation, 
    setLogs, 
    finishOperation, 
    clearLogs 
  } = useDiscordSetupStore();
  
  const isSettingUp = operationType === 'setup';
  const isPostingMessages = operationType === 'post';
  const isDeletingMessages = operationType === 'deleteWelcome';
  const isDeletingAll7Days = operationType === 'delete7Days';
  const isDeletingAll = operationType === 'deleteAll';

  // Load saved bot config on mount
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const { data: config } = await supabase
          .from('discord_bot_config')
          .select('*')
          .limit(1)
          .single();

        if (config) {
          setBotInfo({
            id: config.bot_id,
            username: config.bot_username,
            avatar: config.bot_avatar,
            discriminator: config.bot_discriminator || '',
          });
          if (config.selected_guild_id) {
            setSelectedGuild(config.selected_guild_id);
          }
          if (config.invite_url) {
            setInviteUrl(config.invite_url);
          }
          // Fetch fresh guild list in background
          fetchGuildsOnly();
          fetchStructurePreview();
        }
      } catch (e) {
        // No saved config, that's fine
      } finally {
        setIsInitializing(false);
      }
    };
    loadSavedConfig();
  }, []);

  // Save config when bot info or selection changes
  const saveBotConfig = async (bot: BotInfo, guildId?: string, guildName?: string, url?: string) => {
    try {
      await supabase
        .from('discord_bot_config')
        .upsert({
          bot_id: bot.id,
          bot_username: bot.username,
          bot_avatar: bot.avatar,
          bot_discriminator: bot.discriminator,
          selected_guild_id: guildId || null,
          selected_guild_name: guildName || null,
          invite_url: url || null,
        }, { onConflict: 'bot_id' });
    } catch (e) {
      console.error('Failed to save bot config:', e);
    }
  };

  const fetchGuildsOnly = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_bot_info' },
      });
      if (!error && data.success) {
        setGuilds(data.guilds || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBotInfo = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_bot_info' },
      });

      if (error) throw error;

      if (data.success) {
        setBotInfo(data.bot);
        setGuilds(data.guilds || []);
        // Save to database
        await saveBotConfig(data.bot);
        toast.success('Connected to Discord bot');
      } else {
        throw new Error(data.error || 'Failed to fetch bot info');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to connect to Discord bot');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInviteUrl = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_invite_url' },
      });

      if (error) throw error;

      if (data.success && data.invite_url) {
        setInviteUrl(data.invite_url);
        // Save invite URL to config
        if (botInfo) {
          await saveBotConfig(botInfo, selectedGuild, undefined, data.invite_url);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle guild selection change
  const handleGuildChange = async (guildId: string) => {
    setSelectedGuild(guildId);
    const guild = guilds.find(g => g.id === guildId);
    if (botInfo) {
      await saveBotConfig(botInfo, guildId, guild?.name, inviteUrl);
    }
  };

  const fetchStructurePreview = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_structure_preview' },
      });

      if (error) throw error;

      if (data.success && data.structure) {
        setStructurePreview(data.structure);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnect = async () => {
    await fetchBotInfo();
    await fetchInviteUrl();
    await fetchStructurePreview();
  };

  const handleSetupServer = async (categoryPermissions: Record<string, CategoryPermission>) => {
    if (!selectedGuild) {
      toast.error('Please select a server first');
      return;
    }

    startOperation('setup');

    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { 
          action: 'setup_server',
          guild_id: selectedGuild,
          category_permissions: categoryPermissions,
        },
      });

      if (error) throw error;

      if (data.success) {
        setLogs(data.logs || []);
        toast.success('Server setup complete!');
      } else {
        throw new Error(data.error || 'Setup failed');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to setup server');
      setLogs([...setupLogs, `❌ Error: ${e instanceof Error ? e.message : 'Unknown error'}`]);
    } finally {
      finishOperation();
    }
  };

  const handlePostAllMessages = async () => {
    if (!selectedGuild) {
      toast.error('Please select a server first');
      return;
    }

    startOperation('post');

    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { 
          action: 'post_all_messages',
          guild_id: selectedGuild,
        },
      });

      if (error) throw error;

      if (data.success) {
        setLogs(data.logs || []);
        toast.success(`Posted messages to ${data.posted} channels!`);
      } else {
        throw new Error(data.error || 'Failed to post messages');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to post messages');
      setLogs([...setupLogs, `❌ Error: ${e instanceof Error ? e.message : 'Unknown error'}`]);
    } finally {
      finishOperation();
    }
  };

  const handleDeleteWelcomeMessages = async () => {
    if (!selectedGuild) {
      toast.error('Please select a server first');
      return;
    }

    startOperation('deleteWelcome');

    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { 
          action: 'delete_welcome_messages',
          guild_id: selectedGuild,
        },
      });

      if (error) throw error;

      if (data.success) {
        setLogs(data.logs || []);
        if (data.partial) {
          toast.warning(`Deleted ${data.deleted} messages (partial - run again to continue)`);
        } else {
          toast.success(`Deleted ${data.deleted} welcome messages!`);
        }
      } else {
        throw new Error(data.error || 'Failed to delete messages');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to delete messages');
      setLogs([...setupLogs, `❌ Error: ${e instanceof Error ? e.message : 'Unknown error'}`]);
    } finally {
      finishOperation();
    }
  };

  const handleDeleteAll7Days = async () => {
    if (!selectedGuild) {
      toast.error('Please select a server first');
      return;
    }

    startOperation('delete7Days');

    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { 
          action: 'delete_all_messages_7days',
          guild_id: selectedGuild,
        },
      });

      if (error) throw error;

      if (data.success) {
        setLogs(data.logs || []);
        if (data.partial) {
          toast.warning(`Deleted ${data.deleted} messages (partial - run again to continue)`);
        } else {
          toast.success(`Deleted ${data.deleted} bot messages from last 7 days!`);
        }
      } else {
        throw new Error(data.error || 'Failed to delete messages');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to delete messages');
      setLogs([...setupLogs, `❌ Error: ${e instanceof Error ? e.message : 'Unknown error'}`]);
    } finally {
      finishOperation();
    }
  };

  const handleDeleteAllBotMessages = async () => {
    if (!selectedGuild) {
      toast.error('Please select a server first');
      return;
    }

    startOperation('deleteAll');

    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { 
          action: 'delete_all_bot_messages',
          guild_id: selectedGuild,
        },
      });

      if (error) throw error;

      if (data.success) {
        setLogs(data.logs || []);
        if (data.partial) {
          toast.warning(`Deleted ${data.deleted} messages (partial - run again to continue)`);
        } else {
          toast.success(`Deleted ALL ${data.deleted} bot messages!`);
        }
      } else {
        throw new Error(data.error || 'Failed to delete messages');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to delete messages');
      setLogs([...setupLogs, `❌ Error: ${e instanceof Error ? e.message : 'Unknown error'}`]);
    } finally {
      finishOperation();
    }
  };

  const copyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite URL copied!');
  };

  const selectedGuildInfo = guilds.find(g => g.id === selectedGuild);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[#5865F2]" />
          <h4 className="font-semibold text-foreground text-sm">Server Setup</h4>
        </div>
        <Badge variant="secondary" className="text-xs">Channels & Roles</Badge>
      </div>

      {/* Bot Status */}
      {isInitializing ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !botInfo ? (
        <div className="space-y-4">
          <Button 
            onClick={handleConnect} 
            disabled={isLoading}
            className="w-full gap-2 bg-[#5865F2] hover:bg-[#4752C4]"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            Connect Discord Bot
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Make sure DISCORD_BOT_TOKEN is configured in your secrets.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connected Bot Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30">
            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center">
              {botInfo.avatar ? (
                <img 
                  src={`https://cdn.discordapp.com/avatars/${botInfo.id}/${botInfo.avatar}.png`}
                  alt={botInfo.username}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <Bot className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{botInfo.username}</p>
              <p className="text-xs text-muted-foreground">Bot ID: {botInfo.id}</p>
            </div>
            <Badge className="bg-[hsl(var(--green))]/15 text-[hsl(var(--green))]">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          </div>

          {/* Invite Bot */}
          {inviteUrl && (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <Label className="text-sm mb-2 block">Invite Bot to Your Server</Label>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyInviteUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Server Selection */}
          <div className="space-y-2">
            <Label>Select Server to Setup</Label>
            <Select value={selectedGuild} onValueChange={handleGuildChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a Discord server..." />
              </SelectTrigger>
              <SelectContent>
                {guilds.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No servers found. Invite the bot first!
                  </SelectItem>
                ) : (
                  guilds.map(guild => (
                    <SelectItem key={guild.id} value={guild.id}>
                      <div className="flex items-center gap-2">
                        {guild.icon ? (
                          <img 
                            src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                            alt={guild.name}
                            className="w-5 h-5 rounded-full"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                            <Server className="w-3 h-3" />
                          </div>
                        )}
                        {guild.name}
                        {guild.owner && <Badge variant="secondary" className="ml-2 text-xs">Owner</Badge>}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Structure Preview */}
          {structurePreview && (
            <Collapsible open={showPreview} onOpenChange={setShowPreview}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Preview Server Structure
                  </span>
                  {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-4 rounded-lg bg-secondary/20 border border-border/30 space-y-4">
                  {/* Roles Preview */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Roles
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {structurePreview.roles.map(role => (
                        <Badge 
                          key={role.name}
                          style={{ 
                            backgroundColor: `#${role.color.toString(16).padStart(6, '0')}20`,
                            color: `#${role.color.toString(16).padStart(6, '0')}`,
                            borderColor: `#${role.color.toString(16).padStart(6, '0')}50`,
                          }}
                          className="border"
                        >
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Categories Preview */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Categories & Channels</p>
                    <div className="space-y-3">
                      {structurePreview.categories.map(category => (
                        <div key={category.name} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                            {category.name}
                            {category.staffOnly && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                <Shield className="w-3 h-3 mr-0.5" />
                                Staff Only
                              </Badge>
                            )}
                          </p>
                          <div className="pl-3 space-y-0.5">
                            {category.channels.map(channel => (
                              <p key={channel.name} className="text-xs text-muted-foreground flex items-center gap-1.5">
                                {channel.type === 2 ? (
                                  <Volume2 className="w-3 h-3" />
                                ) : (
                                  <Hash className="w-3 h-3" />
                                )}
                                {channel.name}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Progress Log - Always visible when processing or has logs */}
          {(isProcessing || setupLogs.length > 0) && (
            <div className="p-3 rounded-lg bg-background/80 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                  Progress Log
                </p>
                {setupLogs.length > 0 && !isProcessing && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => clearLogs()}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <ScrollArea className="h-32 rounded border border-border/30 bg-secondary/20 p-2">
                <div className="space-y-0.5 font-mono text-xs">
                  {setupLogs.length === 0 && isProcessing && (
                    <p className="text-muted-foreground animate-pulse">Starting operation...</p>
                  )}
                  {setupLogs.map((log, idx) => (
                    <p 
                      key={idx} 
                      className={
                        log.includes('✅') || log.includes('🗑️') ? 'text-[hsl(var(--green))]' :
                        log.includes('❌') ? 'text-destructive' :
                        log.includes('⚠️') ? 'text-amber-500' :
                        log.includes('⏭️') ? 'text-muted-foreground' :
                        log.includes('📊') ? 'text-primary font-medium' :
                        'text-foreground/80'
                      }
                    >
                      {log}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={async () => {
                  if (!structurePreview) {
                    await fetchStructurePreview();
                  }
                  setShowWizard(true);
                }} 
                disabled={!selectedGuild || isProcessing}
                size="sm"
                className="gap-2"
              >
                {isSettingUp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Setup Server
              </Button>

              <Button 
                onClick={handlePostAllMessages} 
                disabled={!selectedGuild || isProcessing}
                variant="secondary"
                size="sm"
                className="gap-2"
              >
                {isPostingMessages ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                Post Messages
              </Button>

              <Button 
                onClick={handleDeleteWelcomeMessages} 
                disabled={!selectedGuild || isProcessing}
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:bg-destructive/10"
              >
                {isDeletingMessages ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Delete Welcome
              </Button>

              <Button 
                onClick={handleDeleteAll7Days} 
                disabled={!selectedGuild || isProcessing}
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:bg-destructive/10"
              >
                {isDeletingAll7Days ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
                Delete 7 Days
              </Button>
            </div>
            
            {/* Delete All - Full width for emphasis */}
            <Button 
              onClick={handleDeleteAllBotMessages} 
              disabled={!selectedGuild || isProcessing}
              variant="destructive"
              size="sm"
              className="w-full gap-2"
            >
              {isDeletingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete ALL Bot Messages
            </Button>
          </div>

          {/* Refresh Button */}
          <Button variant="ghost" size="sm" onClick={handleConnect} disabled={isLoading} className="w-full text-xs">
            Refresh Server List
          </Button>
        </div>
      )}

      {/* Setup Wizard */}
      <DiscordSetupWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        guildId={selectedGuild}
        guildName={selectedGuildInfo?.name}
        categories={structurePreview?.categories ?? []}
        onConfirm={handleSetupServer}
      />
    </div>
  );
}
