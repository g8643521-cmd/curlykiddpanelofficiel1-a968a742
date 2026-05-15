import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Image } from 'lucide-react';

interface ModelViewer3DProps {
  isOpen: boolean;
  onClose: () => void;
  modName: string;
  modelUrl?: string;
  fallbackImage?: string;
}

const ModelViewer3D = ({ isOpen, onClose, modName, modelUrl: _modelUrl, fallbackImage }: ModelViewer3DProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl bg-card/95 backdrop-blur-xl border-border/30 p-0 overflow-hidden">
        <div className="flex flex-col">
          <div className="border-b border-border/20 px-5 py-3">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                <Image className="h-4 w-4 text-primary" />
                Preview — {modName}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground/60">
                {fallbackImage
                  ? 'Billedpreview af modulet.'
                  : 'Der er ikke uploadet et preview-billede til dette mod endnu.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="bg-gradient-to-b from-background to-card p-4 sm:p-6">
            {fallbackImage ? (
              <div className="flex items-center justify-center rounded-xl border border-border/20 bg-background/40 p-2">
                <img
                  src={fallbackImage}
                  alt={`Preview af ${modName}`}
                  className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/30 bg-background/30 p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
                  <Image className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Intet preview-billede tilgængeligt endnu.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModelViewer3D;
