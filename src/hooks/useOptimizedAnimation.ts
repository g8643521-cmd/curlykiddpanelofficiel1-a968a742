import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for optimized animations that respects user preferences
 * and pauses animations when not visible
 */
export const useOptimizedAnimation = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isOptimizedMode, setIsOptimizedMode] = useState(() => 
    localStorage.getItem('optimized_mode') !== 'false'
  );
  
  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  useEffect(() => {
    // Track page visibility
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  useEffect(() => {
    // Listen for optimized mode changes
    const handleOptimizedChange = (e: CustomEvent<boolean>) => {
      setIsOptimizedMode(e.detail);
    };
    
    window.addEventListener('optimized-mode-change', handleOptimizedChange as EventListener);
    return () => window.removeEventListener('optimized-mode-change', handleOptimizedChange as EventListener);
  }, []);
  
  // Should animations be enabled?
  const shouldAnimate = isVisible && !prefersReducedMotion;
  
  // Get animation duration multiplier (reduced in optimized mode)
  const durationMultiplier = isOptimizedMode ? 0.5 : 1;
  
  return {
    isVisible,
    prefersReducedMotion,
    isOptimizedMode,
    shouldAnimate,
    durationMultiplier,
  };
};

/**
 * Hook for intersection-based lazy animations
 */
export const useLazyAnimation = (threshold = 0.1) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const hasAnimated = useRef(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          setIsInView(true);
          hasAnimated.current = true;
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '50px' }
    );
    
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);
  
  return { ref, isInView };
};

/**
 * Hook for optimized scroll position tracking
 */
export const useScrollPosition = (throttleMs = 100) => {
  const [scrollY, setScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  
  useEffect(() => {
    const updateScrollPosition = () => {
      const currentScrollY = window.scrollY;
      setScrollDirection(currentScrollY > lastScrollY.current ? 'down' : 'up');
      lastScrollY.current = currentScrollY;
      setScrollY(currentScrollY);
      ticking.current = false;
    };
    
    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(updateScrollPosition);
        ticking.current = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [throttleMs]);
  
  return { scrollY, scrollDirection };
};

/**
 * Optimized framer-motion variants for common animations
 */
export const optimizedVariants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.2 }
    }
  },
  fadeInUp: {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }
    }
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.2 }
    }
  },
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.05,
      }
    }
  },
  staggerItem: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 }
    }
  }
};

/**
 * GPU-accelerated transform properties
 * Using transform and opacity only for best performance
 */
export const gpuAcceleratedProps = {
  style: {
    willChange: 'transform, opacity',
    transform: 'translateZ(0)', // Force GPU layer
  }
};
