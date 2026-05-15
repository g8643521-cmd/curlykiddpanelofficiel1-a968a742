// @ts-nocheck
import { useState, useEffect, lazy, Suspense } from 'react';
import { useI18n } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Search, Filter, Package, Car, Crosshair, User, Code, Map, Palette, Volume2, Star, Plus, Eye, Trash2, Edit, ToggleLeft, ToggleRight, Copy, ExternalLink, Save, Sparkles, X, ArrowUpDown, TrendingUp, Clock, Grid3X3, LayoutGrid, List, ShieldCheck, FileCheck, Image } from 'lucide-react';
const CosmicNebulaBackground = lazy(() => import('@/components/CosmicNebulaBackground'));
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Footer from '@/components/Footer';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { toast } from 'sonner';
import ModUploadDialog from '@/components/ModUploadDialog';
import { useEnhancingModsStore } from '@/stores/enhancingModsStore';
import ScreenshotCompareDialog from '@/components/ScreenshotCompareDialog';
import ModelViewer3D from '@/components/ModelViewer3D';
import { ModThumbnail } from '@/components/mods/ModThumbnail';

interface ModCategory {
  id: string;
  name: string;
  icon: string;
}

interface FiveMod {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  file_url: string;
  file_name: string;
  file_size: string | null;
  screenshots: string[];
  download_count: number;
  version: string;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  uploaded_by: string | null;
  mod_categories?: ModCategory | null;
  tags: string | null;
  changelog: string | null;
  requirements: string | null;
  compatibility: string | null;
  author_notes: string | null;
  model_url: string | null;
}

const iconMap: Record<string, React.ElementType> = {
  Package,
  Car,
  Crosshair,
  User,
  Code,
  Map,
  Palette,
  Volume2,
};

