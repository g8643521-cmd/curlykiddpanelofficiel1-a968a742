import { supabase } from '@/lib/supabase';

export const syncCurrentUserProfile = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const user = session.user;
  const metadata = user.user_metadata ?? {};
  const displayName = metadata.display_name || metadata.full_name || metadata.name || metadata.user_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = metadata.avatar_url || metadata.picture || null;
  const providerId = metadata.provider_id || metadata.sub || null;
  const provider = user.app_metadata?.provider;

  const patch: Record<string, string | null> = {
    email: user.email ?? null,
    display_name: displayName,
  };

  if (avatarUrl) patch.avatar_url = avatarUrl;
  if (provider === 'discord' && providerId) {
    patch.discord_user_id = String(providerId);
    patch.discord_username = metadata.user_name || metadata.preferred_username || displayName;
    if (avatarUrl) patch.discord_avatar = avatarUrl;
  }

  await supabase.from('profiles').upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });
  return patch;
};