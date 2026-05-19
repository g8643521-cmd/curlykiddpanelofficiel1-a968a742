import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle, 
  Shield,
  ShieldCheck,
  Server,
  Calendar,
  Download,
  FileJson,
  FileText,
  ExternalLink,
  Copy,
  Eye,
  Info,
  Loader2,
  Database,
  Fingerprint,
  Zap,
  Ticket,
  Users,
  Clock,
  Activity,
  ArrowLeft,
  MessageSquare,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { supabase } from '@/lib/supabase';
import { pingRpc, pingHead, getCached } from '@/lib/connectionCache';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import ParticleBackground from '@/components/ParticleBackground';
import AppHeader from '@/components/AppHeader';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { EyeOff, ShieldAlert } from 'lucide-react';

// Animated counter component
const AnimatedCounter = ({ value, duration = 1.5 }: { value: number; duration?: number }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString('en-US'));
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
    const unsubscribe = rounded.on('change', (v) => setDisplay(v));
    return () => { controls.stop(); unsubscribe(); };
  }, [value, duration, count, rounded]);

  return <span>{display}</span>;
};

interface PlayerIdentifiers {
  steam?: string;
  discord?: string;
  discord_avatar?: string;
  discord_username?: string;
  fivem?: string;
  license?: string;
}

interface CheaterReport {
  id: string;
  player_name: string;
  player_identifiers: PlayerIdentifiers | null;
  server_code: string | null;
  server_name: string | null;
  reason: string;
  evidence_url: string | null;
  status: string;
  created_at: string;
}

