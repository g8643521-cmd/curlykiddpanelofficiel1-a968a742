import { motion } from 'framer-motion';
import { Crown, ExternalLink, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ServerOwnerCardProps {
  ownerName?: string | null;
  ownerProfile?: string | null;
  ownerAvatar?: string | null;
}

const ServerOwnerCard = ({ ownerName, ownerProfile, ownerAvatar }: ServerOwnerCardProps) => {
  if (!ownerName) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-center gap-4">
        <Avatar className="w-12 h-12 border-2 border-[hsl(var(--yellow))]/30">
          {ownerAvatar ? (
            <AvatarImage src={ownerAvatar} alt={ownerName} />
          ) : null}
          <AvatarFallback className="bg-[hsl(var(--yellow))]/10">
            <User className="w-6 h-6 text-[hsl(var(--yellow))]" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-[hsl(var(--yellow))]" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Server Owner</span>
          </div>
          <p className="font-medium text-foreground truncate">{ownerName}</p>
        </div>
        {ownerProfile && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-primary hover:text-primary"
          >
            <a href={ownerProfile} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              Profile
            </a>
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default ServerOwnerCard;
