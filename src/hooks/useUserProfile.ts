import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  xp_required: number;
  earned_at?: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  theme: string | null;
  level: number;
  xp: number;
  total_searches: number;
  servers_tracked: number;
  created_at: string | null;
}

// XP required for each level (exponential growth)
export const getXpForLevel = (level: number) => Math.floor(100 * Math.pow(1.5, level - 1));
export const getTotalXpForLevel = (level: number) => {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXpForLevel(i);
  }
  return total;
};

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    setProfile(profileData as UserProfile);
  }, []);

  const fetchBadges = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch all badges
    const { data: allBadges } = await supabase
      .from('badges')
      .select('*')
      .order('rarity', { ascending: true });

    if (allBadges) {
      setBadges(allBadges as Badge[]);
    }

    // Fetch user's earned badges
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select(`
        earned_at,
        badge_id,
        badges (*)
      `)
      .eq('user_id', session.user.id);

    if (userBadges) {
      const earned = userBadges.map((ub: any) => ({
        ...ub.badges,
        earned_at: ub.earned_at,
      }));
      setEarnedBadges(earned);
    }
  }, []);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
        .eq('id', session.user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        return null;
      }

      await fetchProfile();
      return publicUrl;
    } finally {
      setIsUploading(false);
    }
  };

  const updateDisplayName = async (name: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name })
      .eq('id', session.user.id);

    if (error) {
      console.error('Error updating display name:', error);
      return false;
    }

    await fetchProfile();
    return true;
  };

  const addXp = async (amount: number): Promise<{ leveledUp: boolean; newLevel: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile) return { leveledUp: false, newLevel: profile?.level || 1 };

    // @ts-ignore - rpc function not in generated types yet
    const { data, error } = await supabase.rpc('award_xp' as any, {
      _amount: amount,
      _reason: 'Badge: Award',
    });

    if (error || !data || !data[0]) {
      console.error('Error adding XP:', error);
      return { leveledUp: false, newLevel: profile.level };
    }

    await fetchProfile();
    const result = data[0] as { new_level: number; leveled_up: boolean };
    return { leveledUp: result.leveled_up, newLevel: result.new_level };
  };


  const awardBadge = async (badgeName: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    // Find badge by name
    const badge = badges.find(b => b.name === badgeName);
    if (!badge) return false;

    // Check if already earned
    if (earnedBadges.some(b => b.id === badge.id)) return false;

    const { error } = await supabase
      .from('user_badges')
      .insert({
        user_id: session.user.id,
        badge_id: badge.id,
      });

    if (error) {
      console.error('Error awarding badge:', error);
      return false;
    }

    // Add XP reward
    await addXp(badge.xp_required);
    await fetchBadges();
    return true;
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchProfile(), fetchBadges()]);
      setIsLoading(false);
    };
    init();
  }, [fetchProfile, fetchBadges]);

  return {
    profile,
    badges,
    earnedBadges,
    isLoading,
    isUploading,
    uploadAvatar,
    updateDisplayName,
    addXp,
    awardBadge,
    refetch: () => Promise.all([fetchProfile(), fetchBadges()]),
  };
};
