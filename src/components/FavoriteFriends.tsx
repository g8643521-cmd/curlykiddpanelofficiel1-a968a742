import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, StarOff, MessageCircle, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface FavoriteFriend {
  id: string;
  friend_id: string;
  created_at: string;
  profile: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  is_online?: boolean;
}

export const FavoriteFriends = () => {
  const [favorites, setFavorites] = useState<FavoriteFriend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchFavorites = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('favorite_friends')
        .select('id, friend_id, created_at')
        .eq('user_id', session.user.id);

      if (error) throw error;

      // Fetch profiles for each favorite
      const favoritesWithProfiles = await Promise.all(
        (data || []).map(async (fav) => {
          const { data: profile } = await supabase
            .from('profiles_public')
            .select('display_name, avatar_url')
            .eq('id', fav.friend_id)
            .single();

          const { data: presence } = await supabase
            .from('user_presence')
            .select('is_online, last_seen')
            .eq('user_id', fav.friend_id)
            .single();

          // Consider user online only if is_online is true AND last_seen is within 5 minutes
          const isRecentlyActive = presence?.last_seen 
            ? (Date.now() - new Date(presence.last_seen).getTime()) < 5 * 60 * 1000
            : false;
          const isActuallyOnline = (presence?.is_online || false) && isRecentlyActive;

          return {
            ...fav,
            profile,
            is_online: isActuallyOnline
          };
        })
      );

      setFavorites(favoritesWithProfiles);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFavorite = async (favoriteId: string) => {
    try {
      const { error } = await supabase
        .from('favorite_friends')
        .delete()
        .eq('id', favoriteId);

      if (error) throw error;

      setFavorites(prev => prev.filter(f => f.id !== favoriteId));
      toast.success('Friend removed from favorites');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Could not remove favorite');
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-yellow-500" />
            Favorit Venner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          Favorit Venner
          {favorites.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {favorites.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {favorites.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">
              No favorite friends yet
            </p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              Click the star icon on a friend to add them
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {favorites.map((favorite) => (
              <div
                key={favorite.id}
                className="group relative bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/user/${favorite.friend_id}`)}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-yellow-500/30">
                      <AvatarImage src={favorite.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20">
                        {favorite.profile?.display_name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    {favorite.is_online && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-background" />
                    )}
                  </div>
                  <span className="text-sm font-medium mt-2 truncate w-full">
                    {favorite.profile?.display_name || 'Unknown'}
                  </span>
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mt-1" />
                </div>

                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(favorite.id);
                    }}
                  >
                    <StarOff className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
