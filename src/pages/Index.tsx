import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Users, Search, Package, MapPin, Crosshair, Eye, Globe, Code, Trophy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
const Auth = lazy(() => import("./Auth.tsx"));
import BrandLogo from "@/components/BrandLogo";
import DashboardHero from "@/components/DashboardHero";
import Footer from "@/components/Footer";
import { getSessionWithTimeout } from "@/lib/authSession";
import { useHeroImage, prefetchHeroImages } from "@/hooks/useHeroImage";
import { useI18n } from "@/lib/i18n";
import showcasePlayers from "@/assets/showcase-players.png";

import showcaseCheaters from "@/assets/showcase-cheaters.png";
import showcaseMods from "@/assets/showcase-mods.png";
import featureServerLookupImg from "@/assets/feature-server-lookup.jpg";
import featurePlayerLocatorImg from "@/assets/feature-player-locator.jpg";
import featureDiscordBotImg from "@/assets/feature-discord-bot.jpg";
import { usePageMeta } from "@/hooks/usePageMeta";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  usePageMeta({
    title: "CurlyKiddPanel — FiveM Server Lookup & Player Tracking",
    description: "Free FiveM toolkit: server analytics, community cheater database, mods directory, coordinate lookup and live player tracking.",
    path: "/",
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  // One round-trip instead of 5 individual admin_settings queries.
  if (typeof window !== 'undefined') {
    void prefetchHeroImages([
      'hero_showcase_image',
      'landing_feature_server_lookup',
      'landing_feature_players',
      'landing_feature_cheaters',
      'landing_feature_mods',
    ]);
  }
  const featServerImg = useHeroImage("/images/showcase-server-details.png", "landing_feature_server_lookup");
  const featPlayersImg = useHeroImage(showcasePlayers, "landing_feature_players");
  const featCheatersImg = useHeroImage(showcaseCheaters, "landing_feature_cheaters");
  const featModsImg = useHeroImage(showcaseMods, "landing_feature_mods");

  const showcaseFeatures = [
    { icon: Search, title: t("index.server_lookup"), desc: t("index.server_lookup_desc"), image: featServerImg },
    { icon: Users, title: t("index.online_players"), desc: t("index.online_players_desc"), image: featPlayersImg },
    { icon: Shield, title: t("index.cheater_db"), desc: t("index.cheater_db_desc"), image: featCheatersImg },
    { icon: Package, title: t("index.fivem_mods"), desc: t("index.fivem_mods_desc"), image: featModsImg },
  ];

  const extraFeatures: Array<{
    icon: typeof MapPin;
    title: string;
    tagline: string;
    desc: string;
    howItWorks: string[];
    color: string;
    accent: string;
    href: string;
    image: string;
  }> = [
    {
      icon: Search,
      title: "Server Lookup",
      tagline: "Instant intelligence on any CFX code",
      desc: "Paste a CFX join code and get a complete profile of the server within seconds — built for owners who need answers, not guesses.",
      howItWorks: [
        "Resolves the join code to the direct IP, port and game build",
        "Pulls live player count, ping, gametype, mapname and tags",
        "Surfaces hosting region, ISP and onesync / OneSync Plus state",
      ],
      color: "text-[hsl(var(--cyan))]",
      accent: "from-[hsl(var(--cyan))]/30",
      href: "/dashboard",
      image: featureServerLookupImg,
    },
    {
      icon: MapPin,
      title: "Player Locator",
      tagline: "Find any player across tracked servers",
      desc: "Search by name or identifier and pinpoint exactly where a player is — and where they've been — across every server you watch.",
      howItWorks: [
        "Cross-references active sessions across watched servers",
        "Plots live coordinates on an interactive GTA V map",
        "Keeps a session history so you can rebuild a player's timeline",
      ],
      color: "text-[hsl(var(--magenta))]",
      accent: "from-[hsl(var(--magenta))]/30",
      href: "/dashboard",
      image: featurePlayerLocatorImg,
    },
    {
      icon: MessageCircle,
      title: "Discord Bot",
      tagline: "Lookups, alerts and moderation in-server",
      desc: "Connect CurlyKidd Bot to your Discord and bring the entire toolkit to your community — without anyone leaving the chat.",
      howItWorks: [
        "Slash-commands for lookups, player checks and cheater reports",
        "Real-time alerts when watched servers change status",
        "Role-aware moderation actions logged back to the panel",
      ],
      color: "text-[hsl(var(--purple))]",
      accent: "from-[hsl(var(--purple))]/35",
      href: "/bot",
      image: featureDiscordBotImg,
    },
  ];



  const shouldShowAuthFallback =
    searchParams.get("__spa_path") === "/login" ||
    (searchParams.get("state") === "discord_login" && Boolean(searchParams.get("code")));

  useEffect(() => {
    if (shouldShowAuthFallback) return;

    try {
      getSessionWithTimeout().then(({ data: { session } }) => {
        if (session) {
          navigate("/dashboard");
        } else {
          setIsLoggedIn(false);
        }
      }).catch(() => {
        setIsLoggedIn(false);
      });
    } catch {
      setIsLoggedIn(false);
    }
  }, [navigate, shouldShowAuthFallback]);

  if (shouldShowAuthFallback) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
        <Auth />
      </Suspense>
    );
  }

  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/20 bg-background/60 backdrop-blur-2xl">
        <div className="container mx-auto px-6 flex items-center justify-between h-14">
          <button onClick={() => navigate("/")} className="hover:opacity-80 transition-opacity">
            <BrandLogo size="md" />
          </button>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Button onClick={() => navigate("/dashboard")} size="sm" className="gap-2">
                {t("index.dashboard")} <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-muted-foreground/70 hover:text-foreground">
                  {t("index.log_in")}
                </Button>
                <Button size="sm" onClick={() => navigate("/login")} className="gap-2">
                  {t("index.get_started")} <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="container mx-auto px-6 pt-28 pb-24">
          <DashboardHero onGetStarted={() => navigate("/login")} />
        </section>

        {/* Platform Modules */}
        <section className="container mx-auto px-6 py-28">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 backdrop-blur-sm px-3 py-1 text-[11px] font-medium tracking-[0.14em] uppercase text-muted-foreground mb-6">
              <span className="w-1 h-1 rounded-full bg-primary" />
              Platform Modules
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
              <span className="gradient-text">{t("index.more_features")}</span>
            </h2>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed mt-5 max-w-2xl mx-auto">
              {t("index.more_features_desc")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {extraFeatures.map((feature, i) => (
              <motion.a
                key={feature.title}
                href={feature.href}
                onClick={(e) => { e.preventDefault(); navigate(feature.href); }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="relative isolate flex flex-col rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden group transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_30px_90px_-30px_hsl(var(--primary)/0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 min-h-[460px]"
              >
                {/* Background image — fades in on hover */}
                <div className="absolute inset-0 -z-10 overflow-hidden">
                  <img
                    src={feature.image}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    width={1024}
                    height={768}
                    className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-30 scale-110 group-hover:scale-100 transition-all duration-700 ease-out"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.accent} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-card/40 opacity-100 group-hover:opacity-95 transition-opacity duration-500" />
                </div>

                {/* Top accent line */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"
                />
                {/* Index */}
                <span className="absolute top-6 right-7 text-[10px] font-mono text-muted-foreground/40 tabular-nums tracking-[0.18em]">
                  {String(i + 1).padStart(2, "0")} / 03
                </span>

                {/* Default content */}
                <div className="relative p-8 pb-7 flex-1 flex flex-col">
                  <feature.icon
                    className={`w-8 h-8 mb-7 ${feature.color} transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-0.5 drop-shadow-[0_0_18px_currentColor]`}
                    strokeWidth={1.4}
                  />

                  <h3 className="font-display text-[22px] font-semibold text-foreground mb-1.5 tracking-tight leading-tight">
                    {feature.title}
                  </h3>
                  <p className={`text-[12px] font-medium tracking-wide uppercase mb-4 ${feature.color} opacity-80`}>
                    {feature.tagline}
                  </p>
                  <p className="text-muted-foreground/80 text-[14px] leading-relaxed mb-6">
                    {feature.desc}
                  </p>

                  {/* "How it works" — slides in on hover */}
                  <div className="overflow-hidden transition-all duration-500 max-h-0 opacity-0 group-hover:max-h-[260px] group-hover:opacity-100">
                    <div className="pt-5 mt-auto border-t border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60 mb-3">
                        How it works
                      </p>
                      <ul className="space-y-2.5">
                        {feature.howItWorks.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-[13px] text-muted-foreground/85 leading-snug">
                            <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${feature.color} bg-current`} />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-auto pt-6 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground/70 group-hover:text-primary transition-colors duration-300">
                      Open module
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      Hover for details
                    </span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-6 py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-[28px] border border-border/40 bg-card/40 backdrop-blur-2xl px-8 py-16 md:px-16 md:py-20 max-w-5xl mx-auto overflow-hidden shadow-[0_50px_140px_-50px_hsl(var(--primary)/0.45)]"
          >
            {/* Animated gradient backdrop */}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-[hsl(var(--cyan-glow))]/[0.08]" />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[680px] h-[680px] bg-primary/15 blur-[140px] rounded-full"
            />
            {/* Grid pattern */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
                maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              }}
            />
            {/* Top accent line */}
            <div aria-hidden className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

            <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-12 md:gap-10 items-center">
              {/* Left: copy + CTAs */}
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-400/95 mb-6">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Free forever — no credit card required
                </div>

                <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] mb-5">
                  <span className="gradient-text">Built for serious</span>
                  <br />
                  <span className="text-foreground">FiveM communities.</span>
                </h2>
                <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl mb-8">
                  Server analytics, a community-powered cheater database, mods directory and live player tracking — everything you need to run a clean, competitive FiveM server. Sign up in seconds.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                  <Button
                    size="lg"
                    onClick={() => navigate("/login")}
                    className="gap-2 px-8 h-12 shadow-lg shadow-primary/20 hover:shadow-primary/35 transition-all group"
                  >
                    Create free account
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/login")}
                    className="gap-2 px-8 h-12 border-border/60 hover:bg-secondary/40"
                  >
                    Sign in
                  </Button>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 justify-center md:justify-start text-[12px] text-muted-foreground/70">
                  <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary/70" /> Encrypted &amp; GDPR</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <span className="flex items-center gap-1.5"><Code className="w-3.5 h-3.5 text-primary/70" /> Open Discord bot</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary/70" /> Active community</span>
                </div>
              </div>

              {/* Right: live stat tiles */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Cheaters tracked", value: "495+", icon: Shield, accent: "text-[hsl(var(--magenta))]" },
                  { label: "Servers monitored", value: "Live", icon: Search, accent: "text-primary" },
                  { label: "Players indexed", value: "24/7", icon: Users, accent: "text-[hsl(var(--cyan))]" },
                  { label: "Uptime", value: "99.9%", icon: Trophy, accent: "text-[hsl(var(--yellow))]" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="relative rounded-2xl border border-border/40 bg-background/50 backdrop-blur-sm p-4 hover:border-border/70 hover:-translate-y-0.5 transition-all"
                  >
                    <stat.icon className={`w-4 h-4 mb-3 ${stat.accent}`} />
                    <div className="font-display text-2xl font-bold text-foreground leading-none mb-1.5">
                      {stat.value}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
