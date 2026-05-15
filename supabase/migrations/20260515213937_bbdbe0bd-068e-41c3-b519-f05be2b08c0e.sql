-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'owner', 'mod_creator', 'integrations_manager', 'server_owner');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE, value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON public.admin_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, table_name TEXT, record_id TEXT,
  old_data JSONB, new_data JSONB, ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own audit entries" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.bot_detected_cheaters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT, discord_username TEXT, discord_avatar TEXT,
  guild_id TEXT, guild_name TEXT,
  total_bans INTEGER DEFAULT 0, total_tickets INTEGER DEFAULT 0,
  summary_text TEXT, is_flagged BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_detected_cheaters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bot_server_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL, setting_key TEXT NOT NULL, setting_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_server_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage bot settings" ON public.bot_server_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.cheater_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user TEXT, reason TEXT, evidence TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cheater_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.cheater_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON public.cheater_reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TABLE public.discord_alerted_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ, alerted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discord_alerted_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.discord_bot_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL, guild_name TEXT, guild_icon TEXT,
  webhook_url TEXT, manual_webhook_url TEXT, alert_channel_name TEXT,
  is_active BOOLEAN DEFAULT true, member_count INTEGER DEFAULT 0,
  last_checked_at TIMESTAMPTZ, auto_scan_webhook_url TEXT,
  full_scan_webhook_url TEXT, info_channel_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discord_bot_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own bot servers" ON public.discord_bot_servers FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own or admin all bot servers" ON public.discord_bot_servers FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Guild owners or admins can read cheaters" ON public.bot_detected_cheaters FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR (guild_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.discord_bot_servers s WHERE s.guild_id = bot_detected_cheaters.guild_id AND s.user_id = auth.uid())));
CREATE POLICY "Guild owners or admins can insert cheaters" ON public.bot_detected_cheaters FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR (guild_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.discord_bot_servers s WHERE s.guild_id = bot_detected_cheaters.guild_id AND s.user_id = auth.uid())));

CREATE TABLE public.discord_member_joins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT, discord_username TEXT, discord_avatar TEXT,
  guild_id TEXT, guild_name TEXT,
  is_cheater BOOLEAN DEFAULT false, is_flagged BOOLEAN DEFAULT false,
  total_bans INTEGER DEFAULT 0, total_tickets INTEGER DEFAULT 0,
  summary_text TEXT, logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discord_member_joins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guild owners or admins can read member joins" ON public.discord_member_joins FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR (guild_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.discord_bot_servers s WHERE s.guild_id = discord_member_joins.guild_id AND s.user_id = auth.uid())));

CREATE TABLE public.mod_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT UNIQUE, icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mod_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.mod_categories FOR SELECT USING (true);

CREATE TABLE public.fivem_mods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  file_url TEXT, file_name TEXT, file_size BIGINT, version TEXT,
  category_id UUID REFERENCES public.mod_categories(id) ON DELETE SET NULL,
  tags TEXT[], screenshots TEXT[], model_url TEXT,
  author_notes TEXT, changelog TEXT, compatibility TEXT, requirements TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  download_count INTEGER DEFAULT 0, is_featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fivem_mods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view mods" ON public.fivem_mods FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert mods" ON public.fivem_mods FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update mods" ON public.fivem_mods FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete mods" ON public.fivem_mods FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications" ON public.notification_settings FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT, avatar_url TEXT, bio TEXT, email TEXT,
  discord_user_id TEXT, discord_username TEXT, discord_avatar TEXT,
  role TEXT DEFAULT 'user', status TEXT DEFAULT 'active',
  risk_score INTEGER DEFAULT 0,
  suspended_at TIMESTAMPTZ, suspended_reason TEXT,
  flagged_at TIMESTAMPTZ, flagged_reason TEXT,
  xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1,
  badges TEXT[] DEFAULT '{}', theme TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own full profile" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (email) WHERE email IS NOT NULL;

REVOKE SELECT ON public.profiles FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, user_id, display_name, avatar_url, bio, badges, level, xp, theme,
  discord_username, discord_avatar, discord_user_id, status, created_at, updated_at) ON public.profiles TO anon, authenticated;
GRANT SELECT (email, role, risk_score, suspended_at, suspended_reason, flagged_at, flagged_reason)
  ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, bio, theme, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO service_role;

CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker = on) AS
SELECT id, user_id, display_name, avatar_url, bio, theme, badges, xp, level,
  discord_username, discord_avatar, created_at FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT user_id, display_name, avatar_url, bio, badges, level, xp, theme,
  discord_username, discord_avatar, status, created_at FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE TABLE public.scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  server_id TEXT, guild_id TEXT, guild_name TEXT, scan_type TEXT,
  status TEXT DEFAULT 'pending',
  total_members INTEGER DEFAULT 0, total_checked INTEGER DEFAULT 0,
  total_alerts INTEGER DEFAULT 0, total_skipped INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0, duration_seconds NUMERIC,
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ,
  error_message TEXT, rate_limit_info TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at TIMESTAMPTZ, current_stage TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scans" ON public.scan_history FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own scans" ON public.scan_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own scans" ON public.scan_history FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own scans" ON public.scan_history FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX scan_history_guild_started_idx ON public.scan_history (guild_id, started_at DESC);
CREATE INDEX scan_history_status_heartbeat_idx ON public.scan_history (status, last_heartbeat_at DESC);

CREATE TABLE public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL, search_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own search history" ON public.search_history FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.server_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  server_id TEXT NOT NULL, server_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.server_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own favorites" ON public.server_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.server_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id TEXT NOT NULL, shared_with TEXT,
  shared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  permission TEXT DEFAULT 'view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.server_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view shares they're involved in" ON public.server_shares FOR SELECT TO authenticated