// Helper to get Discord avatar URL
const getDiscordAvatarUrl = (discordId: string, avatarHash?: string) => {
  if (avatarHash) {
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=128`;
  }
  const defaultIndex = Number(BigInt(discordId) % BigInt(5));
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
};

const EXTERNAL_LOOKUP_UNAVAILABLE = 'External screening is temporarily unavailable. Cheater DB results are still available.';

const getExternalLookupMessage = (value?: string | null) => {
  if (!value || /lookup failed|upstream|failed to contact|functionshttp|non-2xx/i.test(value)) {
    return EXTERNAL_LOOKUP_UNAVAILABLE;
  }
  return value;
};

const normalizeSxPayload = (response: any) => response?.data?.user ?? response?.data ?? response?.user ?? null;

const normalizeSxDiscordUser = (response: any, payload: any) => {
  const explicit = response?.data?.discord_user || response?.discord_user || payload?.discord_user;
  if (explicit) return explicit;
  if (!payload?.discordId) return null;
  const username = Array.isArray(payload.usernames) ? payload.usernames[0]?.value : undefined;
  return {
    id: payload.discordId,
    username: username || payload.globalName || payload.discordId,
    global_name: payload.globalName || username || null,
    avatar: payload.discordAvatarHash || null,
    avatar_url: payload.avatarUrl || null,
  };
};

const CheaterSearch = () => {
  const { isAdmin, isOwner } = useAdminStatus();
  const canUseAdminMode = isAdmin || isOwner;
  const [adminMode, setAdminMode] = useState<boolean>(() => {
    try { return localStorage.getItem('ckp_cheater_admin_mode') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('ckp_cheater_admin_mode', adminMode ? '1' : '0'); } catch {}
  }, [adminMode]);
  // If user loses admin rights, force-disable admin mode
  useEffect(() => {
    if (!canUseAdminMode && adminMode) setAdminMode(false);
  }, [canUseAdminMode, adminMode]);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<CheaterReport[]>([]);
  const [allCheaters, setAllCheaters] = useState<CheaterReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, suspected: 0 });
  const [sxResult, setSxResult] = useState<any>(null);
  const [sxDiscordUser, setSxDiscordUser] = useState<any>(null);
  const [sxLoading, setSxLoading] = useState(false);
  const [sxError, setSxError] = useState<string | null>(null);
  // Tab filter state
  const [ticketsFilter, setTicketsFilter] = useState('');
  const [ticketsEventFilter, setTicketsEventFilter] = useState<Set<string>>(new Set());
  const [guildsFilter, setGuildsFilter] = useState('');
  const [guildsEventFilter, setGuildsEventFilter] = useState<Set<string>>(new Set());
  const [anticheatFilter, setAnticheatFilter] = useState('');
  const [messagesFilter, setMessagesFilter] = useState('');
  // Hydrate from cache instantly so the pill renders with last-known latency on mount
  const _cachedSx = getCached('head:cheater_reports');
  const _cachedDb = getCached('head:mod_categories');
  // Static table count — known from schema, no need to query information_schema (~150ms saved)
  const KNOWN_TABLE_COUNT = 20;
  const [sxStats, setSxStats] = useState<{ connected: boolean; latency: number | null; ticketCount: number }>({
    connected: _cachedSx?.connected ?? false,
    latency: _cachedSx?.latency ?? null,
    ticketCount: (_cachedSx as any)?.data ?? 0,
  });
  const [dbStats, setDbStats] = useState<{ connected: boolean; tableCount: number; latency: number | null }>({
    connected: _cachedDb?.connected ?? false,
    tableCount: KNOWN_TABLE_COUNT,
    latency: _cachedDb?.latency ?? null,
  });
  const hasAutoSearched = useRef(false);
  const lastSearchRunRef = useRef<{ query: string; at: number } | null>(null);

  const fetchDbStats = async () => {
    // Bypass cache so the pill updates with a fresh measurement every tick
    const { connected, latency } = await pingHead('mod_categories', { bypassCache: true });
    setDbStats({
      connected,
      tableCount: KNOWN_TABLE_COUNT,
      latency: connected ? latency : null,
    });
  };

  useEffect(() => {
    // Fire connection pings first for instant feedback, then heavier stats
    fetchDbStats();
    fetchSxStats();
    Promise.all([fetchStats(), fetchStatsOverrides()]);
    // Live-refresh status pills every 3s so the latency reflects current conditions
    const interval = setInterval(() => {
      fetchSxStats();
      fetchDbStats();
    }, 3000);
    return () => { clearInterval(interval); };
  }, []);

  // Auto-search from URL query param (e.g. /cheaters?q=somePlayer)
  const pendingSearch = useRef<string | null>(null);
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !hasAutoSearched.current) {
      hasAutoSearched.current = true;
      setSearchQuery(q);
      pendingSearch.current = q;
    }
  }, [searchParams]);

  // Single auto-search path for URL-driven lookups
  useEffect(() => {
    if (pendingSearch.current && searchQuery === pendingSearch.current) {
      pendingSearch.current = null;
      handleSearch();
    }
  }, [searchQuery]);

  const fetchSxStats = async () => {
    // Bypass cache so each tick produces a fresh latency measurement
    const { connected, latency, count } = await pingHead('cheater_reports', { bypassCache: true });
    setSxStats({
      connected,
      latency: connected ? latency : null,
      ticketCount: count ?? 0,
    });
  };

  const [statsOverrides, setStatsOverrides] = useState<{ total?: number; confirmed?: number; suspected?: number }>({});

  // Hidden entries (admins can silently exclude specific results from search).
  const [hiddenValues, setHiddenValues] = useState<Set<string>>(new Set());

  const fetchHiddenEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('hidden_cheater_entries')
      .select('match_value');
    if (!error && data) {
      setHiddenValues(new Set(data.map((r: any) => String(r.match_value || '').toLowerCase())));
    }
  }, []);

  useEffect(() => {
    fetchHiddenEntries();
  }, [fetchHiddenEntries]);

  const isCheaterHidden = useCallback(
    (cheater: CheaterReport) => {
      if (adminMode && canUseAdminMode) return false;
      if (hiddenValues.size === 0) return false;
      const candidates: string[] = [];
      if (cheater.player_name) candidates.push(cheater.player_name.toLowerCase());
      const ids = cheater.player_identifiers;
      if (ids) {
        for (const v of Object.values(ids)) {
          if (typeof v === 'string' && v) candidates.push(v.toLowerCase());
        }
      }
      return candidates.some((c) => hiddenValues.has(c));
    },
    [hiddenValues, adminMode, canUseAdminMode]
  );

  const hideCheaterEntry = useCallback(
    async (cheater: CheaterReport) => {
      const value = (cheater.player_identifiers?.discord || cheater.player_name || '').trim();
      if (!value) return;
      const { error } = await supabase.from('hidden_cheater_entries').insert({
        match_value: value,
        match_type: cheater.player_identifiers?.discord ? 'discord' : 'name',
        cheater_report_id: cheater.id,
      });
      if (error) {
        toast.error('Could not hide entry');
        return;
      }
      setHiddenValues((prev) => new Set(prev).add(value.toLowerCase()));
      setResults((prev) => prev.filter((r) => r.id !== cheater.id));
      toast.success('Entry hidden from search');
    },
    []
  );

  const fetchStatsOverrides = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['stats_total_override', 'stats_confirmed_override', 'stats_suspected_override']);
    
    if (data) {
      const overrides: any = {};
      for (const row of data) {
        const val = typeof row.value === 'string' ? row.value.replace(/^"|"$/g, '') : String(row.value ?? '');
        const num = parseInt(val, 10);
        if (!isNaN(num) && val !== '') {
          if (row.key === 'stats_total_override') overrides.total = num;
          if (row.key === 'stats_confirmed_override') overrides.confirmed = num;
          if (row.key === 'stats_suspected_override') overrides.suspected = num;
        }
      }
      setStatsOverrides(overrides);
    }
  };

  // Fast stats via DB function — no need to fetch all rows
  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_cheater_stats');
      if (!error && data) {
        setStats({
          total: data.total || 0,
          confirmed: data.confirmed || 0,
          suspected: data.suspected || 0,
        });
      }
    } catch {}
  };

  // Only used when browsing/displaying the list — lazy loaded
  const fetchAllCheaters = async () => {
    if (allCheaters.length > 0) return; // Already cached in state
    try {
      const { data, error } = await supabase
        .from('cheater_reports')
        .select('id, player_name, player_identifiers, server_code, server_name, reason, evidence_url, status, created_at')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const typedData = data.map(item => ({
          ...item,
          player_identifiers: item.player_identifiers as PlayerIdentifiers | null,
        }));
        setAllCheaters(typedData);
      }
    } catch {}
  };


  const handleSearch = async () => {
    const query = searchQuery.trim();

    if (!query) {
      setResults([]);
      setHasSearched(false);
      setSxResult(null);
      setSxError(null);
      return;
    }

    const now = Date.now();
    if (
      lastSearchRunRef.current &&
      lastSearchRunRef.current.query === query &&
      now - lastSearchRunRef.current.at < 1500
    ) {
      return;
    }
    lastSearchRunRef.current = { query, at: now };

    setIsLoading(true);
    setHasSearched(true);
    setSxResult(null);
    setSxDiscordUser(null);
    setSxError(null);
    const isDiscordId = /^\d{17,19}$/.test(query);
    const isSteamHex = /^steam:/.test(query.toLowerCase()) || /^[a-f0-9]{15,17}$/i.test(query);
    const isFiveM = /^fivem:/.test(query.toLowerCase()) || /^\d{1,10}$/.test(query);
    const isLicense = /^license:/.test(query.toLowerCase()) || /^[a-f0-9]{40}$/i.test(query);

    // If Discord ID, also query external API
    let sxData: any = null;
    let sxDiscordUserData: any = null;
    const bypassHidden = adminMode && canUseAdminMode;
    const discordIsHidden = !bypassHidden && isDiscordId && hiddenValues.has(query.toLowerCase());
    if (isDiscordId && !discordIsHidden) {
      try {
        const { data } = await supabase.functions.invoke('screensharex-lookup', {
          body: { discord_id: query },
        });
        if (data?.success) {
          sxData = normalizeSxPayload(data);
          sxDiscordUserData = normalizeSxDiscordUser(data, sxData);
          setSxResult(sxData);
          setSxDiscordUser(sxDiscordUserData || null);
        } else {
          setSxError(getExternalLookupMessage(data?.error));
        }
      } catch {}
      setSxLoading(false);
    }

    // Fetch all and filter client-side for identifier matching (JSONB)
    let typedData: CheaterReport[] = [];
    try {
      const { data, error } = await supabase
        .from('cheater_reports')
        .select('id, player_name, player_identifiers, server_code, server_name, reason, evidence_url, status, created_at')
        .order('created_at', { ascending: false });

      if (!error && data) {
        typedData = data.map(item => ({
          ...item,
          player_identifiers: item.player_identifiers as PlayerIdentifiers | null,
        }));
      }
    } catch {}

    // Also search bot-detected cheaters when searching by Discord ID
    if (isDiscordId) {
      try {
        const { data: botData } = await supabase.rpc('public_lookup_bot_cheater', { _discord_id: query });
        if (Array.isArray(botData) && botData.length > 0) {
          const mapped: CheaterReport[] = botData.map((b: any) => ({
            id: `bot-${b.discord_user_id}-${b.guild_id ?? 'na'}-${b.detected_at ?? ''}`,
            player_name: b.discord_username || b.discord_user_id,
            player_identifiers: {
              discord: b.discord_user_id,
              discord_avatar: b.discord_avatar || undefined,
              discord_username: b.discord_username || undefined,
            },
            server_code: null,
            server_name: b.guild_name || null,
            reason: b.summary_text || (b.is_flagged
              ? 'Flagged by automated bot detection'
              : `Detected by bot — ${b.total_bans ?? 0} bans, ${b.total_tickets ?? 0} tickets`),
            evidence_url: null,
            status: (b.is_flagged || (b.total_bans ?? 0) > 0) ? 'confirmed' : 'suspected',
            created_at: b.detected_at || new Date().toISOString(),
          }));
          // Avoid duplicates if same Discord ID already in cheater_reports
          const seen = new Set(typedData.map(c => c.player_identifiers?.discord).filter(Boolean));
          for (const m of mapped) {
            if (!seen.has(m.player_identifiers?.discord)) {
              typedData.push(m);
            }
          }
        }
      } catch {}
    }



    // Filter results by name OR any matching identifier
    const filtered = typedData.filter(cheater => {
      const lowerQuery = query.toLowerCase();
      const ids = cheater.player_identifiers;

      // Match by player name
      if (cheater.player_name.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      if (!ids) return false;

      // Match by Discord ID
      if (isDiscordId && ids.discord === query) {
        return true;
      }

      // Match by Steam (with or without prefix)
      if (isSteamHex) {
        const steamQuery = query.toLowerCase().replace(/^steam:/, '');
        const storedSteam = ids.steam?.toLowerCase().replace(/^steam:/, '');
        if (storedSteam && storedSteam.includes(steamQuery)) {
          return true;
        }
      }

      // Match by FiveM ID
      if (isFiveM) {
        const fivemQuery = query.toLowerCase().replace(/^fivem:/, '');
        const storedFiveM = ids.fivem?.toLowerCase().replace(/^fivem:/, '');
        if (storedFiveM && storedFiveM.includes(fivemQuery)) {
          return true;
        }
      }

      // Match by License
      if (isLicense) {
        const licenseQuery = query.toLowerCase().replace(/^license:/, '');
        const storedLicense = ids.license?.toLowerCase().replace(/^license:/, '');
        if (storedLicense && storedLicense.includes(licenseQuery)) {
          return true;
        }
      }

      // Fallback: partial match on any identifier value
      const idValues = Object.values(ids).filter(Boolean).map(v => String(v).toLowerCase());
      return idValues.some(val => val.includes(lowerQuery));
    });

    // Enrich filtered results with avatar data if available
    if (isDiscordId && sxDiscordUserData?.avatar) {
      for (const cheater of filtered) {
        const ids = cheater.player_identifiers;
        if (ids?.discord === query && !ids?.discord_avatar) {
          // Update in-memory
          cheater.player_identifiers = { ...ids, discord_avatar: sxDiscordUserData.avatar, discord_username: sxDiscordUserData.global_name || sxDiscordUserData.username };
          // Persist avatar hash to DB (fire-and-forget)
          supabase
            .from('cheater_reports')
            .update({ player_identifiers: cheater.player_identifiers })
            .eq('id', cheater.id)
            .then(() => {});
        }
      }
    }

    const visible = filtered.filter((c) => !isCheaterHidden(c));
    setResults(visible);
    setIsLoading(false);

    // Send Discord webhook notification with full data
    const session = (await supabase.auth.getSession()).data.session;
    const avatarUrl = sxDiscordUserData?.avatar_url || (sxDiscordUserData?.avatar && isDiscordId
      ? `https://cdn.discordapp.com/avatars/${query}/${sxDiscordUserData.avatar}.${sxDiscordUserData.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
      : null);
    const allTickets = [
      ...((sxData?.tickets as any[]) || []),
      ...((sxData?.tickets_v2 as any[]) || []),
    ];
    const guildNames = [...new Set(allTickets.map((t: any) => t.guild_name || t.guildname).filter(Boolean))];
    const guildActivity = (sxData?.guild_join_leave as any[]) || [];
    const totalTickets = (sxData?.summary?.total_tickets || 0) + (sxData?.summary?.total_tickets_v2 || 0);

    supabase.functions.invoke('cheater-webhook', {
      body: {
        search_query: query,
        results_count: filtered.length,
        searched_by: session?.user?.email || 'Anonymous',
        sx_username: sxDiscordUserData?.global_name || sxDiscordUserData?.username || null,
        sx_tickets: totalTickets,
        sx_guilds: sxData?.summary?.total_guild_records || 0,
        sx_guild_names: guildNames,
        sx_avatar_url: avatarUrl,
        sx_discord_id: isDiscordId ? query : null,
        sx_guild_activity: guildActivity.slice(0, 10).map((g: any) => ({
          guild: g.guildname,
          joined: g.joined_at,
          left: g.left_at,
          username: g.memberUsername,
        })),
        sx_tickets_detail: allTickets.slice(0, 5).map((t: any) => ({
          guild: t.guild_name || t.guildname,
          action: t.action,
          channel: t.channelname,
          time: t.time,
          games: t.games,
        })),
        db_matches: filtered.map(r => ({
          name: r.player_name,
          status: r.status,
          reason: r.reason,
          evidence_url: r.evidence_url,
          server_name: r.server_name,
          server_code: r.server_code,
          created_at: r.created_at,
          player_identifiers: r.player_identifiers,
        })),
      },
    }).catch(err => console.error('Discord webhook failed:', err));
  };


  const lookupExternalDB = async (discordId: string) => {
    setSxLoading(true);
    setSxDiscordUser(null);
    try {
      const { data, error } = await supabase.functions.invoke('screensharex-lookup', {
        body: { discord_id: discordId },
      });
      if (error) throw error;
      if (data?.success) {
        // screenshare.lol returns { data: { user: {...} } }; older shapes return the object directly
        const payload = normalizeSxPayload(data);
        setSxResult(payload);
        const discordUserData = normalizeSxDiscordUser(data, payload);
        if (discordUserData) {
          setSxDiscordUser(discordUserData);
        }
      } else {
        setSxError(getExternalLookupMessage(data?.error));
      }
    } catch (err: any) {
      setSxError(getExternalLookupMessage(err.message));
    }
    setSxLoading(false);
  };

  const handleExportJSON = () => {
    const dataToExport = allCheaters.map(c => ({
      player_name: c.player_name,
      identifiers: c.player_identifiers,
      reason: c.reason,
      status: c.status,
      server: c.server_name || c.server_code,
      reported_at: c.created_at,
    }));

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cheater_database_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${allCheaters.length} records as JSON`);
  };

  const handleExportCSV = () => {
    const headers = ['Player Name', 'Status', 'Reason', 'Server', 'Discord ID', 'Reported Date'];
    const rows = allCheaters.map(c => [
      `"${c.player_name.replace(/"/g, '""')}"`,
      c.status,
      `"${c.reason.replace(/"/g, '""')}"`,
      `"${(c.server_name || c.server_code || '').replace(/"/g, '""')}"`,
      c.player_identifiers?.discord || '',
      new Date(c.created_at).toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cheater_database_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${allCheaters.length} records as CSV`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/50">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        );
      case 'suspected':
        return (
          <Badge className="bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))] border-[hsl(var(--yellow))]/50">
            <HelpCircle className="w-3 h-3 mr-1" />
            Suspected
          </Badge>
        );
      case 'cleared':
        return (
          <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/50">
            <CheckCircle className="w-3 h-3 mr-1" />
            Cleared
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderCheaterCard = (cheater: CheaterReport, isSearchResult = false) => {
    const identifiers = cheater.player_identifiers;
    const discordId = identifiers?.discord;
    const discordAvatar = identifiers?.discord_avatar;

    return (
      <ContextMenu key={cheater.id}>
        <ContextMenuTrigger asChild>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl overflow-hidden bg-card/60 backdrop-blur-md border border-border/50 hover:border-border/70 transition-all"
          >
            {/* Header with status indicator */}
            <div className={`px-5 py-3 border-b flex items-center justify-between ${
              cheater.status === 'confirmed'
                ? 'border-destructive/30 bg-destructive/5'
                : cheater.status === 'suspected'
                ? 'border-[hsl(var(--yellow))]/30 bg-[hsl(var(--yellow))]/5'
                : 'border-[hsl(var(--green))]/30 bg-[hsl(var(--green))]/5'
            }`}>
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-border/50">
                  {discordId ? (
                    <AvatarImage src={getDiscordAvatarUrl(discordId, discordAvatar)} alt={cheater.player_name} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground font-bold text-sm">
                    {cheater.player_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-foreground text-base leading-tight">{cheater.player_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reported {formatDistanceToNow(new Date(cheater.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(cheater.status)}
                {cheater.evidence_url && (
                  <a
                    href={cheater.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary text-xs font-medium hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" /> Evidence
                  </a>
                )}
              </div>
            </div>

            {/* Info Grid */}
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Details */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">Reason</h4>
                    <p className="text-sm text-foreground leading-relaxed">{cheater.reason}</p>
                  </div>
                  {cheater.server_name && (
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">Server</h4>
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-primary/60" />
                        <span className="text-sm text-foreground">{cheater.server_name}</span>
                        {cheater.server_code && (
                          <span className="text-xs text-muted-foreground font-mono">({cheater.server_code})</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">Reported</h4>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary/60" />
                      <span className="text-sm text-foreground">
                        {new Date(cheater.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Identifiers */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">Identifiers</h4>
                  <div className="space-y-1.5">
                    {discordId && (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-[#5865F2] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                          </svg>
                          <span className="text-xs font-mono text-foreground truncate">{discordId}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => copyToClipboard(discordId)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <a href={`https://discord.com/users/${discordId}`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                          </a>
                        </div>
                      </div>
                    )}
                    {identifiers?.steam && (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-[#66c0f4] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/>
                          </svg>
                          <span className="text-xs font-mono text-foreground truncate">{identifiers.steam}</span>
                        </div>
                        <button onClick={() => copyToClipboard(identifiers.steam!)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted shrink-0">
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                    {identifiers?.license && (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <Shield className="w-4 h-4 text-[#f40552] shrink-0" />
                          <span className="text-xs font-mono text-foreground truncate">{identifiers.license}</span>
                        </div>
                        <button onClick={() => copyToClipboard(identifiers.license!)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted shrink-0">
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                    {identifiers?.fivem && (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30 group">
                        <div className="flex items-center gap-2 min-w-0">
                          <Database className="w-4 h-4 text-orange-400 shrink-0" />
                          <span className="text-xs font-mono text-foreground truncate">{identifiers.fivem}</span>
                        </div>
                        <button onClick={() => copyToClipboard(identifiers.fivem!)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted shrink-0">
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                    {!discordId && !identifiers?.steam && !identifiers?.license && !identifiers?.fivem && (
                      <p className="text-xs text-muted-foreground italic px-3 py-2">No identifiers recorded</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </ContextMenuTrigger>
        
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => copyToClipboard(cheater.player_name)}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Player Name
          </ContextMenuItem>
          
          {discordId && (
            <>
              <ContextMenuItem onClick={() => copyToClipboard(discordId)}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Discord ID
              </ContextMenuItem>
              <ContextMenuItem onClick={() => window.open(`https://discord.com/users/${discordId}`, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Discord Profile
              </ContextMenuItem>
            </>
          )}
          
          {identifiers?.steam && (
            <ContextMenuItem onClick={() => copyToClipboard(identifiers.steam!)}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Steam ID
            </ContextMenuItem>
          )}
          
          {identifiers?.license && (
            <ContextMenuItem onClick={() => copyToClipboard(identifiers.license!)}>
              <Copy className="w-4 h-4 mr-2" />
              Copy FiveM License
            </ContextMenuItem>
          )}
          
          {identifiers?.fivem && (
            <ContextMenuItem onClick={() => copyToClipboard(identifiers.fivem!)}>
              <Copy className="w-4 h-4 mr-2" />
              Copy FiveM ID
            </ContextMenuItem>
          )}
          
          {cheater.evidence_url && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => window.open(cheater.evidence_url!, '_blank')}>
                <Eye className="w-4 h-4 mr-2" />
                View Evidence
              </ContextMenuItem>
            </>
          )}
          
          <ContextMenuSeparator />
          
          <ContextMenuItem onClick={() => {
            const allIds = [
              cheater.player_name,
              discordId ? `Discord: ${discordId}` : null,
              identifiers?.steam ? `Steam: ${identifiers.steam}` : null,
              identifiers?.license ? `License: ${identifiers.license}` : null,
              identifiers?.fivem ? `FiveM: ${identifiers.fivem}` : null,
            ].filter(Boolean).join('\n');
            copyToClipboard(allIds);
          }}>
            <Info className="w-4 h-4 mr-2" />
            Copy All Info
          </ContextMenuItem>
          {isAdmin && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => hideCheaterEntry(cheater)}
                className="text-destructive focus:text-destructive"
              >
                <EyeOff className="w-4 h-4 mr-2" />
                Hide from search
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="min-h-screen bg-background relative">
      <MaintenanceBanner />
      <ParticleBackground />
      <AppHeader />
      
      <div className="container mx-auto px-4 py-4 max-w-6xl relative z-10">

        {/* Hero & Stats - hidden when searching */}
        {!hasSearched && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 block leading-none mb-0.5">
                    CurlyKidd
                  </span>
                  <span className="text-xs font-semibold text-foreground/80">
                    Anti-Cheat Intelligence
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Combined connection indicator */}
                <motion.div 
                  className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-card/60 border border-border/30 backdrop-blur-sm cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => { fetchSxStats(); fetchDbStats(); }}
                  title="Click to refresh status"
                >
                  {sxStats.connected ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.5)]" />}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {sxStats.connected ? 'Service' : 'Service Offline'}
                  </span>
                  {sxStats.connected && sxStats.latency && (
                    <span className={`text-[10px] font-mono ${sxStats.latency < 300 ? 'text-emerald-400' : sxStats.latency < 800 ? 'text-yellow-400' : 'text-orange-400'}`}>
                      {sxStats.latency}ms
                    </span>
                  )}
                  <span className="w-px h-4 bg-border/50" />
                  {dbStats.connected ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.5)]" />}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {dbStats.connected ? 'Database' : 'DB Offline'}
                  </span>
                  {dbStats.connected && (
                    <span className="text-[10px] font-mono text-emerald-400">
                      {dbStats.tableCount} tables
                    </span>
                  )}
                  {dbStats.connected && dbStats.latency && (
                    <span className={`text-[10px] font-mono ${dbStats.latency < 300 ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {dbStats.latency}ms
                    </span>
                  )}
                </motion.div>
                
                {isAdmin && (
                  <Button
                    variant={adminMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setAdminMode((v) => {
                        const next = !v;
                        toast.success(next ? 'Admin Mode on — hidden entries are visible' : 'Admin Mode off');
                        return next;
                      });
                    }}
                    className={`h-8 px-3 text-xs gap-1.5 ${adminMode ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}`}
                    title="Toggle Admin Mode (ignores Hidden from search)"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Admin Mode{adminMode ? ': ON' : ''}
                  </Button>
                )}

                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground h-8 px-3">
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleExportJSON}>
                        <FileJson className="w-4 h-4 mr-2" />
                        Export as JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportCSV}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export as CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Hero */}
            <div className="text-center mb-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-8"
              >
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Verified Data Sources</span>
              </motion.div>

              <motion.h1 
                className="font-display text-5xl md:text-6xl lg:text-[5.5rem] font-black text-foreground tracking-[-0.03em] leading-[0.85]"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.7 }}
              >
                Cheater
                <br />
                <span className="relative">
                  <span className="bg-gradient-to-r from-primary via-[hsl(var(--cyan-glow))] to-primary bg-clip-text text-transparent">
                    Database
                  </span>
                  <span className="absolute -inset-x-4 -inset-y-2 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
                </span>
              </motion.h1>
              
              <motion.p 
                className="text-muted-foreground/60 text-sm md:text-base mt-6 max-w-md mx-auto leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                Cross-referenced screening intelligence across Discord, Steam, FiveM, and license identifiers.
              </motion.p>
            </div>

            {/* Stats Cards */}
            <motion.div 
              className="max-w-3xl mx-auto mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
            >
              <div className="grid grid-cols-3 gap-4">
                {[
                  { 
                    label: 'Total Reports', 
                    value: statsOverrides.total ?? stats.total, 
                    icon: Shield,
                    gradient: 'from-foreground/10 to-foreground/5',
                    iconColor: 'text-foreground/70',
                    valueColor: 'text-foreground',
                    glowColor: 'shadow-[0_0_30px_hsl(var(--foreground)/0.05)]',
                  },
                  { 
                    label: 'Confirmed', 
                    value: statsOverrides.confirmed ?? stats.confirmed, 
                    icon: ShieldCheck,
                    gradient: 'from-primary/15 to-primary/5',
                    iconColor: 'text-primary',
                    valueColor: 'text-primary',
                    glowColor: 'shadow-[0_0_30px_hsl(var(--primary)/0.1)]',
                  },
                  { 
                    label: 'Suspected', 
                    value: statsOverrides.suspected ?? stats.suspected, 
                    icon: AlertTriangle,
                    gradient: 'from-[hsl(var(--yellow))]/15 to-[hsl(var(--yellow))]/5',
                    iconColor: 'text-[hsl(var(--yellow))]',
                    valueColor: 'text-[hsl(var(--yellow))]',
                    glowColor: 'shadow-[0_0_30px_hsl(var(--yellow)/0.1)]',
                  },
                ].map((stat, i) => (
                  <motion.div 
                    key={i} 
                    className="relative group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                  >
                    {/* Glow effect */}
                    <div className={`absolute inset-0 rounded-2xl ${stat.glowColor} opacity-0 group-hover:opacity-100 transition-all duration-300`} />
                    
                    <div className={`relative rounded-2xl border border-border/30 bg-gradient-to-b ${stat.gradient} backdrop-blur-xl p-6 text-center hover:border-border/60 transition-all duration-300`}>
                      <p className={`text-3xl md:text-4xl font-black tabular-nums tracking-tight ${stat.valueColor}`}>
                        <AnimatedCounter value={stat.value} />
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 mt-2 font-semibold">
                        {stat.label}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Trust bar */}
            <motion.div
              className="flex items-center justify-center gap-6 text-muted-foreground/40 text-[11px] font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary/50" />
                <span>Verified data sources</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
              <div className="flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-primary/50" />
                <span>Multi-identifier cross-reference</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary/50" />
                <span>Real-time updates</span>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Search Bar */}
        <motion.div 
          className={`${hasSearched ? '' : 'max-w-2xl mx-auto'} mb-8`}
          layout
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Search type hints */}
          {!hasSearched && (
            <motion.div 
              className="flex items-center justify-center gap-3 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <TooltipProvider>
                {[
                  { icon: (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                  ), label: 'Discord' },
                  { icon: (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/></svg>
                  ), label: 'Steam' },
                  { icon: <Database className="w-3.5 h-3.5" />, label: 'FiveM' },
                  { icon: <Fingerprint className="w-3.5 h-3.5" />, label: 'License' },
                ].map((item, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/40 border border-border/20 text-muted-foreground/50 hover:text-muted-foreground hover:border-border/40 transition-all duration-200 cursor-default">
                        {item.icon}
                        <span className="text-[11px] font-medium">{item.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Search by {item.label} identifier
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </motion.div>
          )}

          <div className="relative group">
            {/* Outer glow */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/20 via-[hsl(var(--cyan-glow))]/10 to-primary/20 opacity-0 group-focus-within:opacity-100 transition-all duration-300 blur-lg" />
            
            <div className="relative flex items-center bg-card/70 backdrop-blur-xl border border-border/40 rounded-2xl overflow-hidden focus-within:border-primary/50 transition-all duration-300 shadow-lg shadow-black/10">
              <div className="pl-5 pr-2 pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <Input
                placeholder="Search by name, Discord ID, Steam, FiveM, or license..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="border-0 bg-transparent h-14 md:h-16 text-base focus-visible:ring-0 focus-visible:ring-offset-0 px-3 placeholder:text-muted-foreground/30"
              />
              <div className="pr-3">
                <Button 
                  onClick={handleSearch} 
                  disabled={isLoading}
                  size="sm"
                  className="h-10 md:h-11 px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-primary to-[hsl(var(--cyan-glow))] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all duration-300 text-primary-foreground"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Keyboard hint */}
          {!hasSearched && (
            <motion.p 
              className="text-center text-[11px] text-muted-foreground/30 mt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              Press <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/30 text-muted-foreground/50 font-mono text-[10px]">Enter</kbd> to search
            </motion.p>
          )}
        </motion.div>

        {/* External Screening Results */}
        {hasSearched && (sxLoading || sxResult || sxError) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 space-y-4"
          >

            {sxLoading && (
              <div className="glass-card p-8 flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Querying external database...</span>
              </div>
            )}

            {sxError && (
              <div className="glass-card p-5 border border-primary/20 bg-primary/5">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  {sxError}
                </p>
              </div>
            )}

            {sxResult && (() => {
              // New screenshare.lol API shape
              const r: any = sxResult || {};
              const discordId = String(r.discordId || searchQuery);
              const username = r.globalName || r.username || 'Unknown';
              const handle = r.username || r.globalName || '';
              const avatarUrl = r.avatarUrl
                || (r.discordAvatarHash ? `https://cdn.discordapp.com/avatars/${discordId}/${r.discordAvatarHash}.${String(r.discordAvatarHash).startsWith('a_') ? 'gif' : 'png'}?size=256` : null);

              const tickets: any[] = Array.isArray(r.tickets) ? r.tickets : [];
              const ticketTimeline: any[] = Array.isArray(r.ticketTimeline) ? r.ticketTimeline : [];
              const guilds: any[] = Array.isArray(r.guilds) ? r.guilds : [];
              const guildEvents: any[] = Array.isArray(r.guildEvents) ? r.guildEvents : [];
              const flags: any[] = Array.isArray(r.flags) ? r.flags : [];

              // Snowflake-derived account creation fallback (Discord epoch: 2015-01-01)
              let snowflakeCreated: Date | null = null;
              try {
                if (/^\d{17,19}$/.test(discordId)) {
                  const ms = Number((BigInt(discordId) >> 22n) + 1420070400000n);
                  snowflakeCreated = new Date(ms);
                }
              } catch {}
              const accountCreated = r.createdAt ? new Date(r.createdAt) : snowflakeCreated;
              const lastSeen = r.lastSeenAt ? new Date(r.lastSeenAt) : null;
              const firstSeen = r.firstSeenAt ? new Date(r.firstSeenAt) : null;
              const riskScore = typeof r.riskScore === 'number' ? r.riskScore : 0;
              const currentGuilds = guilds.length;
              const totalTickets = tickets.length || (r.summary?.total_tickets ?? 0) + (r.summary?.total_tickets_v2 ?? 0);
              const totalGuildEvents = guildEvents.length || (r.summary?.total_guild_records ?? 0);
              const totalFlags = flags.length;

              // Identity history arrays — gracefully support multiple API shapes
              const usernameHistory: any[] = Array.isArray(r.usernameHistory) ? r.usernameHistory
                : Array.isArray(r.identities?.usernames) ? r.identities.usernames
                : [];
              const displayNameHistory: any[] = Array.isArray(r.displayNameHistory) ? r.displayNameHistory
                : Array.isArray(r.globalNameHistory) ? r.globalNameHistory
                : Array.isArray(r.identities?.displayNames) ? r.identities.displayNames
                : [];
              const avatarHistory: any[] = Array.isArray(r.avatarHistory) ? r.avatarHistory
                : Array.isArray(r.identities?.avatars) ? r.identities.avatars
                : [];

              // Risk level label
              const riskLevel = riskScore >= 75 ? { label: 'High', cls: 'text-destructive bg-destructive/10 border-destructive/30' }
                : riskScore >= 40 ? { label: 'Medium', cls: 'text-[hsl(var(--yellow))] bg-[hsl(var(--yellow))]/10 border-[hsl(var(--yellow))]/30' }
                : riskScore > 0 ? { label: 'Low', cls: 'text-[hsl(var(--green))] bg-[hsl(var(--green))]/10 border-[hsl(var(--green))]/30' }
                : { label: 'None', cls: 'text-muted-foreground bg-muted/30 border-border/40' };

              // Account age in human terms
              const accountAge = (() => {
                if (!accountCreated) return null;
                const diff = Date.now() - accountCreated.getTime();
                if (diff <= 0) return null;
                const years = Math.floor(diff / (365.25 * 86400000));
                const months = Math.floor((diff % (365.25 * 86400000)) / (30.44 * 86400000));
                if (years > 0) return `${years}y ${months}m old`;
                const days = Math.floor(diff / 86400000);
                if (days > 30) return `${months}m old`;
                return `${days}d old`;
              })();

              if (tickets.length === 0 && ticketTimeline.length === 0 && guilds.length === 0 && guildEvents.length === 0 && flags.length === 0 && !r.discordId) {
                return (
                  <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-8 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--green))] opacity-60" />
                    <p className="text-foreground font-medium">No Records Found</p>
                    <p className="text-sm text-muted-foreground mt-1">This user has no entries in the external screening database</p>
                  </div>
                );
              }

              const fmtDateTime = (val: any) => {
                if (!val) return '—';
                try {
                  const d = new Date(val);
                  if (isNaN(d.getTime())) return '—';
                  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                } catch { return '—'; }
              };
              const fmtRel = (val: any) => {
                if (!val) return null;
                try {
                  const d = new Date(val);
                  if (isNaN(d.getTime())) return null;
                  return formatDistanceToNow(d, { addSuffix: true });
                } catch { return null; }
              };

              const StatCard = ({ icon: Icon, label, value, sub }: any) => (
                <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm px-4 py-3">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em] mb-1.5">
                    <Icon className="w-3.5 h-3.5 text-primary/70" />
                    {label}
                  </div>
                  <div className="text-sm font-semibold text-foreground leading-tight">{value}</div>
                  {sub && <div className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</div>}
                </div>
              );

              return (
                <>
                  {/* Top action bar */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                    <button
                      onClick={() => { setSxResult(null); setSxDiscordUser(null); setSearchQuery(''); setHasSearched(false); }}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      New search
                    </button>
                    <span>Times in <span className="text-foreground/80 font-medium">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span></span>
                  </div>

                  {/* Profile card */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-2xl border border-border/40 bg-gradient-to-br from-card/60 via-card/40 to-card/20 backdrop-blur-xl p-6 shadow-xl shadow-black/20"
                  >
                    <div className="flex flex-col md:flex-row gap-6">
                      <Avatar className="w-[120px] h-[120px] rounded-xl ring-1 ring-border/40 shrink-0">
                        <AvatarImage src={avatarUrl || undefined} alt={username} className="object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <AvatarFallback className="bg-primary/15 text-primary font-bold text-3xl rounded-xl">
                          {(username || '?').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.18em]">Discord Profile</span>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-primary/30 bg-primary/10 text-primary px-1.5 py-0 h-4">Indexed</Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-3xl font-bold text-foreground leading-tight">{username}</h2>
                          {guilds.slice(0, 8).map((g: any, i: number) => {
                            const gName = String(g.guildName || g.name || g.guildId || 'Unknown');
                            const gId = g.guildId || g.id;
                            const role = g.role || g.roleName || g.customerRole;
                            const flaggedAt = g.flaggedAt || g.flagged_at || g.lastEventAt;
                            const joined = g.joinedAt || g.joined_at;
                            const icon = g.iconUrl || g.icon_url || (g.icon && gId ? `https://cdn.discordapp.com/icons/${gId}/${g.icon}.png?size=64` : null);
                            // Derive a stable hue from the guild id/name so each server gets its own color badge
                            const seed = String(gId || gName);
                            let hash = 0;
                            for (let c = 0; c < seed.length; c++) hash = (hash * 31 + seed.charCodeAt(c)) >>> 0;
                            const hue = hash % 360;
                            const initials = gName.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?';
                            const bgStyle = { background: `linear-gradient(135deg, hsl(${hue} 70% 22%), hsl(${(hue + 30) % 360} 75% 38%))` };
                            const ringStyle = { boxShadow: `0 0 0 1px hsl(${hue} 80% 55% / 0.55), 0 0 12px hsl(${hue} 90% 55% / 0.25)` };
                            return (
                              <HoverCard key={`gicon-${i}`} openDelay={80} closeDelay={80}>
                                <HoverCardTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={gName}
                                    style={ringStyle}
                                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 overflow-hidden hover:scale-105 transition-transform"
                                  >
                                    {icon ? (
                                      <img src={icon} alt={gName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                      <span style={bgStyle} className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white tracking-tight">
                                        {initials}
                                      </span>
                                    )}
                                  </button>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80 p-0 border-primary/30 bg-card/95 backdrop-blur-xl">
                                  <div className="p-4 border-l-2 border-primary">
                                    {role && (
                                      <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em] mb-1">Customer</div>
                                    )}
                                    <div className="flex items-center gap-2.5 mb-3">
                                      <div style={ringStyle} className="w-10 h-10 rounded-md flex items-center justify-center overflow-hidden shrink-0">
                                        {icon ? (
                                          <img src={icon} alt={gName} className="w-full h-full object-cover" />
                                        ) : (
                                          <span style={bgStyle} className="w-full h-full flex items-center justify-center text-sm font-bold text-white">
                                            {initials}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm font-semibold text-foreground truncate">{gName}</div>
                                    </div>
                                    {role && (
                                      <div className="mb-3">
                                        <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em] mb-1">Role</div>
                                        <div className="text-sm text-foreground">{String(role)}</div>
                                      </div>
                                    )}
                                    {flaggedAt && (
                                      <div className="mb-2">
                                        <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em] mb-1">Flagged at</div>
                                        <div className="text-xs font-mono text-foreground/80">{fmtDateTime(flaggedAt)}</div>
                                      </div>
                                    )}
                                    {joined && (
                                      <div className="mb-2">
                                        <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em] mb-1">Joined</div>
                                        <div className="text-xs font-mono text-foreground/80">{fmtDateTime(joined)}</div>
                                      </div>
                                    )}
                                    {gId && (
                                      <div className="pt-2 mt-2 border-t border-border/30">
                                        <div className="text-[10px] text-muted-foreground/60 font-mono break-all">{String(gId)}</div>
                                      </div>
                                    )}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })}
                          {guilds.length > 8 && (
                            <span className="text-[11px] text-muted-foreground/60">+{guilds.length - 8}</span>
                          )}
                        </div>
                        {handle && <p className="text-sm text-muted-foreground/70 mt-0.5">@{handle}</p>}
                        <div className="flex items-center gap-2 mt-3">
                          <div className="px-2.5 py-1 rounded-md bg-background/50 border border-border/40 text-xs font-mono text-foreground/80">{discordId}</div>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-border/40" onClick={() => copyToClipboard(discordId)}>
                            <Copy className="w-3 h-3" />
                            Copy
                          </Button>
                          <a
                            href={`https://discord.com/users/${discordId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border/40 bg-background/50 text-xs text-foreground/80 hover:text-primary hover:border-primary/40 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open in Discord
                          </a>
                          <Badge variant="outline" className={`text-[10px] uppercase tracking-wider px-2 h-5 ${riskLevel.cls}`}>
                            Risk · {riskLevel.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5">
                          <StatCard icon={Calendar} label="Account Created" value={fmtDateTime(accountCreated)} sub={accountAge} />
                          <StatCard icon={Clock} label="Last Seen" value={fmtDateTime(lastSeen)} sub={fmtRel(lastSeen)} />
                          <StatCard icon={Eye} label="First Seen" value={fmtDateTime(firstSeen)} sub={fmtRel(firstSeen)} />
                          <StatCard icon={Fingerprint} label="Current Guilds" value={String(currentGuilds)} sub={`${totalGuildEvents} total events`} />
                          <StatCard icon={Ticket} label="Tickets" value={String(totalTickets)} sub={totalTickets > 0 ? 'screening records' : 'no records'} />
                          <StatCard icon={AlertTriangle} label="Flags" value={String(totalFlags)} sub={totalFlags > 0 ? 'active flags' : 'clean'} />
                          <StatCard icon={Shield} label="Risk Score" value={String(riskScore)} sub={riskLevel.label} />
                          <StatCard icon={Activity} label="Status" value={lastSeen && (Date.now() - lastSeen.getTime()) < 7 * 86400000 ? 'Recently active' : 'Dormant'} sub={lastSeen ? fmtRel(lastSeen) || undefined : undefined} />
                        </div>
                      </div>
                    </div>

                    {/* Identity history */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em]">Identity History</h3>
                        <span className="text-[10px] text-muted-foreground/50">
                          {usernameHistory.length + displayNameHistory.length + avatarHistory.length || 'latest known'} {(usernameHistory.length + displayNameHistory.length + avatarHistory.length) ? 'entries' : ''}
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-background/30 overflow-hidden">
                        {(() => {
                          // Build unified rows: history first (most recent first), then current as fallback
                          type Row = { kind: 'Username' | 'Display Name' | 'Avatar'; value: string; at?: any; sub?: string };
                          const rows: Row[] = [];

                          for (const u of usernameHistory) {
                            const v = u?.value || u?.username || u?.name;
                            if (v) rows.push({ kind: 'Username', value: String(v), at: u?.changedAt || u?.at || u?.seenAt });
                          }
                          for (const d of displayNameHistory) {
                            const v = d?.value || d?.displayName || d?.globalName || d?.name;
                            if (v) rows.push({ kind: 'Display Name', value: String(v), at: d?.changedAt || d?.at || d?.seenAt });
                          }
                          for (const a of avatarHistory) {
                            const v = a?.hash || a?.value || a?.url;
                            if (v) rows.push({ kind: 'Avatar', value: String(v).slice(0, 16) + '…', at: a?.changedAt || a?.at || a?.seenAt, sub: 'avatar hash' });
                          }

                          // Fallbacks if API didn't supply history arrays
                          if (handle) rows.push({ kind: 'Username', value: handle, at: lastSeen || accountCreated, sub: rows.some(r => r.kind === 'Username') ? 'current' : 'latest known' });
                          if (username && username !== handle) rows.push({ kind: 'Display Name', value: username, at: lastSeen || accountCreated, sub: rows.some(r => r.kind === 'Display Name') ? 'current' : 'latest known' });

                          // De-duplicate by kind+value, keep first occurrence
                          const seen = new Set<string>();
                          const dedup = rows.filter(r => {
                            const k = `${r.kind}::${r.value}`;
                            if (seen.has(k)) return false;
                            seen.add(k);
                            return true;
                          });

                          if (dedup.length === 0) {
                            return <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">No identity history</div>;
                          }

                          return dedup.map((row, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border/20 last:border-b-0 hover:bg-primary/[0.03] transition-colors">
                              <div className="flex items-center gap-6 min-w-0">
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] w-24 shrink-0">{row.kind}</span>
                                <div className="min-w-0">
                                  <div className={`text-sm truncate ${row.kind === 'Display Name' ? 'font-semibold text-foreground' : 'font-mono text-foreground'}`}>{row.value}</div>
                                  {row.sub && <div className="text-[11px] text-muted-foreground/60">{row.sub}</div>}
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground/60 shrink-0 ml-4">{fmtDateTime(row.at)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </motion.div>

                  {/* Tabs: Tickets / Guilds / Anti-cheat */}
                  {/* Active Memberships — prominent overview */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-2xl border border-border/40 bg-gradient-to-br from-card/60 via-card/40 to-card/20 backdrop-blur-xl p-5 shadow-xl shadow-black/20"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Active Memberships</h3>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-primary/30 bg-primary/10 text-primary px-1.5 py-0 h-4">
                          {guilds.length}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground/60">Servers currently joined</span>
                    </div>
                    {guilds.length === 0 ? (
                      <div className="rounded-xl border border-border/30 bg-background/30 p-6 text-center">
                        <Server className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground/70">No active memberships detected</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {guilds.map((g: any, i: number) => {
                          const name = String(g.guildName || g.name || g.guildId || '—');
                          const joined = g.joinedAt || g.joined_at;
                          return (
                            <div key={i} className="group rounded-xl border border-border/40 bg-background/30 hover:bg-background/50 hover:border-primary/30 transition-all px-3.5 py-3 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <Server className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--green))] shadow-[0_0_6px_hsl(var(--green)/0.5)]" />
                                  <span className="text-[10px] font-medium text-[hsl(var(--green))] uppercase tracking-wider">Active</span>
                                  {joined && (
                                    <span className="text-[10px] text-muted-foreground/60">· joined {fmtRel(joined) || fmtDateTime(joined)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>

                  {/* Tabs: Tickets / Guilds / Anti-cheat / Messages */}
                  <Tabs defaultValue="tickets" className="w-full">
                    <TabsList className="bg-transparent border-b border-border/30 rounded-none w-full justify-start h-auto p-0 gap-1">
                      <TabsTrigger value="tickets" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-4 py-2.5 text-sm font-medium gap-2">
                        <Ticket className="w-4 h-4" /> Tickets
                      </TabsTrigger>
                      <TabsTrigger value="guilds" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-4 py-2.5 text-sm font-medium gap-2">
                        <Users className="w-4 h-4" /> Guilds
                      </TabsTrigger>
                      <TabsTrigger value="anticheat" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-4 py-2.5 text-sm font-medium gap-2">
                        <Shield className="w-4 h-4" /> Anti-cheat
                      </TabsTrigger>
                      <TabsTrigger value="messages" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-4 py-2.5 text-sm font-medium gap-2">
                        <MessageSquare className="w-4 h-4" /> Messages
                      </TabsTrigger>
                    </TabsList>

                    {/* Tickets tab */}
                    <TabsContent value="tickets" className="mt-4">
                      {(() => {
                        const baseRows = ticketTimeline.length > 0 ? ticketTimeline : tickets.map((t: any) => ({
                          at: t.openedAt,
                          ticketId: t.id || t.channelId,
                          channelId: t.channelId,
                          guildId: t.guildId,
                          guildName: t.guildName,
                          detail: `As ${t.usernameAtTicket || handle || ''}`.trim(),
                          metadata: { summary: t.summary },
                          isLegacy: t.isLegacy,
                          type: 'ticket_created',
                        }));
                        const eventTypes = Array.from(new Set(baseRows.map((r: any) => {
                          const t = String(r.type || '').toLowerCase();
                          if (t.includes('renamed') || t.includes('rename')) return 'RENAMED';
                          if (t.includes('created') || t.includes('open')) return 'CREATED';
                          if (t.includes('closed')) return 'CLOSED';
                          return String(r.type || 'EVENT').toUpperCase().replace(/_/g, ' ');
                        })));
                        const q = ticketsFilter.toLowerCase().trim();
                        const filtered = baseRows.filter((ev: any) => {
                          const t = String(ev.type || '').toLowerCase();
                          const label = t.includes('renamed') ? 'RENAMED' : t.includes('created') || t.includes('open') ? 'CREATED' : t.includes('closed') ? 'CLOSED' : String(ev.type || 'EVENT').toUpperCase().replace(/_/g, ' ');
                          if (ticketsEventFilter.size > 0 && !ticketsEventFilter.has(label)) return false;
                          if (!q) return true;
                          return [ev.ticketId, ev.channelId, ev.guildName, ev.guildId, ev.detail, ev.metadata?.summary].some((v: any) => v && String(v).toLowerCase().includes(q));
                        });
                        const toggleEv = (e: string) => {
                          const next = new Set(ticketsEventFilter);
                          if (next.has(e)) next.delete(e); else next.add(e);
                          setTicketsEventFilter(next);
                        };
                        return (
                          <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
                              <input
                                value={ticketsFilter}
                                onChange={(e) => setTicketsFilter(e.target.value)}
                                placeholder="Filter events..."
                                className="bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/50 flex-1"
                              />
                              <div className="flex items-center gap-1.5">
                                {eventTypes.map((ev) => {
                                  const active = ticketsEventFilter.has(ev);
                                  return (
                                    <button
                                      key={ev}
                                      onClick={() => toggleEv(ev)}
                                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-colors ${active ? 'bg-primary/15 text-primary border-primary/40' : 'bg-background/40 text-muted-foreground/70 border-border/40 hover:border-border/70'}`}
                                    >
                                      {ev}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {filtered.length === 0 ? (
                              <div className="p-12 text-center">
                                <Ticket className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                                <p className="text-sm font-medium text-foreground">No ticket events</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Nothing matched your filters, or there is no ticket history for this user.</p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-border/30 bg-background/30">
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Account</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Event</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Ticket</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Guild</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Channel</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">When</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Detail</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filtered.map((ev: any, i: number) => {
                                      const t = String(ev.type || '').toLowerCase();
                                      const isRenamed = t.includes('renamed');
                                      const isCreated = t.includes('created') || t.includes('open');
                                      const eventLabel = isRenamed ? 'Renamed' : isCreated ? 'Created' : String(ev.type || 'event').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                                      const evCls = isRenamed
                                        ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                                        : isCreated
                                          ? 'bg-primary/15 text-primary border-primary/30'
                                          : 'bg-muted text-muted-foreground border-border';
                                      return (
                                        <tr key={ev.id || i} className="border-b border-border/15 hover:bg-primary/[0.03] transition-colors">
                                          <td className="px-4 py-3">
                                            <div className="text-sm font-semibold text-foreground">{username}</div>
                                            <div className="text-[11px] text-primary/70 font-mono">{discordId}</div>
                                          </td>
                                          <td className="px-4 py-3">
                                            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-bold ${evCls}`}>
                                              {eventLabel}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-mono text-primary/80">{String(ev.ticketId || '—')}</span>
                                              {ev.isLegacy && (
                                                <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-[hsl(var(--yellow))]/10 text-[hsl(var(--yellow))] border-[hsl(var(--yellow))]/30 px-1.5 py-0 h-4">Legacy</Badge>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="text-sm font-semibold text-foreground">{String(ev.guildName || '—')}</div>
                                            {ev.guildId && <div className="text-[11px] text-primary/70 font-mono">{String(ev.guildId)}</div>}
                                          </td>
                                          <td className="px-4 py-3 text-[11px] text-primary/70 font-mono">{ev.channelId ? String(ev.channelId) : '—'}</td>
                                          <td className="px-4 py-3 text-sm text-foreground/80 whitespace-nowrap">{fmtDateTime(ev.at)}</td>
                                          <td className="px-4 py-3">
                                            <div className="text-sm text-foreground/80">{String(ev.detail || '—')}</div>
                                            {ev.metadata?.summary && <div className="text-[11px] text-muted-foreground/50">summary:{String(ev.metadata.summary)}</div>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TabsContent>

                    {/* Guilds tab */}
                    <TabsContent value="guilds" className="mt-4 space-y-4">
                      {(() => {
                        const q = guildsFilter.toLowerCase().trim();
                        const filtered = guildEvents.filter((ev: any) => {
                          const t = String(ev.type || '').toLowerCase();
                          const label = t.includes('join') ? 'JOIN' : t.includes('leave') ? 'LEAVE' : t.includes('role') ? 'ROLES' : String(ev.type || 'EVENT').toUpperCase();
                          if (guildsEventFilter.size > 0 && !guildsEventFilter.has(label)) return false;
                          if (!q) return true;
                          return [ev.guildName, ev.guildId, ev.type].some((v: any) => v && String(v).toLowerCase().includes(q));
                        });
                        const toggleEv = (e: string) => {
                          const next = new Set(guildsEventFilter);
                          if (next.has(e)) next.delete(e); else next.add(e);
                          setGuildsEventFilter(next);
                        };
                        const evTypes = ['JOIN', 'LEAVE', 'ROLES'];
                        return (
                          <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
                              <input
                                value={guildsFilter}
                                onChange={(e) => setGuildsFilter(e.target.value)}
                                placeholder="Filter guilds..."
                                className="bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/50 flex-1"
                              />
                              <div className="flex items-center gap-1.5">
                                {evTypes.map((ev) => {
                                  const active = guildsEventFilter.has(ev);
                                  return (
                                    <button
                                      key={ev}
                                      onClick={() => toggleEv(ev)}
                                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-colors ${active ? (ev === 'JOIN' ? 'bg-[hsl(var(--green))]/15 text-[hsl(var(--green))] border-[hsl(var(--green))]/40' : ev === 'LEAVE' ? 'bg-destructive/15 text-destructive border-destructive/40' : 'bg-primary/15 text-primary border-primary/40') : 'bg-background/40 text-muted-foreground/70 border-border/40 hover:border-border/70'}`}
                                    >
                                      {ev}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {filtered.length === 0 ? (
                              <div className="p-12 text-center">
                                <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                                <p className="text-sm font-medium text-foreground">No guild events</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Nothing matched your filters, or there is no join/leave history for this user.</p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-border/30 bg-background/30">
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Account</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Event</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Guild</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Guild ID</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">Roles</th>
                                      <th className="text-left text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.12em] px-4 py-2.5">When</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filtered.map((ev: any, i: number) => {
                                      const t = String(ev.type || '').toLowerCase();
                                      const isJoin = t.includes('join');
                                      const isLeave = t.includes('leave');
                                      const label = isJoin ? 'JOIN' : isLeave ? 'LEAVE' : t.includes('role') ? 'ROLES' : String(ev.type || 'EVENT').toUpperCase();
                                      const evCls = isJoin
                                        ? 'bg-[hsl(var(--green))]/15 text-[hsl(var(--green))] border-[hsl(var(--green))]/30'
                                        : isLeave
                                          ? 'bg-destructive/15 text-destructive border-destructive/30'
                                          : 'bg-primary/15 text-primary border-primary/30';
                                      const roleCount = Array.isArray(ev.roles) ? ev.roles.length : (typeof ev.roleCount === 'number' ? ev.roleCount : 0);
                                      return (
                                        <tr key={i} className="border-b border-border/15 hover:bg-primary/[0.03] transition-colors">
                                          <td className="px-4 py-3">
                                            <div className="text-sm font-semibold text-foreground">{username}</div>
                                            <div className="text-[11px] text-primary/70 font-mono">{discordId}</div>
                                          </td>
                                          <td className="px-4 py-3">
                                            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-bold ${evCls}`}>
                                              {label}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-3 text-sm font-semibold text-foreground">{String(ev.guildName || '—')}</td>
                                          <td className="px-4 py-3 text-[11px] text-primary/70 font-mono">{String(ev.guildId || '—')}</td>
                                          <td className="px-4 py-3 text-xs text-muted-foreground/80">{roleCount > 0 ? `${roleCount} role${roleCount === 1 ? '' : 's'}` : '—'}</td>
                                          <td className="px-4 py-3 text-sm text-foreground/80 whitespace-nowrap">{fmtDateTime(ev.at)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/30">
                          <h4 className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]">Current Memberships</h4>
                        </div>
                        {guilds.length === 0 ? (
                          <div className="p-8 text-center text-xs text-muted-foreground/60">
                            None estimated from the latest event timeline (last per-server event may be leave), or no indexed guild rows.
                          </div>
                        ) : (
                          <div className="divide-y divide-border/20">
                            {guilds.map((g: any, i: number) => {
                              const joined = g.joinedAt || g.joined_at;
                              return (
                                <div key={i} className="flex items-center justify-between px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--green))] shadow-[0_0_6px_hsl(var(--green)/0.5)]" />
                                    <span className="text-sm font-semibold text-foreground">{String(g.guildName || g.name || g.guildId || '—')}</span>
                                    {joined && <span className="text-[11px] font-mono text-muted-foreground/60 ml-1">{fmtDateTime(joined)}</span>}
                                  </div>
                                  <span className="text-[10px] font-bold text-[hsl(var(--green))] uppercase tracking-wider">Active</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Anti-cheat tab */}
                    <TabsContent value="anticheat" className="mt-4">
                      {(() => {
                        const q = anticheatFilter.toLowerCase().trim();
                        const filtered = flags.filter((f: any) => {
                          if (!q) return true;
                          return [f.label, f.type, f.name, f.detail].some((v: any) => v && String(v).toLowerCase().includes(q));
                        });
                        return (
                          <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
                              <input
                                value={anticheatFilter}
                                onChange={(e) => setAnticheatFilter(e.target.value)}
                                placeholder="Filter records..."
                                className="bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/50 flex-1"
                              />
                            </div>
                            {filtered.length === 0 ? (
                              <div className="p-12 text-center">
                                <Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                                <p className="text-sm font-medium text-foreground">No anti-cheat records</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Nothing matched your filters, or this user has no indexed anti-cheat data.</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-border/20">
                                {filtered.map((f: any, i: number) => (
                                  <div key={i} className="px-4 py-3 hover:bg-primary/[0.03] transition-colors">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-semibold text-foreground">{String(f.label || f.type || f.name || 'Flag')}</span>
                                      {f.at && <span className="text-xs text-muted-foreground/70">{fmtDateTime(f.at)}</span>}
                                    </div>
                                    {f.detail && <p className="text-xs text-muted-foreground/70 mt-1">{String(f.detail)}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TabsContent>

                    {/* Messages tab */}
                    <TabsContent value="messages" className="mt-4">
                      <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
                          <input
                            value={messagesFilter}
                            onChange={(e) => setMessagesFilter(e.target.value)}
                            placeholder="Filter messages..."
                            className="bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/50 flex-1"
                          />
                        </div>
                        <div className="p-12 text-center">
                          <MessageSquare className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-sm font-medium text-foreground">No messages indexed</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">This user has no indexed message history in the external screening database.</p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              );
            })()}
          </motion.div>
        )}


        {hasSearched && (isLoading || sxLoading) && (
          <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-16 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 text-primary animate-spin" />
            <h3 className="text-base font-semibold text-foreground mb-1">Scanning databases...</h3>
            <p className="text-xs text-muted-foreground/60">Cross-referencing multiple sources</p>
          </div>
        )}

        {hasSearched && !isLoading && !sxLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {results.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1 h-5 rounded-full bg-primary" />
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {results.length} {results.length === 1 ? 'Match' : 'Matches'} Found
                  </h2>
                </div>
                <div className="space-y-3">
                  {results.map((cheater) => renderCheaterCard(cheater, true))}
                </div>
              </>
            )}

            {results.length === 0 && !sxResult && !isLoading && !sxLoading && (
              <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-16 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-7 h-7 text-primary/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1.5">No Records Found</h3>
                <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto">
                  "{searchQuery}" has no reports in our database. This doesn't guarantee they're legitimate.
                </p>
              </div>
            )}
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default CheaterSearch;
