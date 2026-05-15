export const getDiscordAvatarUrl = (
  discordUserId?: string | null,
  discordAvatar?: string | null,
  size = 128,
) => {
  if (!discordAvatar) return null;
  if (/^https?:\/\//i.test(discordAvatar)) return discordAvatar;
  if (!discordUserId) return null;
  const ext = discordAvatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${discordAvatar}.${ext}?size=${size}`;
};

export const getProfileAvatarUrl = (
  profile?: {
    avatar_url?: string | null;
    discord_user_id?: string | null;
    discord_avatar?: string | null;
  } | null,
) => {
  if (!profile) return null;
  return (
    profile.avatar_url ||
    getDiscordAvatarUrl(profile.discord_user_id, profile.discord_avatar) ||
    null
  );
};