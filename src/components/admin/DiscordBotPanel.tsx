// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Ban, 
  Bot, 
  CheckCircle, 
  ClipboardList,
  LogOut, 
  MessageSquare, 
  RefreshCw, 
  Search, 
  Send, 
  Shield, 
  Timer, 
  Trash2, 
  UserMinus, 
  Users, 
  Volume2,
  BarChart3,
  Bell,
  Loader2,
  Copy,
  ExternalLink,
  Database,
  Zap,
  Clock,
  CheckSquare,
  Square,
  X,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

interface Member {
  user: {
    id: string;
    username: string;
    avatar: string | null;
    discriminator: string;
  };
  nick: string | null;
  roles: string[];
  joined_at: string;
  communication_disabled_until: string | null;
}

interface GuildStats {
  member_count: number;
  online_count: number;
  boost_count: number;
  channel_count: number;
  name: string;
  icon: string | null;
}

interface ModAction {
  type: 'kick' | 'ban' | 'timeout' | 'warn';
  member: Member | null;
  reason: string;
  duration: number;
}

interface BulkModAction {
  type: 'kick' | 'ban' | 'timeout';
  memberIds: string[];
  reason: string;
  duration: number;
}

// Convert Discord color int to hex
const discordColorToHex = (color: number): string => {
  if (!color) return '#99aab5'; // Default Discord gray
  return `#${color.toString(16).padStart(6, '0')}`;
};

// Format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const MEMBERS_PAGE_SIZE = 50;

