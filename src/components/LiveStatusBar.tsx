import { RefreshCw, Clock, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface LiveStatusBarProps {
  lastUpdate: Date | null;
  isPolling: boolean;
  onRefresh: () => void;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: (enabled: boolean) => void;
}

const LiveStatusBar = ({
  lastUpdate,
  isPolling,
  onRefresh,
  autoRefreshEnabled,
  onToggleAutoRefresh,
}: LiveStatusBarProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/50 border border-border/50"
    >
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 ${autoRefreshEnabled ? 'text-green' : 'text-muted-foreground'}`}>
          <Wifi className={`w-4 h-4 ${isPolling ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium">
            {autoRefreshEnabled ? 'Live Updates' : 'Auto-refresh Off'}
          </span>
        </div>
        
        {lastUpdate && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleAutoRefresh(!autoRefreshEnabled)}
          className={autoRefreshEnabled ? 'text-green hover:text-green' : ''}
        >
          {autoRefreshEnabled ? 'Pause' : 'Resume'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isPolling}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </motion.div>
  );
};

export default LiveStatusBar;
