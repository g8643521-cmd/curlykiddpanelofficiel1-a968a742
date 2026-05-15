import { useState, useEffect, useCallback } from "react";
import { Eye, Plus, Trash2, RefreshCw, Users, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

interface WatchlistEntry {
  id: string;
  server_code: string;
  server_name: string | null;
  last_status: boolean;
  last_checked_at: string;
  created_at: string;
  // Live data (fetched client-side)
  live?: {
    online: boolean;
    playerCount: number;
    maxPlayers: number;
    hostname: string;
  } | null;
  liveLoading?: boolean;
}

const ServerWatchlist = () => {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("server_watchlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEntries(data.map(e => ({ ...e, live: null, liveLoading: false })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  const refreshAll = useCallback(async () => {
    if (entries.length === 0) return;
    setRefreshing(true);
    setEntries(prev => prev.map(e => ({ ...e, liveLoading: true })));

    const updated = await Promise.all(
      entries.map(async (entry) => {
        try {
          const { data: result } = await supabase.functions.invoke("cfx-lookup", {
            body: { serverCode: entry.server_code, skipWebhook: true },
          });

          if (result && !result.error) {
            const playerCount = result.playerCount ?? result.players?.length ?? 0;
            const wasOffline = !entry.last_status;
            const isOnline = true;

            // Update DB with latest status
            await supabase
              .from("server_watchlist")
              .update({
                last_status: isOnline,
                last_player_count: playerCount,
                last_checked_at: new Date().toISOString(),
                server_name: result.hostname?.replace(/\^[0-9]/g, "").replace(/~[a-zA-Z]~/g, "") || entry.server_name,
              })
              .eq("id", entry.id);

            if (wasOffline && isOnline) {
              toast.success(`${entry.server_name || entry.server_code} is back online!`);
            }

            return {
              ...entry,
              last_status: isOnline,
              last_player_count: playerCount,
              last_checked_at: new Date().toISOString(),
              server_name: result.hostname?.replace(/\^[0-9]/g, "").replace(/~[a-zA-Z]~/g, "") || entry.server_name,
              live: {
                online: true,
                playerCount,
                maxPlayers: result.maxPlayers ?? 32,
                hostname: result.hostname || "Unknown",
              },
              liveLoading: false,
            };
          } else {
            const wasOnline = entry.last_status;
            await supabase
              .from("server_watchlist")
              .update({ last_status: false, last_checked_at: new Date().toISOString() })
              .eq("id", entry.id);

            if (wasOnline) {
              toast.error(`${entry.server_name || entry.server_code} went offline!`);
            }

            return {
              ...entry,
              last_status: false,
              last_checked_at: new Date().toISOString(),
              live: { online: false, playerCount: 0, maxPlayers: 0, hostname: entry.server_name || "Unknown" },
              liveLoading: false,
            };
          }
        } catch {
          return { ...entry, liveLoading: false };
        }
      })
    );

    setEntries(updated);
    setRefreshing(false);
  }, [entries]);

  // Auto-refresh on mount
  useEffect(() => {
    if (!loading && entries.length > 0 && !entries.some(e => e.live)) {
      refreshAll();
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const addServer = async () => {
    const code = newCode.trim().replace(/[^a-zA-Z0-9]/g, "");
    if (!code) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please log in first"); return; }

    if (entries.some(e => e.server_code === code)) {
      toast.error("Server already in watchlist");
      return;
    }

    setAdding(true);
    try {
      // Fetch server info first
      const { data: result } = await supabase.functions.invoke("cfx-lookup", {
        body: { serverCode: code, skipWebhook: true },
      });

      const serverName = result?.hostname?.replace(/\^[0-9]/g, "").replace(/~[a-zA-Z]~/g, "") || null;
      const playerCount = result?.playerCount ?? result?.players?.length ?? 0;

      const { error } = await supabase.from("server_watchlist").insert({
        user_id: user.id,
        server_code: code,
        server_name: serverName,
        last_status: !result?.error,
        last_player_count: playerCount,
      });

      if (error) throw error;

      toast.success(`Added ${serverName || code} to watchlist`);
      setNewCode("");
      fetchWatchlist();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add server");
    }
    setAdding(false);
  };

  const removeServer = async (id: string) => {
    await supabase.from("server_watchlist").delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success("Removed from watchlist");
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          Server Watchlist
        </h3>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <Button variant="ghost" size="sm" onClick={refreshAll} disabled={refreshing} className="gap-1">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
          <Badge variant="outline" className="text-muted-foreground">{entries.length} servers</Badge>
        </div>
      </div>

      {/* Add server */}
      <div className="flex gap-2">
        <Input
          placeholder="Server code (e.g. ygjqrk)"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && addServer()}
          className="bg-background/50"
        />
        <Button onClick={addServer} disabled={adding || !newCode.trim()} size="sm" className="gap-1 shrink-0">
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {/* Watchlist entries */}
      {loading ? (
        <div className="text-center text-muted-foreground py-8">Loading watchlist...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No servers in your watchlist yet</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Add a server code above to start tracking</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-background/30 border border-border/50 hover:border-primary/30 transition-colors">
              {/* Status indicator */}
              <div className="shrink-0">
                {entry.liveLoading ? (
                  <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                ) : entry.live ? (
                  entry.live.online ? (
                    <Wifi className="w-5 h-5 text-green-500" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-500" />
                  )
                ) : entry.last_status ? (
                  <Wifi className="w-5 h-5 text-green-500/50" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500/50" />
                )}
              </div>

              {/* Server info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {entry.server_name || entry.server_code}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{entry.server_code}</span>
                  <span>•</span>
                  <span>Checked {formatDistanceToNow(new Date(entry.last_checked_at), { addSuffix: true })}</span>
                </div>
              </div>

              {/* Player count */}
              <div className="flex items-center gap-1 text-sm shrink-0">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {entry.live ? `${entry.live.playerCount}/${entry.live.maxPlayers}` : 'N/A'}
                </span>
              </div>

              {/* Status badge */}
              <Badge
                variant="outline"
                className={
                  (entry.live?.online ?? entry.last_status)
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                }
              >
                {(entry.live?.online ?? entry.last_status) ? "Online" : "Offline"}
              </Badge>

              {/* Remove */}
              <Button variant="ghost" size="icon" onClick={() => removeServer(entry.id)} className="shrink-0 text-muted-foreground hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServerWatchlist;