USING (auth.uid() = shared_by OR shared_with = auth.uid()::text OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create shares" ON public.server_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = shared_by);
CREATE POLICY "Share creators can update their shares" ON public.server_shares FOR UPDATE TO authenticated
USING (auth.uid() = shared_by OR has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = shared_by OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Share creators can delete their shares" ON public.server_shares FOR DELETE TO authenticated
USING (auth.uid() = shared_by OR has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  flag_type TEXT NOT NULL, reason TEXT,
  flagged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage flags" ON public.user_flags FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TABLE public.visitor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page TEXT, ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view visitor logs" ON public.visitor_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.discord_bot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id text NOT NULL UNIQUE, bot_username text, bot_avatar text, bot_discriminator text,
  selected_guild_id text, selected_guild_name text, invite_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.discord_bot_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage bot config" ON public.discord_bot_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read bot config" ON public.discord_bot_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fivem_mods_updated_at BEFORE UPDATE ON public.fivem_mods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bot_server_settings_updated_at BEFORE UPDATE ON public.bot_server_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('fivem-mods', 'fivem-mods', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('mod-screenshots', 'mod-screenshots', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('public-assets', 'public-assets', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('hero-images', 'hero-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('map-tiles', 'map-tiles', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "Auth upload mods" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fivem-mods' AND ((storage.foldername(name))[1] = (auth.uid())::text OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Auth upload screenshots" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mod-screenshots' AND ((storage.foldername(name))[1] = (auth.uid())::text OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins upload public-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'public-assets' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can upload hero images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update hero images" ON storage.objects FOR UPDATE USING (bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete hero images" ON storage.objects FOR DELETE USING (bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner or admin can update mod files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('fivem-mods', 'mod-screenshots') AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (bucket_id IN ('fivem-mods', 'mod-screenshots') AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Owner or admin can delete mod files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('fivem-mods', 'mod-screenshots') AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE TABLE public.bot_server_advanced_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL UNIQUE REFERENCES public.discord_bot_servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cheater_role_id TEXT, auto_assign_cheater_role BOOLEAN NOT NULL DEFAULT false,
  auto_kick_cheaters BOOLEAN NOT NULL DEFAULT false,
  auto_ban_cheaters BOOLEAN NOT NULL DEFAULT false,
  min_bans_for_alert INTEGER NOT NULL DEFAULT 1,
  alert_mention_role_id TEXT, notify_on_clean_joins BOOLEAN NOT NULL DEFAULT false,
  log_all_joins BOOLEAN NOT NULL DEFAULT false,
  auto_scan_interval_minutes INTEGER NOT NULL DEFAULT 0,
  info_channel_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auto_mod_mutually_exclusive CHECK (NOT (auto_kick_cheaters AND auto_ban_cheaters)),
  CONSTRAINT min_bans_for_alert_positive CHECK (min_bans_for_alert >= 0),
  CONSTRAINT auto_scan_interval_non_negative CHECK (auto_scan_interval_minutes >= 0)
);
CREATE INDEX idx_bot_advanced_settings_user ON public.bot_server_advanced_settings(user_id);
CREATE INDEX idx_bot_advanced_settings_server ON public.bot_server_advanced_settings(server_id);
ALTER TABLE public.bot_server_advanced_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own advanced settings" ON public.bot_server_advanced_settings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own advanced settings" ON public.bot_server_advanced_settings FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_bot_advanced_settings_updated_at BEFORE UPDATE ON public.bot_server_advanced_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.server_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL, guild_id TEXT, user_id UUID,
  action TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('success', 'fail', 'partial')),
  details JSONB, error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_server_audit_log_server_id ON public.server_audit_log(server_id, created_at DESC);
CREATE INDEX idx_server_audit_log_user_id ON public.server_audit_log(user_id, created_at DESC);
ALTER TABLE public.server_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server owners and admins can view audit log" ON public.server_audit_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.discord_bot_servers s WHERE s.id = server_audit_log.server_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can insert audit entries for own servers" ON public.server_audit_log FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.discord_bot_servers s WHERE s.id = server_audit_log.server_id AND s.user_id = auth.uid()));

CREATE TABLE public.server_creation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code TEXT NOT NULL UNIQUE,
  issued_to UUID, issued_to_email TEXT,
  created_by UUID NOT NULL,
  used_by UUID, used_at TIMESTAMPTZ, used_for_server_id UUID,
  expires_at TIMESTAMPTZ, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_server_creation_keys_code ON public.server_creation_keys(key_code) WHERE used_at IS NULL;
CREATE INDEX idx_server_creation_keys_issued_to ON public.server_creation_keys(issued_to) WHERE used_at IS NULL;
ALTER TABLE public.server_creation_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all keys" ON public.server_creation_keys FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users can view own unused keys" ON public.server_creation_keys FOR SELECT TO authenticated
USING (issued_to = auth.uid() AND used_at IS NULL);

CREATE TABLE public.server_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.discord_bot_servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  invited_by UUID, invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (server_id, user_id)
);
CREATE INDEX idx_server_members_server ON public.server_members(server_id);
CREATE INDEX idx_server_members_user ON public.server_members(user_id);
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_server_member(_server_id UUID, _user_id UUID, _min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.server_members WHERE server_id = _server_id AND user_id = _user_id
  AND CASE _min_role WHEN 'viewer' THEN role IN ('viewer','editor','admin') WHEN 'editor' THEN role IN ('editor','admin')
  WHEN 'admin' THEN role = 'admin' ELSE FALSE END) $$;

CREATE OR REPLACE FUNCTION public.is_server_owner(_server_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.discord_bot_servers WHERE id = _server_id AND user_id = _user_id) $$;

CREATE POLICY "View members if owner, member or admin" ON public.server_members FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_server_owner(server_id, auth.uid())
  OR user_id = auth.uid() OR public.is_server_member(server_id, auth.uid(), 'viewer'));
CREATE POLICY "Owner or server-admin can add members" ON public.server_members FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_server_owner(server_id, auth.uid())
  OR public.is_server_member(server_id, auth.uid(), 'admin'));
CREATE POLICY "Owner or server-admin can update members" ON public.server_members FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_server_owner(server_id, auth.uid())
  OR public.is_server_member(server_id, auth.uid(), 'admin'));
CREATE POLICY "Owner, server-admin or self can remove member" ON public.server_members FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_server_owner(server_id, auth.uid())
  OR public.is_server_member(server_id, auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Owners, shared users and admins can view bot servers" ON public.discord_bot_servers FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR is_server_member(id, auth.uid(), 'viewer'::text)
  OR EXISTS (SELECT 1 FROM public.server_shares s WHERE s.server_id::text = discord_bot_servers.id::text AND s.shared_with = auth.uid()::text));
CREATE POLICY "Update own, editor+ or admin servers" ON public.discord_bot_servers FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.is_server_member(id, auth.uid(), 'editor'));

CREATE POLICY "View advanced settings if owner, member or admin" ON public.bot_server_advanced_settings FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.is_server_member(server_id, auth.uid(), 'viewer'));
CREATE POLICY "Update advanced settings if owner, editor+ or admin" ON public.bot_server_advanced_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.is_server_member(server_id, auth.uid(), 'editor'));

