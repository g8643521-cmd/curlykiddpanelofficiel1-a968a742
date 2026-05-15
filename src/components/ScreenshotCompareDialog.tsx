// @ts-nocheck
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, RefreshCw, ArrowLeftRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { X, ZoomIn } from 'lucide-react';

const getSpinStyle = (duration: number, direction = 'normal') => ({
  animation: `spin ${duration}s linear infinite`,
  animationDirection: direction,
});

interface ScreenshotCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modId: string;
  modName: string;
  screenshotIndex: number;
  originalUrl: string;
  allScreenshots: string[];
  onSaved: () => void;
}

const ScreenshotCompareDialog = ({
  open,
  onOpenChange,
  modId,
  modName,
  screenshotIndex,
  originalUrl,
  allScreenshots,
  onSaved,
}: ScreenshotCompareDialogProps) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<'original' | 'enhanced' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setEnhancedUrl(null);
      setSelected(null);
      setHistory([]);
      setHistoryIndex(-1);
      setIsEnhancing(false);
      setIsSaving(false);
      setZoomedImage(null);
    }
  }, [open]);

  const runEnhance = async () => {
    setIsEnhancing(true);
    setSelected(null);
    try {
      // Fetch the original image as base64
      const imgResp = await fetch(originalUrl);
      const blob = await imgResp.blob();
      const base64 = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const { data, error } = await supabase.functions.invoke('enhance-screenshot', {
        body: { imageBase64: base64 },
      });

      if (error || data?.fallback || data?.error) {
        toast.error(data?.message || 'AI enhancement failed');
        setIsEnhancing(false);
        return;
      }

      const enhancedImageUrl = data?.imageUrl;
      if (!enhancedImageUrl) {
        toast.error('AI did not return an image');
        setIsEnhancing(false);
        return;
      }

      setEnhancedUrl(enhancedImageUrl);
      setHistory(prev => [...prev, enhancedImageUrl]);
      setHistoryIndex(prev => prev + 1);
    } catch (e) {
      console.error('Enhancement error:', e);
      toast.error('Failed to enhance screenshot');
    }
    setIsEnhancing(false);
  };

  const handleSave = async (choice: 'original' | 'enhanced') => {
    if (choice === 'original') {
      toast.info('Original kept');
      onOpenChange(false);
      return;
    }

    if (!enhancedUrl) return;
    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in');
        setIsSaving(false);
        return;
      }
      // Upload the enhanced base64 image to storage
      const res = await fetch(enhancedUrl);
      const blob = await res.blob();
      const fileName = `${session.user.id}/${Date.now()}-ai-enhanced.png`;
      const { error: uploadErr } = await supabase.storage
        .from('mod-screenshots')
        .upload(fileName, blob, { contentType: 'image/png' });

      if (uploadErr) {
        toast.error('Failed to upload enhanced image');
        setIsSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('mod-screenshots').getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;

      // Update the mod's screenshots array
      const updatedScreenshots = [...allScreenshots];
      updatedScreenshots[screenshotIndex] = newUrl;

      const { error: updateErr } = await supabase
        .from('fivem_mods')
        .update({ screenshots: updatedScreenshots })
        .eq('id', modId);

      if (updateErr) {
        toast.error('Failed to save');
        console.error(updateErr);
      } else {
        toast.success('AI-enhanced image saved!');
        onSaved();
        onOpenChange(false);
      }
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Failed to save');
    }
    setIsSaving(false);
  };

  const browseHistory = (dir: -1 | 1) => {
    const newIdx = historyIndex + dir;
    if (newIdx >= 0 && newIdx < history.length) {
      setHistoryIndex(newIdx);
      setEnhancedUrl(history[newIdx]);
      setSelected(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card/95 backdrop-blur-2xl border-border/30 p-0 overflow-hidden rounded-2xl">
        {/* Fullscreen image zoom overlay */}
        {zoomedImage && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-background/20 hover:bg-background/40 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Screenshot Sammenligning
          </DialogTitle>
          <DialogDescription>
            {modName} — Screenshot {screenshotIndex + 1}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Comparison grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <button
              type="button"
              onClick={() => setSelected('original')}
              className={cn(
                'relative rounded-xl overflow-hidden border-2 transition-all duration-200 group',
                selected === 'original'
                  ? 'border-primary shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                  : 'border-border/30 hover:border-border/60'
              )}
            >
              <Badge className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm text-foreground border-border/30">
                Original
              </Badge>
              {selected === 'original' && (
                <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
              <img
                src={originalUrl}
                alt="Original"
                className="w-full aspect-video object-cover cursor-zoom-in"
                onClick={(e) => { e.stopPropagation(); setZoomedImage(originalUrl); }}
              />
            </button>

            {/* Enhanced */}
            <button
              type="button"
              onClick={() => enhancedUrl && setSelected('enhanced')}
              disabled={!enhancedUrl}
              className={cn(
                'relative rounded-xl overflow-hidden border-2 transition-all duration-200',
                selected === 'enhanced'
                  ? 'border-primary shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                  : 'border-border/30 hover:border-border/60',
                !enhancedUrl && 'cursor-default'
              )}
            >
              <Badge className="absolute top-2 left-2 z-10 bg-primary/90 backdrop-blur-sm text-primary-foreground border-0">
                AI Enhanced
              </Badge>
              {selected === 'enhanced' && (
                <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
              {enhancedUrl ? (
                <div className="relative">
                  <img
                    src={enhancedUrl}
                    alt="AI Enhanced"
                    className="w-full aspect-video object-cover cursor-zoom-in"
                    onClick={(e) => { e.stopPropagation(); setZoomedImage(enhancedUrl); }}
                  />
                  {isEnhancing && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
                      <div className="relative flex h-12 w-12 items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                        <div className="absolute inset-0" style={getSpinStyle(0.7)}>
                          <div className="absolute left-1/2 top-[-2px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.65)]" />
                        </div>
                        <RefreshCw className="h-6 w-6 text-primary" style={getSpinStyle(1.05, 'reverse')} />
                      </div>
                      <span className="text-xs font-medium text-foreground animate-pulse">AI laver en ny version...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-video bg-muted/30 flex flex-col items-center justify-center gap-2">
                  {isEnhancing ? (
                    <>
                      <div className="relative flex h-10 w-10 items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                        <div className="absolute inset-0" style={getSpinStyle(0.7)}>
                          <div className="absolute left-1/2 top-[-2px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.65)]" />
                        </div>
                        <RefreshCw className="h-5 w-5 text-primary" style={getSpinStyle(1.05, 'reverse')} />
                      </div>
                      <span className="text-xs text-muted-foreground animate-pulse">AI genererer...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-8 h-8 text-muted-foreground/40" />
                      <span className="text-xs text-muted-foreground">Tryk AI Enhance for at starte</span>
                    </>
                  )}
                </div>
              )}
            </button>
          </div>

          {/* History navigation */}
          {history.length > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => browseHistory(-1)}
                disabled={historyIndex <= 0}
              >
                ← Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Version {historyIndex + 1} of {history.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => browseHistory(1)}
                disabled={historyIndex >= history.length - 1}
              >
                Next →
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={runEnhance}
              disabled={isEnhancing || isSaving}
              variant="outline"
              className="gap-2 flex-1"
            >
              {isEnhancing ? (
                <RefreshCw className="w-4 h-4" style={getSpinStyle(0.9)} />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {enhancedUrl ? 'Try again' : 'AI Enhance'}
            </Button>

            <Button
              onClick={() => handleSave('original')}
              disabled={isSaving}
              variant="secondary"
              className="gap-2"
            >
              Behold original
            </Button>

            <Button
              onClick={() => handleSave('enhanced')}
              disabled={!enhancedUrl || isSaving}
              className="gap-2 flex-1"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Use AI image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScreenshotCompareDialog;