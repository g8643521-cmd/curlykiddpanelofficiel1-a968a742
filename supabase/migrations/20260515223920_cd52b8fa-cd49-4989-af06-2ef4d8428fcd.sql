CREATE OR REPLACE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'owner'::public.app_role)
$$;

DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;
CREATE POLICY "Admins and owners can manage settings"
ON public.admin_settings
FOR ALL
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
CREATE POLICY "Users can view own profile, admins and owners view all"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins and owners can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins and owners can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins and owners can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins and owners can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins and owners can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
CREATE POLICY "Admins and owners can view audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all activity" ON public.activity_log;
CREATE POLICY "Admins and owners can view all activity"
ON public.activity_log
FOR SELECT
TO authenticated
USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete activity" ON public.activity_log;
CREATE POLICY "Admins and owners can delete activity"
ON public.activity_log
FOR DELETE
TO authenticated
USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage system webhooks" ON public.system_webhooks;
CREATE POLICY "Admins and owners can manage system webhooks"
ON public.system_webhooks
FOR ALL
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage bot config" ON public.discord_bot_config;
CREATE POLICY "Admins and owners can manage bot config"
ON public.discord_bot_config
FOR ALL
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can read bot config" ON public.discord_bot_config;
CREATE POLICY "Admins and owners can read bot config"
ON public.discord_bot_config
FOR SELECT
TO authenticated
USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can view visitor logs" ON public.visitor_logs;
CREATE POLICY "Admins and owners can view visitor logs"
ON public.visitor_logs
FOR SELECT
TO authenticated
USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can update mods" ON public.fivem_mods;
CREATE POLICY "Admins and owners can update mods"
ON public.fivem_mods
FOR UPDATE
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete mods" ON public.fivem_mods;
CREATE POLICY "Admins and owners can delete mods"
ON public.fivem_mods
FOR DELETE
TO authenticated
USING (public.has_admin_access(auth.uid()));