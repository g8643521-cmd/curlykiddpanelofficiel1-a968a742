// @ts-nocheck
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, BarChart3, Award, TrendingUp, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PrivacySettings {
  show_email: boolean;
  show_stats: boolean;
  show_badges: boolean;
  show_level: boolean;
  show_activity: boolean;
}

const ProfilePrivacySettings = () => {
  const [settings, setSettings] = useState<PrivacySettings>({
    show_email: false,
    show_stats: true,
    show_badges: true,
    show_level: true,
    show_activity: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('show_email, show_stats, show_badges, show_level, show_activity')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        if (data) {
          setSettings({
            show_email: data.show_email ?? false,
            show_stats: data.show_stats ?? true,
            show_badges: data.show_badges ?? true,
            show_level: data.show_level ?? true,
            show_activity: data.show_activity ?? true,
          });
        }
      } catch (error) {
        console.error('Error fetching privacy settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const updateSetting = async (key: keyof PrivacySettings, value: boolean) => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('profiles')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Privacy setting updated');
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      toast.error('Failed to update setting');
    } finally {
      setIsSaving(false);
    }
  };

  const privacyOptions = [
    {
      key: 'show_email' as const,
      label: 'Show Email',
      description: 'Display your email on your public profile',
      icon: Mail,
    },
    {
      key: 'show_stats' as const,
      label: 'Show Statistics',
      description: 'Display search count and tracked servers',
      icon: BarChart3,
    },
    {
      key: 'show_badges' as const,
      label: 'Show Badges',
      description: 'Display earned badges on your profile',
      icon: Award,
    },
    {
      key: 'show_level' as const,
      label: 'Show Level & XP',
      description: 'Display your level and experience progress',
      icon: TrendingUp,
    },
    {
      key: 'show_activity' as const,
      label: 'Show Activity Feed',
      description: 'Display recent activity on your public profile',
      icon: Clock,
    },
  ];

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2 mb-6">
        <Lock className="w-5 h-5 text-primary" />
        Privacy Settings
      </h3>

      <div className="space-y-4">
        {privacyOptions.map((option) => (
          <div
            key={option.key}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                settings[option.key] ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <option.icon className="w-4 h-4" />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground cursor-pointer">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settings[option.key] ? (
                <Eye className="w-4 h-4 text-[hsl(var(--green))]" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              <Switch
                checked={settings[option.key]}
                onCheckedChange={(checked) => updateSetting(option.key, checked)}
                disabled={isSaving}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        These settings control what others can see on your public profile
      </p>
    </motion.div>
  );
};

export default ProfilePrivacySettings;