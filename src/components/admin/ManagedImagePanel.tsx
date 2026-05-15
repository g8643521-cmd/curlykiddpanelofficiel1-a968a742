import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';

const BUCKET = 'hero-images';

interface Props {
  settingKey: string;
  storagePrefix: string; // e.g. 'hero-showcase' or 'feature-server-details'
  title: string;
  description: string;
  fallbackPreview?: string;
}

export default function ManagedImagePanel({ settingKey, storagePrefix, title, description, fallbackPreview }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchImage = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', settingKey)
      .maybeSingle();
    if (data?.value) setImageUrl(String(data.value).replace(/^"|"$/g, ''));
    else setImageUrl(null);
    setIsLoading(false);
  }, [settingKey]);

  useEffect(() => { fetchImage(); }, [fetchImage]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }

    setIsUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${storagePrefix}.${ext}`;

      // Remove possible old variants
      await supabase.storage.from(BUCKET).remove([
        `${storagePrefix}.png`, `${storagePrefix}.jpg`,
        `${storagePrefix}.jpeg`, `${storagePrefix}.webp`,
      ]);

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();

      await supabase.from('admin_settings').upsert(
        { key: settingKey, value: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

      setImageUrl(publicUrl);
      toast.success(`${title} updated!`);
    } catch (err: any) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
    }
    setIsUploading(false);
    e.target.value = '';
  };

  const handleRemove = async () => {
    setIsUploading(true);
    try {
      await supabase.from('admin_settings').delete().eq('key', settingKey);
      await supabase.storage.from(BUCKET).remove([
        `${storagePrefix}.png`, `${storagePrefix}.jpg`,
        `${storagePrefix}.jpeg`, `${storagePrefix}.webp`,
      ]);
      setImageUrl(null);
      toast.success(`${title} reset to default`);
    } catch {
      toast.error('Could not remove the image');
    }
    setIsUploading(false);
  };

  const previewSrc = imageUrl || fallbackPreview || null;

  return (
    <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {imageUrl && (
          <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Custom
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="h-40 rounded-lg bg-muted/20 animate-pulse" />
      ) : (
        <>
          <div className="relative rounded-lg overflow-hidden border border-border/30 bg-muted/10 aspect-video flex items-center justify-center">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={`${title} preview`}
                className="w-full h-full object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
              />
            ) : (
              <div className="text-center px-6 py-12">
                <ImageIcon className="w-5 h-5 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-[12px] text-muted-foreground/70">Default image in use</p>
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={`upload-${settingKey}`} className="cursor-pointer">
              <Button asChild variant={imageUrl ? 'outline' : 'default'} size="sm" disabled={isUploading}>
                <span className="flex items-center gap-2">
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {imageUrl ? 'Change image' : 'Upload image'}
                </span>
              </Button>
            </Label>
            <Input
              id={`upload-${settingKey}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={isUploading}
            />
            {imageUrl && (
              <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isUploading} className="text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Reset
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}