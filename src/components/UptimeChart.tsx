import { useState } from "react";
import { Activity, TrendingUp, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { UptimeDataPoint } from "@/hooks/useUptimeHistory";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface UptimeChartProps {
  history: UptimeDataPoint[];
  isLoading: boolean;
  serverCode?: string | null;
  currentPlayerCount?: number;
  maxPlayers?: number;
  onTrackingAdded?: () => void;
}

const UptimeChart = ({ 
  history, 
  isLoading, 
  serverCode, 
  currentPlayerCount = 0, 
  maxPlayers = 0,
  onTrackingAdded 
}: UptimeChartProps) => {
  const [isTracking, setIsTracking] = useState(false);

  const handleStartTracking = async () => {
    if (!serverCode) {
      toast.error("Cannot track: no server code available");
      return;
    }

    setIsTracking(true);
    try {
      const { error } = await supabase.from("server_uptime_history").insert({
        server_code: serverCode,
        is_online: true,
        player_count: currentPlayerCount,
        max_players: maxPlayers,
      });

      if (error) throw error;
      
      toast.success("Uptime tracking started for this server");
      onTrackingAdded?.();
    } catch (err) {
      console.error("Failed to add tracking:", err);
      toast.error("Failed to start tracking");
    } finally {
      setIsTracking(false);
    }
  };

  if (isLoading) {
    return (
      <motion.div 
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div 
            className="icon-badge-cyan"
            animate={{ 
              boxShadow: [
                "0 0 0px hsl(var(--cyan) / 0)",
                "0 0 15px hsl(var(--cyan) / 0.4)",
                "0 0 0px hsl(var(--cyan) / 0)",
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Activity className="w-5 h-5" />
          </motion.div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Uptime History (24h)
          </h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <motion.div 
            className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </motion.div>
    );
  }

  if (history.length === 0) {
    return (
      <motion.div 
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ boxShadow: "0 0 30px hsl(var(--primary) / 0.1)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="icon-badge-cyan"
              animate={{ 
                y: [0, -2, 0],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Activity className="w-5 h-5" />
            </motion.div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Uptime History (24h)
            </h3>
          </div>
          {serverCode && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartTracking}
                disabled={isTracking}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {isTracking ? "Starting..." : "Start Tracking"}
              </Button>
            </motion.div>
          )}
        </div>
        <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
          <motion.div
            animate={{ 
              y: [0, -5, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <TrendingUp className="w-10 h-10 mb-3" />
          </motion.div>
          <p>No uptime data available yet</p>
          <p className="text-sm mt-1">Click "Start Tracking" to begin monitoring this server</p>
        </div>
      </motion.div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="icon-badge-cyan">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Uptime History (24h)
            </h3>
          </div>
          {serverCode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartTracking}
              disabled={isTracking}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {isTracking ? "Starting..." : "Start Tracking"}
            </Button>
          )}
        </div>
        <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
          <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
          <p>No uptime data available yet</p>
          <p className="text-sm mt-1">Click "Start Tracking" to begin monitoring this server</p>
        </div>
      </div>
    );
  }

  // Calculate uptime percentage
  const onlineCount = history.filter((h) => h.is_online).length;
  const uptimePercent = history.length > 0 ? ((onlineCount / history.length) * 100).toFixed(1) : "0";

  // Prepare chart data
  const chartData = history.map((point) => ({
    time: format(new Date(point.checked_at), "HH:mm"),
    fullTime: format(new Date(point.checked_at), "MMM d, HH:mm"),
    players: point.player_count,
    maxPlayers: point.max_players,
    status: point.is_online ? 1 : 0,
    isOnline: point.is_online,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ boxShadow: "0 0 30px hsl(var(--primary) / 0.1)" }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <motion.div 
            className="icon-badge-cyan"
            animate={{ 
              boxShadow: [
                "0 0 0px hsl(var(--cyan) / 0)",
                "0 0 15px hsl(var(--cyan) / 0.3)",
                "0 0 0px hsl(var(--cyan) / 0)",
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Activity className="w-5 h-5" />
          </motion.div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Uptime History (24h)
            </h3>
            <motion.p 
              className="text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {history.length} data points
            </motion.p>
          </div>
        </div>
        <motion.div 
          className="text-right"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-muted-foreground text-sm">Uptime</p>
          <motion.p 
            className={`font-semibold text-lg ${Number(uptimePercent) >= 99 ? "text-green" : Number(uptimePercent) >= 90 ? "text-yellow" : "text-destructive"}`}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
          >
            {uptimePercent}%
          </motion.p>
        </motion.div>
      </div>

      <motion.div 
        className="h-48"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="playerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="time"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number, name: string) => {
                if (name === "players") return [`${value} players`, "Players"];
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <span>
                      {data.fullTime} -{" "}
                      <span className={data.isOnline ? "text-green" : "text-destructive"}>
                        {data.isOnline ? "Online" : "Offline"}
                      </span>
                    </span>
                  );
                }
                return label;
              }}
            />
            <Area
              type="monotone"
              dataKey="players"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#playerGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Status timeline with animated bars */}
      <motion.div 
        className="mt-4 pt-4 border-t border-border/50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-muted-foreground text-xs mb-2">Status Timeline</p>
        <div className="flex gap-0.5 h-3 rounded overflow-hidden">
          <AnimatePresence>
            {chartData.map((point, idx) => (
              <motion.div
                key={idx}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: idx * 0.02, duration: 0.3 }}
                className={`flex-1 origin-bottom ${point.isOnline ? "bg-green" : "bg-destructive"}`}
                title={`${point.fullTime}: ${point.isOnline ? "Online" : "Offline"} - ${point.players} players`}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>24h ago</span>
          <span>Now</span>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default UptimeChart;
