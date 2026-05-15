/**
 * Preload utilities for critical resources and components
 * Helps improve perceived performance by loading resources ahead of time
 */

// Preload critical fonts
export const preloadFonts = () => {
  const fonts = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap',
  ];
  
  fonts.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);
  });
};

// Preload component on hover/focus - for navigation links
export const preloadComponent = (importFn: () => Promise<unknown>) => {
  // Use requestIdleCallback for non-blocking preload
  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
      importFn();
    });
  } else {
    setTimeout(() => importFn(), 100);
  }
};

// Preload dashboard components when user is likely to navigate there
export const preloadDashboard = () => {
  preloadComponent(() => import('../pages/Dashboard.tsx'));
  preloadComponent(() => import('../components/UnifiedSearch'));
  preloadComponent(() => import('../components/ServerDetails'));
};

// Preload profile components
export const preloadProfile = () => {
  preloadComponent(() => import('../pages/Profile.tsx'));
  preloadComponent(() => import('../components/FriendsPanel'));
};

// Preload admin components for admin users
export const preloadAdmin = () => {
  preloadComponent(() => import('../pages/AdminPanel.tsx'));
  
};

// Intersection Observer for lazy loading images
export const createLazyImageObserver = (callback: (entry: IntersectionObserverEntry) => void) => {
  if (typeof IntersectionObserver === 'undefined') return null;
  
  return new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry);
        }
      });
    },
    {
      rootMargin: '100px',
      threshold: 0.1,
    }
  );
};

// Debounce utility for performance
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Throttle utility for scroll/resize handlers
export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// RAF throttle for animations
export const rafThrottle = <T extends (...args: unknown[]) => void>(fn: T) => {
  let rafId: number | null = null;
  return (...args: Parameters<T>) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      fn(...args);
      rafId = null;
    });
  };
};
