import { memo, useMemo } from "react";
import { Wifi } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Player {
  id: number;
  name: string;
  ping: number;
}

interface PingDistributionChartProps {
  players: Player[];
}

const PingDistributionChart = memo(({ players }: PingDistributionChartProps) => {
  // Memoize all calculations to prevent recalculation on every render
  const { chartData, avgPing, medianPing, minPing, maxPing } = useMemo(() => {
    if (players.length === 0) {
      return { chartData: [], avgPing: 0, medianPing: 0, minPing: 0, maxPing: 0 };
    }

    // Single pass through players for distribution counts
    let lowPing = 0, mediumPing = 0, highPing = 0, veryHighPing = 0, totalPing = 0;
    
    for (const p of players) {
      totalPing += p.ping;
      if (p.ping <= 50) lowPing++;
      else if (p.ping <= 100) mediumPing++;
      else if (p.ping <= 200) highPing++;
      else veryHighPing++;
    }

    const len = players.length;
    const chartData = [
      { 
        name: "0-50ms", 
        label: "Excellent",
        count: lowPing, 
        percentage: Math.round((lowPing / len) * 100),
        color: "hsl(var(--green))"
      },
      { 
        name: "51-100ms", 
        label: "Good",
        count: mediumPing, 
        percentage: Math.round((mediumPing / len) * 100),
        color: "hsl(var(--primary))"
      },
      { 
        name: "101-200ms", 
        label: "Fair",
        count: highPing, 
        percentage: Math.round((highPing / len) * 100),
        color: "hsl(var(--yellow))"
      },
      { 
        name: "200ms+", 
        label: "Poor",
        count: veryHighPing, 
        percentage: Math.round((veryHighPing / len) * 100),
        color: "hsl(var(--destructive))"
      },
    ];

    const avgPing = Math.round(totalPing / len);
    const sortedPings = [...players].sort((a, b) => a.ping - b.ping);
    const medianPing = len % 2 === 0
      ? Math.round((sortedPings[len / 2 - 1].ping + sortedPings[len / 2].ping) / 2)
      : sortedPings[Math.floor(len / 2)].ping;
    const minPing = sortedPings[0]?.ping || 0;
    const maxPing = sortedPings[len - 1]?.ping || 0;

    return { chartData, avgPing, medianPing, minPing, maxPing };
  }, [players]);

  if (players.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ boxShadow: "0 0 30px hsl(var(--purple) / 0.1)" }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <motion.div 
            className="icon-badge-purple"
            animate={{ 
              boxShadow: [
                "0 0 0px hsl(var(--purple) / 0)",
                "0 0 15px hsl(var(--purple) / 0.3)",
                "0 0 0px hsl(var(--purple) / 0)",
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Wifi className="w-5 h-5" />
          </motion.div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Ping Distribution
            </h3>
            <motion.p 
              className="text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {players.length} players analyzed
            </motion.p>
          </div>
        </div>
        <motion.div 
          className="flex gap-4 text-sm"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div 
            className="text-center"
            whileHover={{ scale: 1.05 }}
          >
            <p className="text-muted-foreground">Avg</p>
            <motion.p 
              className="text-primary font-semibold"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
            >
              {avgPing}ms
            </motion.p>
          </motion.div>
          <motion.div 
            className="text-center"
            whileHover={{ scale: 1.05 }}
          >
            <p className="text-muted-foreground">Median</p>
            <motion.p 
              className="text-foreground font-semibold"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
            >
              {medianPing}ms
            </motion.p>
          </motion.div>
          <motion.div 
            className="text-center"
            whileHover={{ scale: 1.05 }}
          >
            <p className="text-muted-foreground">Range</p>
            <motion.p 
              className="text-foreground font-semibold"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
            >
              {minPing}-{maxPing}ms
            </motion.p>
          </motion.div>
        </motion.div>
      </div>

      <motion.div 
        className="h-48"
        initial={{ opacity: 0, scaleY: 0.8 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{ originY: 1 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
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
              formatter={(value: number, name: string, props: any) => {
                const data = props.payload;
                return [`${value} players (${data.percentage}%)`, data.label];
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Legend with staggered animation */}
      <motion.div 
        className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {chartData.map((item, index) => (
          <motion.div 
            key={item.name} 
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            whileHover={{ scale: 1.05, x: 5 }}
          >
            <motion.div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: item.color }}
              animate={{ 
                boxShadow: [
                  `0 0 0px ${item.color}`,
                  `0 0 8px ${item.color}`,
                  `0 0 0px ${item.color}`,
                ]
              }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
            />
            <div className="text-xs">
              <span className="text-foreground font-medium">{item.count}</span>
              <span className="text-muted-foreground"> {item.label}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
});

PingDistributionChart.displayName = 'PingDistributionChart';

export default PingDistributionChart;
