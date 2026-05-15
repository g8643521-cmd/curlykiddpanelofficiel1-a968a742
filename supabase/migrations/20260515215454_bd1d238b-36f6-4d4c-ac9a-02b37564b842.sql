
INSERT INTO public.admin_settings (key, value) VALUES
  ('auth_show_discord','true'),
  ('auth_show_google','false'),
  ('auth_show_email','true'),
  ('auth_show_signup','true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
