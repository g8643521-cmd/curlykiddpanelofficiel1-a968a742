import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface CheaterReport {
  id: string;
  player_name: string;
  player_identifiers: unknown;
  server_code: string | null;
  server_name: string | null;
  reason: string;
  evidence_url: string | null;
  status: string;
  created_at: string;
}

interface Player {
  id: number;
  name: string;
  ping: number;
  identifiers?: string[];
}

interface CheaterMatch {
  player: Player;
  report: CheaterReport;
  matchType: 'name' | 'identifier';
}

export const useCheaterDatabase = () => {
  const [cheaters, setCheaters] = useState<CheaterReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCheaters = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cheater_reports')
      .select('*')
      .in('status', ['confirmed', 'suspected']);

    if (error) {
      console.error('Error fetching cheaters:', error);
    } else {
      setCheaters(data || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCheaters();
  }, [fetchCheaters]);

  const checkPlayersAgainstCheaters = useCallback(
    (players: Player[]): CheaterMatch[] => {
      if (!Array.isArray(players)) return [];
      const matches: CheaterMatch[] = [];

      for (const player of players) {
        for (const cheater of cheaters) {
          // Match by name (case-insensitive)
          if (player.name.toLowerCase() === cheater.player_name.toLowerCase()) {
            matches.push({ player, report: cheater, matchType: 'name' });
            continue;
          }

          // Match by identifiers if available
          if (player.identifiers && cheater.player_identifiers) {
            const cheaterIds = cheater.player_identifiers as Record<string, string>;
            for (const id of player.identifiers) {
              const [type, value] = id.split(':');
              if (cheaterIds[type] && cheaterIds[type] === value) {
                matches.push({ player, report: cheater, matchType: 'identifier' });
                break;
              }
            }
          }
        }
      }

      return matches;
    },
    [cheaters]
  );

  const isCheater = useCallback(
    (player: Player): CheaterReport | null => {
      for (const cheater of cheaters) {
        if (player.name.toLowerCase() === cheater.player_name.toLowerCase()) {
          return cheater;
        }
      }
      return null;
    },
    [cheaters]
  );

  return {
    cheaters,
    isLoading,
    fetchCheaters,
    checkPlayersAgainstCheaters,
    isCheater,
  };
};
