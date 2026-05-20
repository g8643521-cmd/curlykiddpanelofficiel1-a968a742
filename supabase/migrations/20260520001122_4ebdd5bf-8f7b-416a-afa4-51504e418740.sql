CREATE OR REPLACE FUNCTION public.get_login_social_proof()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'avatars', COALESCE((
      SELECT jsonb_agg(a) FROM (
        SELECT COALESCE(p.avatar_url, p.discord_avatar) AS a
        FROM public.profiles p
        WHERE COALESCE(p.avatar_url, p.discord_avatar) IS NOT NULL
          AND COALESCE(p.status, 'active') = 'active'
        ORDER BY p.created_at DESC
        LIMIT 5
      ) s
    ), '[]'::jsonb),
    'joined_this_week', (
      SELECT COUNT(*)::int
      FROM public.profiles
      WHERE created_at > now() - interval '7 days'
        AND COALESCE(status, 'active') = 'active'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_login_social_proof() TO anon, authenticated;