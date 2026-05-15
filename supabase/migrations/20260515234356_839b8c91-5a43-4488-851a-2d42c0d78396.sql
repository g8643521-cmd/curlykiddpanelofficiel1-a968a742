GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT INSERT ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

GRANT SELECT (
  id,
  user_id,
  display_name,
  avatar_url,
  bio,
  email,
  discord_user_id,
  discord_username,
  discord_avatar,
  banner_url,
  discord_guild_member,
  discord_guild_status,
  discord_guild_checked_at,
  theme,
  badges,
  level,
  xp,
  role,
  status,
  flagged_at,
  flagged_reason,
  suspended_at,
  suspended_reason,
  risk_score,
  created_at,
  updated_at
) ON public.profiles TO authenticated;

GRANT INSERT (
  user_id,
  display_name,
  avatar_url,
  bio,
  email,
  discord_user_id,
  discord_username,
  discord_avatar,
  banner_url,
  discord_guild_member,
  discord_guild_status,
  discord_guild_checked_at,
  theme,
  badges,
  level,
  xp
) ON public.profiles TO authenticated;

GRANT UPDATE (
  display_name,
  avatar_url,
  bio,
  email,
  discord_user_id,
  discord_username,
  discord_avatar,
  banner_url,
  discord_guild_member,
  discord_guild_status,
  discord_guild_checked_at,
  theme,
  badges,
  level,
  xp,
  updated_at
) ON public.profiles TO authenticated;

GRANT SELECT (
  id,
  user_id,
  display_name,
  avatar_url,
  bio,
  discord_user_id,
  discord_username,
  discord_avatar,
  banner_url,
  discord_guild_member,
  discord_guild_status,
  discord_guild_checked_at,
  theme,
  badges,
  level,
  xp,
  role,
  status,
  created_at,
  updated_at
) ON public.profiles TO anon;