const FiveMMods = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isAdmin, isOwner, isModerator, roles, isLoading: adminLoading } = useAdminStatus();
  const [categories, setCategories] = useState<ModCategory[]>([]);
  const [mods, setMods] = useState<FiveMod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMod, setSelectedMod] = useState<FiveMod | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [editingMod, setEditingMod] = useState<FiveMod | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', version: '', category_id: '' });
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'name'>('newest');
  const enhancingMods = useEnhancingModsStore((s) => s.enhancingMods);
  const [, setTick] = useState(0);
  const [compareState, setCompareState] = useState<{ modId: string; modName: string; screenshotIndex: number; originalUrl: string; allScreenshots: string[] } | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preview3dMod, setPreview3dMod] = useState<FiveMod | null>(null);
  const [modToDelete, setModToDelete] = useState<FiveMod | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isModCreator = roles.includes('mod_creator' as any);
  const isStaff = isAdmin || isOwner || isModerator;
  const canUpload = isStaff || isModCreator;

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    fetchCategories();
    fetchMods();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('fivem_mods-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fivem_mods' },
        (payload) => {
          setMods(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'fivem_mods' },
        (payload) => {
          setMods(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fivem_mods' },
        () => { fetchMods(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('mod_categories')
      .select('*')
      .order('name');
    if (error) { console.error('Error fetching categories:', error); return; }
    setCategories(data || []);
  };

  const fetchMods = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('fivem_mods')
      .select('*, mod_categories(*)')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching mods:', error); setIsLoading(false); return; }
    setMods(data || []);
    setIsLoading(false);
  };

  const handleDownload = async (mod: FiveMod) => {
    try {
      await supabase.rpc('increment_mod_download', { mod_id: mod.id });
      window.open(mod.file_url, '_blank');
      toast.success(`Downloading ${mod.name}`);
      fetchMods();
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to start download');
    }
  };

  const logModAudit = async (action: string, mod: { id: string; name: string }, extra: Record<string, any> = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('audit_log').insert({
        action,
        table_name: 'fivem_mods',
        record_id: mod.id,
        user_id: session?.user?.id ?? null,
        new_data: { name: mod.name, ...extra },
      });
    } catch (e) {
      console.warn('Audit log insert failed:', e);
    }
  };

  const handleDeleteMod = (mod: FiveMod) => {
    setModToDelete(mod);
  };

  const confirmDeleteMod = async () => {
    if (!modToDelete) return;
    setIsDeleting(true);
    const mod = modToDelete;
    const { error } = await supabase.from('fivem_mods').delete().eq('id', mod.id);
    setIsDeleting(false);
    if (error) { toast.error('Failed to delete mod'); console.error(error); }
    else {
      await logModAudit('mod_deleted', mod);
      toast.success(`Deleted "${mod.name}"`);
      setModToDelete(null);
      fetchMods();
    }
  };

  const handleToggleFeatured = async (mod: FiveMod) => {
    const { error } = await supabase.from('fivem_mods').update({ is_featured: !mod.is_featured }).eq('id', mod.id);
    if (error) { toast.error('Failed to update'); }
    else {
      await logModAudit('mod_featured_toggled', mod, { is_featured: !mod.is_featured });
      toast.success(mod.is_featured ? 'Removed from featured' : 'Added to featured');
      fetchMods();
    }
  };

  const handleToggleActive = async (mod: FiveMod) => {
    const { error } = await supabase.from('fivem_mods').update({ is_active: !mod.is_active }).eq('id', mod.id);
    if (error) { toast.error('Failed to update'); }
    else {
      await logModAudit('mod_active_toggled', mod, { is_active: !mod.is_active });
      toast.success(mod.is_active ? 'Mod deactivated' : 'Mod activated');
      fetchMods();
    }
  };

  const handleCopyId = (mod: FiveMod) => {
    navigator.clipboard.writeText(mod.id);
    toast.success('Mod ID copied');
  };

  const openEditDialog = (mod: FiveMod) => {
    setEditForm({ name: mod.name, description: mod.description || '', version: mod.version || '1.0', category_id: mod.category_id || '' });
    setEditingMod(mod);
  };

  const handleSaveEdit = async () => {
    if (!editingMod) return;
    const { error } = await supabase
      .from('fivem_mods')
      .update({ name: editForm.name.trim(), description: editForm.description.trim() || null, version: editForm.version, category_id: editForm.category_id || null })
      .eq('id', editingMod.id);
    if (error) { toast.error('Failed to save changes'); console.error(error); }
    else {
      await logModAudit('mod_updated', { id: editingMod.id, name: editForm.name.trim() }, {
        version: editForm.version,
        category_id: editForm.category_id || null,
      });
      toast.success('Mod updated');
      setEditingMod(null);
      fetchMods();
    }
  };

  const handleAiEnhanceScreenshot = (mod: FiveMod, screenshotIndex: number) => {
    if (!mod.screenshots || mod.screenshots.length === 0) { toast.error('This mod has no screenshots'); return; }
    const idx = Math.min(screenshotIndex, mod.screenshots.length - 1);
    setCompareState({ modId: mod.id, modName: mod.name, screenshotIndex: idx, originalUrl: mod.screenshots[idx], allScreenshots: [...mod.screenshots] });
  };

  const filteredMods = mods
    .filter(mod => {
      if (!isStaff) {
        const published = (mod as any).status ? (mod as any).status === 'published' : mod.is_active !== false;
        if (!published) return false;
      }
      const matchesCategory = !selectedCategory || mod.category_id === selectedCategory;
      const matchesSearch = !searchQuery ||
        mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      switch (sortBy) {
        case 'popular': return (b.download_count || 0) - (a.download_count || 0);
        case 'name': return a.name.localeCompare(b.name);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const featuredMods = filteredMods.filter(m => m.is_featured);
  const regularMods = filteredMods.filter(m => !m.is_featured);
  const totalDownloads = mods.reduce((acc, m) => acc + (m.download_count || 0), 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isCheckingAuth || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleDownloadWithState = async (mod: FiveMod) => {
    setDownloadingId(mod.id);
    await handleDownload(mod);
    setTimeout(() => setDownloadingId(null), 1500);
  };

  const renderModCard = (mod: FiveMod) => {
    const CategoryIcon = mod.mod_categories?.icon ? iconMap[mod.mod_categories.icon] || Package : Package;
    const isBeingEnhanced = enhancingMods.has(mod.id);
    const enhanceStart = enhancingMods.get(mod.id);
    const elapsedSec = enhanceStart ? Math.floor((Date.now() - enhanceStart) / 1000) : 0;
    const elapsedStr = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
    const isDownloading = downloadingId === mod.id;
    const tags = mod.tags ? mod.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const isNew = (Date.now() - new Date(mod.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

    const card = (
      <motion.div
        key={mod.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        whileHover={{ y: -5 }}
        className="group font-sans"
      >
        <div className="relative rounded-2xl overflow-hidden h-full flex flex-col transition-all duration-300" style={{ isolation: 'isolate' }}>
          {/* Glow border on hover */}
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-primary/30 via-transparent to-primary/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Card body */}
          <div className="relative z-[1] rounded-2xl overflow-hidden bg-card/80 border border-white/[0.06] group-hover:border-primary/20 h-full flex flex-col shadow-[0_2px_16px_-4px_rgba(0,0,0,0.4)] group-hover:shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.12)] transition-all duration-300">
            
            {/* Thumbnail — fixed 16:10 ratio */}
            <div className="relative aspect-[16/10] overflow-hidden cursor-pointer bg-card" onClick={() => setSelectedMod(mod)}>
              <ModThumbnail
                src={mod.screenshots?.[0]}
                name={mod.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-card/30 via-transparent to-transparent" />

              {/* Hover overlay for buttons */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Top-left badges */}
              <div className="absolute z-20 top-3 left-3 flex items-center gap-1.5">
                {mod.is_featured && (
                  <Badge className="bg-yellow-500/90 text-yellow-950 border-0 gap-1 font-bold text-[10px] shadow-lg backdrop-blur-sm px-2 py-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    {t('mods.featured')}
                  </Badge>
                )}
                {isNew && !mod.is_featured && (
                  <Badge className="bg-primary/90 text-primary-foreground border-0 font-bold text-[10px] shadow-lg backdrop-blur-sm px-2 py-0.5">
                    New
                  </Badge>
                )}
              </div>

              {/* Top-right: File size */}
              {mod.file_size && (
                <div className="absolute z-20 top-3 right-3">
                  <span className="text-[10px] font-mono text-foreground/70 bg-black/50 backdrop-blur-md px-2 py-1 rounded-md border border-white/[0.06]">
                    {mod.file_size} MB
                  </span>
                </div>
              )}

              {/* Hover quick actions */}
              <div className="absolute z-20 bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                <div className="flex gap-1.5">
                  {mod.screenshots && mod.screenshots.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={(e) => { e.stopPropagation(); setPreview3dMod(mod); }}
                      className="h-8 px-3 rounded-lg bg-background/70 backdrop-blur-md border border-white/[0.08] text-[11px] font-medium text-foreground flex items-center gap-1.5 hover:bg-background/90 transition-colors duration-200"
                    >
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      {t('mods.preview')}
                    </motion.button>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={(e) => { e.stopPropagation(); handleDownloadWithState(mod); }}
                  disabled={isDownloading}
                  className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold flex items-center gap-1.5 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 transition-all duration-200 disabled:opacity-50"
                >
                  {isDownloading ? (
                    <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {isDownloading ? t('mods.downloading') : t('mods.download')}
                </motion.button>
              </div>

              {/* AI enhancing overlay */}
              {isBeingEnhanced && (
                <div className="absolute z-20 bottom-3 left-3 right-3 flex items-center gap-2 bg-background/90 backdrop-blur-sm text-xs text-foreground px-3 py-2 rounded-xl border border-border/50">
                  <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{t('mods.ai_enhancing')}</span>
                      <span className="text-muted-foreground">{elapsedStr}</span>
                    </div>
                    <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-1">
              {/* Category + Version */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1 text-[10px] text-primary/80 font-medium tracking-wide uppercase">
                  <CategoryIcon className="w-3 h-3" />
                  {mod.mod_categories?.name || t('mods.general')}
                </span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[10px] text-muted-foreground/50 font-mono">v{mod.version}</span>
              </div>

              {/* Title */}
              <h3 className="font-bold text-foreground leading-snug line-clamp-1 text-sm mb-1.5 tracking-tight">
                {mod.name}
              </h3>

              {/* Description */}
              <p className="text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed mb-3">
                {mod.description || t('mods.no_description')}
              </p>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[9px] font-medium text-muted-foreground/60 tracking-wide uppercase border border-white/[0.04]">
                      {tag}
                    </span>
                  ))}
                  {tags.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.03] text-[9px] text-muted-foreground/40 border border-white/[0.03]">+{tags.length - 3}</span>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-3">
                  {/* Download count */}
                  <span className="text-xs font-semibold text-primary flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {(mod.download_count || 0) > 0 ? (
                      <motion.span key={mod.download_count} initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                        {(mod.download_count || 0).toLocaleString()}
                      </motion.span>
                    ) : (
                      <span className="text-muted-foreground/50 font-normal italic text-[10px]">No downloads yet</span>
                    )}
                  </span>
                  {/* Verified badge */}
                  <span className="text-[9px] text-primary/60 flex items-center gap-0.5 font-medium">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {t('mods.verified')}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDate(mod.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );

    if (isStaff || isModCreator) {
      return (
        <ContextMenu key={mod.id}>
          <ContextMenuTrigger asChild>
            {card}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56 bg-card/95 backdrop-blur-xl border-border/50">
            <ContextMenuItem onClick={() => setSelectedMod(mod)} className="gap-2">
              <Eye className="w-4 h-4" /> {t('mods.view_details')}
            </ContextMenuItem>
            {isStaff && (
              <ContextMenuItem onClick={() => openEditDialog(mod)} className="gap-2">
                <Edit className="w-4 h-4" /> {t('mods.edit_mod')}
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={() => handleDownload(mod)} className="gap-2">
              <Download className="w-4 h-4" /> {t('mods.download')}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => window.open(mod.file_url, '_blank')} className="gap-2">
              <ExternalLink className="w-4 h-4" /> {t('mods.open_file_url')}
            </ContextMenuItem>
            {isStaff && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleToggleFeatured(mod)} className="gap-2">
                  <Star className={`w-4 h-4 ${mod.is_featured ? 'text-yellow-500' : ''}`} />
                  {mod.is_featured ? t('mods.remove_featured') : t('mods.add_featured')}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleToggleActive(mod)} className="gap-2">
                  {mod.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {mod.is_active ? t('mods.deactivate') : t('mods.activate')}
                </ContextMenuItem>
              </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => handleCopyId(mod)} className="gap-2">
              <Copy className="w-4 h-4" /> {t('mods.copy_id')}
            </ContextMenuItem>
            {mod.screenshots && mod.screenshots.length > 0 && (
              <>
                <ContextMenuSeparator />
                {mod.screenshots.map((_, sIdx) => (
                  <ContextMenuItem key={sIdx} onClick={() => handleAiEnhanceScreenshot(mod, sIdx)} className="gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> {t('mods.ai_enhance')} {sIdx + 1}
                  </ContextMenuItem>
                ))}
              </>
            )}
            {isStaff && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleDeleteMod(mod)} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4" /> {t('mods.delete_mod')}
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      );
    }

    return card;
  };

  return (
    <div className="min-h-screen relative">
      <Suspense fallback={<div className="fixed inset-0 -z-10" style={{ background: 'hsl(230, 25%, 4%)' }} />}>
        <CosmicNebulaBackground />
      </Suspense>
      <MaintenanceBanner />
      <AppHeader />

      <main className="relative z-10">
        {/* Toolbar Section */}
        <section className="sticky top-0 z-30 border-b border-border/10 bg-background/60 backdrop-blur-2xl">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Title */}
              <h1 className="text-base font-semibold tracking-tight text-foreground shrink-0 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                FiveM <span className="text-primary">Mods</span>
              </h1>

              <div className="hidden sm:block w-px h-5 bg-border/30" />

              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <Input
                  placeholder={t('mods.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-secondary/30 border-border/20 text-sm rounded-xl placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all duration-200"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors duration-200" />
                  </button>
                )}
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[130px] h-9 bg-secondary/30 border-border/20 text-xs rounded-xl">
                  <ArrowUpDown className="w-3 h-3 mr-1.5 text-muted-foreground/50" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="newest">{t('mods.newest')}</SelectItem>
                   <SelectItem value="popular">{t('mods.most_popular')}</SelectItem>
                   <SelectItem value="name">{t('mods.name_az')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Upload button */}
              {canUpload && (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button onClick={() => setShowUploadDialog(true)} size="sm" className="gap-1.5 h-9 text-xs rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200">
                    <Plus className="w-3.5 h-3.5" />
                     {t('mods.upload_btn')}
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Category filters */}
            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedCategory === null
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                   {t('mods.all')}
                </button>
                {categories.map((category) => {
                  const IconComponent = iconMap[category.icon] || Package;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        selectedCategory === category.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <IconComponent className="w-3 h-3" />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Featured Hero */}
        {!isLoading && featuredMods.length > 0 && !searchQuery && !selectedCategory && (
          <section className="container mx-auto px-4 pt-8 pb-2">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">{t('mods.trending')}</h2>
              <div className="flex-1 h-px bg-border/20" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {featuredMods.slice(0, 2).map((mod) => {
                const tags = mod.tags ? mod.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                return (
                  <motion.div
                    key={`featured-${mod.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -2 }}
                    className="group relative rounded-2xl overflow-hidden cursor-pointer"
                    onClick={() => setSelectedMod(mod)}
                  >
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-yellow-500/40 via-primary/20 to-yellow-500/10" />
                    <div className="relative rounded-2xl overflow-hidden bg-[hsl(220,20%,8%)]">
                      <div className="flex flex-col sm:flex-row">
                        <div className="relative aspect-[16/10] sm:aspect-auto sm:w-1/2 overflow-hidden">
                          <ModThumbnail
                            src={mod.screenshots?.[0]}
                            name={mod.name}
                            className="w-full h-full min-h-[200px] object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/80 hidden sm:block" />
                        </div>
                        <div className="p-5 sm:w-1/2 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-yellow-500/90 text-yellow-950 border-0 gap-1 font-bold text-[10px]">
                              <Star className="w-2.5 h-2.5 fill-current" />
                               {t('mods.featured')}
                            </Badge>
                            <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px]">
                              <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                              {t('mods.safe')}
                            </Badge>
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-1">{mod.name}</h3>
                          <p className="text-sm text-muted-foreground/60 line-clamp-2 mb-3">{mod.description || t('mods.no_description')}</p>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-primary/8 border border-primary/15 text-[10px] font-medium text-primary/70">{tag}</span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                            <span className="flex items-center gap-1"><Download className="w-3 h-3" />{(mod.download_count || 0).toLocaleString()}</span>
                            <span className="font-mono">v{mod.version}</span>
                            {mod.file_size && <span>{mod.file_size}</span>}
                          </div>
                          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button
                              onClick={(e) => { e.stopPropagation(); handleDownloadWithState(mod); }}
                              className="gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
                            >
                              <Download className="w-4 h-4" />
                              {t('mods.download_now')}
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Content */}
        <section className="container mx-auto px-4 py-8 min-h-screen">
          {!isLoading && filteredMods.length > 0 && (
            <div className="flex items-center gap-2 mb-5">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">
                {searchQuery || selectedCategory ? t('mods.results') : t('mods.all_mods')}
              </h2>
              <div className="flex-1 h-px bg-border/20" />
              <span className="text-xs text-muted-foreground">{filteredMods.length} mod{filteredMods.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-card/40 border border-white/[0.06] overflow-hidden animate-pulse">
                  <div className="aspect-[16/10] w-full bg-secondary/20" />
                  <div className="p-4 space-y-3">
                    <div className="h-2 w-1/4 rounded-full bg-secondary/30" />
                    <div className="h-3.5 w-3/4 rounded-full bg-secondary/25" />
                    <div className="h-2 w-full rounded-full bg-secondary/20" />
                    <div className="h-2 w-2/3 rounded-full bg-secondary/15" />
                    <div className="pt-3 border-t border-white/[0.04] flex justify-between">
                      <div className="h-2 w-16 rounded-full bg-secondary/20" />
                      <div className="h-2 w-12 rounded-full bg-secondary/15" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMods.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-muted-foreground/40" />
              </div>
               <h3 className="text-lg font-semibold text-foreground mb-1">{t('mods.no_mods_found')}</h3>
               <p className="text-sm text-muted-foreground max-w-sm text-center">
                 {searchQuery || selectedCategory
                   ? t('mods.try_adjusting')
                   : t('mods.check_back')}
              </p>
              {(searchQuery || selectedCategory) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                >
                  {t('mods.clear_filters')}
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(searchQuery || selectedCategory ? filteredMods : regularMods).map(renderModCard)}
            </div>
          )}
        </section>
      </main>

      {/* Mod Details Dialog */}
      <Dialog open={!!selectedMod} onOpenChange={() => setSelectedMod(null)}>
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-border/30">
          {selectedMod && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  {selectedMod.is_featured && (
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  )}
                  {selectedMod.name}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-sm">
                  <span>v{selectedMod.version}</span>
                  {selectedMod.file_size && <><span>·</span><span>{selectedMod.file_size}</span></>}
                  <span>·</span>
                  <span>{(selectedMod.download_count || 0).toLocaleString()} {t('mods.downloads')}</span>
                </DialogDescription>
              </DialogHeader>
              
              {selectedMod.screenshots && selectedMod.screenshots.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedMod.screenshots.map((screenshot, i) => (
                    <div key={i} onClick={() => setZoomedImage(screenshot)} className="cursor-zoom-in hover:opacity-90 transition-opacity">
                      <ModThumbnail
                        src={screenshot}
                        name={`${selectedMod.name} ${i + 1}`}
                        className="w-full aspect-video object-cover rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-sm">{t('mods.description')}</h4>
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed">
                    {selectedMod.description || t('mods.no_description')}
                  </p>
                </div>

                {selectedMod.tags && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">{t('mods.tags')}</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMod.tags.split(',').map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{tag.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedMod.changelog && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">{t('mods.changelog')}</h4>
                    <p className="text-muted-foreground text-xs whitespace-pre-wrap font-mono bg-secondary/30 rounded-lg p-3 border border-border/20">
                      {selectedMod.changelog}
                    </p>
                  </div>
                )}

                {selectedMod.requirements && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">{t('mods.requirements')}</h4>
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">{selectedMod.requirements}</p>
                  </div>
                )}

                {selectedMod.compatibility && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">{t('mods.compatibility')}</h4>
                    <Badge variant="outline" className="text-xs">{selectedMod.compatibility}</Badge>
                  </div>
                )}

                {selectedMod.author_notes && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">{t('mods.author_notes')}</h4>
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap bg-primary/5 rounded-lg p-3 border border-primary/10">
                      {selectedMod.author_notes}
                    </p>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedMod.mod_categories?.name || t('mods.uncategorized')}</Badge>
                  {selectedMod.file_name && <Badge variant="secondary">{selectedMod.file_name}</Badge>}
                </div>
                
                <Button className="w-full gap-2" onClick={() => handleDownload(selectedMod)}>
                  <Download className="w-4 h-4" />
                  {t('mods.download')} {selectedMod.name}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      {canUpload && (
        <ModUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          categories={categories}
          onSuccess={() => { fetchMods(); setShowUploadDialog(false); }}
        />
      )}

      {/* Edit Mod Dialog */}
      <Dialog open={!!editingMod} onOpenChange={() => setEditingMod(null)}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-border/30">
          <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Edit className="w-5 h-5" /> {t('mods.edit_mod')}
             </DialogTitle>
             <DialogDescription>{t('mods.update_details')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('mods.name')}</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('mods.description')}</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('mods.version')}</Label>
                <Input value={editForm.version} onChange={(e) => setEditForm(f => ({ ...f, version: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('mods.category')}</Label>
                <Select value={editForm.category_id} onValueChange={(v) => setEditForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSaveEdit} className="w-full gap-2">
              <Save className="w-4 h-4" /> {t('mods.save_changes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />

      <Dialog open={!!zoomedImage} onOpenChange={(open) => { if (!open) setZoomedImage(null); }}>
        <DialogContent className="max-w-[96vw] w-auto border-0 bg-transparent p-0 shadow-none">
          {zoomedImage && (
            <div className="flex items-center justify-center">
              <img src={zoomedImage} alt="Zoomed" className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {compareState && (
        <ScreenshotCompareDialog
          open={!!compareState}
          onOpenChange={(open) => { if (!open) setCompareState(null); }}
          modId={compareState.modId}
          modName={compareState.modName}
          screenshotIndex={compareState.screenshotIndex}
          originalUrl={compareState.originalUrl}
          allScreenshots={compareState.allScreenshots}
          onSaved={fetchMods}
        />
      )}

      {/* 3D Model Viewer */}
      <ModelViewer3D
        isOpen={!!preview3dMod}
        onClose={() => setPreview3dMod(null)}
        modName={preview3dMod?.name || ''}
        modelUrl={preview3dMod?.model_url || undefined}
        fallbackImage={preview3dMod?.screenshots?.[0]}
      />

      {/* Custom delete confirmation */}
      <AlertDialog open={!!modToDelete} onOpenChange={(open) => !open && !isDeleting && setModToDelete(null)}>
        <AlertDialogContent className="border-destructive/30 bg-card/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-destructive/80">Permanent action</p>
                <AlertDialogTitle className="text-base font-semibold">Delete mod?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  You are about to permanently delete <span className="font-medium text-foreground">"{modToDelete?.name}"</span>. This will also remove its files, screenshots and download history. This cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteMod(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete mod'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FiveMMods;
