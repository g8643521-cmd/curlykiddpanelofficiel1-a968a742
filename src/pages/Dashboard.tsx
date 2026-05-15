import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { useI18n } from "@/lib/i18n";
import UnifiedSearch from "@/components/UnifiedSearch";
import DashboardHero from "@/components/DashboardHero";
import FavoritesList from "@/components/FavoritesList";
import SearchHistory from "@/components/SearchHistory";

import MaintenanceBanner from "@/components/MaintenanceBanner";
import Footer from "@/components/Footer";
import { useCfxApi } from "@/hooks/useCfxApi";
import { useFavorites } from "@/hooks/useFavorites";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useNotifications } from "@/hooks/useNotifications";
import { useServerPolling } from "@/hooks/useServerPolling";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { usePresence } from "@/hooks/usePresence";
import { useAuthReady } from "@/hooks/useAuthReady";
import { ErrorCard } from "@/components/feedback/ErrorCard";

// Lazy-load heavy components
const CosmicNebulaBackground = lazy(() => import("@/components/CosmicNebulaBackground"));
const ServerDetails = lazy(() => import("@/components/ServerDetails"));
const ServerDetailsSkeleton = lazy(() => import("@/components/ServerDetailsSkeleton"));
const ServerComparison = lazy(() => import("@/components/ServerComparison"));
const LatestMods = lazy(() => import("@/components/LatestMods"));
const FeaturedModsCarousel = lazy(() => import("@/components/FeaturedModsCarousel"));
const FeatureCards = lazy(() => import("@/components/FeatureCards"));

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const { isLoading, serverData, error: lookupError, errorDetails: lookupErrorDetails, lastSearchedCode, fetchServerData, clearData } = useCfxApi();
  const { favorites, isLoading: favoritesLoading, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { history, isLoading: historyLoading, refetch: refetchHistory, clearHistory } = useSearchHistory();
  const { 
    settings: notificationSettings, 
    permissionGranted, 
    requestPermission, 
    addNotification, 
    removeNotification, 
    hasNotification,
    getNotificationSettings,
    showNotification 
  } = useNotifications();
  const { isOwner, isAdmin, isModerator } = useAdminStatus();
  const { isReady, isAuthenticated } = useAuthReady();
  
  usePresence();
  
  const [showComparison, setShowComparison] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [currentServerLastUpdate, setCurrentServerLastUpdate] = useState<Date | null>(null);
  const [isRefreshingCurrent, setIsRefreshingCurrent] = useState(false);
  const searchSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSearch = useCallback(() => {
    searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const favoriteServerCodes = favorites.map(f => f.server_code);

  const { serverStatuses, isPolling, lastUpdate, manualRefresh } = useServerPolling({
    enabled: isReady && isAuthenticated && autoRefreshEnabled && !serverData && !showComparison,
    interval: 30000,
    serverCodes: favoriteServerCodes,
    notificationSettings,
    onNotification: showNotification,
  });

  const handleServerSelect = useCallback(async (serverCode: string) => {
    await fetchServerData(serverCode);
    await refetchHistory();
  }, [fetchServerData, refetchHistory]);

  const refreshCurrentServer = useCallback(async () => {
    if (!lastSearchedCode) return;
    setIsRefreshingCurrent(true);
    await fetchServerData(lastSearchedCode);
    setCurrentServerLastUpdate(new Date());
    setIsRefreshingCurrent(false);
  }, [lastSearchedCode, fetchServerData]);

  const handleLogoReset = useCallback(() => {
    if (serverData) {
      clearData();
      setCurrentServerLastUpdate(null);
    }
    if (showComparison) {
      setShowComparison(false);
    }
    navigate('/dashboard', { replace: true });
  }, [clearData, navigate, serverData, showComparison]);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isReady, isAuthenticated, navigate]);

  useEffect(() => {
    if (!serverData || !autoRefreshEnabled || !isReady || !isAuthenticated) return;
    setCurrentServerLastUpdate(prev => prev || new Date());
    const intervalId = setInterval(refreshCurrentServer, 30000);
    return () => clearInterval(intervalId);
  }, [serverData?.hostname, autoRefreshEnabled, refreshCurrentServer, isReady, isAuthenticated]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;

    const serverCode = searchParams.get('server');
    const showTour = searchParams.get('tour');
    
    if (serverCode) {
      fetchServerData(serverCode);
    }
    
    if (serverCode || showTour) {
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, fetchServerData, navigate, isReady, isAuthenticated]);


  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" style={{ willChange: 'transform' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <MaintenanceBanner />
      <Suspense fallback={<div className="fixed inset-0 -z-10" style={{ background: 'hsl(230, 25%, 4%)' }} />}>
        <CosmicNebulaBackground />
      </Suspense>
      
      <AppHeader onLogoClick={handleLogoReset} />

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8 md:py-12">
        {showComparison ? (
          <Suspense fallback={<div className="animate-pulse h-96 bg-muted/10 rounded-xl" />}>
            <ServerComparison onClose={() => setShowComparison(false)} />
          </Suspense>
        ) : serverData ? (
          <div className="mt-4">
            <Suspense fallback={<div className="animate-pulse h-96 bg-muted/10 rounded-xl" />}>
              <ServerDetails 
                data={serverData}
                serverCode={lastSearchedCode}
                onClose={clearData}
                isFavorite={lastSearchedCode ? isFavorite(lastSearchedCode) : false}
                onToggleFavorite={async () => {
                  if (!lastSearchedCode) return;
                  if (isFavorite(lastSearchedCode)) {
                    await removeFavorite(lastSearchedCode);
                  } else {
                    await addFavorite(lastSearchedCode, serverData.hostname);
                  }
                }}
                notificationProps={lastSearchedCode ? {
                  hasNotification: hasNotification(lastSearchedCode),
                  currentSettings: getNotificationSettings(lastSearchedCode),
                  permissionGranted,
                  onRequestPermission: requestPermission,
                  onSave: async (options) => {
                    return addNotification(lastSearchedCode, serverData.hostname, options);
                  },
                  onRemove: async () => {
                    return removeNotification(lastSearchedCode);
                  },
                } : undefined}
                lastUpdate={currentServerLastUpdate}
                isPolling={isRefreshingCurrent}
                onRefresh={refreshCurrentServer}
              />
            </Suspense>
          </div>
        ) : isLoading ? (
          <div className="mt-4">
            <Suspense fallback={<div className="animate-pulse h-96 bg-muted/10 rounded-xl" />}>
              <ServerDetailsSkeleton />
            </Suspense>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <DashboardHero onGetStarted={scrollToSearch} />

            {/* Unified Search Section */}
            <div ref={searchSectionRef} className="scroll-mt-24">
              <UnifiedSearch onServerSearch={handleServerSelect} isServerLoading={isLoading} />
              {lookupError && !isLoading && (
                <div className="max-w-2xl mx-auto mt-3">
                  <ErrorCard
                    title={t("lookup.failed") || "Server lookup failed"}
                    message={lookupError}
                    details={lookupErrorDetails}
                    onRetry={lastSearchedCode ? () => fetchServerData(lastSearchedCode, true) : undefined}
                    isRetrying={isLoading}
                  />
                </div>
              )}
            </div>

            {/* Favorites, History & Latest Mods */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-4">
              <FavoritesList 
                favorites={favorites}
                isLoading={favoritesLoading}
                onSelect={handleServerSelect}
                onRemove={removeFavorite}
                serverStatuses={serverStatuses}
              />
              <SearchHistory
                history={history}
                isLoading={historyLoading}
                onSelect={handleServerSelect}
                onClear={clearHistory}
              />
              <Suspense fallback={<div className="animate-pulse h-48 bg-muted/10 rounded-xl" />}>
                <LatestMods />
              </Suspense>
            </div>

            {/* Featured Mods Carousel */}
            <Suspense fallback={null}>
              <FeaturedModsCarousel />
            </Suspense>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
