import { memo, useState, useCallback } from "react";
import { History, Server, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchHistoryItem } from "@/hooks/useSearchHistory";
import { formatDistanceToNow } from "date-fns";
import { stripColorCodes } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useServerIcon } from "@/hooks/useServerIcon";

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  isLoading: boolean;
  onSelect: (serverCode: string) => Promise<void> | void;
  onClear: () => void;
}

const HistoryItem = memo(({ 
  item, 
  onSelect,
  isSelecting,
  onSelectStart
}: { 
  item: SearchHistoryItem; 
  onSelect: (code: string) => Promise<void> | void;
  isSelecting: boolean;
  onSelectStart: (id: string) => void;
}) => {
  const { iconUrl } = useServerIcon(item.query);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelecting) return;
    onSelectStart(item.id);
    void onSelect(item.query);
  }, [item.query, item.id, onSelect, onSelectStart, isSelecting]);

  return (
    <button
      type="button"
      className={`flex items-center gap-3 p-3 bg-secondary/30 rounded-lg transition-colors group cursor-pointer w-full text-left hover:bg-secondary/60 hover:translate-x-1 ${isSelecting ? 'opacity-70 pointer-events-none' : ''}`}
      onClick={handleClick}
      disabled={isSelecting}
    >
      <div className="w-8 h-8 rounded-lg overflow-hidden bg-cyan/20 flex items-center justify-center shrink-0">
        {isSelecting ? (
          <Loader2 className="w-4 h-4 text-cyan animate-spin" />
        ) : iconUrl ? (
          <img src={iconUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Server className="w-4 h-4 text-cyan" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium truncate">
          {stripColorCodes(item.search_type && item.search_type !== 'server' ? item.search_type : item.query)}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{item.query}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
        </div>
      </div>
      {!isSelecting && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-4 h-4 text-primary" />
        </div>
      )}
    </button>
  );
});

const SearchHistory = memo(({ history, isLoading, onSelect, onClear }: SearchHistoryProps) => {
  const { t } = useI18n();
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const handleSelect = useCallback(async (serverCode: string) => {
    try {
      await onSelect(serverCode);
    } finally {
      setSelectingId(null);
    }
  }, [onSelect]);

  const handleSelectStart = useCallback((id: string) => {
    setSelectingId(id);
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[hsl(var(--cyan))]">
            <History className="w-5 h-5" />
          </div>
           <h3 className="font-display text-xl font-semibold text-foreground">{t('history.title')}</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-secondary/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[hsl(var(--cyan))]">
            <History className="w-5 h-5" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">{t('history.title')}</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-cyan/10 flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-cyan" />
          </div>
          <p className="text-muted-foreground">{t('history.empty')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('history.empty_desc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-[hsl(var(--cyan))]">
            <History className="w-5 h-5" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">
            {t('history.title')}
          </h3>
          <span className="text-sm text-muted-foreground">({history.length})</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-destructive hover:text-destructive hover:bg-destructive/20"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t('history.clear')}
        </Button>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {history.map((item) => (
          <HistoryItem
            key={item.id}
            item={item}
            onSelect={handleSelect}
            isSelecting={selectingId === item.id}
            onSelectStart={handleSelectStart}
          />
        ))}
      </div>
    </div>
  );
});

SearchHistory.displayName = "SearchHistory";

export default SearchHistory;
