import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { EyeOff, Trash2, Plus, Loader2, Hash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface HiddenEntry {
  id: string;
  match_value: string;
  match_type: string;
  note: string | null;
  created_at: string;
}

const HiddenCheatersPanel = () => {
  const [entries, setEntries] = useState<HiddenEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [discordId, setDiscordId] = useState('');
  const [note, setNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('hidden_cheater_entries')
      .select('id, match_value, match_type, note, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setEntries(data as HiddenEntry[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleAdd = async () => {
    const value = discordId.trim();
    if (!value) {
      toast.error('Enter a Discord ID');
      return;
    }
    if (!/^\d{17,20}$/.test(value)) {
      toast.error("That doesn't look like a Discord ID");
      return;
    }
    setIsAdding(true);
    const { error } = await supabase.from('hidden_cheater_entries').insert({
      match_value: value,
      match_type: 'discord',
      note: note.trim() || null,
    });
    setIsAdding(false);
    if (error) {
      toast.error(error.message || 'Could not add');
      return;
    }
    setDiscordId('');
    setNote('');
    toast.success('Hidden from search');
    fetchEntries();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('hidden_cheater_entries').delete().eq('id', id);
    if (error) {
      toast.error('Could not remove');
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success('Removed — will appear in search again');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/15 bg-card/40 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
          <EyeOff className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">Hidden from search</h3>
          <p className="text-[11px] text-muted-foreground/65 mt-0.5">
            Discord IDs added here will silently return no results in /cheaters. Nothing tells the searcher.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4 border-b border-border/10">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-2">
          <div className="relative">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder="Discord ID (e.g. 123456789012345678)"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value.replace(/\D/g, ''))}
              className="h-10 pl-10 text-sm font-mono"
              inputMode="numeric"
            />
          </div>
          <Input
            placeholder="Internal note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-10 text-sm"
          />
          <Button onClick={handleAdd} disabled={isAdding} className="h-10 px-4">
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1.5" /> Hide</>}
          </Button>
        </div>
      </div>

      <div className="p-2 max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center">
            <EyeOff className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground/60">No hidden entries yet</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/20 transition-colors group"
            >
              <div className="w-7 h-7 rounded-md bg-secondary/30 flex items-center justify-center shrink-0">
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-mono text-foreground/90 truncate">{entry.match_value}</p>
                <p className="text-[11px] text-muted-foreground/55 truncate">
                  {entry.note ? entry.note : entry.match_type}
                  <span className="mx-1.5 text-muted-foreground/30">•</span>
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </p>
              </div>
              <button
                onClick={() => handleRemove(entry.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-md hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive flex items-center justify-center"
                title="Remove (will appear in search again)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default HiddenCheatersPanel;
