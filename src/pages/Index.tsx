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
import { useHeroImage } from "@/hooks/useHeroImage";
import { useI18n } from "@/lib/i18n";
import showcasePlayers from "@/assets/showcase-players.png";

import showcaseCheaters from "@/assets/showcase-cheaters.png";
import showcaseMods from "@/assets/showcase-mods.png";
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

  const extraFeatures = [
    { icon: MapPin, title: t("index.player_locator"), desc: t("index.player_locator_desc"), color: "text-[hsl(var(--cyan))]", bg: "bg-[hsl(var(--cyan))]/10" },
    { icon: Crosshair, title: t("index.coord_lookup"), desc: t("index.coord_lookup_desc"), color: "text-[hsl(var(--magenta))]", bg: "bg-[hsl(var(--magenta))]/10" },
    { icon: Eye, title: t("index.watchlist"), desc: t("index.watchlist_desc"), color: "text-[hsl(var(--yellow))]", bg: "bg-[hsl(var(--yellow))]/10" },
    { icon: Globe, title: t("index.geolocation"), desc: t("index.geolocation_desc"), color: "text-[hsl(var(--purple))]", bg: "bg-[hsl(var(--purple))]/10" },
    { icon: Code, title: t("index.embed"), desc: t("index.embed_desc"), color: "text-primary", bg: "bg-primary/10" },
    { icon: Trophy, title: t("index.leaderboard"), desc: t("index.leaderboard_desc"), color: "text-[hsl(var(--yellow))]", bg: "bg-[hsl(var(--yellow))]/10" },
    { icon: MessageCircle, title: t("index.social"), desc: t("index.social_desc"), color: "text-[hsl(var(--cyan))]", bg: "bg-[hsl(var(--cyan))]/10" },
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

        {/* Extra Features Grid */}
        <section className="container mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              <span className="gradient-text">{t("index.more_features")}</span>
            </h2>
            <p className="text-muted-foreground/60 mt-3 max-w-lg mx-auto">
              {t("index.more_features_desc")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {extraFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="p-6 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm hover:-translate-y-1 hover:border-border/40 transition-all duration-300 group cursor-default"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${feature.bg} ${feature.color} mb-4`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground/60 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
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
