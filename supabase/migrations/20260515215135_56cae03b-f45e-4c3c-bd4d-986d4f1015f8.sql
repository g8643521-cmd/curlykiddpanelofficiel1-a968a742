UPDATE public.admin_settings SET value='true' WHERE key IN ('auth_show_email','auth_show_signup','auth_show_google');
UPDATE public.admin_settings SET value='false' WHERE key='auth_show_discord';