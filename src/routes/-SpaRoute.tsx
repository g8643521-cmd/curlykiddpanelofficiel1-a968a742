import { ClientOnly } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useState } from 'react';

const App = lazy(() => import('@/App'));

const fallback = (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

function DiscordCallbackForwarder({ children }: { children: React.ReactNode }) {
  const [forwarding, setForwarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('state') === 'discord_login' && !!params.get('code');
  });

  useEffect(() => {
    if (!forwarding) return;
    const search = window.location.search;
    window.location.replace(`/login${search}`);
  }, [forwarding]);

  if (forwarding) return fallback;
  return <>{children}</>;
}

export function SpaRoute() {
  return (
    <ClientOnly fallback={fallback}>
      <DiscordCallbackForwarder>
        <Suspense fallback={fallback}>
          <App />
        </Suspense>
      </DiscordCallbackForwarder>
    </ClientOnly>
  );
}
