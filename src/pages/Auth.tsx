import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Chrome, ArrowLeft, Loader2, Shield, Zap, Database, Users, CheckCircle2, Sparkles, Star, TrendingUp, Activity, Quote, Lock as LockIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ParticleBackground from "@/components/ParticleBackground";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import { supabase } from "@/lib/supabase";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import BrandLogo from "@/components/BrandLogo";
import { useI18n } from "@/lib/i18n";
import { logActivity } from "@/lib/activityLog";
import { getSessionWithTimeout, withTimeout } from "@/lib/authSession";
import { usePageMeta } from "@/hooks/usePageMeta";

type AuthMode = "login" | "signup" | "forgot-password";

const DiscordIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const parseBool = (v: unknown, fallback: boolean) => {
  if (v === undefined || v === null) return fallback;
  const s = String(v).replace(/^"|"$/g, "").toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return fallback;
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  usePageMeta({
    title: "Sign In or Create Account — CurlyKiddPanel",
    description: "Log in or sign up to CurlyKiddPanel and access FiveM server analytics, the cheater database, mods directory and player tracking tools.",
    path: "/login",
  });
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const processedDiscordCode = useRef<string | null>(null);
  const [recentAvatars, setRecentAvatars] = useState<string[]>([]);
  const [joinedThisWeek, setJoinedThisWeek] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc('get_login_social_proof');
      if (cancelled || error || !data) return;
      const avatars = Array.isArray(data.avatars) ? (data.avatars as string[]).filter(Boolean) : [];
      setRecentAvatars(avatars);
      setJoinedThisWeek(typeof data.joined_this_week === 'number' ? data.joined_this_week : 0);
    })();
    return () => { cancelled = true; };
  }, []);

  // Visibility flags loaded from admin_settings (Discord-only by default)
  const [isReturning] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const v = localStorage.getItem("ckp_has_visited");
      if (!v) localStorage.setItem("ckp_has_visited", "1");
      return v === "1";
    } catch {
      return false;
    }
  });

  const [vis, setVis] = useState({
    discord: true,
    google: false,
    apple: false,
    email: false,
    signup: false,
  });
  const [visLoaded, setVisLoaded] = useState(false);

  // Load auth-method visibility flags from public settings
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("admin_settings")
          .select("key,value")
          .in("key", [
            "auth_show_discord",
            "auth_show_google",
            "auth_show_apple",
            "auth_show_email",
            "auth_show_signup",
          ]);
        if (!active || !data) { setVisLoaded(true); return; }
        const next = { discord: true, google: false, apple: false, email: false, signup: false };
        for (const row of data) {
          const v = parseBool(row.value, false);
          if (row.key === "auth_show_discord") next.discord = v;
          if (row.key === "auth_show_google") next.google = v;
          if (row.key === "auth_show_apple") next.apple = v;
          if (row.key === "auth_show_email") next.email = v;
          if (row.key === "auth_show_signup") next.signup = v;
        }
        setVis(next);
      } catch {}
      setVisLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  // Handle Discord login callback (redirected back with ?code=...&state=discord_login)
  const handleDiscordCallback = useCallback(async (code: string) => {
    setDiscordLoading(true);
    try {
      const callbackPath = searchParams.get("discord_redirect_path") || "/login";
      const redirectUri = `${window.location.origin}${callbackPath.startsWith("/") ? callbackPath : "/login"}`;
      const fnUrl = `/api/public/discord-oauth?action=login_callback`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      });
      const data = await res.json();
      if (!res.ok || !data?.action_link) {
        throw new Error(data?.error || "Discord login failed");
      }
      void logActivity({ category: "auth", action: "Discord login", severity: "info", metadata: { discord_id: data?.discord?.id } });
      // Clean URL before redirecting to magic link
      window.history.replaceState({}, "", "/login");
      window.location.href = data.action_link;
    } catch (err: any) {
      console.error("Discord callback error:", err);
      toast.error(err?.message || "Could not sign in with Discord");
      setDiscordLoading(false);
      window.history.replaceState({}, "", "/login");
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && state === "discord_login") {
      if (processedDiscordCode.current !== code) {
        processedDiscordCode.current = code;
        handleDiscordCallback(code);
      }
      return () => { active = false; };
    }

    const checkSession = async () => {
      const { data: { session } } = await getSessionWithTimeout().catch(() => ({ data: { session: null } } as any));
      if (!active) return;
      if (session) navigate("/dashboard", { replace: true });
    };
    checkSession();

    // Only redirect on an explicit SIGNED_IN event from a user action.
    // Ignore INITIAL_SESSION / TOKEN_REFRESHED / USER_UPDATED so a stale
    // refresh-token sitting in localStorage can't silently bypass the
    // login screen while the user is just sitting on /auth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, searchParams, handleDiscordCallback]);

  const handleDiscordLogin = async () => {
    setDiscordLoading(true);
    try {
      const redirectUri = `${window.location.origin}/login`;
      const fnUrl = `/api/public/discord-oauth?action=login_initiate&redirect_uri=${encodeURIComponent(redirectUri)}`;
      const res = await fetch(fnUrl, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const data = await res.json();
      if (!data?.url) throw new Error(data?.error || "Could not start Discord login");
      window.location.href = data.url;
    } catch (err: any) {
      console.error("Discord login init error:", err);
      toast.error(err?.message || "Could not start Discord login");
      setDiscordLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    setIsLoading(true);
    try {
      const { error } = await withTimeout(
        lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }),
        12000,
        `${provider} sign-in timed out`,
      );
      if (error) throw error;
    } catch (error: any) {
      console.error(`${provider} auth error:`, error);
      toast.error(error.message || `${provider} sign-in failed`);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?mode=reset`,
      });
      if (error) throw error;
      toast.success(t("auth.reset_sent"));
      setAuthMode("login");
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (authMode === "login") {
        const { error } = await withTimeout<any>(
          supabase.auth.signInWithPassword({ email, password }),
          12000,
          "Login timed out",
        );
        if (error) throw error;
        // Don't navigate here — onAuthStateChange below handles redirect.
        // Calling navigate() twice causes a double-mount of Dashboard and
        // makes the loading spinner appear to "restart".
        toast.success(t("auth.welcome_msg"));
        void logActivity({ category: "auth", action: "User logged in", severity: "info", metadata: { email, method: "password" } });
      } else if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email.split("@")[0], role: "user" },
          },
        });
        if (error) throw error;
        supabase.functions.invoke("new-user-webhook", {
          body: { display_name: displayName || email.split("@")[0], email, id: "new-user" },
        }).catch((err) => console.error("Signup webhook failed:", err));
        toast.success(t("auth.account_created"));
        void logActivity({ category: "auth", action: "New account created", severity: "info", metadata: { email, display_name: displayName || email.split("@")[0] } });
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      void logActivity({ category: "auth", action: "Auth failed", severity: "warning", description: error?.message, metadata: { email, mode: authMode } });
      if (error.message?.includes("User already registered")) toast.error("This email is already registered. Try logging in instead.");
      else if (error.message?.includes("Invalid login credentials")) toast.error("Invalid email or password.");
      else toast.error(error.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (authMode) {
      case "login": return isReturning ? t("auth.welcome_back") : "Sign in to your account";
      case "signup": return t("auth.create_account");
      case "forgot-password": return t("auth.reset_password");
    }
  };
  const getSubtitle = () => {
    switch (authMode) {
      case "login": return isReturning ? t("auth.sign_in_desc") : "Access the CurlyKiddPanel operations suite.";
      case "signup": return t("auth.sign_up_desc");
      case "forgot-password": return t("auth.reset_desc");
    }
  };

  const showAnyOAuth = vis.google || vis.apple;
  const showEmail = vis.email;
  const showSignupToggle = vis.email && vis.signup;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <MaintenanceBanner />

      {/* Particle background — restored */}
      <ParticleBackground />

      {/* Ambient gradient orbs */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, scale: [1, 1.1, 1] }}
        transition={{ opacity: { duration: 1 }, scale: { duration: 16, repeat: Infinity, ease: "easeInOut" } }}
        className="pointer-events-none absolute left-1/4 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[140px] rounded-full -z-10"
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, scale: [1, 1.15, 1] }}
        transition={{ opacity: { duration: 1.2 }, scale: { duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 } }}
        className="pointer-events-none absolute right-1/4 bottom-1/3 translate-x-1/2 translate-y-1/2 w-[520px] h-[520px] bg-accent/15 blur-[140px] rounded-full -z-10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 35%, transparent 75%)",
        }}
      />
      {/* Subtle vignette for depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background))_100%)]" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="px-6 sm:px-10 pt-6 sm:pt-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group" aria-label="Back to home">
            <BrandLogo size="md" />
            <span className="hidden sm:inline-flex items-center rounded-md border border-border/40 bg-card/40 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 group-hover:text-foreground transition-colors">
              v2.0
            </span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href="https://discord.gg/curlykiddpanel"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground hover:border-border/70 transition-colors"
            >
              <DiscordIcon className="w-3.5 h-3.5" />
              Support
            </a>
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-emerald-400/90">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              All systems operational
            </div>
          </div>
        </header>

        {/* Centered auth */}
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[520px]"
          >
            {/* Eyebrow */}
            <div className="flex justify-center mb-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80 backdrop-blur-sm shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <Shield className="w-3 h-3 text-primary/80" strokeWidth={2.25} />
                Secure sign-in · End-to-end encrypted
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-9">
              <h1 className="font-display text-[2.1rem] sm:text-[2.5rem] font-semibold tracking-[-0.025em] leading-[1.05] mb-3">
                <span className="bg-gradient-to-b from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                  {getTitle()}
                </span>
              </h1>
              <p className="text-muted-foreground/90 text-[13.5px] leading-relaxed max-w-[360px] mx-auto">
                {getSubtitle()}
              </p>
            </div>

            {/* Social proof — recently joined avatars */}
            {recentAvatars.length > 0 && (
              <div className="flex items-center justify-center gap-3 mb-7">
                <div className="flex -space-x-2">
                  {recentAvatars.map((src, i) => (
                    <div
                      key={src + i}
                      className="relative w-7 h-7 rounded-full border-2 border-background overflow-hidden bg-muted ring-1 ring-border/40 transition-transform hover:-translate-y-0.5 hover:scale-110 hover:z-10"
                      style={{ zIndex: recentAvatars.length - i }}
                    >
                      <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                  {joinedThisWeek > recentAvatars.length && (
                    <div className="relative w-7 h-7 rounded-full border-2 border-background bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-[9px] font-bold text-foreground/90 ring-1 ring-border/40">
                      +{joinedThisWeek - recentAvatars.length}
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1 text-[11px]">
                    <TrendingUp className="w-3 h-3 text-emerald-400" strokeWidth={2.5} />
                    <span className="text-foreground/90 font-semibold ml-0.5">{joinedThisWeek}</span>
                    <span className="text-muted-foreground/70">new member{joinedThisWeek === 1 ? "" : "s"}</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground/70 leading-tight mt-0.5">
                    Joined this week
                  </p>
                </div>
              </div>
            )}

            {/* Auth card */}
            <div className="relative group/card">
              {/* Subtle animated conic border */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px rounded-[20px] opacity-40 transition-opacity duration-700 group-hover/card:opacity-60"
                style={{
                  background:
                    "conic-gradient(from var(--auth-angle,0deg), transparent 0deg, hsl(var(--primary)/0.35) 60deg, transparent 120deg, transparent 240deg, hsl(var(--accent)/0.25) 300deg, transparent 360deg)",
                  animation: "auth-spin 18s linear infinite",
                  WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  padding: "1px",
                }}
              />
              {/* Outer soft halo — refined */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-10 rounded-[32px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.10),transparent_70%)] blur-3xl"
              />

              <div className="relative rounded-[20px] border border-border/50 bg-card/70 backdrop-blur-xl shadow-[0_50px_140px_-40px_hsl(var(--primary)/0.5),0_2px_0_0_hsl(var(--foreground)/0.04)_inset] p-9 sm:p-11 overflow-hidden">
                {/* Top shimmer line */}
                <div className="absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                {/* Corner accents */}
                <div aria-hidden className="pointer-events-none absolute -top-px -left-px h-8 w-8 rounded-tl-[18px] border-t border-l border-primary/40" />
                <div aria-hidden className="pointer-events-none absolute -top-px -right-px h-8 w-8 rounded-tr-[18px] border-t border-r border-primary/40" />
                <div aria-hidden className="pointer-events-none absolute -bottom-px -left-px h-8 w-8 rounded-bl-[18px] border-b border-l border-accent/30" />
                <div aria-hidden className="pointer-events-none absolute -bottom-px -right-px h-8 w-8 rounded-br-[18px] border-b border-r border-accent/30" />
                {/* Diagonal sheen */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[18px] opacity-[0.06]"
                  style={{
                    background:
                      "linear-gradient(135deg, transparent 0%, transparent 40%, hsl(var(--foreground)) 50%, transparent 60%, transparent 100%)",
                  }}
                />

              {discordLoading && (
                <div className="mb-5 flex items-center justify-center gap-2 rounded-xl border border-[#5865F2]/25 bg-[#5865F2]/[0.08] py-3 text-[13px] text-foreground/90">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing you in with Discord…
                </div>
              )}

              {authMode === "forgot-password" ? (
                <>
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-foreground/90 text-[13px] font-medium">{t("auth.email")}</Label>
                      <div className="relative group">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-11 h-12 bg-secondary/30 border-border/50 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all" />
                      </div>
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full h-12 bg-primary hover:bg-primary/90 text-[14.5px] text-primary-foreground font-semibold tracking-tight shadow-lg shadow-primary/15 group">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<>{t("auth.send_reset")}<ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" /></>)}
                    </Button>
                  </form>
                  <div className="mt-6 text-center">
                    <button type="button" onClick={() => setAuthMode("login")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5">
                      <ArrowLeft className="w-4 h-4" />{t("auth.back_to_sign_in")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {vis.discord && (
                      <div className="group/discord relative">
                        {/* Recommended ribbon — floats + pulses */}
                        <div className="absolute -top-2 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#5865F2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white auth-ribbon-float">
                          <Sparkles className="w-2.5 h-2.5 auth-sparkle-twinkle" />
                          Recommended
                        </div>


                        <Button
                          type="button"
                          onClick={handleDiscordLogin}
                          disabled={discordLoading || isLoading}
                          className="relative w-full h-12 bg-[#5865F2] text-[14.5px] hover:bg-[#4752C4] text-white font-semibold tracking-tight border-0 shadow-lg shadow-[#5865F2]/25 hover:shadow-[#5865F2]/60 transition-all overflow-hidden group/btn"
                        >
                          {/* Sweep shimmer */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 -translate-x-full group-hover/btn:translate-x-[400%] transition-transform duration-[900ms] ease-out"
                          />
                          {/* Second sweep, delayed */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 -translate-x-full group-hover/btn:translate-x-[450%] transition-transform duration-[1400ms] ease-out delay-150"
                          />
                          <DiscordIcon className="w-[18px] h-[18px] mr-2 transition-transform duration-500 group-hover/btn:scale-125 group-hover/btn:-rotate-12" />
                          Continue with Discord
                          <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-3 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300" />
                        </Button>

                        {/* Drop-down details panel on hover */}
                        <div className="grid grid-rows-[0fr] group-hover/discord:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
                          <div className="overflow-hidden">
                            <div className="mt-2 rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/[0.06] backdrop-blur-sm p-3 opacity-0 -translate-y-1 group-hover/discord:opacity-100 group-hover/discord:translate-y-0 transition-all duration-300 delay-75">
                              <div className="flex items-center gap-2 mb-2">
                                <DiscordIcon className="w-3.5 h-3.5 text-[#5865F2]" />
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/90">
                                  Fastest sign-in
                                </span>
                              </div>
                              <ul className="space-y-1.5 text-[11.5px] text-muted-foreground/90 auth-tick-stagger">
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>One-click — no password to remember</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>Auto-syncs your Discord roles &amp; servers</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>Used by 95% of CurlyKiddPanel members</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {vis.google && (
                      <div className="group/google relative">
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#4285F4]/30 via-[#EA4335]/20 to-[#FBBC05]/30 opacity-0 blur-lg transition-opacity duration-300 group-hover/google:opacity-100"
                        />
                        <Button type="button" variant="outline" onClick={() => handleOAuthSignIn("google")} disabled={isLoading || discordLoading} className="relative w-full h-12 border-border/50 hover:bg-secondary/50 hover:border-border/80 transition-all font-medium overflow-hidden group/btn">
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-foreground/10 to-transparent skew-x-12 -translate-x-full group-hover/btn:translate-x-[400%] transition-transform duration-[900ms] ease-out"
                          />
                          <Chrome className="w-[18px] h-[18px] mr-2 transition-transform duration-300 group-hover/btn:scale-110 group-hover/btn:-rotate-6" />
                          {t("auth.continue_google")}
                          <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300" />
                        </Button>
                        <div className="grid grid-rows-[0fr] group-hover/google:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
                          <div className="overflow-hidden">
                            <div className="mt-2 rounded-xl border border-border/50 bg-secondary/20 backdrop-blur-sm p-3 opacity-0 -translate-y-1 group-hover/google:opacity-100 group-hover/google:translate-y-0 transition-all duration-300 delay-75">
                              <div className="flex items-center gap-2 mb-2">
                                <Chrome className="w-3.5 h-3.5 text-[#4285F4]" />
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/90">
                                  Quick & familiar
                                </span>
                              </div>
                              <ul className="space-y-1.5 text-[11.5px] text-muted-foreground/90 auth-tick-stagger">
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>Sign in with your existing Google account</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>Two-factor security handled by Google</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>No password to remember</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {vis.apple && (
                      <div className="group/apple relative">
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -inset-0.5 rounded-xl bg-foreground/15 opacity-0 blur-lg transition-opacity duration-300 group-hover/apple:opacity-100"
                        />
                        <Button type="button" variant="outline" onClick={() => handleOAuthSignIn("apple")} disabled={isLoading || discordLoading} className="relative w-full h-12 border-border/50 hover:bg-secondary/50 hover:border-border/80 transition-all font-medium overflow-hidden group/btn">
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-foreground/10 to-transparent skew-x-12 -translate-x-full group-hover/btn:translate-x-[400%] transition-transform duration-[900ms] ease-out"
                          />
                          <svg className="w-[18px] h-[18px] mr-2 transition-transform duration-300 group-hover/btn:scale-110 group-hover/btn:-rotate-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                          </svg>
                          Continue with Apple
                          <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300" />
                        </Button>
                        <div className="grid grid-rows-[0fr] group-hover/apple:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
                          <div className="overflow-hidden">
                            <div className="mt-2 rounded-xl border border-border/50 bg-secondary/20 backdrop-blur-sm p-3 opacity-0 -translate-y-1 group-hover/apple:opacity-100 group-hover/apple:translate-y-0 transition-all duration-300 delay-75">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-3.5 h-3.5 text-foreground/90" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                                </svg>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/90">
                                  Private & secure
                                </span>
                              </div>
                              <ul className="space-y-1.5 text-[11.5px] text-muted-foreground/90 auth-tick-stagger">
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>Hide My Email keeps your inbox private</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>Face ID / Touch ID on supported devices</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400/90 flex-shrink-0" />
                                  <span>No tracking — Apple privacy by default</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {showEmail && (vis.discord || showAnyOAuth) && (
                      <div className="relative py-3">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
                          <span className="bg-card/0 px-3 text-muted-foreground/60 font-medium">{t("auth.or")}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {showEmail ? (
                    <>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        {authMode === "signup" && showSignupToggle && (
                          <div className="space-y-2">
                            <Label htmlFor="displayName" className="text-foreground/90 text-[13px] font-medium">{t("auth.display_name")}</Label>
                            <div className="relative group">
                              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                              <Input id="displayName" type="text" placeholder={t("auth.display_name_placeholder")} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="pl-11 h-12 bg-secondary/30 border-border/50 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all" />
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-foreground/90 text-[13px] font-medium">{t("auth.email")}</Label>
                          <div className="relative group">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-11 h-12 bg-secondary/30 border-border/50 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-foreground/90 text-[13px] font-medium">{t("auth.password")}</Label>
                            {authMode === "login" && (
                              <button type="button" onClick={() => setAuthMode("forgot-password")} className="text-[11.5px] text-primary/90 hover:text-primary transition-colors font-medium">
                                {t("auth.forgot_password")}
                              </button>
                            )}
                          </div>
                          <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-11 h-12 bg-secondary/30 border-border/50 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all" />
                          </div>
                        </div>
                        <Button type="submit" disabled={isLoading || discordLoading} className="w-full h-12 bg-primary hover:bg-primary/90 text-[14.5px] text-primary-foreground font-semibold tracking-tight shadow-lg shadow-primary/15 group mt-1">
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<>{authMode === "login" ? t("auth.sign_in") : t("auth.sign_up")}<ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" /></>)}
                        </Button>
                      </form>
                      {showSignupToggle && (
                        <div className="mt-6 text-center">
                          <button type="button" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                            {authMode === "login" ? (<>{t("auth.no_account")} <span className="text-primary font-semibold">{t("auth.sign_up_link")}</span></>) : (<>{t("auth.has_account")} <span className="text-primary font-semibold">{t("auth.sign_in_link")}</span></>)}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    visLoaded && !vis.discord && !showAnyOAuth && (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        No login methods are currently enabled. Please contact an administrator.
                      </p>
                    )
                  )}

                  {visLoaded && vis.discord && (
                    <p className="mt-6 text-center text-[10.5px] leading-relaxed text-muted-foreground/60 max-w-[300px] mx-auto">
                      By continuing, your Discord profile (username, ID, avatar, email) will be linked to your account.
                    </p>
                  )}
                </>
              )}
              </div>
            </div>

            {/* Trust strip */}
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/50 font-medium">
                  Trusted by FiveM operators
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border/30 bg-card/20 backdrop-blur-sm px-2 py-2.5">
                  <div className="font-display text-base font-semibold text-foreground leading-none">495+</div>
                  <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/60 mt-1">Cheaters tracked</div>
                </div>
                <div className="rounded-lg border border-border/30 bg-card/20 backdrop-blur-sm px-2 py-2.5">
                  <div className="font-display text-base font-semibold text-foreground leading-none">99.9%</div>
                  <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/60 mt-1">Uptime</div>
                </div>
                <div className="rounded-lg border border-border/30 bg-card/20 backdrop-blur-sm px-2 py-2.5">
                  <div className="font-display text-base font-semibold text-foreground leading-none">24/7</div>
                  <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/60 mt-1">Live monitoring</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/60 font-medium">
                <div className="flex items-center gap-1.5">
                  <LockIcon className="w-3 h-3 text-primary/60" strokeWidth={2.25} />
                  <span>AES-256</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-primary/60" strokeWidth={2.25} />
                  <span>GDPR compliant</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-primary/60" strokeWidth={2.25} />
                  <span>SOC-grade</span>
                </div>
              </div>
            </div>

            {/* Back to home */}
            <div className="mt-6 flex justify-center">
              <a
                href="/"
                className="group inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground/60 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                Back to home
              </a>
            </div>
          </motion.div>
        </main>
      </div>

      <Footer />
    </div>

  );
};

export default Auth;
