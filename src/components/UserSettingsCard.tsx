import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Bell, BellOff, Eye, EyeOff, Settings, Moon, Sun, Zap, ZapOff, Palette } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { soundEffects } from '@/services/soundEffects';
import { useGamificationStore } from '@/services/gamificationService';
import { toast } from 'sonner';

const UserSettingsCard = () => {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  
  const { notificationsEnabled: xpNotificationsEnabled, setNotificationsEnabled: setXpNotificationsEnabled } = useGamificationStore();
  const [xpNotifications, setXpNotifications] = useState(xpNotificationsEnabled);

  useEffect(() => {
    setSoundEnabled(soundEffects.isEnabled());
    setNotificationsEnabled(localStorage.getItem('browserNotifications') === 'true');
    setPrivateProfile(localStorage.getItem('privateProfile') === 'true');
    setReducedMotion(localStorage.getItem('reducedMotion') === 'true');
    setXpNotifications(xpNotificationsEnabled);
  }, [xpNotificationsEnabled]);

  const handleSoundToggle = (checked: boolean) => {
    setSoundEnabled(checked);
    soundEffects.setEnabled(checked);
    if (checked) {
      soundEffects.playClick();
    }
  };

  const handleNotificationsToggle = async (checked: boolean) => {
    if (checked) {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        toast.error("Your browser doesn't support notifications");
        return;
      }
      
      // If permission was denied, user must enable in browser settings
      if (Notification.permission === 'denied') {
        toast.error("Notifications blocked. Please enable in your browser settings.");
        return;
      }
      
      // Request permission if not yet granted
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return;
        }
      }
      
      setNotificationsEnabled(true);
      localStorage.setItem('browserNotifications', 'true');
      toast.success("Notifications enabled!");
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('browserNotifications', 'false');
    }
  };

  const handlePrivateProfileToggle = (checked: boolean) => {
    setPrivateProfile(checked);
    localStorage.setItem('privateProfile', checked.toString());
  };

  const handleReducedMotionToggle = (checked: boolean) => {
    setReducedMotion(checked);
    localStorage.setItem('reducedMotion', checked.toString());
  };

  const handleXpNotificationsToggle = (checked: boolean) => {
    setXpNotifications(checked);
    setXpNotificationsEnabled(checked);
  };

  const settingsGroups = [
    {
      title: 'Audio & Notifications',
      icon: Settings,
      settings: [
        {
          id: 'sound',
          label: 'Sound Effects',
          description: 'Play sounds for XP gains, badge unlocks, and level ups',
          icon: soundEnabled ? Volume2 : VolumeX,
          iconColor: soundEnabled ? 'text-primary' : 'text-muted-foreground',
          bgColor: soundEnabled ? 'bg-primary/20' : 'bg-muted',
          checked: soundEnabled,
          onChange: handleSoundToggle,
        },
        {
          id: 'xpNotifications',
          label: 'XP Notifications',
          description: 'Show on-screen popups when earning XP or badges',
          icon: xpNotifications ? Zap : ZapOff,
          iconColor: xpNotifications ? 'text-[hsl(var(--yellow))]' : 'text-muted-foreground',
          bgColor: xpNotifications ? 'bg-[hsl(var(--yellow))]/20' : 'bg-muted',
          checked: xpNotifications,
          onChange: handleXpNotificationsToggle,
        },
      ],
    },
    {
      title: 'Browser Notifications',
      icon: Bell,
      settings: [
        {
          id: 'notifications',
          label: 'Browser Notifications',
          description: 'Receive alerts for server status changes',
          icon: notificationsEnabled ? Bell : BellOff,
          iconColor: notificationsEnabled ? 'text-[hsl(var(--cyan))]' : 'text-muted-foreground',
          bgColor: notificationsEnabled ? 'bg-[hsl(var(--cyan))]/20' : 'bg-muted',
          checked: notificationsEnabled,
          onChange: handleNotificationsToggle,
        },
      ],
    },
    {
      title: 'Privacy',
      icon: Eye,
      settings: [
        {
          id: 'private',
          label: 'Private Profile',
          description: 'Hide your profile from the public leaderboard',
          icon: privateProfile ? EyeOff : Eye,
          iconColor: privateProfile ? 'text-[hsl(var(--yellow))]' : 'text-muted-foreground',
          bgColor: privateProfile ? 'bg-[hsl(var(--yellow))]/20' : 'bg-muted',
          checked: privateProfile,
          onChange: handlePrivateProfileToggle,
        },
      ],
    },
    {
      title: 'Accessibility',
      icon: Palette,
      settings: [
        {
          id: 'reducedMotion',
          label: 'Reduced Motion',
          description: 'Minimize animations and transitions',
          icon: reducedMotion ? Moon : Sun,
          iconColor: reducedMotion ? 'text-[hsl(var(--magenta))]' : 'text-muted-foreground',
          bgColor: reducedMotion ? 'bg-[hsl(var(--magenta))]/20' : 'bg-muted',
          checked: reducedMotion,
          onChange: handleReducedMotionToggle,
        },
      ],
    },
  ];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/20">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">Settings</h3>
      </div>

      <div className="space-y-6">
        {settingsGroups.map((group, groupIndex) => (
          <div key={group.title}>
            {groupIndex > 0 && <Separator className="mb-6" />}
            <div className="space-y-4">
              {group.settings.map((setting) => {
                const Icon = setting.icon;
                return (
                  <div key={setting.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${setting.bgColor}`}>
                        <Icon className={`w-5 h-5 ${setting.iconColor}`} />
                      </div>
                      <div>
                        <Label htmlFor={setting.id} className="text-base font-medium text-foreground cursor-pointer">
                          {setting.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={setting.id}
                      checked={setting.checked}
                      onCheckedChange={setting.onChange}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserSettingsCard;
