import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, TrendingDown, Minus, Clock, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { UptimeDataPoint } from '@/hooks/useUptimeHistory';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

interface PlayerHistoryChartProps {
  history: UptimeDataPoint[];
  isLoading: boolean;
  maxPlayers: number;
}

const PlayerHistoryChart = ({ history, isLoading, maxPlayers }: PlayerHistoryChartProps) => {
  const [showChart, setShowChart] = useState(true);

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            Player History (24h)
          </h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            Player History (24h)
          </h3>
        </div>
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          <p className="text-center">
            Not enough data yet. Check back later to see player trends.
          </p>
        </div>
      </div>
    );
  }

  // Process data for chart
  const chartData = history.map((point) => ({
    time: new Date(point.checked_at).getTime(),
    players: point.player_count,
    label: format(new Date(point.checked_at), 'HH:mm'),
  }));

  // Calculate stats
  const playerCounts = history.map(h => h.player_count);
  const avgPlayers = Math.round(playerCounts.reduce((a, b) => a + b, 0) / playerCounts.length);
  const maxSeen = Math.max(...playerCounts);
  const minSeen = Math.min(...playerCounts);
  const currentPlayers = playerCounts[playerCounts.length - 1];
  const previousPlayers = playerCounts.length > 1 ? playerCounts[playerCounts.length - 2] : currentPlayers;
  const trend = currentPlayers - previousPlayers;

  const getTrendIcon = () => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-[hsl(var(--green))]" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (trend > 0) return 'text-[hsl(var(--green))]';
    if (trend < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            Player History (24h)
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowChart(!showChart)}
          className="text-muted-foreground text-xs"
        >
          {showChart ? 'Hide' : 'Show'} Chart
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-2 bg-secondary/30 rounded-lg">
          <p className="text-lg font-bold text-primary">{currentPlayers}</p>
          <p className="text-xs text-muted-foreground">Current</p>
        </div>
        <div className="text-center p-2 bg-secondary/30 rounded-lg">
          <p className="text-lg font-bold text-foreground">{avgPlayers}</p>
          <p className="text-xs text-muted-foreground">Average</p>
        </div>
        <div className="text-center p-2 bg-secondary/30 rounded-lg">
          <p className="text-lg font-bold text-[hsl(var(--green))]">{maxSeen}</p>
          <p className="text-xs text-muted-foreground">Peak</p>
        </div>
        <div className="text-center p-2 bg-secondary/30 rounded-lg flex flex-col items-center justify-center">
          <div className="flex items-center gap-1">
            {getTrendIcon()}
            <span className={`text-lg font-bold ${getTrendColor()}`}>
              {trend > 0 ? '+' : ''}{trend}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Trend</p>
        </div>
      </div>

      {/* Chart */}
      {showChart && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="playerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={[0, maxPlayers]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                width={30}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                itemStyle={{ color: 'hsl(var(--primary))' }}
                formatter={(value: number) => [`${value} players`, 'Online']}
              />
              <Area
                type="monotone"
                dataKey="players"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#playerGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>{history.length} data points collected</span>
      </div>
    </motion.div>
  );
};

export default PlayerHistoryChart;
