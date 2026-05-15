import { memo, useCallback } from "react";
import { Star, Server, Trash2, ExternalLink, Users, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Favorite } from "@/hooks/useFavorites";
import { stripColorCodes } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface ServerStatus {
  serverCode: string;
  serverName: string;
  playerCount: number;
  maxPlayers: number;
  isOnline: boolean;
  lastChecked: Date;
}

interface FavoritesListProps {
  favorites: Favorite[];
  isLoading: boolean;
  onSelect: (serverCode: string) => void;
  onRemove: (serverCode: string) => void;
  serverStatuses?: Map<string, ServerStatus>;
}

const FavoriteItem = memo(({ 
  favorite, 
  status, 
  onSelect, 
  onRemove 
}: { 
  favorite: Favorite; 
  status?: ServerStatus;
  onSelect: (code: string) => void;
  onRemove: (code: string) => void;
}) => (
  <div
    className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg transition-colors group cursor-pointer hover:bg-secondary/60 hover:translate-x-1"
    onClick={() => onSelect(favorite.server_code)}
  >
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
      status?.isOnline ? 'bg-green/20' : status ? 'bg-destructive/20' : 'bg-primary/20'
    }`}>
      {status?.isOnline ? (
        <Wifi className="w-4 h-4 text-green" />
      ) : status ? (
        <WifiOff className="w-4 h-4 text-destructive" />
      ) : (
        <Server className="w-4 h-4 text-primary" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-foreground font-medium truncate">
        {stripColorCodes(favorite.server_name || favorite.server_code)}
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground font-mono">{favorite.server_code}</span>
        {status && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className={`flex items-center gap-1 ${status.isOnline ? 'text-green' : 'text-destructive'}`}>
              <Users className="w-3 h-3" />
              {status.playerCount}/{status.maxPlayers}
            </span>
          </>
        )}
      </div>
    </div>
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/20"
        onClick={(e) => { e.stopPropagation(); onSelect(favorite.server_code); }}
      >
        <ExternalLink className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/20"
        onClick={(e) => { e.stopPropagation(); onRemove(favorite.server_code); }}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  </div>
));

FavoriteItem.displayName = "FavoriteItem";

const FavoritesList = memo(({ favorites, isLoading, onSelect, onRemove, serverStatuses }: FavoritesListProps) => {
  const { t } = useI18n();
  const handleRemove = useCallback((serverCode: string) => {
    onRemove(serverCode);
  }, [onRemove]);

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[hsl(var(--yellow))]">
            <Star className="w-5 h-5" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">{t('favorites.title')}</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-secondary/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[hsl(var(--yellow))]">
            <Star className="w-5 h-5" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">{t('favorites.title')}</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-yellow/10 flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-yellow" />
          </div>
          <p className="text-muted-foreground">{t('favorites.empty')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('favorites.empty_desc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-[hsl(var(--yellow))]">
          <Star className="w-5 h-5" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground">
          {t('favorites.title')}
        </h3>
        <span className="text-sm text-muted-foreground">({favorites.length})</span>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {favorites.map((favorite) => (
          <FavoriteItem
            key={favorite.id}
            favorite={favorite}
            status={serverStatuses?.get(favorite.server_code)}
            onSelect={onSelect}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  );
});

FavoritesList.displayName = "FavoritesList";

export default FavoritesList;