export default function DiscordBotPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [guildStats, setGuildStats] = useState<GuildStats | null>(null);
  const [modAction, setModAction] = useState<ModAction | null>(null);
  const [showModDialog, setShowModDialog] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [membersIntentError, setMembersIntentError] = useState(false);
  const lastMembersFetchAtRef = useRef<number>(0);

  // Pagination state for members
  const [membersNextAfter, setMembersNextAfter] = useState<string | null>(null);
  const [membersHasMore, setMembersHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'HIT' | 'STALE' | 'MISS' | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Guild roles for display
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);

  // Bulk selection state
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkModAction | null>(null);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [isBulkActioning, setIsBulkActioning] = useState(false);

  // Infinite scroll ref
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  
  // Notification state
  const [notifyChannel, setNotifyChannel] = useState('');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);

  // Audit log state
  const [modLogs, setModLogs] = useState<Array<{
    id: string;
    action_type: string;
    target_user_id: string;
    target_username: string | null;
    reason: string | null;
    duration: number | null;
    performed_at: string;
    performed_by: string | null;
    performer_name?: string | null;
  }>>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheLastUpdated, setCacheLastUpdated] = useState<Date | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Load saved guild on mount
  useEffect(() => {
    loadSavedConfig();
  }, []);

  // Filter members when search changes
  useEffect(() => {
    if (!memberSearch.trim()) {
      setFilteredMembers(members);
    } else {
      const search = memberSearch.toLowerCase();
      setFilteredMembers(members.filter(m => 
        m.user.username.toLowerCase().includes(search) ||
        m.nick?.toLowerCase().includes(search) ||
        m.user.id.includes(search)
      ));
    }
  }, [memberSearch, members]);

  const loadSavedConfig = async () => {
    try {
      const { data: config } = await supabase
        .from('discord_bot_config')
        .select('*')
        .limit(1)
        .single();

      if (config) {
        setSelectedGuild(config.selected_guild_id || '');
        // Fetch guilds
        const { data } = await supabase.functions.invoke('discord-setup', {
          body: { action: 'get_bot_info' },
        });
        if (data?.success) {
          setGuilds(data.guilds || []);
          if (config.selected_guild_id) {
            fetchGuildData(config.selected_guild_id);
          }
        }
      }
    } catch (e) {
      // No config saved
    }
  };

  const fetchGuildData = async (guildId: string, attempt = 0, skipCache = false) => {
    // Avoid spamming member fetch on fast UI interactions
    if (attempt === 0 && !skipCache) {
      const now = Date.now();
      if (now - lastMembersFetchAtRef.current < 1500) return;
      lastMembersFetchAtRef.current = now;
    }

    setIsLoading(true);
    setMembersIntentError(false);
    // Reset pagination when fetching fresh
    setMembersNextAfter(null);
    setMembersHasMore(false);
    setCacheStatus(null);
    setSelectedMemberIds(new Set()); // Clear selection on refresh

    try {
      // Fetch members (first page)
      const membersRes = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_members', guild_id: guildId, limit: MEMBERS_PAGE_SIZE, after: '0', skip_cache: skipCache },
      });

      if (membersRes.data?.success) {
        setMembers(membersRes.data.members || []);
        setMembersHasMore(membersRes.data.pagination?.has_more ?? false);
        setMembersNextAfter(membersRes.data.pagination?.next_after ?? null);
        setCacheStatus(membersRes.data.cache_status || null);
        setLastFetchedAt(new Date());
      } else if (membersRes.data?.error === 'rate_limited') {
        const retryMs = typeof membersRes.data?.retry_after_ms === 'number' ? membersRes.data.retry_after_ms : 1500;
        toast.error(`Discord rate limited. Retrying in ${Math.ceil(retryMs / 1000)}s...`);
        setIsLoading(false);
        if (attempt < 2) {
          window.setTimeout(() => fetchGuildData(guildId, attempt + 1, skipCache), retryMs);
        }
        return;
      } else if (membersRes.data?.action_required === 'enable_server_members_intent') {
        setMembersIntentError(true);
        setMembers([]);
        toast.error('Server Members Intent required - see instructions below');
      } else if (membersRes.error) {
        console.error('Members fetch error:', membersRes.error);
        if (membersRes.error.message?.includes('50001') || membersRes.error.message?.includes('Missing Access')) {
          setMembersIntentError(true);
          setMembers([]);
        }
      }

      // Fetch stats
      const statsRes = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_guild_stats', guild_id: guildId },
      });
      if (statsRes.data?.success) {
        setGuildStats(statsRes.data.stats);
      }

      // Fetch guild roles
      const rolesRes = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_roles', guild_id: guildId },
      });
      if (rolesRes.data?.success) {
        setGuildRoles(rolesRes.data.roles || []);
      }

      // Fetch channels for notifications
      const channelsRes = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_bot_info', guild_id: guildId },
      });
      // Get channels from the guild
      const channelData = await supabase.functions.invoke('discord-setup', {
        body: { action: 'post_all_messages', guild_id: guildId },
      });
      // We'll get channels differently - through the stats or separate call
    } catch (e) {
      console.error('Failed to fetch guild data:', e);
      toast.error('Failed to load guild data');
    } finally {
      setIsLoading(false);
    }
  };

  const forceRefreshMembers = () => {
    if (selectedGuild) {
      lastMembersFetchAtRef.current = 0; // Reset throttle
      fetchGuildData(selectedGuild, 0, true);
      toast.info('Fetching fresh data from Discord...');
    }
  };

  // Clear member cache for guild
  const clearMemberCache = async () => {
    if (!selectedGuild) return;

    setIsClearingCache(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { action: 'clear_member_cache', guild_id: selectedGuild },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to clear cache');

      toast.success('Cache cleared successfully');
      setCacheStatus(null);
      setCacheLastUpdated(null);
      // Fetch fresh data
      forceRefreshMembers();
    } catch (e) {
      console.error('Failed to clear cache:', e);
      toast.error('Failed to clear cache');
    } finally {
      setIsClearingCache(false);
    }
  };

  // Fetch moderation audit logs with performer names
  const fetchModLogs = async () => {
    if (!selectedGuild) return;

    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('discord_mod_logs')
        .select('*')
        .eq('guild_id', selectedGuild)
        .order('performed_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch performer names for logs that have performed_by
      const performerIds = [...new Set((data || []).filter(l => l.performed_by).map(l => l.performed_by))];
      let performerMap: Record<string, string> = {};

      if (performerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', performerIds);

        if (profiles) {
          performerMap = Object.fromEntries(profiles.map(p => [p.id, p.display_name || 'Unknown']));
        }
      }

      // Attach performer names
      const logsWithPerformers = (data || []).map(log => ({
        ...log,
        performer_name: log.performed_by ? performerMap[log.performed_by] || 'Unknown' : null,
      }));

      setModLogs(logsWithPerformers);
    } catch (e) {
      console.error('Failed to fetch mod logs:', e);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Filter logs based on search and action filter
  const filteredLogs = modLogs.filter(log => {
    const matchesSearch = !logSearch.trim() || 
      log.target_username?.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.target_user_id.includes(logSearch) ||
      log.reason?.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.performer_name?.toLowerCase().includes(logSearch.toLowerCase());
    
    const matchesAction = logActionFilter === 'all' || log.action_type === logActionFilter;
    
    return matchesSearch && matchesAction;
  });

  // Fetch logs when guild changes or on mount
  useEffect(() => {
    if (selectedGuild) {
      fetchModLogs();
    }
  }, [selectedGuild]);

  // Get role info by ID
  const getRoleById = (roleId: string): GuildRole | undefined => {
    return guildRoles.find(r => r.id === roleId);
  };

  // Get top roles for a member (sorted by position, limited)
  const getMemberTopRoles = (memberRoles: string[], maxRoles = 2): GuildRole[] => {
    return memberRoles
      .map(id => getRoleById(id))
      .filter((r): r is GuildRole => !!r && r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .slice(0, maxRoles);
  };

  // Toggle member selection
  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  // Select all visible members
  const selectAllMembers = () => {
    setSelectedMemberIds(new Set(filteredMembers.map(m => m.user.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedMemberIds(new Set());
  };

  // Open bulk action dialog
  const openBulkAction = (type: BulkModAction['type']) => {
    setBulkAction({
      type,
      memberIds: Array.from(selectedMemberIds),
      reason: '',
      duration: 60,
    });
    setShowBulkDialog(true);
  };

  // Execute bulk moderation action
  const executeBulkAction = async () => {
    if (!bulkAction || bulkAction.memberIds.length === 0 || !selectedGuild) return;

    setIsBulkActioning(true);
    let successCount = 0;
    let failCount = 0;

    for (const userId of bulkAction.memberIds) {
      try {
        let actionName = '';
        const body: Record<string, unknown> = {
          guild_id: selectedGuild,
          user_id: userId,
          reason: bulkAction.reason || `Bulk ${bulkAction.type}`,
        };

        switch (bulkAction.type) {
          case 'kick':
            actionName = 'mod_kick';
            break;
          case 'ban':
            actionName = 'mod_ban';
            body.delete_days = 0;
            break;
          case 'timeout':
            actionName = 'mod_timeout';
            body.duration_minutes = bulkAction.duration;
            break;
        }

        const { data, error } = await supabase.functions.invoke('discord-setup', {
          body: { action: actionName, ...body },
        });

        if (error || !data?.success) {
          failCount++;
        } else {
          successCount++;
          // Log the action
          const member = members.find(m => m.user.id === userId);
          await supabase.from('discord_mod_logs').insert({
            guild_id: selectedGuild,
            target_user_id: userId,
            target_username: member?.user.username || userId,
            action_type: bulkAction.type,
            reason: bulkAction.reason || `Bulk ${bulkAction.type}`,
            duration: bulkAction.type === 'timeout' ? bulkAction.duration : null,
            performed_by: currentUserId,
          });
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 300));
      } catch {
        failCount++;
      }
    }

    setIsBulkActioning(false);
    setShowBulkDialog(false);
    setSelectedMemberIds(new Set());

    if (successCount > 0) {
      toast.success(`Successfully ${bulkAction.type === 'kick' ? 'kicked' : bulkAction.type === 'ban' ? 'banned' : 'timed out'} ${successCount} member${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to ${bulkAction.type} ${failCount} member${failCount > 1 ? 's' : ''}`);
    }

    // Refresh member list
    fetchGuildData(selectedGuild, 0, true);
  };

  const loadMoreMembers = useCallback(async () => {
    if (!selectedGuild || !membersNextAfter || isLoadingMore || !membersHasMore) return;

    setIsLoadingMore(true);
    try {
      const res = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_members', guild_id: selectedGuild, limit: MEMBERS_PAGE_SIZE, after: membersNextAfter },
      });

      if (res.data?.success) {
        const newMembers = res.data.members || [];
        setMembers(prev => [...prev, ...newMembers]);
        setMembersHasMore(res.data.pagination?.has_more ?? false);
        setMembersNextAfter(res.data.pagination?.next_after ?? null);
      } else if (res.data?.error === 'rate_limited') {
        const retryMs = typeof res.data?.retry_after_ms === 'number' ? res.data.retry_after_ms : 1500;
        toast.error(`Rate limited. Try again in ${Math.ceil(retryMs / 1000)}s`);
      }
    } catch (e) {
      console.error('Failed to load more members:', e);
      toast.error('Failed to load more members');
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedGuild, membersNextAfter, isLoadingMore, membersHasMore]);

  // Infinite scroll observer
  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && membersHasMore && !isLoadingMore && !memberSearch.trim()) {
          loadMoreMembers();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(trigger);
    return () => observer.disconnect();
  }, [membersHasMore, isLoadingMore, memberSearch, loadMoreMembers]);

  const handleGuildChange = (guildId: string) => {
    setSelectedGuild(guildId);
    if (guildId) {
      fetchGuildData(guildId);
    }
  };

  const openModAction = (type: ModAction['type'], member: Member) => {
    setModAction({ type, member, reason: '', duration: 60 });
    setShowModDialog(true);
  };

  const executeModAction = async () => {
    if (!modAction?.member || !selectedGuild) return;
    
    setIsActioning(true);
    try {
      let actionName = '';
      const body: Record<string, unknown> = {
        guild_id: selectedGuild,
        user_id: modAction.member.user.id,
        reason: modAction.reason || undefined,
      };

      switch (modAction.type) {
        case 'kick':
          actionName = 'mod_kick';
          break;
        case 'ban':
          actionName = 'mod_ban';
          body.delete_days = 0;
          break;
        case 'timeout':
          actionName = 'mod_timeout';
          body.duration_minutes = modAction.duration;
          break;
      }

      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { action: actionName, ...body },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Action failed');

      // Log the action
      await supabase.from('discord_mod_logs').insert({
        guild_id: selectedGuild,
        target_user_id: modAction.member.user.id,
        target_username: modAction.member.user.username,
        action_type: modAction.type,
        reason: modAction.reason || null,
        duration: modAction.type === 'timeout' ? modAction.duration : null,
        performed_by: currentUserId,
      });

      toast.success(`Successfully ${modAction.type === 'kick' ? 'kicked' : modAction.type === 'ban' ? 'banned' : 'timed out'} ${modAction.member.user.username}`);
      setShowModDialog(false);
      
      // Refresh member list
      fetchGuildData(selectedGuild);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setIsActioning(false);
    }
  };

  const removeTimeout = async (member: Member) => {
    if (!selectedGuild) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: { 
          action: 'mod_untimeout', 
          guild_id: selectedGuild, 
          user_id: member.user.id 
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Action failed');

      toast.success(`Removed timeout from ${member.user.username}`);
      fetchGuildData(selectedGuild);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove timeout');
    }
  };

  const sendNotification = async () => {
    if (!notifyChannel || !notifyTitle) {
      toast.error('Channel and title are required');
      return;
    }

    setIsSendingNotification(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-setup', {
        body: {
          action: 'send_notification',
          channel_id: notifyChannel,
          title: notifyTitle,
          description: notifyMessage,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send');

      toast.success('Notification sent!');
      setNotifyTitle('');
      setNotifyMessage('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send notification');
    } finally {
      setIsSendingNotification(false);
    }
  };

  const refreshStats = async () => {
    if (!selectedGuild) return;
    
    try {
      const { data } = await supabase.functions.invoke('discord-setup', {
        body: { action: 'get_guild_stats', guild_id: selectedGuild },
      });
      if (data?.success) {
        setGuildStats(data.stats);
        toast.success('Stats refreshed');
      }
    } catch (e) {
      toast.error('Failed to refresh stats');
    }
  };

  const selectedGuildInfo = guilds.find(g => g.id === selectedGuild);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#5865F2]" />
          <h4 className="font-display font-semibold text-foreground">Discord Bot Management</h4>
        </div>
        <Badge variant="secondary" className="bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/30">
          Advanced Controls
        </Badge>
      </div>

      {/* Guild Selector */}
      <div className="mb-4">
        <Label className="text-sm mb-2 block">Active Server</Label>
        <Select value={selectedGuild} onValueChange={handleGuildChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a server..." />
          </SelectTrigger>
          <SelectContent>
            {guilds.map(guild => (
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
                      <Bot className="w-3 h-3" />
                    </div>
                  )}
                  {guild.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedGuild && (
        <Tabs defaultValue="stats" className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stats" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Members
              {members.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1 h-5 px-1.5 text-[10px] bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/30"
                >
                  {members.length}
                  {guildStats?.member_count ? `/${guildStats.member_count}` : ''}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="moderation" className="gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Moderation
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5" onClick={fetchModLogs}>
              <ClipboardList className="w-3.5 h-3.5" />
              Audit
              {modLogs.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1 h-5 px-1.5 text-[10px] bg-muted text-muted-foreground"
                >
                  {modLogs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notify" className="gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Notify
            </TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-4">
            {guildStats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {guildStats.icon && (
                      <img 
                        src={`https://cdn.discordapp.com/icons/${selectedGuild}/${guildStats.icon}.png`}
                        alt={guildStats.name}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div>
                      <h5 className="font-semibold">{guildStats.name}</h5>
                      <p className="text-xs text-muted-foreground">Server Statistics</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={refreshStats}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Total Members</span>
                    </div>
                    <p className="text-2xl font-bold">{guildStats.member_count}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <div className="w-2 h-2 rounded-full bg-[hsl(var(--green))]" />
                      <span className="text-xs">Online</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--green))]">{guildStats.online_count}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <span className="text-xs">💎 Boosts</span>
                    </div>
                    <p className="text-2xl font-bold text-[#f47fff]">{guildStats.boost_count}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Volume2 className="w-4 h-4" />
                      <span className="text-xs">Channels</span>
                    </div>
                    <p className="text-2xl font-bold">{guildStats.channel_count}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-4">
            <div className="space-y-3">
              {membersIntentError && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="font-semibold">Server Members Intent Required</p>
                      <p className="text-sm text-amber-400/80">
                        To view and manage guild members, you need to enable the "Server Members Intent" in Discord Developer Portal:
                      </p>
                      <ol className="text-sm text-amber-400/80 list-decimal list-inside space-y-1">
                        <li>Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">Discord Developer Portal</a></li>
                        <li>Select your bot application</li>
                        <li>Go to "Bot" in the sidebar</li>
                        <li>Scroll to "Privileged Gateway Intents"</li>
                        <li>Enable "Server Members Intent"</li>
                        <li>Save changes and refresh this page</li>
                      </ol>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                        onClick={() => window.open('https://discord.com/developers/applications', '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Developer Portal
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cache Status & Refresh */}
              {!membersIntentError && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {cacheStatus && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className={`cursor-help ${
                                cacheStatus === 'HIT' 
                                  ? 'bg-[hsl(var(--green))]/10 text-[hsl(var(--green))] border-[hsl(var(--green))]/30' 
                                  : cacheStatus === 'STALE'
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                  : 'bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/30'
                              }`}
                            >
                              {cacheStatus === 'HIT' && <Zap className="w-3 h-3 mr-1" />}
                              {cacheStatus === 'STALE' && <Clock className="w-3 h-3 mr-1" />}
                              {cacheStatus === 'MISS' && <Database className="w-3 h-3 mr-1" />}
                              {cacheStatus === 'HIT' ? 'Cached' : cacheStatus === 'STALE' ? 'Stale' : 'Fresh'}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-xs">
                              {cacheStatus === 'HIT' && 'Data served from cache. Updated ' + (lastFetchedAt ? formatRelativeTime(lastFetchedAt) : 'recently') + '.'}
                              {cacheStatus === 'STALE' && 'Cache is stale. Showing cached data while refreshing in background. Updated ' + (lastFetchedAt ? formatRelativeTime(lastFetchedAt) : 'recently') + '.'}
                              {cacheStatus === 'MISS' && 'Fresh data fetched directly from Discord API.'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {lastFetchedAt && (
                      <span className="text-[10px] text-muted-foreground">
                        Updated {formatRelativeTime(lastFetchedAt)}
                      </span>
                    )}
                    {members.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {members.length}{guildStats?.member_count ? `/${guildStats.member_count}` : ''} loaded
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearMemberCache}
                            disabled={isClearingCache || !cacheStatus || cacheStatus === 'MISS'}
                            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className={`w-4 h-4 ${isClearingCache ? 'animate-pulse' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Clear member cache</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={forceRefreshMembers}
                      disabled={isLoading}
                      className="h-8 px-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      <span className="ml-1.5 text-xs">Refresh</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Bulk Actions Bar */}
              {!membersIntentError && selectedMemberIds.size > 0 && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-[#5865F2]/20 text-[#5865F2]">
                      {selectedMemberIds.size} selected
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 px-2">
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBulkAction('timeout')}
                      className="h-7 px-2"
                    >
                      <Timer className="w-3 h-3 mr-1" />
                      Timeout
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBulkAction('kick')}
                      className="h-7 px-2"
                    >
                      <UserMinus className="w-3 h-3 mr-1" />
                      Kick
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBulkAction('ban')}
                      className="h-7 px-2 text-destructive border-destructive/50 hover:bg-destructive/10"
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      Ban
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectedMemberIds.size === filteredMembers.length ? clearSelection : selectAllMembers}
                  className="h-8 px-2"
                  disabled={membersIntentError || filteredMembers.length === 0}
                >
                  {selectedMemberIds.size === filteredMembers.length && filteredMembers.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </Button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search members..." 
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="pl-9"
                    disabled={membersIntentError}
                  />
                </div>
              </div>

              <ScrollArea className="h-64" ref={scrollAreaRef}>
                <div className="space-y-2">
                  {!membersIntentError && filteredMembers.map(member => (
                    <div 
                      key={member.user.id}
                      className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                        selectedMemberIds.has(member.user.id)
                          ? 'bg-[#5865F2]/20 border border-[#5865F2]/30'
                          : 'bg-secondary/20 hover:bg-secondary/40'
                      }`}
                      onClick={() => toggleMemberSelection(member.user.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedMemberIds.has(member.user.id)}
                          onCheckedChange={() => toggleMemberSelection(member.user.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="border-muted-foreground/50"
                        />
                        {member.user.avatar ? (
                          <img 
                            src={`https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=32`}
                            alt={member.user.username}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <Users className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium truncate">{member.nick || member.user.username}</p>
                            {/* Role badges */}
                            {getMemberTopRoles(member.roles).map(role => (
                              <span
                                key={role.id}
                                className="text-[9px] px-1 py-0.5 rounded font-medium"
                                style={{ 
                                  backgroundColor: `${discordColorToHex(role.color)}20`,
                                  color: discordColorToHex(role.color),
                                  border: `1px solid ${discordColorToHex(role.color)}40`
                                }}
                              >
                                {role.name}
                              </span>
                            ))}
                            {member.roles.filter(id => getRoleById(id)?.name !== '@everyone').length > 2 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{member.roles.filter(id => getRoleById(id)?.name !== '@everyone').length - 2}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">@{member.user.username}</p>
                        </div>
                        {member.communication_disabled_until && new Date(member.communication_disabled_until) > new Date() && (
                          <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 ml-1">
                            <Timer className="w-3 h-3 mr-1" />
                            Timed out
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {member.communication_disabled_until && new Date(member.communication_disabled_until) > new Date() ? (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeTimeout(member)}
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--green))]" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openModAction('timeout', member)}
                          >
                            <Timer className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openModAction('kick', member)}
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => openModAction('ban', member)}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Infinite scroll trigger */}
                  {!membersIntentError && membersHasMore && !memberSearch.trim() && (
                    <div 
                      ref={loadMoreTriggerRef} 
                      className="flex items-center justify-center py-3"
                    >
                      {isLoadingMore ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs">Loading more...</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Scroll for more</span>
                      )}
                    </div>
                  )}

                  {/* Member count info */}
                  {!membersIntentError && members.length > 0 && !membersHasMore && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      {memberSearch.trim() 
                        ? `Showing ${filteredMembers.length} of ${members.length} loaded members`
                        : `All ${members.length} members loaded`
                      }
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Moderation Tab */}
          <TabsContent value="moderation" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Quick moderation actions. Select a member from the Members tab to take action.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start gap-2">
                  <Timer className="w-4 h-4" />
                  Timeout User
                </Button>
                <Button variant="outline" className="justify-start gap-2">
                  <UserMinus className="w-4 h-4" />
                  Kick User
                </Button>
                <Button variant="outline" className="justify-start gap-2 text-destructive">
                  <Ban className="w-4 h-4" />
                  Ban User
                </Button>
                <Button variant="outline" className="justify-start gap-2">
                  <Shield className="w-4 h-4" />
                  View Logs
                </Button>
              </div>

              {/* Recent Mod Actions */}
              <div>
                <h5 className="text-sm font-medium mb-2">Recent Actions</h5>
                <div className="text-xs text-muted-foreground text-center py-4 bg-secondary/20 rounded-lg">
                  No recent moderation actions
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium">Moderation Audit Log</h5>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchModLogs}
                  disabled={isLoadingLogs}
                  className="h-8 px-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                  <span className="ml-1.5 text-xs">Refresh</span>
                </Button>
              </div>

              {/* Search and Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by user, reason, or moderator..." 
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={logActionFilter} onValueChange={setLogActionFilter}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="ban">Bans</SelectItem>
                    <SelectItem value="kick">Kicks</SelectItem>
                    <SelectItem value="timeout">Timeouts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Results count */}
              {modLogs.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Showing {filteredLogs.length} of {modLogs.length} actions
                </p>
              )}

              <ScrollArea className="h-72">
                {isLoadingLogs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8 bg-secondary/20 rounded-lg">
                    {modLogs.length === 0 ? 'No moderation actions recorded' : 'No matching actions found'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline"
                              className={
                                log.action_type === 'ban'
                                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                                  : log.action_type === 'kick'
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                  : 'bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/30'
                              }
                            >
                              {log.action_type === 'ban' && <Ban className="w-3 h-3 mr-1" />}
                              {log.action_type === 'kick' && <UserMinus className="w-3 h-3 mr-1" />}
                              {log.action_type === 'timeout' && <Timer className="w-3 h-3 mr-1" />}
                              {log.action_type.charAt(0).toUpperCase() + log.action_type.slice(1)}
                            </Badge>
                            <span className="text-sm font-medium">
                              {log.target_username || log.target_user_id}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(new Date(log.performed_at))}
                          </span>
                        </div>
                        {log.performer_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            <span className="font-medium">By:</span> {log.performer_name}
                          </p>
                        )}
                        {log.reason && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Reason:</span> {log.reason}
                          </p>
                        )}
                        {log.duration && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Duration:</span> {log.duration} min
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70">
                          ID: {log.target_user_id}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Notify Tab */}
          <TabsContent value="notify" className="mt-4">
            <div className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Channel ID</Label>
                <Input 
                  placeholder="Enter channel ID..."
                  value={notifyChannel}
                  onChange={e => setNotifyChannel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Right-click a channel in Discord → Copy Channel ID
                </p>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Title</Label>
                <Input 
                  placeholder="Notification title..."
                  value={notifyTitle}
                  onChange={e => setNotifyTitle(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Message</Label>
                <Textarea 
                  placeholder="Notification message..."
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button 
                onClick={sendNotification}
                disabled={isSendingNotification || !notifyChannel || !notifyTitle}
                className="w-full gap-2"
              >
                {isSendingNotification ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Notification
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Moderation Dialog */}
      <Dialog open={showModDialog} onOpenChange={setShowModDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modAction?.type === 'kick' && <UserMinus className="w-5 h-5" />}
              {modAction?.type === 'ban' && <Ban className="w-5 h-5 text-destructive" />}
              {modAction?.type === 'timeout' && <Timer className="w-5 h-5" />}
              {modAction?.type === 'kick' && 'Kick User'}
              {modAction?.type === 'ban' && 'Ban User'}
              {modAction?.type === 'timeout' && 'Timeout User'}
            </DialogTitle>
            <DialogDescription>
              {modAction?.member && (
                <span>
                  You are about to {modAction.type} <strong>{modAction.member.user.username}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {modAction?.type === 'timeout' && (
              <div>
                <Label className="text-sm mb-2 block">Duration (minutes)</Label>
                <Select 
                  value={String(modAction.duration)} 
                  onValueChange={v => setModAction({ ...modAction, duration: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="1440">1 day</SelectItem>
                    <SelectItem value="10080">1 week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-sm mb-2 block">Reason (optional)</Label>
              <Textarea 
                placeholder="Reason for this action..."
                value={modAction?.reason || ''}
                onChange={e => modAction && setModAction({ ...modAction, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant={modAction?.type === 'ban' ? 'destructive' : 'default'}
              onClick={executeModAction}
              disabled={isActioning}
            >
              {isActioning ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm {modAction?.type}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Moderation Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkAction?.type === 'kick' && <UserMinus className="w-5 h-5" />}
              {bulkAction?.type === 'ban' && <Ban className="w-5 h-5 text-destructive" />}
              {bulkAction?.type === 'timeout' && <Timer className="w-5 h-5" />}
              Bulk {bulkAction?.type === 'kick' ? 'Kick' : bulkAction?.type === 'ban' ? 'Ban' : 'Timeout'} {bulkAction?.memberIds.length} Members
            </DialogTitle>
            <DialogDescription>
              This action will {bulkAction?.type === 'kick' ? 'kick' : bulkAction?.type === 'ban' ? 'permanently ban' : 'timeout'} {bulkAction?.memberIds.length} selected member{bulkAction?.memberIds.length !== 1 ? 's' : ''}.
              {bulkAction?.type === 'ban' && ' This cannot be undone easily.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm mb-2 block">Reason (optional)</Label>
              <Textarea
                placeholder="Enter reason for this action..."
                value={bulkAction?.reason || ''}
                onChange={e => setBulkAction(prev => prev ? { ...prev, reason: e.target.value } : null)}
                rows={2}
              />
            </div>

            {bulkAction?.type === 'timeout' && (
              <div>
                <Label className="text-sm mb-2 block">Duration (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={40320}
                  value={bulkAction?.duration || 60}
                  onChange={e => setBulkAction(prev => prev ? { ...prev, duration: parseInt(e.target.value) || 60 } : null)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Max: 40320 minutes (28 days)
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Selected members:</p>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {bulkAction?.memberIds.slice(0, 10).map(id => {
                  const member = members.find(m => m.user.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {member?.nick || member?.user.username || id}
                    </Badge>
                  );
                })}
                {(bulkAction?.memberIds.length || 0) > 10 && (
                  <Badge variant="secondary" className="text-xs">
                    +{(bulkAction?.memberIds.length || 0) - 10} more
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant={bulkAction?.type === 'ban' ? 'destructive' : 'default'}
              onClick={executeBulkAction}
              disabled={isBulkActioning}
            >
              {isBulkActioning ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm {bulkAction?.type} {bulkAction?.memberIds.length} members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
