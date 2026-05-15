// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Palette, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Theme {
  id: string;
  name: string;
  description: string;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  premium?: boolean;
}

const THEMES: Theme[] = [
  {
    id: 'default',
    name: 'Standard',
    description: 'Det klassiske look',
    preview: {
      primary: 'from-cyan-500 to-blue-500',
      secondary: 'from-gray-700 to-gray-800',
      accent: 'cyan-500',
      background: 'from-gray-900 to-gray-950'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange and red tones',
    preview: {
      primary: 'from-orange-500 to-red-500',
      secondary: 'from-orange-900/30 to-red-900/30',
      accent: 'orange-500',
      background: 'from-orange-950 to-red-950'
    }
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Natural green shades',
    preview: {
      primary: 'from-green-500 to-emerald-500',
      secondary: 'from-green-900/30 to-emerald-900/30',
      accent: 'green-500',
      background: 'from-green-950 to-emerald-950'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep blue ocean colors',
    preview: {
      primary: 'from-blue-500 to-indigo-500',
      secondary: 'from-blue-900/30 to-indigo-900/30',
      accent: 'blue-500',
      background: 'from-blue-950 to-indigo-950'
    }
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Soft purple tones',
    preview: {
      primary: 'from-purple-500 to-pink-500',
      secondary: 'from-purple-900/30 to-pink-900/30',
      accent: 'purple-500',
      background: 'from-purple-950 to-pink-950'
    }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep dark aesthetic',
    preview: {
      primary: 'from-slate-500 to-zinc-500',
      secondary: 'from-slate-900/30 to-zinc-900/30',
      accent: 'slate-500',
      background: 'from-slate-950 to-zinc-950'
    }
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Nordlysets magiske farver',
    preview: {
      primary: 'from-teal-400 via-purple-500 to-pink-500',
      secondary: 'from-teal-900/30 to-pink-900/30',
      accent: 'teal-500',
      background: 'from-slate-900 via-purple-950 to-slate-900'
    },
    premium: true
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Lysende cyberpunk vibes',
    preview: {
      primary: 'from-fuchsia-500 to-cyan-500',
      secondary: 'from-fuchsia-900/30 to-cyan-900/30',
      accent: 'fuchsia-500',
      background: 'from-gray-950 to-black'
    },
    premium: true
  }
];

export const ProfileThemes = () => {
  const [currentTheme, setCurrentTheme] = useState('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('profile_theme')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        if (data?.profile_theme) {
          setCurrentTheme(data.profile_theme);
        }
      } catch (error) {
        console.error('Error fetching theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTheme();
  }, []);

  const selectTheme = async (themeId: string) => {
    if (isSaving) return;

    const theme = THEMES.find(t => t.id === themeId);
    if (theme?.premium) {
      toast.info('Premium tema - kommer snart!');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ profile_theme: themeId })
        .eq('id', session.user.id);

      if (error) throw error;

      setCurrentTheme(themeId);
      toast.success(`Theme changed to ${theme?.name}`);
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error('Could not save theme');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5 text-primary" />
            Profil Temaer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="h-5 w-5 text-primary" />
          Profil Temaer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => selectTheme(theme.id)}
              disabled={isSaving}
              className={cn(
                "relative group rounded-lg overflow-hidden border-2 transition-all duration-200",
                currentTheme === theme.id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border/50 hover:border-primary/50"
              )}
            >
              {/* Theme Preview */}
              <div className={cn(
                "h-20 bg-gradient-to-br",
                theme.preview.background
              )}>
                <div className="h-full flex items-center justify-center">
                  <div className={cn(
                    "w-12 h-6 rounded-full bg-gradient-to-r",
                    theme.preview.primary
                  )} />
                </div>
              </div>

              {/* Theme Info */}
              <div className="p-2 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{theme.name}</span>
                  {currentTheme === theme.id && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {theme.description}
                </p>
              </div>

              {/* Premium Badge */}
              {theme.premium && (
                <Badge 
                  className="absolute top-1 right-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px] px-1.5 py-0"
                >
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  PRO
                </Badge>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
