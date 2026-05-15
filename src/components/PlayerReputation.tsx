import { useState, useEffect, useCallback } from "react";
import { ThumbsUp, ThumbsDown, Users, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface PlayerRating {
  player_name: string;
  trusted: number;
  suspicious: number;
  userRating?: "trusted" | "suspicious" | null;
}

interface Props {
  players: { name: string }[];
  serverCode?: string | null;
}

const PlayerReputation = ({ players, serverCode }: Props) => {
  const [ratings, setRatings] = useState<Map<string, PlayerRating>>(new Map());
  const [loading, setLoading] = useState(true);
  const [ratingPlayer, setRatingPlayer] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const playerNames = players.map(p => p.name);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
  }, []);

  const fetchRatings = useCallback(async () => {
    if (playerNames.length === 0) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from("player_ratings")
        .select("player_name, rating, user_id")
        .in("player_name", playerNames);

      const map = new Map<string, PlayerRating>();
      playerNames.forEach(name => map.set(name, { player_name: name, trusted: 0, suspicious: 0, userRating: null }));

      (data || []).forEach(r => {
        const entry = map.get(r.player_name);
        if (!entry) return;
        if (r.rating >= 4) entry.trusted++;
        else if (r.rating <= 2) entry.suspicious++;
        if (r.user_id === userId) entry.userRating = r.rating >= 4 ? "trusted" : "suspicious";
      });

      setRatings(map);
    } catch { /* ignore */ }
    setLoading(false);
  }, [playerNames.join(","), userId]);

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const submitRating = async (playerName: string, rating: "trusted" | "suspicious") => {
    if (!userId) { toast.error("You must be logged in"); return; }
    setSubmitting(true);
    try {
      const numericRating = rating === "trusted" ? 5 : 1;
      const { error } = await supabase.from("player_ratings").upsert({
        user_id: userId,
        player_name: playerName,
        rating: numericRating,
      }, { onConflict: "user_id,player_name" });

      if (error) throw error;
      toast.success(`Rated ${playerName} as ${rating}`);
      setRatingPlayer(null);
      setReason("");
      fetchRatings();
    } catch (err: any) {
      toast.error(err.message || "Failed to rate player");
    }
    setSubmitting(false);
  };

  const removeRating = async (playerName: string) => {
    if (!userId) return;
    await supabase.from("player_ratings").delete().eq("user_id", userId).eq("player_name", playerName);
    toast.success("Rating removed");
    fetchRatings();
  };

  const filteredPlayers = search
    ? playerNames.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : playerNames;

  const getRepScore = (r: PlayerRating) => {
    const total = r.trusted + r.suspicious;
    if (total === 0) return null;
    return Math.round((r.trusted / total) * 100);
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Player Reputation
        </h3>
        <Badge variant="outline" className="text-muted-foreground">{playerNames.length} players</Badge>
      </div>

      <Input
        placeholder="Search players..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="bg-background/50"
      />

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {filteredPlayers.map(name => {
            const r = ratings.get(name) || { player_name: name, trusted: 0, suspicious: 0, userRating: null };
            const score = getRepScore(r);

            return (
              <div key={name} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {score !== null ? (
                      <>
                        <span className={score >= 60 ? "text-green-400" : score >= 40 ? "text-yellow-400" : "text-red-400"}>
                          {score}% trusted
                        </span>
                        <span>·</span>
                        <span>{r.trusted + r.suspicious} votes</span>
                      </>
                    ) : (
                      <span>No ratings yet</span>
                    )}
                  </div>
                </div>

                {r.userRating && (
                  <Badge
                    variant="outline"
                    className={r.userRating === "trusted"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"}
                  >
                    {r.userRating === "trusted" ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                    Your vote
                  </Badge>
                )}

                <Dialog open={ratingPlayer === name} onOpenChange={(open) => { if (!open) setRatingPlayer(null); }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setRatingPlayer(name)} className="shrink-0">
                      Rate
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Rate {name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Reason (optional)..."
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                          onClick={() => submitRating(name, "trusted")}
                          disabled={submitting}
                        >
                          <ThumbsUp className="w-4 h-4" /> Trusted
                        </Button>
                        <Button
                          className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
                          onClick={() => submitRating(name, "suspicious")}
                          disabled={submitting}
                        >
                          <ThumbsDown className="w-4 h-4" /> Suspicious
                        </Button>
                      </div>
                      {r.userRating && (
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => { removeRating(name); setRatingPlayer(null); }}>
                          Remove my rating
                        </Button>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
          {filteredPlayers.length === 0 && (
            <p className="text-center text-muted-foreground py-4 text-sm">No players found</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerReputation;
