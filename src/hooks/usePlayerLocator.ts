import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Player {
  id: number;
  name: string;
  ping: number;
  identifiers?: string[];
}

interface ServerMatch {
  serverCode: string;
  serverName: string;
  player: Player;
  matchType: 'name' | 'discord' | 'identifier';
  confidence: 'exact' | 'partial';
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

export interface ExternalScreeningResult {
  discord_user?: {
    username?: string;
    global_name?: string;
    avatar?: string;
    discriminator?: string;
  };
  summary?: {
    total_tickets?: number;
    total_guild_records?: number;
    is_flagged?: boolean;
  };
  tickets?: any[];
  tickets_v2?: any[];
  guild_join_leave?: any[];
  confirmed_user?: any[];
  flagged?: boolean;
  user?: { discord_id?: string };
}

export interface PlayerLocatorResult {
  servers: ServerMatch[];
  cheaterRecords: CheaterRecord[];
  scannedServers: number;
  totalServers: number;
  externalScreening?: ExternalScreeningResult | null;
}

export type ServerSource = 'all' | 'favorites' | 'history' | 'custom';

export const usePlayerLocator = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PlayerLocatorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customServers, setCustomServers] = useState<string>('');
  const [serverSource, setServerSource] = useState<ServerSource>('all');

  const parseCustomServers = useCallback((input: string): { code: string; name: string }[] => {
    const codes = input
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(s => /^[a-zA-Z0-9]{2,10}$/.test(s));
    
    return [...new Set(codes)].map(code => ({ code, name: code }));
  }, []);

  const searchPlayer = useCallback(async (query: string, source?: ServerSource, customInput?: string) => {
    if (!query.trim()) {
      setError('Please enter a player name or Discord ID');
      return;
    }

    const activeSource = source || serverSource;
    setIsSearching(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        setError('Please log in to use the player locator');
        setIsSearching(false);
        return;
      }

      const userId = session.session.user.id;
      const searchQuery = query.trim().toLowerCase();
      const isDiscordId = /^\d{17,19}$/.test(searchQuery);

      // Start ExternalScreening lookup in parallel if Discord ID
      let sxPromise: Promise<ExternalScreeningResult | null> = Promise.resolve(null);
      if (isDiscordId) {
        sxPromise = supabase.functions.invoke('screensharex-lookup', {
          body: { discord_id: searchQuery },
        }).then(({ data, error }) => {
          if (!error && data?.success) return data.data as ExternalScreeningResult;
          return null;
        }).catch(() => null);
      }

      let servers: { code: string; name: string }[] = [];

      if (activeSource === 'custom') {
        servers = parseCustomServers(customInput || customServers);
        if (servers.length === 0) {
          setError('Please enter valid server codes (comma or newline separated)');
          setIsSearching(false);
          return;
        }
      } else {
        const serverMap = new Map<string, string>();
        const shouldFetchFavorites = activeSource === 'all' || activeSource === 'favorites';
        const shouldFetchHistory = activeSource === 'all' || activeSource === 'history';

        const [favoritesRes, historyRes] = await Promise.all([
          shouldFetchFavorites
            ? supabase.from('server_favorites').select('server_code, server_name').eq('user_id', userId)
            : Promise.resolve({ data: [] }),
          shouldFetchHistory
            ? supabase.from('search_history').select('query, search_type').eq('user_id', userId).limit(50)
            : Promise.resolve({ data: [] }),
        ]);

        (favoritesRes.data || []).forEach(f => serverMap.set(f.server_code, f.server_name || f.server_code));
        (historyRes.data || []).forEach(h => serverMap.set(h.server_code, h.server_name || h.server_code));

        servers = Array.from(serverMap.entries()).map(([code, name]) => ({ code, name }));

        if (servers.length === 0) {
          // Still wait for ExternalScreening result even if no servers
          const sxResult = await sxPromise;
          if (sxResult) {
            setResult({
              servers: [],
              cheaterRecords: [],
              scannedServers: 0,
              totalServers: 0,
              externalScreening: sxResult,
            });
            setIsSearching(false);
            setProgress(100);
            return;
          }
          const errorMessages: Record<ServerSource, string> = {
            all: 'No servers to scan. Add favorites or search for servers first.',
            favorites: 'No favorites to scan. Add servers to favorites first.',
            history: 'No search history. Search for servers first.',
            custom: 'Please enter valid server codes.',
          };
          setError(errorMessages[activeSource]);
          setIsSearching(false);
          return;
        }
      }

      // Check cheater database
      const cheaterRecords: CheaterRecord[] = [];
      
      const { data: nameMatches } = await supabase
        .from('cheater_reports')
        .select('id, player_name, player_identifiers, status, reason, server_name, created_at')
        .ilike('player_name', `%${searchQuery}%`)
        .in('status', ['confirmed', 'suspected']);

      if (nameMatches) {
        cheaterRecords.push(...nameMatches.map(r => ({
          ...r,
          player_identifiers: r.player_identifiers as Record<string, string> | null,
        })));
      }

      if (isDiscordId) {
        const { data: allReports } = await supabase
          .from('cheater_reports')
          .select('id, player_name, player_identifiers, status, reason, server_name, created_at')
          .in('status', ['confirmed', 'suspected']);

        if (allReports) {
          for (const report of allReports) {
            const ids = report.player_identifiers as Record<string, string> | null;
            if (ids?.discord === searchQuery && !cheaterRecords.some(r => r.id === report.id)) {
              cheaterRecords.push({
                ...report,
                player_identifiers: ids,
              });
            }
          }
        }
      }

      // Scan servers for the player
      const serverMatches: ServerMatch[] = [];
      let scanned = 0;

      for (const server of servers) {
        try {
          const { data, error: fetchError } = await supabase.functions.invoke('cfx-lookup', {
            body: { serverCode: server.code, skipWebhook: true },
          });

          if (!fetchError && data?.players) {
            const players = data.players as Player[];
            
            for (const player of players) {
              let matched = false;
              let matchType: 'name' | 'discord' | 'identifier' = 'name';
              let confidence: 'exact' | 'partial' = 'partial';

              const playerNameLower = player.name.toLowerCase();
              if (playerNameLower === searchQuery) {
                matched = true;
                matchType = 'name';
                confidence = 'exact';
              } else if (playerNameLower.includes(searchQuery) || searchQuery.includes(playerNameLower)) {
                matched = true;
                matchType = 'name';
                confidence = 'partial';
              }

              if (!matched && isDiscordId && player.identifiers) {
                for (const id of player.identifiers) {
                  if (id.startsWith('discord:') && id.includes(searchQuery)) {
                    matched = true;
                    matchType = 'discord';
                    confidence = 'exact';
                    break;
                  }
                }
              }

              if (matched) {
                serverMatches.push({
                  serverCode: server.code,
                  serverName: data.hostname || server.name,
                  player,
                  matchType,
                  confidence,
                });
              }
            }
          }
        } catch (err) {
          console.warn(`Failed to scan server ${server.code}:`, err);
        }

        scanned++;
        setProgress(Math.round((scanned / servers.length) * 100));
      }

      serverMatches.sort((a, b) => {
        if (a.confidence !== b.confidence) {
          return a.confidence === 'exact' ? -1 : 1;
        }
        return a.serverName.localeCompare(b.serverName);
      });

      const sxResult = await sxPromise;

      setResult({
        servers: serverMatches,
        cheaterRecords,
        scannedServers: scanned,
        totalServers: servers.length,
        externalScreening: sxResult,
      });
    } catch (err) {
      console.error('Player locator error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setIsSearching(false);
      setProgress(100);
    }
  }, [serverSource, customServers, parseCustomServers]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    isSearching,
    progress,
    result,
    error,
    serverSource,
    setServerSource,
    customServers,
    setCustomServers,
    searchPlayer,
    clearResult,
  };
};