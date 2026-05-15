import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { supabase } from '@/lib/supabase';

interface SocialLinks {
  discord: string;
  youtube: string;
  tiktok: string;
}

const DEFAULT_LINKS: SocialLinks = {
  discord: 'https://discord.gg/CqX8YVFrCP',
  youtube: 'https://youtube.com/@curlykidd',
  tiktok: 'https://tiktok.com/@curlykidd',
};

const Footer = () => {
  const navigate = useNavigate();
  const [links, setLinks] = useState<SocialLinks>(DEFAULT_LINKS);

  useEffect(() => {
    const fetchLinks = async () => {
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['social_discord', 'social_youtube', 'social_tiktok']);

      if (data && data.length > 0) {
        const fetched = { ...DEFAULT_LINKS };
        data.forEach((row) => {
          if (row.key === 'social_discord') fetched.discord = row.value;
          if (row.key === 'social_youtube') fetched.youtube = row.value;
          if (row.key === 'social_tiktok') fetched.tiktok = row.value;
        });
        setLinks(fetched);
      }
    };
    fetchLinks();
  }, []);

  const linkClass =
    'text-muted-foreground/60 hover:text-primary text-[13px] leading-none transition-colors duration-250 block py-[5px]';

  const headingClass =
    'text-foreground/80 font-semibold text-xs tracking-[0.16em] uppercase mb-6';

  return (
    <footer className="relative z-10 mt-16 border-t border-border/[0.08] bg-background/60 backdrop-blur-2xl">
      <div className="container mx-auto max-w-6xl px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-y-12 gap-x-8 lg:gap-x-12 items-start">

          {/* Brand */}
          <div className="col-span-2 md:col-span-4 space-y-6 pr-6">
            <button onClick={() => navigate('/')} className="hover:opacity-90 transition-opacity duration-250 inline-block">
              <BrandLogo size="lg" />
            </button>
            <p className="text-muted-foreground/55 text-[13px] leading-[1.75] max-w-[280px]">
              All-in-one FiveM toolkit — server lookup, anti-cheat scanning, Discord bot integration &amp; mod management.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {/* Discord */}
              <a
                href={links.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-card/30 border border-white/[0.06] flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/[0.08] hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] hover:scale-105 transition-all duration-250"
                aria-label="Discord"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z" />
                </svg>
              </a>
              {/* YouTube */}
              <a
                href={links.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-card/30 border border-white/[0.06] flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/[0.08] hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] hover:scale-105 transition-all duration-250"
                aria-label="YouTube"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              {/* TikTok */}
              <a
                href={links.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-card/30 border border-white/[0.06] flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/[0.08] hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] hover:scale-105 transition-all duration-250"
                aria-label="TikTok"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div className="md:col-span-2">
            <h4 className={headingClass}>Product</h4>
            <ul className="space-y-3.5">
              <li><button type="button" onClick={() => navigate('/dashboard')} className={linkClass}>Server Lookup</button></li>
              <li><button type="button" onClick={() => navigate('/cheaters')} className={linkClass}>Cheater Database</button></li>
              <li><button type="button" onClick={() => navigate('/mods')} className={linkClass}>FiveM Mods</button></li>
              <li><button type="button" onClick={() => navigate('/coordinates')} className={linkClass}>Coordinates</button></li>
              <li><button type="button" onClick={() => navigate('/bot')} className={linkClass}>Discord Bot</button></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="md:col-span-2">
            <h4 className={headingClass}>Resources</h4>
            <ul className="space-y-3.5">
              <li>
                <a href={links.discord} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Discord Server
                </a>
              </li>
              <li>
                <a href={links.youtube} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  YouTube
                </a>
              </li>
              <li>
                <a href={links.tiktok} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  TikTok
                </a>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/login')} className={linkClass}>
                  Get Started
                </button>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div className="md:col-span-2">
            <h4 className={headingClass}>Account</h4>
            <ul className="space-y-3.5">
              <li><button type="button" onClick={() => navigate('/profile')} className={linkClass}>Profile</button></li>
              <li><button type="button" onClick={() => navigate('/settings')} className={linkClass}>Settings</button></li>
              <li><button type="button" onClick={() => navigate('/login')} className={linkClass}>Sign In</button></li>
            </ul>
          </div>

          {/* About */}
          <div className="col-span-2 md:col-span-2">
            <h4 className={headingClass}>About</h4>
            <p className="text-muted-foreground/50 text-[13px] leading-[1.8]">
              A community-driven platform helping FiveM server owners manage, protect, and grow their servers.
            </p>
          </div>

        </div>

        {/* Divider + Copyright */}
        <div className="mt-14 pt-7 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-muted-foreground/40 text-[11.5px] tracking-wide font-medium">
            &copy; {new Date().getFullYear()} CurlyKiddPanel. All rights reserved.
          </span>
          <span className="text-muted-foreground/25 text-[11.5px] tracking-wide">
            Built for the FiveM community
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
