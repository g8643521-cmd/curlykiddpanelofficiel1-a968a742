import { useState, useEffect } from 'react';
import { Hash, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const StatsOverridePanel = () => {
  const [total, setTotal] = useState('');
  const [confirmed, setConfirmed] = useState('');
  const [suspected, setSuspected] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchValues(); }, []);

  const fetchValues = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['stats_total_override', 'stats_confirmed_override', 'stats_suspected_override']);

    if (data) {
      const clean = (v: unknown) => (v != null ? String(v).replace(/^"|"$/g, '') : '');
      setTotal(clean(data.find(r => r.key === 'stats_total_override')?.value ?? null));
      setConfirmed(clean(data.find(r => r.key === 'stats_confirmed_override')?.value ?? null));
      setSuspected(clean(data.find(r => r.key === 'stats_suspected_override')?.value ?? null));
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const entries = [
      { key: 'stats_total_override', value: total },
      { key: 'stats_confirmed_override', value: confirmed },
      { key: 'stats_suspected_override', value: suspected },
    ];

    for (const entry of entries) {
      await supabase.from('admin_settings').upsert(
        { key: entry.key, value: entry.value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    }

    toast.success('Stats overrides saved');
    setIsSaving(false);
  };

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border/20 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Hash className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Database Stats Override</h3>
          <p className="text-xs text-muted-foreground">Override the displayed numbers on the cheater database page. Leave fields empty for live data.</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Total Reports</Label>
                <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Auto" min="0" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-destructive">Confirmed</Label>
                <Input type="number" value={confirmed} onChange={(e) => setConfirmed(e.target.value)} placeholder="Auto" min="0" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[hsl(var(--yellow))]">Suspected</Label>
                <Input type="number" value={suspected} onChange={(e) => setSuspected(e.target.value)} placeholder="Auto" min="0" className="h-9 text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Save
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchValues} className="h-8 w-8">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StatsOverridePanel;
