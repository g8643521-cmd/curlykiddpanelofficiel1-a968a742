import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Download, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { ModThumbnail } from '@/components/mods/ModThumbnail';

interface FiveMod {
  id: string;
  name: string;
  description: string | null;
  file_size: string | null;
  download_count: number;
  screenshots: string[] | null;
  version: string | null;
  created_at: string;
  mod_categories?: {
    name: string;
    icon: string;
  } | null;
}

const LatestMods = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [mods, setMods] = useState<FiveMod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestMods = async () => {
      const { data, error } = await supabase
        .from('fivem_mods')
        .select('id, name, description, file_size, download_count, version, created_at, screenshots, mod_categories(name, icon)')
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) {
        console.error('Error fetching latest mods:', error);
        setIsLoading(false);
        return;
      }

      setMods(data || []);
      setIsLoading(false);
    };

    fetchLatestMods();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[hsl(var(--purple))]">
            <Package className="w-5 h-5" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">{t('mods.latest')}</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <Skeleton className="w-12 h-12 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mods.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[hsl(var(--purple))]">
            <Package className="w-5 h-5" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">{t('mods.latest')}</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-purple/10 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-[hsl(var(--purple))]" />
          </div>
          <p className="text-muted-foreground">{t('mods.empty')}</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate('/mods')}
            className="mt-1"
          >
            {t('mods.browse')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-[hsl(var(--purple))]">
            <Package className="w-5 h-5" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">
            {t('mods.latest')}
          </h3>
          <span className="text-sm text-muted-foreground">({mods.length})</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/mods')}
          className="text-muted-foreground hover:text-foreground gap-1"
        >
          {t('mods.view_all')}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {mods.map((mod) => (
          <button
            key={mod.id}
            onClick={() => navigate('/mods')}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 hover:translate-x-1 transition-all text-left group"
          >
            <ModThumbnail
              src={mod.screenshots?.[0]}
              name={mod.name}
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{mod.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="truncate">{mod.mod_categories?.name || 'Uncategorized'}</span>
                <span>•</span>
                <span>{mod.file_size || 'N/A'}</span>
                <span>•</span>
                <span>{formatDate(mod.created_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Download className="w-3 h-3" />
              <span>{mod.download_count?.toLocaleString() || 0}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LatestMods;
