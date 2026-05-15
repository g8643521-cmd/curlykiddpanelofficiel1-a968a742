// Service Worker Registration and Management

export const SW_VERSION = 'v1';

async function clearAllCaches(): Promise<void> {
  if (!('caches' in window)) return;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
}

async function unregisterExistingServiceWorkers(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  await clearAllCaches();
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const swCheck = await fetch('/sw.js', { method: 'HEAD', cache: 'no-store' });
    const contentType = swCheck.headers.get('content-type') || '';

    if (!swCheck.ok || !contentType.includes('javascript')) {
      await unregisterExistingServiceWorkers();
      return null;
    }

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    console.log('Service Worker registered:', registration.scope);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Every hour

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export function skipWaiting(): void {
  navigator.serviceWorker.controller?.postMessage('skipWaiting');
}

export function clearCache(): void {
  navigator.serviceWorker.controller?.postMessage('clearCache');
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const success = await registration.unregister();
    if (success) {
      await clearAllCaches();
    }
    return success;
  } catch {
    return false;
  }
}

// Check if app is running from cache (offline)
export function isOffline(): boolean {
  return !navigator.onLine;
}

// Listen for online/offline events
export function setupConnectivityListeners(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = () => {
    console.log('App is online');
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('App is offline');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
