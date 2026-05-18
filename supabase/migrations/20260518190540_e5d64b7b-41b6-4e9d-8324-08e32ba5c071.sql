
-- Public lookup of bot-detected cheaters by Discord ID
CREATE OR REPLACE FUNCTION public.public_lookup_bot_cheater(_discord_id text)
RETURNS TABLE(
  discord_user_id text,
  discord_username text,
  discord_avatar text,
  guild_id text,
  guild_name text,
  total_bans int,
  total_tickets int,
  is_flagged boolean,
  summary_text text,
  detected_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.discord_user_id,
    b.discord_username,
    b.discord_avatar,
    b.guild_id,
    b.guild_name,
    COALESCE(b.total_bans, 0),
    COALESCE(b.total_tickets, 0),
    COALESCE(b.is_flagged, false),
    b.summary_text,
    b.detected_at
  FROM public.bot_detected_cheaters b
  WHERE b.discord_user_id = _discord_id
  ORDER BY b.detected_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.public_lookup_bot_cheater(text) TO anon, authenticated;

-- Update stats to also count bot-detected cheaters
CREATE OR REPLACE FUNCTION public.get_cheater_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH r AS (
    SELECT
      count(*)::int AS total_r,
      count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_r,
      count(*) FILTER (WHERE status = 'suspected')::int AS suspected_r
    FROM public.cheater_reports
    WHERE status IN ('confirmed', 'suspected')
  ),
  b AS (
    SELECT
      count(DISTINCT discord_user_id)::int AS total_b,
      count(DISTINCT discord_user_id) FILTER (WHERE is_flagged = true OR COALESCE(total_bans, 0) > 0)::int AS flagged_b
    FROM public.bot_detected_cheaters
    WHERE discord_user_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total', (SELECT total_r FROM r) + (SELECT total_b FROM b),
    'confirmed', (SELECT confirmed_r FROM r) + (SELECT flagged_b FROM b),
    'suspected', (SELECT suspected_r FROM r) + ((SELECT total_b FROM b) - (SELECT flagged_b FROM b))
  );
$$;
