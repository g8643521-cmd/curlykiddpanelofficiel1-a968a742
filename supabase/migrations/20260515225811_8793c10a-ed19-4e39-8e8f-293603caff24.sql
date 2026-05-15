ALTER TABLE public.server_favorites
  ADD COLUMN IF NOT EXISTS server_code TEXT;

UPDATE public.server_favorites
SET server_code = COALESCE(server_code, server_id)
WHERE server_code IS NULL;

ALTER TABLE public.cheater_reports
  ADD COLUMN IF NOT EXISTS player_name TEXT,
  ADD COLUMN IF NOT EXISTS player_identifiers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS server_code TEXT,
  ADD COLUMN IF NOT EXISTS server_name TEXT,
  ADD COLUMN IF NOT EXISTS evidence_url TEXT;

UPDATE public.cheater_reports
SET
  player_name = COALESCE(player_name, NULLIF(reported_user, ''), 'Unknown player'),
  evidence_url = COALESCE(evidence_url, evidence),
  player_identifiers = COALESCE(player_identifiers, '{}'::jsonb)
WHERE player_name IS NULL OR evidence_url IS NULL OR player_identifiers IS NULL;

ALTER TABLE public.cheater_reports
  ALTER COLUMN player_identifiers SET DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS "Users can view own reports" ON public.cheater_reports;
DROP POLICY IF EXISTS "Staff and public can view cheater reports" ON public.cheater_reports;
CREATE POLICY "Staff and public can view cheater reports"
ON public.cheater_reports
FOR SELECT
TO authenticated
USING (
  status IN ('confirmed', 'suspected')
  OR auth.uid() = reporter_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Admins and moderators can update cheater reports" ON public.cheater_reports;
CREATE POLICY "Admins and moderators can update cheater reports"
ON public.cheater_reports
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Admins and moderators can delete cheater reports" ON public.cheater_reports;
CREATE POLICY "Admins and moderators can delete cheater reports"
ON public.cheater_reports
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.get_cheater_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', count(*)::int,
    'confirmed', count(*) FILTER (WHERE status = 'confirmed')::int,
    'suspected', count(*) FILTER (WHERE status = 'suspected')::int
  )
  FROM public.cheater_reports
  WHERE status IN ('confirmed', 'suspected');
$$;