CREATE TABLE public.hidden_cheater_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_value text NOT NULL,
  match_type text NOT NULL DEFAULT 'any',
  cheater_report_id uuid,
  note text,
  hidden_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hidden_cheater_entries_value_idx ON public.hidden_cheater_entries (lower(match_value));
ALTER TABLE public.hidden_cheater_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and owners manage hidden entries" ON public.hidden_cheater_entries FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, user_email TEXT, user_display_name TEXT,
  category TEXT NOT NULL, action TEXT NOT NULL, description TEXT,
  metadata JSONB, page_path TEXT, ip_address TEXT, user_agent TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_category ON public.activity_log(category);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX idx_activity_log_severity ON public.activity_log(severity);
CREATE INDEX idx_activity_log_action ON public.activity_log (action);
CREATE INDEX idx_activity_log_user_email ON public.activity_log (user_email);
CREATE INDEX idx_activity_log_category_created ON public.activity_log (category, created_at DESC);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all activity" ON public.activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own activity" ON public.activity_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert activity" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anonymous can insert activity" ON public.activity_log FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Admins can delete activity" ON public.activity_log FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.system_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, category TEXT NOT NULL, webhook_url TEXT NOT NULL,
  description TEXT, enabled BOOLEAN NOT NULL DEFAULT true,
  mention_role_id TEXT, min_severity TEXT NOT NULL DEFAULT 'info',
  events JSONB NOT NULL DEFAULT '[]'::jsonb, created_by UUID,
  last_used_at TIMESTAMP WITH TIME ZONE, last_status TEXT, last_error TEXT,
  total_sent INTEGER NOT NULL DEFAULT 0, total_failed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_system_webhooks_category ON public.system_webhooks(category);
CREATE INDEX idx_system_webhooks_enabled ON public.system_webhooks(enabled);
ALTER TABLE public.system_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage system webhooks" ON public.system_webhooks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_system_webhooks_updated_at BEFORE UPDATE ON public.system_webhooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url, discord_user_id, discord_username, discord_avatar)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'user_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'),
    NEW.raw_user_meta_data ->> 'provider_id',
    NEW.raw_user_meta_data ->> 'user_name',
    NEW.raw_user_meta_data ->> 'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE SELECT (webhook_url, manual_webhook_url, auto_scan_webhook_url, full_scan_webhook_url)
  ON public.discord_bot_servers FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_server_webhooks(_server_id uuid)
RETURNS TABLE (id uuid, webhook_url text, manual_webhook_url text, auto_scan_webhook_url text, full_scan_webhook_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.webhook_url, s.manual_webhook_url, s.auto_scan_webhook_url, s.full_scan_webhook_url
  FROM public.discord_bot_servers s WHERE s.id = _server_id
    AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));
