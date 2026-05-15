import { useState, useEffect } from 'react';
import { Save, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SocialLinks {
  discord: string;
  youtube: string;
  tiktok: string;
}

const DEFAULT_LINKS: SocialLinks = {
  discord: 'https://discord.gg/CqX8YVFrCP',
  youtube: 'https://youtube.com/@curlykidd',
  tiktok: 'https://tiktok.com/@curlykidd',
};

const SocialLinksPanel = () => {
  const [links, setLinks] = useState<SocialLinks>(DEFAULT_LINKS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchLinks(); }, []);

  const fetchLinks = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['social_discord', 'social_youtube', 'social_tiktok']);

    if (data) {
      const fetched = { ...DEFAULT_LINKS };
      data.forEach((row) => {
        if (row.key === 'social_discord') fetched.discord = row.value;
        if (row.key === 'social_youtube') fetched.youtube = row.value;
        if (row.key === 'social_tiktok') fetched.tiktok = row.value;
      });
      setLinks(fetched);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const entries = [
        { key: 'social_discord', value: links.discord },
        { key: 'social_youtube', value: links.youtube },
        { key: 'social_tiktok', value: links.tiktok },
      ];

      for (const entry of entries) {
        const { data: existing } = await supabase
          .from('admin_settings')
          .select('id')
          .eq('key', entry.key)
          .maybeSingle();

        if (existing) {
          await supabase.from('admin_settings').update({ value: entry.value, updated_at: new Date().toISOString() }).eq('key', entry.key);
        } else {
          await supabase.from('admin_settings').insert({ key: entry.key, value: entry.value });
        }
      }
      toast.success('Social links saved!');
    } catch {
      toast.error('Could not save links');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/30 bg-card/50 p-5 animate-pulse h-full">
        <div className="h-5 w-40 bg-secondary/40 rounded mb-4" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-9 bg-secondary/20 rounded" />)}
        </div>
      </div>
    );
  }

  const fields = [
    { id: 'discord', label: 'Discord', placeholder: 'https://discord.gg/...', value: links.discord },
    { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/...', value: links.youtube },
    { id: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/...', value: links.tiktok },
  ];

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border/20 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--magenta))]/10 flex items-center justify-center">
          <ExternalLink className="w-4 h-4 text-[hsl(var(--magenta))]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Social Links</h3>
          <p className="text-xs text-muted-foreground">Footer & embed links</p>
        </div>
      </div>
      <div className="p-5 flex-1 space-y-3">
        {fields.map((f) => (
          <div key={f.id} className="space-y-1">
            <Label htmlFor={`social-${f.id}`} className="text-xs text-muted-foreground">{f.label}</Label>
            <Input
              id={`social-${f.id}`}
              value={f.value}
              onChange={(e) => setLinks({ ...links, [f.id]: e.target.value })}
              placeholder={f.placeholder}
              className="bg-secondary/30 border-border/30 h-8 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full gap-1.5 h-8">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isSaving ? 'Saving...' : 'Save Links'}
        </Button>
      </div>
    </div>
  );
};

export default SocialLinksPanel;
