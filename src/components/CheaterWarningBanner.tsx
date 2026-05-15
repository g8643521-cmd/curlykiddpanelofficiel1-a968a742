import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface CheaterMatch {
  player: {
    id: number;
    name: string;
    ping: number;
  };
  report: {
    id: string;
    player_name: string;
    reason: string;
    status: string;
  };
  matchType: 'name' | 'identifier';
}

interface CheaterWarningBannerProps {
  matches: CheaterMatch[];
  onScrollToPlayer?: (playerName: string) => void;
}

const CheaterWarningBanner = ({ matches, onScrollToPlayer }: CheaterWarningBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (matches.length === 0 || isDismissed) return null;

  const confirmedCount = matches.filter(m => m.report.status === 'confirmed').length;
  const suspectedCount = matches.filter(m => m.report.status === 'suspected').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card border-2 border-destructive/50 bg-destructive/10 p-4"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-destructive" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-semibold text-destructive">
              ⚠️ Cheater Alert
            </h3>
            {confirmedCount > 0 && (
              <Badge className="bg-destructive/20 text-destructive border-destructive/50">
                {confirmedCount} Confirmed
              </Badge>
            )}
            {suspectedCount > 0 && (
              <Badge className="bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))] border-[hsl(var(--yellow))]/50">
                {suspectedCount} Suspected
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mt-1">
            {matches.length} known cheater{matches.length > 1 ? 's' : ''} detected on this server
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            {matches.slice(0, 5).map((match) => (
              <button
                key={match.player.id}
                onClick={() => onScrollToPlayer?.(match.player.name)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${match.report.status === 'confirmed' 
                    ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' 
                    : 'bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))] hover:bg-[hsl(var(--yellow))]/30'
                  }
                `}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {match.player.name}
                <Eye className="w-3 h-3 opacity-50" />
              </button>
            ))}
            {matches.length > 5 && (
              <span className="text-sm text-muted-foreground self-center">
                +{matches.length - 5} more
              </span>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDismissed(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default CheaterWarningBanner;
