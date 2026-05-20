-- 1. activity_log: restrict anonymous inserts to safe fields only
DROP POLICY IF EXISTS "Anonymous can insert activity" ON public.activity_log;
CREATE POLICY "Anonymous can insert activity"
  ON public.activity_log
  FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND user_email IS NULL
    AND user_display_name IS NULL
    AND severity = 'info'
    AND category IN ('page_view', 'visitor')
  );

-- 2. discord_bot_servers: hide webhook columns at the column-privilege level.
--    Owners/admins read them via the existing SECURITY DEFINER RPCs
--    (get_server_webhooks / get_my_server_webhooks).
REVOKE SELECT (webhook_url, manual_webhook_url, auto_scan_webhook_url, full_scan_webhook_url)
  ON public.discord_bot_servers FROM anon, authenticated;

-- 3a. fivem_mods: only expose published mods to the public
DROP POLICY IF EXISTS "Anyone can view mods" ON public.fivem_mods;
CREATE POLICY "Anyone can view published mods"
  ON public.fivem_mods
  FOR SELECT
  TO public
  USING (status = 'published');

-- 3b. fivem_mods: allow authors to delete their own uploads
CREATE POLICY "Uploaders can delete own mods"
  ON public.fivem_mods
  FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- 4. server_creation_keys: hide expired keys from recipients
DROP POLICY IF EXISTS "Users can view own unused keys" ON public.server_creation_keys;
CREATE POLICY "Users can view own unused keys"
  ON public.server_creation_keys
  FOR SELECT
  TO authenticated
  USING (
    issued_to = auth.uid()
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );