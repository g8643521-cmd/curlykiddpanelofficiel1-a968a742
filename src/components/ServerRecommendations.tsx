import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Share2,
  Star,
  Users,
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { useSocialFeatures } from '@/hooks/useSocialFeatures';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type SharedServer = {
  id: string;
  server_code: string;
  server_name: string | null;
  message: string | null;
  created_at: string;
  sender: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const ServerRecommendations = () => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<SharedServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shareServer } = useSocialFeatures();

  const fetchRecommendations = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get shared servers from friends
      const { data, error } = await supabase
        .from('shared_servers')
        .select(`
          id,
          server_code,
          server_name,
          message,
          created_at,
          sender_id
        `)
        .eq('receiver_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch sender profiles
      if (data && data.length > 0) {
        const senderIds = [...new Set(data.map(s => s.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', senderIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedData = data.map(item => ({
          ...item,
          sender: profileMap.get(item.sender_id) || null,
        }));

        setRecommendations(enrichedData);
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleOpenServer = (serverCode: string) => {
    navigate(`/dashboard?server=${encodeURIComponent(serverCode)}`);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await supabase
        .from('shared_servers')
        .update({ is_read: true })
        .eq('id', id);
      
      setRecommendations(prev => prev.filter(r => r.id !== id));
      toast.success('Removed from recommendations');
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Server Recommendations</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Server Recommendations</h3>
        </div>
        <div className="text-center py-8">
          <Server className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">No server recommendations yet</p>
          <p className="text-xs text-muted-foreground mt-1">Your friends can share servers with you</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Server Recommendations</h3>
        </div>
        <Badge variant="secondary">{recommendations.length} new</Badge>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {recommendations.map((rec, index) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-start gap-3">
                {/* Sender Avatar */}
                <Avatar className="w-10 h-10 border-2 border-primary/20">
                  <AvatarImage src={rec.sender?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {rec.sender?.display_name?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {rec.sender?.display_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">anbefalede</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <Server className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground truncate">
                      {rec.server_name || rec.server_code}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {rec.server_code}
                    </Badge>
                  </div>

                  {rec.message && (
                    <div className="mt-2 p-2 rounded bg-background/50 border border-border/30">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground italic">"{rec.message}"</p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(rec.created_at).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleOpenServer(rec.server_code)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open server</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleMarkAsRead(rec.id)}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove recommendation</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default memo(ServerRecommendations);
