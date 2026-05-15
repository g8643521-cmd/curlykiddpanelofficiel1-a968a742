import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { soundEffects } from '@/services/soundEffects';

interface XPNotification {
  id: string;
  amount: number;
  reason: string;
  timestamp: number;
}

interface BadgeNotification {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  xpReward: number;
  timestamp: number;
}

interface ChallengeNotification {
  id: string;
  name: string;
  xpReward: number;
  timestamp: number;
}

interface GamificationStore {
  xpNotifications: XPNotification[];
  badgeNotifications: BadgeNotification[];
  challengeNotifications: ChallengeNotification[];
  notificationsEnabled: boolean;
  addXPNotification: (amount: number, reason: string) => void;
  addBadgeNotification: (badge: Omit<BadgeNotification, 'id' | 'timestamp'>) => void;
  addChallengeNotification: (challenge: Omit<ChallengeNotification, 'id' | 'timestamp'>) => void;
  removeXPNotification: (id: string) => void;
  removeBadgeNotification: (id: string) => void;
  removeChallengeNotification: (id: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

// Batch notification removals to reduce state updates
const batchedRemovals = new Map<string, NodeJS.Timeout>();

// Helper to get XP notifications enabled state from localStorage
const getNotificationsEnabled = (): boolean => {
  const stored = localStorage.getItem('xp_notifications_enabled');
  // Default to false (OFF)
  return stored === 'true';
};

export const useGamificationStore = create<GamificationStore>((set, get) => ({
  xpNotifications: [],
  badgeNotifications: [],
  challengeNotifications: [],
  notificationsEnabled: getNotificationsEnabled(),
  setNotificationsEnabled: (enabled: boolean) => {
    localStorage.setItem('xp_notifications_enabled', String(enabled));
    set({ notificationsEnabled: enabled });
  },
  addXPNotification: (amount, reason) => {
    // Check if notifications are enabled
    if (!get().notificationsEnabled) {
      // Still play sound if sound is enabled, but don't show notification
      soundEffects.playXPGain();
      return;
    }
    const notification: XPNotification = {
      id: `xp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      amount,
      reason,
      timestamp: Date.now(),
    };
    set((state) => ({
      xpNotifications: [...state.xpNotifications, notification],
    }));
    // Play sound (debounced internally)
    soundEffects.playXPGain();
    // Auto-remove after 3 seconds
    batchedRemovals.set(notification.id, setTimeout(() => {
      set((state) => ({
        xpNotifications: state.xpNotifications.filter((n) => n.id !== notification.id),
      }));
      batchedRemovals.delete(notification.id);
    }, 3000));
  },
  addBadgeNotification: (badge) => {
    // Check if notifications are enabled
    if (!get().notificationsEnabled) {
      soundEffects.playBadgeUnlock();
      return;
    }
    const notification: BadgeNotification = {
      ...badge,
      id: `badge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      badgeNotifications: [...state.badgeNotifications, notification],
    }));
    // Play sound
    soundEffects.playBadgeUnlock();
    // Auto-remove after 4 seconds
    batchedRemovals.set(notification.id, setTimeout(() => {
      set((state) => ({
        badgeNotifications: state.badgeNotifications.filter((n) => n.id !== notification.id),
      }));
      batchedRemovals.delete(notification.id);
    }, 4000));
  },
  addChallengeNotification: (challenge) => {
    // Check if notifications are enabled
    if (!get().notificationsEnabled) {
      soundEffects.playChallengeComplete();
      return;
    }
    const notification: ChallengeNotification = {
      ...challenge,
      id: `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      challengeNotifications: [...state.challengeNotifications, notification],
    }));
    // Play sound
    soundEffects.playChallengeComplete();
    // Auto-remove after 4 seconds
    batchedRemovals.set(notification.id, setTimeout(() => {
      set((state) => ({
        challengeNotifications: state.challengeNotifications.filter((n) => n.id !== notification.id),
      }));
      batchedRemovals.delete(notification.id);
    }, 4000));
  },
  removeXPNotification: (id) =>
    set((state) => ({
      xpNotifications: state.xpNotifications.filter((n) => n.id !== id),
    })),
  removeBadgeNotification: (id) =>
    set((state) => ({
      badgeNotifications: state.badgeNotifications.filter((n) => n.id !== id),
    })),
  removeChallengeNotification: (id) =>
    set((state) => ({
      challengeNotifications: state.challengeNotifications.filter((n) => n.id !== id),
    })),
}));

// XP values for actions
const XP_VALUES = {
  search: 5,
  favorite: 10,
  export: 15,
  track_server: 8,
};

// Get XP required for level
export const getXpForLevel = (level: number) => Math.floor(100 * Math.pow(1.5, level - 1));

export class GamificationService {
  private static async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  private static async getProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  }

  private static async getBadges() {
    const { data } = await supabase.from('badges').select('*');
    return data || [];
  }

  private static async getUserBadges(userId: string) {
    const { data } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);
    return data?.map((b) => b.badge_id) || [];
  }

  static async addXP(amount: number, reason: string): Promise<{ leveledUp: boolean; newLevel: number } | null> {
    const session = await this.getSession();
    if (!session) return null;

    // Server-side award to prevent client tampering
    // @ts-ignore - rpc function not in generated types yet
    const { data, error } = await supabase.rpc('award_xp' as any, {
      _amount: amount,
      _reason: reason,
    });

    if (error || !data || !data[0]) {
      console.error('Failed to award XP:', error);
      return null;
    }

    const result = data[0] as { new_xp: number; new_level: number; leveled_up: boolean };

    // Show notification
    useGamificationStore.getState().addXPNotification(amount, reason);

    // Play level up sound if leveled up
    if (result.leveled_up) {
      setTimeout(() => soundEffects.playLevelUp(), 500);
    }

    // Check for Legend badge at level 10
    if (result.new_level >= 10) {
      await this.checkAndAwardBadge('Legend');
    }

    return { leveledUp: result.leveled_up, newLevel: result.new_level };
  }

  static async checkAndAwardBadge(badgeName: string): Promise<boolean> {
    const session = await this.getSession();
    if (!session) return false;

    const badges = await this.getBadges();
    const badge = badges.find((b) => b.name === badgeName);
    if (!badge) return false;

    const userBadges = await this.getUserBadges(session.user.id);
    if (userBadges.includes(badge.id)) return false;

    const { error } = await supabase.from('user_badges').insert({
      user_id: session.user.id,
      badge_id: badge.id,
    });

    if (error) return false;

    // Show badge notification (this also plays the sound)
    useGamificationStore.getState().addBadgeNotification({
      name: badge.name,
      icon: badge.icon,
      rarity: badge.rarity,
      xpReward: badge.xp_required,
    });

    // Add XP reward for badge (with slight delay so notifications don't overlap)
    setTimeout(() => {
      this.addXP(badge.xp_required, `Badge: ${badge.name}`);
    }, 500);

    return true;
  }

  static async updateChallengeProgress(actionType: string): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Get challenges matching this action type
    const { data: challenges } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('challenge_type', actionType)
      .eq('is_active', true);

    if (!challenges) return;

    for (const challenge of challenges) {
      // Check existing progress
      const { data: existingProgress } = await supabase
        .from('user_daily_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('challenge_id', challenge.id)
        .gte('created_at', today)
        .single();

      if (existingProgress) {
        // Already completed
        if (existingProgress.completed) continue;

        // Update progress
        const newProgress = existingProgress.progress + 1;
        const completed = newProgress >= challenge.target_count;

        await supabase
          .from('user_daily_progress')
          .update({ 
            progress: newProgress, 
            completed,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgress.id);

        // Award XP if completed
        if (completed) {
          useGamificationStore.getState().addChallengeNotification({
            name: challenge.title,
            xpReward: challenge.xp_reward,
          });
          setTimeout(() => {
            this.addXP(challenge.xp_reward, `Challenge: ${challenge.title}`);
          }, 500);
        }
      } else {
        // Create new progress entry
        const progress = 1;
        const completed = progress >= challenge.target_count;

        await supabase.from('user_daily_progress').insert({
          user_id: session.user.id,
          challenge_id: challenge.id,
          progress,
          completed,
          challenge_date: today,
        });

        // Award XP if completed on first action
        if (completed) {
          useGamificationStore.getState().addChallengeNotification({
            name: challenge.title,
            xpReward: challenge.xp_reward,
          });
          setTimeout(() => {
            this.addXP(challenge.xp_reward, `Challenge: ${challenge.title}`);
          }, 500);
        }
      }
    }
  }

  static async onSearch(): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    // Server-side increment to prevent tampering
    // @ts-ignore - rpc function not in generated types yet
    const { data: newCount, error } = await supabase.rpc('increment_total_searches' as any);
    if (error || typeof newCount !== 'number') {
      console.error('Failed to increment total_searches:', error);
      return;
    }

    // Award XP
    await this.addXP(XP_VALUES.search, 'Server Search');

    // Update daily challenge progress
    await this.updateChallengeProgress('search');

    // Check search badges
    if (newCount >= 1) await this.checkAndAwardBadge('First Search');
    if (newCount >= 10) await this.checkAndAwardBadge('Explorer');
    if (newCount >= 50) await this.checkAndAwardBadge('Detective');
    if (newCount >= 100) await this.checkAndAwardBadge('Server Hunter');

    // Check time-based badges
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) await this.checkAndAwardBadge('Night Owl');
    if (hour >= 5 && hour < 7) await this.checkAndAwardBadge('Early Bird');
  }

  static async onFavorite(): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    // Server-side increment to prevent tampering
    // @ts-ignore - rpc function not in generated types yet
    const { data: newCount, error } = await supabase.rpc('increment_servers_tracked' as any);
    if (error || typeof newCount !== 'number') {
      console.error('Failed to increment servers_tracked:', error);
      return;
    }

    // Award XP
    await this.addXP(XP_VALUES.favorite, 'Added Favorite');

    // Update daily challenge progress
    await this.updateChallengeProgress('favorite');

    // Check badge
    await this.checkAndAwardBadge('Tracker');
  }

  static async onExport(): Promise<void> {
    await this.addXP(XP_VALUES.export, 'Player Export');
    await this.updateChallengeProgress('export');
    await this.checkAndAwardBadge('Data Analyst');
  }

  static async checkVeteranBadge(): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    const profile = await this.getProfile(session.user.id);
    if (!profile?.created_at) return;

    const daysSinceSignup = Math.floor(
      (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceSignup >= 30) {
      await this.checkAndAwardBadge('Veteran');
    }
  }
}
