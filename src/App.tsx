import { lazy, Suspense, useEffect } from "react";
import { useGlobalClickSound } from "@/hooks/useGlobalClickSound";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { preloadDashboard, preloadProfile } from "@/lib/preload";
import { registerServiceWorker } from "@/lib/serviceWorker";
import { supabase } from "@/lib/supabase";
import ProtectedRoute from "@/components/ProtectedRoute";
import SiteBackground from "@/components/SiteBackground";
import { usePageViewLogger, installGlobalErrorLogger } from "@/lib/usePageViewLogger";
import { syncCurrentUserProfile } from "@/lib/profileSync";

const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const PublicProfile = lazy(() => import("./pages/PublicProfile.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const AdminPanel = lazy(() => import("./pages/AdminPanel.tsx"));
const ModeratorPanel = lazy(() => import("./pages/ModeratorPanel.tsx"));
const CheaterSearch = lazy(() => import("./pages/CheaterSearch.tsx"));
const FiveMMods = lazy(() => import("./pages/FiveMMods.tsx"));
const CoordinateLookup = lazy(() => import("./pages/CoordinateLookup.tsx"));
const ServerEmbed = lazy(() => import("./pages/ServerEmbed.tsx"));
const BotSetup = lazy(() => import("./pages/BotSetup.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const XPNotifications = lazy(() => import("./components/XPNotifications"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div
      className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
      style={{ willChange: 'transform' }}
    />
  </div>
);

const AppRoutes = () => {
  useGlobalClickSound();
  usePageViewLogger();

  useEffect(() => {
    installGlobalErrorLogger();
  }, []);

  useEffect(() => {
    const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup-webhook`;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const dispatchSignupWebhook = (event: string, session: any) => {
      if (!session?.user) return;
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;

      const lastSignInMs = session.user.last_sign_in_at
        ? new Date(session.user.last_sign_in_at).getTime()
        : 0;

      if (!lastSignInMs || Date.now() - lastSignInMs > 2 * 60 * 1000) {
        return;
      }

      const dispatchKey = `signup-webhook:${session.user.id}:${session.user.last_sign_in_at ?? session.user.created_at ?? 'unknown'}`;
      if (sessionStorage.getItem(dispatchKey)) return;
      sessionStorage.setItem(dispatchKey, '1');

      const provider = session.user.app_metadata?.provider || 'email';
      const payload = {
        user_email: session.user.email,
        display_name:
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.display_name ||
          session.user.email?.split('@')[0],
        auth_provider: provider,
        avatar_url: session.user.user_metadata?.avatar_url || null,
        user_id: session.user.id,
        user_agent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screen_resolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        referrer: document.referrer || 'Direct',
        created_at: session.user.created_at,
        last_sign_in: session.user.last_sign_in_at,
        email_confirmed: session.user.email_confirmed_at ? 'Yes' : 'No',
        phone: session.user.phone || null,
      };

      void fetch(endpoint, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey,
          ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) {
            sessionStorage.removeItem(dispatchKey);
            console.error('Signup webhook failed:', response.status);
          }
        })
        .catch((error) => {
          sessionStorage.removeItem(dispatchKey);
          console.error('Signup webhook failed:', error);
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') && session?.user) {
        void syncCurrentUserProfile().catch((error) => console.warn('Profile sync failed:', error));
      }
      dispatchSignupWebhook(event, session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const preload = () => {
      // Only preload heavy authenticated pages if a session exists.
      // Otherwise /auth and /index drag in Dashboard, Profile, FriendsPanel, etc. for nothing.
      let hasSession = false;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
            hasSession = true;
            break;
          }
        }
      } catch {}
      if (!hasSession) return;
      preloadDashboard();
      preloadProfile();
    };

    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(preload);
    } else {
      setTimeout(preload, 1500);
    }

    registerServiceWorker();

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.closest('[data-allow-context-menu]')) return;
      if (target.closest('[data-radix-collection-item]')) return;
      if (target.closest('[data-state]')) return;
      if (target.closest('.cursor-context-menu')) return;

      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return (
    <>
      <SiteBackground />
      <Suspense fallback={null}>
        <XPNotifications />
      </Suspense>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/login/" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/settings/" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/user/:id" element={<PublicProfile />} />
          <Route path="/user/:id/" element={<PublicProfile />} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/admin/" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/moderator" element={<ProtectedRoute><ModeratorPanel /></ProtectedRoute>} />
          <Route path="/moderator/" element={<ProtectedRoute><ModeratorPanel /></ProtectedRoute>} />
          <Route path="/cheaters" element={<ProtectedRoute><CheaterSearch /></ProtectedRoute>} />
          <Route path="/cheaters/" element={<ProtectedRoute><CheaterSearch /></ProtectedRoute>} />
          <Route path="/cheater-search" element={<ProtectedRoute><CheaterSearch /></ProtectedRoute>} />
          <Route path="/cheater-search/" element={<ProtectedRoute><CheaterSearch /></ProtectedRoute>} />
          <Route path="/mods" element={<ProtectedRoute><FiveMMods /></ProtectedRoute>} />
          <Route path="/mods/" element={<ProtectedRoute><FiveMMods /></ProtectedRoute>} />
          <Route path="/coordinates" element={<ProtectedRoute><CoordinateLookup /></ProtectedRoute>} />
          <Route path="/coordinates/" element={<ProtectedRoute><CoordinateLookup /></ProtectedRoute>} />
          <Route path="/embed/:serverCode" element={<ServerEmbed />} />
          <Route path="/embed/:serverCode/" element={<ServerEmbed />} />
          <Route path="/bot" element={<ProtectedRoute><BotSetup /></ProtectedRoute>} />
          <Route path="/bot/" element={<ProtectedRoute><BotSetup /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ConfirmProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfirmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
