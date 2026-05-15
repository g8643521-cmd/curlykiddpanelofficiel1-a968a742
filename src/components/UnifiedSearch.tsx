import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { 
  Search, 
  Server, 
  Clipboard, 
  AlertTriangle, 
  Shield, 
  Loader2, 
  X,
  Clock,
  UserSearch,
  Database,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface UnifiedSearchProps {
  onServerSearch: (query: string) => void;
  isServerLoading: boolean;
}

type SearchMode = 'server' | 'player';

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
};

const getDiscordCreatedDate = (id: string) => {
  try {
    const snowflake = BigInt(id);
    const timestamp = Number(snowflake >> BigInt(22)) + 1420070400000;
    return new Date(timestamp);
  } catch { return null; }
};

interface ExternalLookupResult {
  discord_user?: { username?: string; global_name?: string; avatar?: string; discriminator?: string };
  summary?: { total_tickets?: number; total_guild_records?: number; is_flagged?: boolean };
  flagged?: boolean;
  confirmed_user?: any[];
}

interface CheaterRecord {
  id: string;
  player_name: string;
  player_identifiers: Record<string, string> | null;
  status: string;
  reason: string;
  server_name: string | null;
  created_at: string;
}

const ExternalLookupCard = memo(({ data, discordId }: { data: ExternalLookupResult; discordId: string }) => {
  const summary = data.summary || {};
  const discordUser = data.discord_user || {};
  const isFlagged = data.flagged || summary.is_flagged;
  const totalTickets = summary.total_tickets || 0;
  const totalGuilds = summary.total_guild_records || 0;
  const username = discordUser.global_name || discordUser.username || 'Unknown';
  const createdDate = getDiscordCreatedDate(discordId);
  const avatarUrl = discordUser.avatar 
    ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.${String(discordUser.avatar).startsWith('a_') ? 'gif' : 'png'}?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordId) % BigInt(5))}.png`;

  return (
    <div className="space-y-2">
      <div className="p-3 rounded-lg border border-border/50 bg-card/50">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-border">
            <AvatarImage src={avatarUrl} alt={username} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Discord ID:</span>
              <span className="text-[10px] font-mono font-medium text-foreground">{discordId}</span>
              <button onClick={() => copyToClipboard(discordId)} className="text-muted-foreground hover:text-foreground">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{username}</p>
            {createdDate && (
              <p className="text-[10px] text-muted-foreground">
                Created {formatDistanceToNow(createdDate, { addSuffix: true })}
              </p>
            )}
          </div>
          {isFlagged && (
            <Badge variant="destructive" className="text-[10px] shrink-0">
              <AlertTriangle className="w-3 h-3 mr-1" /> Flagged
            </Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg border border-border/50 bg-card/30 text-center">
          <p className="text-base font-bold text-foreground">{totalTickets}</p>
          <p className="text-[10px] text-muted-foreground">Tickets</p>
        </div>
        <div className="p-2 rounded-lg border border-border/50 bg-card/30 text-center">
          <p className="text-base font-bold text-foreground">{totalGuilds}</p>
          <p className="text-[10px] text-muted-foreground">Guild Records</p>
        </div>
      </div>
    </div>
  );
});
ExternalLookupCard.displayName = 'ExternalLookupCard';

const CheaterRecordCard = memo(({ record }: { record: CheaterRecord }) => {
  const isConfirmed = record.status === 'confirmed';
  return (
    <div className={`p-3 rounded-lg border ${isConfirmed ? 'border-destructive/30 bg-destructive/10' : 'border-yellow-500/30 bg-yellow-500/10'}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${isConfirmed ? 'text-destructive' : 'text-yellow-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-sm text-foreground">{record.player_name}</span>
            <Badge variant="outline" className={`text-[10px] capitalize ${isConfirmed ? 'text-destructive' : 'text-yellow-500'}`}>
              {record.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{record.reason}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
            {record.server_name && (
              <>
                <span className="flex items-center gap-1"><Server className="w-3 h-3" />{record.server_name}</span>
                <span>•</span>
              </>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
CheaterRecordCard.displayName = 'CheaterRecordCard';

const UnifiedSearch = ({ onServerSearch, isServerLoading }: UnifiedSearchProps) => {
  const [mode, setMode] = useState<SearchMode>('server');
  const [query, setQuery] = useState('');
  const [isPlayerSearching, setIsPlayerSearching] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [cheaterRecords, setCheaterRecords] = useState<CheaterRecord[]>([]);
  const [externalResult, setExternalResult] = useState<ExternalLookupResult | null>(null);
  const [hasPlayerSearched, setHasPlayerSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isLoading = mode === 'server' ? isServerLoading : isPlayerSearching;

  const searchPlayerDB = useCallback(async () => {
    const searchQuery = query.trim().toLowerCase();
    if (!searchQuery) return;

    setIsPlayerSearching(true);
    setPlayerError(null);
    setCheaterRecords([]);
    setExternalResult(null);
    setHasPlayerSearched(false);

    try {
      const isDiscordId = /^\d{17,19}$/.test(searchQuery);

      const sxPromise = isDiscordId
        ? supabase.functions.invoke('screensharex-lookup', { body: { discord_id: searchQuery } })
            .then(({ data, error }) => (!error && data?.success ? data.data as ExternalLookupResult : null))
            .catch(() => null)
        : Promise.resolve(null);

      const namePromise = supabase
        .from('cheater_reports')
        .select('id, player_name, player_identifiers, status, reason, server_name, created_at')
        .ilike('player_name', `%${searchQuery}%`)
        .in('status', ['confirmed', 'suspected']);

      const idPromise = isDiscordId
        ? supabase.from('cheater_reports')
            .select('id, player_name, player_identifiers, status, reason, server_name, created_at')
            .in('status', ['confirmed', 'suspected'])
        : Promise.resolve({ data: [] });

      const [sxResult, nameResult, idResult] = await Promise.all([sxPromise, namePromise, idPromise]);

      const records: CheaterRecord[] = [];
      const seenIds = new Set<string>();

      for (const r of nameResult.data || []) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          records.push({ ...r, player_identifiers: r.player_identifiers as Record<string, string> | null });
        }
      }

      if (isDiscordId) {
        for (const r of (idResult as any).data || []) {
          const ids = r.player_identifiers as Record<string, string> | null;
          if (ids?.discord === searchQuery && !seenIds.has(r.id)) {
            seenIds.add(r.id);
            records.push({ ...r, player_identifiers: ids });
          }
        }
      }

      setCheaterRecords(records);
      setExternalResult(sxResult);
      setHasPlayerSearched(true);

      // Send Discord webhook notification
      const { data: { session } } = await supabase.auth.getSession();
      const sxUser = sxResult?.discord_user;
      const allTickets = [
        ...((sxResult?.tickets as any[]) || []),
        ...((sxResult?.tickets_v2 as any[]) || []),
      ];
      const guildNames = [...new Set(allTickets.map((t: any) => t.guild_name || t.guildname).filter(Boolean))];
      const guildActivity = (sxResult?.guild_join_leave as any[]) || [];
      const avatarUrl = sxUser?.avatar
        ? `https://cdn.discordapp.com/avatars/${searchQuery}/${sxUser.avatar}.${String(sxUser.avatar).startsWith('a_') ? 'gif' : 'png'}?size=128`
        : null;
      const totalTickets = (sxResult?.summary?.total_tickets || 0) + (sxResult?.summary?.total_tickets_v2 || 0);

      supabase.functions.invoke('cheater-webhook', {
        body: {
          search_query: searchQuery,
          results_count: records.length,
          searched_by: session?.user?.email || 'Anonymous',
          sx_username: sxUser?.global_name || sxUser?.username || null,
          sx_tickets: totalTickets,
          sx_guilds: sxResult?.summary?.total_guild_records || 0,
          sx_guild_names: guildNames,
          sx_avatar_url: avatarUrl,
          sx_discord_id: isDiscordId ? searchQuery : null,
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
          db_matches: records.map((r: any) => ({
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
    } catch (err) {
      console.error('Player search error:', err);
      setPlayerError('An error occurred. Please try again.');
    } finally {
      setIsPlayerSearching(false);
    }
  }, [query]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;
    if (mode === 'server') {
      onServerSearch(query.trim());
    } else {
      // Navigate directly to Cheater Database with query
      navigate(`/cheaters?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, mode, isLoading, onServerSearch, navigate]);

  const handleClear = useCallback(() => {
    setQuery('');
    if (mode === 'player') {
      setCheaterRecords([]);
      setExternalResult(null);
      setPlayerError(null);
      setHasPlayerSearched(false);
    }
    inputRef.current?.focus();
  }, [mode]);

  const handleModeChange = useCallback((newMode: SearchMode) => {
    setMode(newMode);
    setQuery('');
    setCheaterRecords([]);
    setExternalResult(null);
    setPlayerError(null);
    setHasPlayerSearched(false);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) { handleSubmit(); return; }
    if (e.key === 'Escape') { e.preventDefault(); handleClear(); return; }
    if (e.key === 'Tab' && !e.shiftKey && document.activeElement === inputRef.current) {
      e.preventDefault();
      handleModeChange(mode === 'server' ? 'player' : 'server');
    }
  }, [handleSubmit, isLoading, handleClear, handleModeChange, mode]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      if (e.key === 'Escape') { e.preventDefault(); handleClear(); }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleClear]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setQuery(text);
      toast.success('Pasted from clipboard');
    } catch { toast.error('Failed to read clipboard'); }
  }, []);

  const hasCheaterRecords = cheaterRecords.length > 0;
  const hasExternalData = !!externalResult;

  return (
    <div ref={containerRef} className="rounded-xl bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 w-full max-w-2xl mx-auto overflow-hidden">
      {/* Mode Tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => handleModeChange('server')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all relative ${
            mode === 'server' ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Server Lookup</span>
          {mode === 'server' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-[hsl(var(--cyan))]" />
          )}
        </button>
        <button
          onClick={() => handleModeChange('player')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all relative ${
            mode === 'player' ? 'text-[hsl(var(--cyan))]' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
          }`}
        >
          <UserSearch className="w-4 h-4" />
          <span>Player Locator</span>
          {mode === 'player' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[hsl(var(--cyan))] to-primary" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="text-center mb-5">
          <p className="text-muted-foreground text-sm">
            {mode === 'server' 
              ? 'Enter a server code or join URL to get detailed information'
              : 'Search cheater database by name or Discord ID'
            }
          </p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              {mode === 'server' ? (
                <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              ) : (
                <UserSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              )}
              <Input
                ref={inputRef}
                type="text"
                placeholder={mode === 'server' 
                  ? 'Enter server code (e.g., abc123) or CFX URL...'
                  : 'Player name or Discord ID...'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="pl-12 pr-12 h-14 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:ring-primary focus:border-primary"
              />
              {query ? (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Clipboard className="w-5 h-5" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="h-14 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </Button>
          </div>
        </form>

        {/* Player searching indicator */}
        {mode === 'player' && isPlayerSearching && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Searching database...</span>
          </div>
        )}

        {/* Player Error */}
        {mode === 'player' && playerError && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {playerError}
          </div>
        )}

        {/* Server Mode: Format hints */}
        {mode === 'server' && !hasPlayerSearched && (
          <div className="mt-5 p-4 bg-secondary/30 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-2.5">Supported Formats:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">Code:</span>
                <code className="text-xs text-primary">abc123</code>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">URL:</span>
                <code className="text-xs text-primary">cfx.re/join/abc123</code>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">Full:</span>
                <code className="text-xs text-primary truncate">https://cfx.re/join/...</code>
              </div>
            </div>
          </div>
        )}

        {/* Player Mode: Format hints */}
        {mode === 'player' && !hasPlayerSearched && (
          <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground/50">
            <span className="text-muted-foreground/70 font-medium shrink-0">Accepted:</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/15 border border-primary/25">
                <Database className="w-3 h-3 text-primary/80" />
                <span className="text-muted-foreground/90 font-medium">Discord ID</span>
                <span className="text-[9px] uppercase tracking-wider text-primary/60 font-bold ml-0.5">Recommended</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/8 border border-primary/15">
                <UserSearch className="w-3 h-3 text-primary/60" />
                <span className="text-muted-foreground/70">Player name</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/8 border border-primary/15">
                <Shield className="w-3 h-3 text-primary/60" />
                <span className="text-muted-foreground/70">license: / steam: / fivem:</span>
              </span>
            </div>
          </div>
        )}

        {/* Player Search Results */}
        {mode === 'player' && hasPlayerSearched && (
          <div className="mt-4">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {/* External Lookup */}
                {hasExternalData && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Database className="w-3.5 h-3.5" />
                      <span className="font-medium text-xs">External Screening</span>
                    </div>
                    <ExternalLookupCard data={externalResult!} discordId={query.trim()} />
                  </div>
                )}

                {/* Cheater Records */}
                {hasCheaterRecords && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="font-medium text-xs">Cheater Database</span>
                      <Badge variant="destructive" className="text-[10px] h-4">{cheaterRecords.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {cheaterRecords.map((record) => (
                        <CheaterRecordCard key={record.id} record={record} />
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {!hasCheaterRecords && !hasExternalData && (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No records found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {/^\d{17,19}$/.test(query.trim()) ? 'This Discord ID has no records' : 'No cheater reports match this name'}
                    </p>
                  </div>
                )}

                {/* View full details in Cheater Database */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => navigate(`/cheaters?q=${encodeURIComponent(query.trim())}`)}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  View full details in Cheater Database
                </Button>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedSearch;
