import { ClientOnly } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const App = lazy(() => import('@/App'));

const fallback = (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

export function SpaRoute() {
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <App />
      </Suspense>
    </ClientOnly>
  );
}
