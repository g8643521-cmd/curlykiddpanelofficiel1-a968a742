import { useState, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PlayerLocator = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = useCallback(() => {
    const searchQuery = query.trim();
    if (!searchQuery) return;
    navigate(`/cheaters?q=${encodeURIComponent(searchQuery)}`);
  }, [query, navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--cyan))]/20 to-primary/20 flex items-center justify-center">
            <Search className="w-5 h-5 text-[hsl(var(--cyan))]" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Player Locator</h3>
            <p className="text-xs text-muted-foreground">Search cheater database by name or Discord ID</p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Player name or Discord ID..."
              className="pr-10"
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={!query.trim()} className="shrink-0">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlayerLocator;