$$;
REVOKE EXECUTE ON FUNCTION public.get_server_webhooks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_server_webhooks(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_server_webhooks()
RETURNS TABLE (id uuid, webhook_url text, manual_webhook_url text, auto_scan_webhook_url text, full_scan_webhook_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.webhook_url, s.manual_webhook_url, s.auto_scan_webhook_url, s.full_scan_webhook_url
  FROM public.discord_bot_servers s
  WHERE s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role);
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_server_webhooks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_server_webhooks() TO authenticated;

CREATE POLICY "Guild owners or admins can read alerted members" ON public.discord_alerted_members FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM public.discord_bot_servers s WHERE s.guild_id = discord_alerted_members.guild_id AND s.user_id = auth.uid()));
CREATE POLICY "Guild owners or admins can insert alerted members" ON public.discord_alerted_members FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM public.discord_bot_servers s WHERE s.guild_id = discord_alerted_members.guild_id AND s.user_id = auth.uid()));

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS TABLE(table_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT t.table_name::text FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' ORDER BY t.table_name;
END; $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_server_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_server_member(uuid, uuid, text) TO authenticated;

CREATE POLICY "Guild owners can read own bot settings" ON public.bot_server_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM public.discord_bot_servers s WHERE s.guild_id = bot_server_settings.guild_id AND s.user_id = auth.uid()));
CREATE POLICY "Guild owners can insert own bot settings" ON public.bot_server_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM public.discord_bot_servers s WHERE s.guild_id = bot_server_settings.guild_id AND s.user_id = auth.uid()));
CREATE POLICY "Guild owners can update own bot settings" ON public.bot_server_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM public.discord_bot_servers s WHERE s.guild_id = bot_server_settings.guild_id AND s.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text; v_record_id text; v_uid uuid := auth.uid(); v_email text; v_display text;
  v_severity text := 'info'; v_description text; v_payload jsonb; v_changed_keys text[]; v_table text := TG_TABLE_NAME;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'db.' || v_table || '.create';
  ELSIF TG_OP = 'UPDATE' THEN v_action := 'db.' || v_table || '.update';
  ELSE v_action := 'db.' || v_table || '.delete'; v_severity := 'warning'; END IF;
  BEGIN
    IF TG_OP = 'DELETE' THEN v_record_id := (to_jsonb(OLD) ->> 'id');
    ELSE v_record_id := (to_jsonb(NEW) ->> 'id'); END IF;
  EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
  IF v_uid IS NOT NULL THEN
    SELECT email, display_name INTO v_email, v_display FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key) INTO v_changed_keys FROM (
      SELECT n.key FROM jsonb_each(to_jsonb(NEW)) n WHERE to_jsonb(OLD) -> n.key IS DISTINCT FROM n.value) k;
  END IF;
  IF v_table IN ('user_roles', 'admin_settings', 'server_creation_keys') THEN
    v_severity := CASE WHEN TG_OP = 'DELETE' THEN 'critical' ELSE 'warning' END;
  END IF;
  v_description := CASE TG_OP WHEN 'INSERT' THEN format('Created %s', v_table)
    WHEN 'UPDATE' THEN format('Updated %s', v_table) ELSE format('Deleted %s', v_table) END;
  v_payload := jsonb_build_object('op', TG_OP, 'table', v_table, 'record_id', v_record_id,
    'changed_keys', v_changed_keys,
    'old', CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    'new', CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END);
  INSERT INTO public.activity_log (user_id, user_email, user_display_name, category, action, description, metadata, severity)
  VALUES (v_uid, v_email, v_display, 'database', v_action, v_description, v_payload, v_severity);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_table_change failed for %: %', v_table, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public._attach_audit_trigger(_table regclass)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE trg_name text := 'audit_' || split_part(_table::text, '.', 2);
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trg_name, _table);
  EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.log_table_change()', trg_name, _table);
END; $$;

SELECT public._attach_audit_trigger('public.cheater_reports');
SELECT public._attach_audit_trigger('public.user_roles');
SELECT public._attach_audit_trigger('public.admin_settings');
SELECT public._attach_audit_trigger('public.fivem_mods');
SELECT public._attach_audit_trigger('public.discord_bot_servers');
SELECT public._attach_audit_trigger('public.bot_server_settings');
SELECT public._attach_audit_trigger('public.bot_server_advanced_settings');
SELECT public._attach_audit_trigger('public.profiles');
SELECT public._attach_audit_trigger('public.system_webhooks');
SELECT public._attach_audit_trigger('public.server_members');
SELECT public._attach_audit_trigger('public.server_shares');
SELECT public._attach_audit_trigger('public.server_creation_keys');
SELECT public._attach_audit_trigger('public.notification_settings');
SELECT public._attach_audit_trigger('public.user_flags');
SELECT public._attach_audit_trigger('public.hidden_cheater_entries');
SELECT public._attach_audit_trigger('public.mod_categories');

CREATE OR REPLACE FUNCTION public.list_public_tables()
RETURNS TABLE(table_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.table_name::text FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' ORDER BY t.table_name;
$$;
REVOKE ALL ON FUNCTION public.list_public_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_tables() TO service_role;

ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.discord_bot_servers REPLICA IDENTITY FULL;
ALTER TABLE public.scan_history REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.validate_server_creation_key(_key_code text)
RETURNS TABLE (id uuid, issued_to uuid, used_at timestamptz, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.id, k.issued_to, k.used_at, k.expires_at FROM public.server_creation_keys k
  WHERE k.key_code = upper(trim(_key_code))
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)
      OR k.issued_to IS NULL OR k.issued_to = auth.uid()) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.validate_server_creation_key(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.use_server_creation_key(_key_code text, _server_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key_id uuid;
BEGIN
  SELECT k.id INTO v_key_id FROM public.server_creation_keys k
  WHERE k.key_code = upper(trim(_key_code)) AND k.used_at IS NULL
    AND (k.expires_at IS NULL OR k.expires_at > now())
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'owner'::public.app_role)
      OR k.issued_to IS NULL OR k.issued_to = auth.uid()) LIMIT 1;
  IF v_key_id IS NULL THEN RETURN false; END IF;
  UPDATE public.server_creation_keys SET used_at = now(), used_by = auth.uid(), used_for_server_id = _server_id
  WHERE id = v_key_id AND used_at IS NULL;
  RETURN found;
