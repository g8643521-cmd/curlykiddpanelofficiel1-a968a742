import { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { soundEffects } from '@/services/soundEffects';

const SoundToggle = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(soundEffects.isEnabled());
  }, []);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    soundEffects.setEnabled(checked);
    if (checked) {
      soundEffects.playClick();
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${enabled ? 'bg-primary/20' : 'bg-muted'}`}>
            {enabled ? (
              <Volume2 className="w-5 h-5 text-primary" />
            ) : (
              <VolumeX className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <Label htmlFor="sound-toggle" className="text-base font-medium text-foreground cursor-pointer">
              Sound Effects
            </Label>
            <p className="text-sm text-muted-foreground">
              Play sounds for XP gains, badge unlocks, and level ups
            </p>
          </div>
        </div>
        <Switch
          id="sound-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
};

export default SoundToggle;
