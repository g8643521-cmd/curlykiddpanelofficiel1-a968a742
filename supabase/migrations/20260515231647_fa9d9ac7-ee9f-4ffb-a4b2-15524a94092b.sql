ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discord_guild_member boolean,
ADD COLUMN IF NOT EXISTS discord_guild_checked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS discord_guild_status text;

CREATE INDEX IF NOT EXISTS idx_profiles_discord_user_id
ON public.profiles (discord_user_id)
WHERE discord_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_discord_guild_member
ON public.profiles (discord_guild_member);