END; $$;
GRANT EXECUTE ON FUNCTION public.use_server_creation_key(text, uuid) TO authenticated;

ALTER TABLE public.discord_bot_servers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid;

CREATE OR REPLACE FUNCTION public.validate_server_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'paused', 'blacklisted') THEN
    RAISE EXCEPTION 'Invalid server status: %', NEW.status;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.status <> 'active') OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS validate_server_status_trg ON public.discord_bot_servers;
CREATE TRIGGER validate_server_status_trg BEFORE INSERT OR UPDATE ON public.discord_bot_servers
FOR EACH ROW EXECUTE FUNCTION public.validate_server_status();

CREATE OR REPLACE FUNCTION public.set_server_status(_server_id uuid, _status text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('active', 'paused', 'blacklisted') THEN
    RAISE EXCEPTION 'Invalid status: %', _status;
  END IF;
  UPDATE public.discord_bot_servers SET status = _status, status_reason = _reason, status_changed_by = auth.uid(),
    is_active = (_status = 'active') WHERE id = _server_id;
END; $$;

CREATE OR REPLACE FUNCTION public.set_user_status(_user_id uuid, _status text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('active', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'Invalid status: %', _status;
  END IF;
  IF _status <> 'active' AND public.has_role(_user_id, 'owner'::app_role) THEN
    RAISE EXCEPTION 'Cannot suspend or ban an owner';
  END IF;
  UPDATE public.profiles SET status = _status,
    suspended_at = CASE WHEN _status = 'suspended' THEN now() ELSE NULL END,
    suspended_reason = CASE WHEN _status = 'suspended' THEN _reason ELSE NULL END,
    flagged_at = CASE WHEN _status = 'banned' THEN now() ELSE NULL END,
    flagged_reason = CASE WHEN _status = 'banned' THEN _reason ELSE NULL END
  WHERE user_id = _user_id;
END; $$;

CREATE POLICY "Public can read safe settings" ON public.admin_settings FOR SELECT TO anon, authenticated
USING (key = ANY (ARRAY['social_discord','social_youtube','social_tiktok','hero_showcase_image',
  'landing_feature_server_lookup','landing_feature_players','landing_feature_cheaters','landing_feature_mods',
  'stats_total_override','stats_confirmed_override','stats_suspected_override',
  'discord_webhook_enabled','embed_config_mod_upload',
  'auth_show_discord','auth_show_google','auth_show_apple','auth_show_email','auth_show_signup']));

INSERT INTO public.admin_settings (key, value) VALUES
  ('auth_show_discord','true'),('auth_show_google','false'),('auth_show_apple','false'),
  ('auth_show_email','false'),('auth_show_signup','false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_cheater_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('total', count(*)::int,
    'confirmed', count(*) FILTER (WHERE is_flagged = true)::int,
    'suspected', count(*) FILTER (WHERE is_flagged = false OR is_flagged IS NULL)::int)
  FROM public.bot_detected_cheaters;
$$;
GRANT EXECUTE ON FUNCTION public.get_cheater_stats() TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS discord_alerted_members_guild_user_unique
ON public.discord_alerted_members (guild_id, discord_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS bot_detected_cheaters_guild_user_unique
ON public.bot_detected_cheaters (guild_id, discord_user_id)
WHERE guild_id IS NOT NULL AND discord_user_id IS NOT NULL;

CREATE POLICY "Authenticated insert own visitor logs"
ON public.visitor_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anonymous insert visitor logs"
ON public.visitor_logs FOR INSERT TO anon
WITH CHECK (user_id IS NULL);

CREATE OR REPLACE FUNCTION public.protect_profile_moderation_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() = OLD.user_id
     AND NOT (public.has_role(auth.uid(), 'admin'::app_role)
              OR public.has_role(auth.uid(), 'owner'::app_role)
              OR public.has_role(auth.uid(), 'moderator'::app_role)) THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.flagged_at := OLD.flagged_at;
    NEW.flagged_reason := OLD.flagged_reason;
    NEW.suspended_at := OLD.suspended_at;
    NEW.suspended_reason := OLD.suspended_reason;
    NEW.risk_score := OLD.risk_score;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS protect_profile_moderation_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_moderation_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_moderation_fields();