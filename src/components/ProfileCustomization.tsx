import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, MessageCircle, Smile, Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProfileCustomizationProps {
  profileId: string;
  currentAccentColor: string;
  currentBackgroundPattern: string | null;
  currentStatusMessage: string | null;
  currentStatusEmoji: string | null;
  onUpdate: () => void;
}

const accentColors = [
  { id: 'cyan', label: 'Cyan', color: 'hsl(var(--cyan))' },
  { id: 'magenta', label: 'Magenta', color: 'hsl(var(--magenta))' },
  { id: 'yellow', label: 'Gold', color: 'hsl(var(--yellow))' },
  { id: 'green', label: 'Green', color: 'hsl(var(--green))' },
  { id: 'purple', label: 'Purple', color: 'hsl(var(--purple))' },
  { id: 'primary', label: 'Primary', color: 'hsl(var(--primary))' },
];

const backgroundPatterns = [
  { id: 'none', label: 'None' },
  { id: 'dots', label: 'Dots' },
  { id: 'grid', label: 'Grid' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'waves', label: 'Waves' },
  { id: 'circuit', label: 'Circuit' },
];

const statusEmojis = ['🟢', '🔴', '🟡', '🌙', '⚡', '🎮', '💻', '🎵', '📚', '🚀', '💬', '👋'];

const ProfileCustomization = ({
  profileId,
  currentAccentColor,
  currentBackgroundPattern,
  currentStatusMessage,
  currentStatusEmoji,
  onUpdate,
}: ProfileCustomizationProps) => {
  const [accentColor, setAccentColor] = useState(currentAccentColor || 'cyan');
  const [backgroundPattern, setBackgroundPattern] = useState(currentBackgroundPattern || 'none');
  const [statusMessage, setStatusMessage] = useState(currentStatusMessage || '');
  const [statusEmoji, setStatusEmoji] = useState(currentStatusEmoji || '🟢');
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          accent_color: accentColor,
          background_pattern: backgroundPattern,
          status_message: statusMessage || null,
          status_emoji: statusEmoji,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);

      if (error) throw error;

      toast.success('Profile customization saved!');
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving customization:', error);
      toast.error('Failed to save customization');
    } finally {
      setIsSaving(false);
    }
  };

  const copyProfileLink = () => {
    const url = `${window.location.origin}/user/${profileId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Profile link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const openPublicProfile = () => {
    window.open(`/user/${profileId}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Palette className="w-4 h-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Customize Profile
          </DialogTitle>
          <DialogDescription>
            Personalize your profile with colors and status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Accent Color */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Accent Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {accentColors.map((color) => (
                <motion.button
                  key={color.id}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setAccentColor(color.id)}
                  className={cn(
                    'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all',
                    accentColor === color.id 
                      ? 'border-foreground scale-110' 
                      : 'border-transparent hover:border-muted-foreground/50'
                  )}
                  style={{ backgroundColor: color.color }}
                >
                  {accentColor === color.id && (
                    <Check className="w-5 h-5 text-background" />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Background Pattern */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Background Pattern
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {backgroundPatterns.map((pattern) => (
                <motion.button
                  key={pattern.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setBackgroundPattern(pattern.id)}
                  className={cn(
                    'h-12 rounded-lg border flex items-center justify-center text-xs font-medium transition-all',
                    backgroundPattern === pattern.id 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50 bg-muted/30'
                  )}
                >
                  {pattern.label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Status Emoji */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Smile className="w-4 h-4" />
              Status Emoji
            </Label>
            <div className="flex flex-wrap gap-2">
              {statusEmojis.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStatusEmoji(emoji)}
                  className={cn(
                    'w-9 h-9 rounded-lg border flex items-center justify-center text-lg transition-all',
                    statusEmoji === emoji 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Status Message */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Status Message
            </Label>
            <Input
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={100}
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground text-right">
              {statusMessage.length}/100
            </p>
          </div>

          {/* Public Profile Link */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Public Profile</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyProfileLink}
                className="flex-1 gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openPublicProfile}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileCustomization;