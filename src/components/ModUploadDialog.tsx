// @ts-nocheck
import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image, Sparkles, Loader2, FileArchive, Trash2, RefreshCw, Ban, CheckCircle2, AlertCircle, Package, ZoomIn, Tag, Info, FileText, Globe, Shield, Hash } from 'lucide-react';
import { Wand2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useEnhancingModsStore } from '@/stores/enhancingModsStore';

interface ModCategory {
  id: string;
  name: string;
  icon: string;
}

interface EnhancePending {
  screenshotIndex: number;
  promise: Promise<File | null>;
}

interface ModFile {
  file: File;
  name: string;
  description: string;
  category_id: string;
  version: string;
  is_featured: boolean;
  screenshots: File[];
  isAnalyzing: boolean;
  isAnalyzed: boolean;
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'done' | 'error' | 'cancelled';
  pendingEnhancements: EnhancePending[];
  tags: string;
  changelog: string;
  requirements: string;
  compatibility: string;
  author_notes: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getSpinStyle = (duration: number, direction = 'normal') => ({
  animation: `spin ${duration}s linear infinite`,
  animationDirection: direction,
});

interface ModUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ModCategory[];
  onSuccess: () => void;
}

const ModUploadDialog = ({ open, onOpenChange, categories, onSuccess }: ModUploadDialogProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [modFiles, setModFiles] = useState<ModFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [autoAnalyzeAll, setAutoAnalyzeAll] = useState(false);
  const [isAdvancedAnalyzing, setIsAdvancedAnalyzing] = useState(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeXHRsRef = useRef<XMLHttpRequest[]>([]);
  const [enhancingIndices, setEnhancingIndices] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const createEnhancePromise = (file: File): Promise<File | null> => {
    return new Promise(async (resolve) => {
      try {
        const base64 = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(file);
        });
        let data: any = null;
        try {
          const result = await supabase.functions.invoke('enhance-screenshot', { body: { imageBase64: base64 } });
          data = result.data;
          if (result.error || data?.fallback || data?.error) { resolve(null); return; }
        } catch { resolve(null); return; }
        const enhancedUrl = data?.imageUrl;
        if (!enhancedUrl) { resolve(null); return; }
        const res = await fetch(enhancedUrl);
        const blob = await res.blob();
        resolve(new File([blob], `enhanced-${file.name}`, { type: 'image/png' }));
      } catch { resolve(null); }
    });
  };

  const startEnhancement = (fileIdx: number, screenshotIdx: number) => {
    const currentFile = modFiles[fileIdx];
    if (!currentFile) return;
    const file = currentFile.screenshots[screenshotIdx];
    if (!file) return;
    const key = `${fileIdx}-${screenshotIdx}`;
    if (enhancingIndices.has(key)) return;
    setEnhancingIndices(prev => new Set(prev).add(key));
    const promise = createEnhancePromise(file);
    setModFiles(prev => prev.map((f, i) => {
      if (i !== fileIdx) return f;
      return { ...f, pendingEnhancements: [...f.pendingEnhancements, { screenshotIndex: screenshotIdx, promise }] };
    }));
    promise.then((enhanced) => {
      setEnhancingIndices(prev => { const n = new Set(prev); n.delete(key); return n; });
      if (enhanced) {
        toast.success('Background-enhanced screenshot is ready and will only be used if you save it manually later.');
      }
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  }, []);

  const analyzeFile = async (file: File, index: number) => {
    setModFiles(prev => prev.map((f, i) => i === index ? { ...f, isAnalyzing: true } : f));
    try {
      const { data, error } = await supabase.functions.invoke('analyze-mod', {
        body: { filename: file.name, fileSize: file.size, categories: categories.map(c => ({ id: c.id, name: c.name })) },
      });
      if (error) throw error;
      if (data?.analysis) {
        const analysis = data.analysis;
        setModFiles(prev => prev.map((f, i) => i === index ? {
          ...f, name: analysis.name || f.name, description: analysis.description || f.description,
          category_id: analysis.category_id || f.category_id, version: analysis.version || f.version,
          isAnalyzing: false, isAnalyzed: true,
        } : f));
        return true;
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      toast.error('AI analysis failed. Fill in details manually.');
      setModFiles(prev => prev.map((f, i) => i === index ? { ...f, isAnalyzing: false } : f));
    }
    return false;
  };

  const analyzeAdvanced = async (index: number) => {
    const modFile = modFiles[index];
    if (!modFile) return;
    setIsAdvancedAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-mod', {
        body: { filename: modFile.file.name, fileSize: modFile.file.size, modName: modFile.name, modDescription: modFile.description, mode: 'advanced' },
      });
      if (error) throw error;
      if (data?.advanced) {
        updateFileData(index, {
          changelog: data.advanced.changelog || '',
          requirements: data.advanced.requirements || '',
          compatibility: data.advanced.compatibility || '',
          author_notes: data.advanced.author_notes || '',
        });
        toast.success('AI filled advanced details!');
      }
    } catch (err) {
      console.error('Advanced AI error:', err);
      toast.error('AI failed to generate advanced details');
    }
    setIsAdvancedAnalyzing(false);
  };

  const batchAnalyzeUnanalyzed = async () => {
    const unanalyzed = modFiles.map((f, i) => ({ file: f, index: i })).filter(({ file }) => !file.isAnalyzed && !file.isAnalyzing);
    if (unanalyzed.length === 0) { toast.info('All files have already been analyzed'); return; }
    setIsBatchAnalyzing(true);
    
    // Mark all as analyzing
    setModFiles(prev => prev.map((f, i) => 
      unanalyzed.some(u => u.index === i) ? { ...f, isAnalyzing: true } : f
    ));

    try {
      // Single batch API call instead of multiple individual calls
      const { data, error } = await supabase.functions.invoke('analyze-mod', {
        body: {
          mode: 'batch',
          files: unanalyzed.map(u => ({ filename: u.file.file.name, fileSize: u.file.file.size })),
          categories: categories.map(c => ({ id: c.id, name: c.name })),
        },
      });

      if (error) throw error;

      const results = data?.results || [];
      setModFiles(prev => prev.map((f, i) => {
        const uIdx = unanalyzed.findIndex(u => u.index === i);
        if (uIdx === -1) return f;
        const analysis = results[uIdx];
        if (!analysis) return { ...f, isAnalyzing: false };
        return {
          ...f,
          name: analysis.name || f.name,
          description: analysis.description || f.description,
          category_id: analysis.category_id || f.category_id,
          version: analysis.version || f.version,
          isAnalyzing: false,
          isAnalyzed: true,
        };
      }));
      toast.success(`Analyzed ${Math.min(results.length, unanalyzed.length)} of ${unanalyzed.length} files`);
    } catch (err) {
      console.error('Batch analysis error:', err);
      // Reset analyzing state
      setModFiles(prev => prev.map((f, i) => 
        unanalyzed.some(u => u.index === i) ? { ...f, isAnalyzing: false } : f
      ));
      toast.error('AI batch analysis failed. Try analyzing individually.');
    }
    setIsBatchAnalyzing(false);
  };

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const validExtensions = ['.rpf', '.zip', '.rar', '.7z'];
    const newFiles: ModFile[] = [];
    for (const file of Array.from(files)) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!validExtensions.includes(ext)) { toast.error(`Invalid file: ${file.name}. Only RPF, ZIP, RAR, 7Z files allowed.`); continue; }
      newFiles.push({ file, name: '', description: '', category_id: '', version: '1.0', is_featured: false, screenshots: [], isAnalyzing: false, isAnalyzed: false, uploadProgress: 0, uploadStatus: 'pending', pendingEnhancements: [], tags: '', changelog: '', requirements: '', compatibility: '', author_notes: '' });
    }
    if (newFiles.length === 0) return;
    const startIndex = modFiles.length;
    setModFiles(prev => [...prev, ...newFiles]);
    if (modFiles.length === 0) setSelectedFileIndex(0);
    if (autoAnalyzeAll) { for (let i = 0; i < newFiles.length; i++) { analyzeFile(newFiles[i].file, startIndex + i); } }
  }, [modFiles.length, categories, autoAnalyzeAll]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) addFiles(files);
  }, [addFiles]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setModFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFileIndex >= modFiles.length - 1 && selectedFileIndex > 0) setSelectedFileIndex(selectedFileIndex - 1);
  };

  const updateFileData = (index: number, data: Partial<ModFile>) => {
    setModFiles(prev => prev.map((f, i) => i === index ? { ...f, ...data } : f));
  };

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const currentScreenshots = modFiles[selectedFileIndex]?.screenshots || [];
    if (files.length + currentScreenshots.length > 4) { toast.error('Maximum 4 screenshots allowed per mod'); return; }
    updateFileData(selectedFileIndex, { screenshots: [...currentScreenshots, ...files] });
  };

  const removeScreenshot = (screenshotIndex: number) => {
    const currentFile = modFiles[selectedFileIndex];
    if (!currentFile) return;
    updateFileData(selectedFileIndex, {
      screenshots: currentFile.screenshots.filter((_, i) => i !== screenshotIndex),
      pendingEnhancements: currentFile.pendingEnhancements.filter(p => p.screenshotIndex !== screenshotIndex),
    });
  };

  const uploadWithProgress = async (bucket: string, path: string, file: File, onProgress: (progress: number) => void): Promise<string | null> => {
    const { data: { session: uploadSession } } = await supabase.auth.getSession();
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      activeXHRsRef.current.push(xhr);
      xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); });
      xhr.addEventListener('load', async () => {
        activeXHRsRef.current = activeXHRsRef.current.filter(x => x !== xhr);
        if (xhr.status >= 200 && xhr.status < 300) { const { data } = supabase.storage.from(bucket).getPublicUrl(path); resolve(data.publicUrl); }
        else { console.error('Upload failed:', xhr.status, xhr.responseText); resolve(null); }
      });
      xhr.addEventListener('error', () => { activeXHRsRef.current = activeXHRsRef.current.filter(x => x !== xhr); resolve(null); });
      xhr.addEventListener('abort', () => { activeXHRsRef.current = activeXHRsRef.current.filter(x => x !== xhr); resolve(null); });
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = uploadSession?.access_token || supabaseKey;
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', supabaseKey);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.send(file);
    });
  };

  const cancelUpload = () => {
    setIsCancelled(true);
    activeXHRsRef.current.forEach(xhr => xhr.abort());
    activeXHRsRef.current = [];
    setModFiles(prev => prev.map(f => f.uploadStatus === 'uploading' ? { ...f, uploadStatus: 'cancelled', uploadProgress: 0 } : f));
    setIsUploading(false);
    toast.info('Upload cancelled');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modFiles.length === 0) { toast.error('Please add at least one mod file'); return; }
    const invalidMods = modFiles.filter(f => !f.name.trim());
    if (invalidMods.length > 0) { toast.error('Please fill in the name for all mods'); return; }
    setIsUploading(true);
    setIsCancelled(false);
    let successCount = 0;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('You must be logged in to upload mods'); setIsUploading(false); return; }
      for (let i = 0; i < modFiles.length; i++) {
        if (isCancelled) break;
        const modFile = modFiles[i];
        if (modFile.uploadStatus === 'done' || modFile.uploadStatus === 'cancelled') continue;
        try {
          updateFileData(i, { uploadStatus: 'uploading', uploadProgress: 0 });
          const modFileName = `${session.user.id}/${Date.now()}-${modFile.file.name}`;
          const modUrl = await uploadWithProgress('fivem-mods', modFileName, modFile.file, (progress) => updateFileData(i, { uploadProgress: Math.round(progress * 0.8) }));
          if (!modUrl) { updateFileData(i, { uploadStatus: 'error' }); continue; }
          const screenshotUrls: string[] = [];
          const screenshotWeight = modFile.screenshots.length > 0 ? 20 / modFile.screenshots.length : 0;
          for (let j = 0; j < modFile.screenshots.length; j++) {
            const screenshot = modFile.screenshots[j];
            const screenshotName = `${session.user.id}/${Date.now()}-${screenshot.name}`;
            const { error: screenshotError } = await supabase.storage.from('mod-screenshots').upload(screenshotName, screenshot);
            if (!screenshotError) { const { data: screenshotUrlData } = supabase.storage.from('mod-screenshots').getPublicUrl(screenshotName); screenshotUrls.push(screenshotUrlData.publicUrl); }
            updateFileData(i, { uploadProgress: Math.round(80 + (j + 1) * screenshotWeight) });
          }
          const tagsArray = modFile.tags.trim() ? modFile.tags.split(',').map(t => t.trim()).filter(Boolean) : null;
          const { data: insertData, error: insertError } = await supabase.from('fivem_mods').insert({
            name: modFile.name.trim(), description: modFile.description.trim() || null, category_id: modFile.category_id || null,
            file_url: modUrl, file_name: modFile.file.name, file_size: Math.round(modFile.file.size / (1024 * 1024)),
            version: modFile.version, is_featured: modFile.is_featured, uploaded_by: session.user.id,
            screenshots: screenshotUrls.length > 0 ? screenshotUrls : null,
            tags: tagsArray,
            changelog: modFile.changelog.trim() || null,
            requirements: modFile.requirements.trim() || null,
            compatibility: modFile.compatibility.trim() || null,
            author_notes: modFile.author_notes.trim() || null,
          }).select('id').single();
          if (insertError) {
            console.error('Insert error:', insertError);
            toast.error(`Failed to save ${modFile.name}: ${insertError.message}`);
          }
          if (!insertError && insertData) {
            successCount++;
            updateFileData(i, { uploadStatus: 'done', uploadProgress: 100 });

            // Log to audit_log so it shows up in Recent Activity / Audit Log
            try {
              await supabase.from('audit_log').insert({
                action: 'mod_uploaded',
                table_name: 'fivem_mods',
                record_id: insertData.id,
                user_id: session.user.id,
                new_data: {
                  name: modFile.name.trim(),
                  category_id: modFile.category_id || null,
                  version: modFile.version,
                  file_name: modFile.file.name,
                  is_featured: modFile.is_featured,
                },
              });
            } catch (auditErr) {
              console.warn('Audit log insert failed:', auditErr);
            }

            // Prepare webhook data
            const categoryName = categories.find(c => c.id === modFile.category_id)?.name || 'Uncategorized';
            const webhookVars: Record<string, string> = {
              mod_name: modFile.name.trim(),
              mod_description: modFile.description.trim() || 'No description',
              mod_category: categoryName,
              mod_version: modFile.version || '1.0',
              file_name: modFile.file.name,
              file_size: formatFileSize(modFile.file.size),
              uploaded_by: session.user.email || session.user.id,
              is_featured: modFile.is_featured ? 'Yes' : 'No',
              timestamp: new Date().toISOString(),
            };

            const sendModWebhook = async (finalScreenshotUrls: string[]) => {
              try {
                const { data: webhookSettings } = await supabase
                  .from('admin_settings')
                  .select('key, value')
                  .in('key', ['discord_mod_upload_webhook_url', 'embed_config_mod_upload', 'discord_webhook_enabled']);
                const getVal = (key: string) => webhookSettings?.find((s: any) => s.key === key)?.value;
                const wEnabled = getVal('discord_webhook_enabled') === 'true';
                const wUrl = getVal('discord_mod_upload_webhook_url')?.replace(/^"|"$/g, '');
                if (!wEnabled || !wUrl) return;
                let embedCfg: any = null;
                try { embedCfg = JSON.parse(getVal('embed_config_mod_upload') || '{}'); } catch {}
                const replaceVars = (text: string) => text.replace(/\{(\w+)\}/g, (_, k) => webhookVars[k] || `{${k}}`);
                const embed: any = {
                  title: replaceVars(embedCfg?.title || '📦 New Mod Uploaded'),
                  description: replaceVars(embedCfg?.description || '**{mod_name}** has been uploaded.'),
                  color: parseInt((embedCfg?.color || '#EA580C').replace('#', ''), 16),
                  timestamp: new Date().toISOString(),
                  footer: { text: replaceVars(embedCfg?.footer || 'CurlyKiddPanel • FiveM Mods') },
                };
                if (embedCfg?.fields?.length) {
                  embed.fields = embedCfg.fields.map((f: any) => ({ name: replaceVars(f.name), value: replaceVars(f.value), inline: f.inline }));
                }
                if (finalScreenshotUrls.length > 0) embed.image = { url: finalScreenshotUrls[0] };
                const payload: any = { username: 'CurlyKiddPanel', avatar_url: 'https://svmulnlysrsmxolvgxnw.supabase.co/storage/v1/object/public/public-assets/bot-avatar.png', embeds: [embed] };
                if (embedCfg?.content) payload.content = replaceVars(embedCfg.content);
                void fetch(wUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
              } catch (webhookErr) { console.error('Mod upload webhook error:', webhookErr); }
            };

            void sendModWebhook(screenshotUrls);
          } else { console.error('Insert error:', insertError); updateFileData(i, { uploadStatus: 'error' }); }
        } catch (error) { console.error(`Error uploading ${modFile.file.name}:`, error); updateFileData(i, { uploadStatus: 'error' }); }
      }
      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} mod${successCount > 1 ? 's' : ''}!`);
        setTimeout(() => { setModFiles([]); setSelectedFileIndex(0); onSuccess(); }, 1000);
      } else { toast.error('Failed to upload any mods'); }
    } catch (error) { console.error('Upload error:', error); toast.error('Failed to upload mods'); }
    finally { setIsUploading(false); }
  };

  const selectedFile = modFiles[selectedFileIndex];
  const unanalyzedCount = modFiles.filter(f => !f.isAnalyzed && !f.isAnalyzing).length;
  const overallProgress = modFiles.length > 0 ? Math.round(modFiles.reduce((sum, f) => sum + f.uploadProgress, 0) / modFiles.length) : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--green))]" />;
      case 'error': return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
      case 'uploading': return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />;
      default: return <FileArchive className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-2xl border-border/20 shadow-2xl shadow-black/40 rounded-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/15 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-display font-bold text-foreground tracking-tight">Upload Mods</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Drag & drop files or browse • Use AI to auto-fill details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Drop Zone */}
          <div className="px-6 pt-5 pb-3">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer overflow-hidden",
                modFiles.length > 0 ? "p-4" : "p-10",
                isDragging
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/5"
                  : "border-border/30 hover:border-primary/40 hover:bg-card/30"
              )}
            >
              <div className={cn("flex items-center gap-3", modFiles.length > 0 ? "flex-row" : "flex-col text-center")}>
                <div className={cn(
                  "rounded-xl flex items-center justify-center transition-colors",
                  modFiles.length > 0 ? "w-8 h-8 bg-primary/10" : "w-14 h-14 bg-card/50 border border-border/20",
                  isDragging && "bg-primary/15"
                )}>
                  <Upload className={cn(
                    "transition-colors",
                    modFiles.length > 0 ? "w-4 h-4" : "w-6 h-6",
                    isDragging ? "text-primary" : "text-muted-foreground/50"
                  )} />
                </div>
                <div>
                  <p className={cn("font-medium text-foreground", modFiles.length > 0 ? "text-sm" : "text-base")}>
                    {isDragging ? "Drop files here" : modFiles.length > 0 ? "Add more files" : "Drag & drop mod files here"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modFiles.length > 0 ? "RPF, ZIP, RAR, 7Z" : "or click to browse • RPF, ZIP, RAR, 7Z"}
                  </p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInputChange} accept=".rpf,.zip,.rar,.7z" multiple />
            </div>
          </div>

          {/* File List & Editor */}
          {modFiles.length > 0 && (
            <div className="flex-1 flex min-h-0 px-6 pb-4 gap-5">
              {/* File List */}
              <div className="w-64 flex-shrink-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {modFiles.length} file{modFiles.length > 1 ? 's' : ''}
                  </span>
                  {unanalyzedCount > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2" onClick={batchAnalyzeUnanalyzed} disabled={isBatchAnalyzing}>
                      {isBatchAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Analyze {unanalyzedCount}
                    </Button>
                  )}
                </div>
                <ScrollArea className="flex-1 max-h-[450px]">
                  <div className="space-y-1 pr-2">
                    {modFiles.map((file, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedFileIndex(index)}
                        className={cn(
                          "group relative flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all duration-150",
                          selectedFileIndex === index
                            ? "bg-primary/8"
                            : "hover:bg-card/40"
                        )}
                      >
                        <div className="shrink-0">{getStatusIcon(file.uploadStatus)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate leading-tight">
                            {file.name || file.file.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{formatFileSize(file.file.size)}</span>
                            {file.isAnalyzing && (
                              <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-primary/10 text-primary border-0 gap-0.5">
                                <Loader2 className="w-2 h-2 animate-spin" /> AI
                              </Badge>
                            )}
                            {file.isAnalyzed && !file.isAnalyzing && (
                              <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-[hsl(var(--green))]/10 text-[hsl(var(--green))] border-0">
                                ✓ AI
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon"
                          className="w-6 h-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive shrink-0"
                          onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>

                        {file.uploadStatus === 'uploading' && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg overflow-hidden">
                            <div
                              className="h-full transition-all duration-300 bg-primary"
                              style={{ width: `${file.uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Divider */}
              <div className="w-px bg-border/15 shrink-0" />

              {/* Editor */}
              {selectedFile && (
                <ScrollArea className="flex-1">
                  <div className="space-y-5 pr-3">
                    {/* AI Button */}
                    {!selectedFile.isAnalyzed && (
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-primary/25 bg-primary/5 hover:bg-primary/8 hover:border-primary/40 transition-all duration-200 text-left"
                        onClick={() => analyzeFile(selectedFile.file, selectedFileIndex)}
                        disabled={selectedFile.isAnalyzing}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                          {selectedFile.isAnalyzing ? (
                            <div className="relative flex h-5 w-5 items-center justify-center">
                              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                              <div className="absolute inset-0" style={getSpinStyle(0.65)}>
                                <div className="absolute left-1/2 top-[-1px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.55)]" />
                              </div>
                              <RefreshCw className="h-3.5 w-3.5 text-primary" style={getSpinStyle(0.95, 'reverse')} />
                            </div>
                          ) : <Sparkles className="w-4 h-4 text-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{selectedFile.isAnalyzing ? 'Analyzing...' : 'Auto-fill with AI'}</p>
                          <p className="text-[11px] text-muted-foreground">Let AI detect the mod name, description and category</p>
                        </div>
                      </button>
                    )}

                    <Tabs defaultValue="details" className="w-full">
                      <TabsList className="w-full grid grid-cols-3 h-9 bg-card/40 border border-border/15 rounded-lg p-0.5">
                        <TabsTrigger value="details" className="text-xs font-medium gap-1.5 data-[state=active]:bg-background/80 rounded-md">
                          <Info className="w-3 h-3" /> Details
                        </TabsTrigger>
                        <TabsTrigger value="media" className="text-xs font-medium gap-1.5 data-[state=active]:bg-background/80 rounded-md">
                          <Image className="w-3 h-3" /> Media
                        </TabsTrigger>
                        <TabsTrigger value="advanced" className="text-xs font-medium gap-1.5 data-[state=active]:bg-background/80 rounded-md">
                          <Shield className="w-3 h-3" /> Advanced
                        </TabsTrigger>
                      </TabsList>

                      {/* Details Tab */}
                      <TabsContent value="details" className="mt-4 space-y-4">
                        {/* Mod Name */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Mod Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={selectedFile.name}
                            onChange={(e) => updateFileData(selectedFileIndex, { name: e.target.value })}
                            placeholder="e.g., Custom Vehicle Pack"
                            className="h-10 bg-card/30 border-border/20 focus:border-primary/40 rounded-lg text-sm"
                            required
                          />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
                          <Textarea
                            value={selectedFile.description}
                            onChange={(e) => updateFileData(selectedFileIndex, { description: e.target.value })}
                            placeholder="Describe what this mod does, features included, etc."
                            className="bg-card/30 border-border/20 focus:border-primary/40 rounded-lg text-sm min-h-[80px] resize-none"
                            rows={3}
                          />
                        </div>

                        {/* Category & Version */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</Label>
                            <Select value={selectedFile.category_id} onValueChange={(value) => updateFileData(selectedFileIndex, { category_id: value })}>
                              <SelectTrigger className="h-10 bg-card/30 border-border/20 rounded-lg text-sm">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Version</Label>
                            <Input
                              value={selectedFile.version}
                              onChange={(e) => updateFileData(selectedFileIndex, { version: e.target.value })}
                              placeholder="1.0.0"
                              className="h-10 bg-card/30 border-border/20 rounded-lg text-sm"
                            />
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Tag className="w-3 h-3" /> Tags
                          </Label>
                          <Input
                            value={selectedFile.tags}
                            onChange={(e) => updateFileData(selectedFileIndex, { tags: e.target.value })}
                            placeholder="vehicle, police, els, lspd (comma separated)"
                            className="h-10 bg-card/30 border-border/20 focus:border-primary/40 rounded-lg text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground/60">Separate tags with commas to help users find your mod</p>
                        </div>

                        {/* Featured toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-card/30 border border-border/15">
                          <div>
                            <p className="text-sm font-medium text-foreground">Featured</p>
                            <p className="text-[11px] text-muted-foreground">Show in featured carousel on the mods page</p>
                          </div>
                          <Switch checked={selectedFile.is_featured} onCheckedChange={(checked) => updateFileData(selectedFileIndex, { is_featured: checked })} />
                        </div>
                      </TabsContent>

                      {/* Media Tab */}
                      <TabsContent value="media" className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Screenshots <span className="text-muted-foreground/50">({selectedFile.screenshots.length}/4)</span>
                          </Label>
                          <p className="text-[11px] text-muted-foreground/60">Upload up to 4 screenshots to showcase your mod. First screenshot will be used as cover image.</p>
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            {selectedFile.screenshots.map((file, index) => {
                              const isEnhancing = enhancingIndices.has(`${selectedFileIndex}-${index}`);
                              return (
                                <div key={index} className="relative aspect-video rounded-xl overflow-hidden border border-border/20 bg-card/30 group cursor-pointer shadow-sm"
                                  onClick={() => setPreviewImage(URL.createObjectURL(file))}
                                >
                                  <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                  
                                  {isEnhancing && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-10">
                                      <div className="relative flex h-10 w-10 items-center justify-center mb-2">
                                        <div className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                                        <div className="absolute inset-0" style={getSpinStyle(0.7)}>
                                          <div className="absolute left-1/2 top-[-2px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.65)]" />
                                        </div>
                                        <RefreshCw className="h-7 w-7 text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]" style={getSpinStyle(1.05, 'reverse')} />
                                      </div>
                                      <span className="text-[10px] font-bold text-white drop-shadow-md animate-pulse">AI Enhancing...</span>
                                    </div>
                                  )}

                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>

                                  {index === 0 && (
                                    <Badge className="absolute top-1.5 left-1.5 h-5 text-[9px] bg-primary/90 text-primary-foreground border-0 z-20">
                                      Cover
                                    </Badge>
                                  )}

                                  <Button type="button" variant="ghost" size="icon"
                                    className="absolute bottom-1.5 left-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                    onClick={(e) => { e.stopPropagation(); startEnhancement(selectedFileIndex, index); }}
                                    disabled={isEnhancing}
                                  >
                                    <Wand2 className="w-3.5 h-3.5 text-white" />
                                  </Button>

                                  <Button type="button" variant="ghost" size="icon"
                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                    onClick={(e) => { e.stopPropagation(); removeScreenshot(index); }}
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </Button>
                                </div>
                              );
                            })}
                            {selectedFile.screenshots.length < 4 && (
                              <label className="aspect-video border-2 border-dashed border-border/25 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-card/30 hover:border-primary/30 transition-all group">
                                <div className="w-10 h-10 rounded-xl bg-card/50 border border-border/20 flex items-center justify-center mb-2 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                                  <Image className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                                </div>
                                <span className="text-xs text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">Add screenshot</span>
                                <input type="file" className="hidden" onChange={handleScreenshotChange} accept="image/*" />
                              </label>
                            )}
                          </div>
                        </div>
                      </TabsContent>

                      {/* Advanced Tab */}
                      <TabsContent value="advanced" className="mt-4 space-y-4">
                        {/* AI Auto-fill button */}
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-primary/25 bg-primary/5 hover:bg-primary/8 hover:border-primary/40 transition-all duration-200 text-left"
                          onClick={() => analyzeAdvanced(selectedFileIndex)}
                          disabled={isAdvancedAnalyzing}
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                            {isAdvancedAnalyzing ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            ) : <Sparkles className="w-4 h-4 text-primary" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{isAdvancedAnalyzing ? 'Generating...' : 'Auto-fill with AI'}</p>
                            <p className="text-[11px] text-muted-foreground">Let AI generate changelog, requirements, compatibility & notes</p>
                          </div>
                        </button>

                        {/* Changelog */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3 h-3" /> Changelog
                          </Label>
                          <Textarea
                            value={selectedFile.changelog}
                            onChange={(e) => updateFileData(selectedFileIndex, { changelog: e.target.value })}
                            placeholder="- Added new vehicle model&#10;- Fixed texture bugs&#10;- Improved performance"
                            className="bg-card/30 border-border/20 focus:border-primary/40 rounded-lg text-sm min-h-[72px] resize-none font-mono text-xs"
                            rows={3}
                          />
                        </div>

                        {/* Requirements */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Hash className="w-3 h-3" /> Requirements
                          </Label>
                          <Textarea
                            value={selectedFile.requirements}
                            onChange={(e) => updateFileData(selectedFileIndex, { requirements: e.target.value })}
                            placeholder="List any dependencies or required mods, e.g. OpenIV, ScriptHookV"
                            className="bg-card/30 border-border/20 focus:border-primary/40 rounded-lg text-sm min-h-[60px] resize-none"
                            rows={2}
                          />
                        </div>

                        {/* Compatibility */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Globe className="w-3 h-3" /> Compatibility
                          </Label>
                          <Input
                            value={selectedFile.compatibility}
                            onChange={(e) => updateFileData(selectedFileIndex, { compatibility: e.target.value })}
                            placeholder="e.g., FiveM b2802+, ESX 1.9+, QBCore"
                            className="h-10 bg-card/30 border-border/20 focus:border-primary/40 rounded-lg text-sm"
                          />
                        </div>

                        {/* Author Notes */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Info className="w-3 h-3" /> Author Notes
                          </Label>
                          <Textarea
                            value={selectedFile.author_notes}
                            onChange={(e) => updateFileData(selectedFileIndex, { author_notes: e.target.value })}
                            placeholder="Installation instructions, credits, or any additional information"
                            className="bg-card/30 border-border/20 focus:border-primary/40 rounded-lg text-sm min-h-[72px] resize-none"
                            rows={3}
                          />
                        </div>

                        {/* Info box */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <span className="font-medium text-foreground">💡 Tip:</span> Adding detailed requirements and compatibility info helps other server owners know if your mod will work with their setup.
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/15 flex items-center gap-3">
            {isUploading && (
              <>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={cancelUpload}>
                  <Ban className="w-3.5 h-3.5" /> Cancel
                </Button>
                <div className="flex-1 flex items-center gap-3">
                  <Progress value={overallProgress} className="h-1.5 flex-1" />
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">{overallProgress}%</span>
                </div>
              </>
            )}
            {!isUploading && (
              <Button type="submit" className="flex-1 h-11 rounded-xl font-semibold gap-2" disabled={modFiles.length === 0}>
                <Upload className="w-4 h-4" />
                Upload {modFiles.length > 0 ? `${modFiles.length} Mod${modFiles.length > 1 ? 's' : ''}` : 'Mods'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>

      {/* Screenshot Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
            <Button
              type="button" variant="ghost" size="icon"
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-card/80 border border-border/30 hover:bg-destructive hover:text-white shadow-lg"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default ModUploadDialog;
