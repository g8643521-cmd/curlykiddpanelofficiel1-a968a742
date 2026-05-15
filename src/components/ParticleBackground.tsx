import { useMemo, memo } from "react";

// Reduced counts for better performance
const PARTICLE_COUNT_FULL = 25;
const PARTICLE_COUNT_OPTIMIZED = 8;
const GLOW_ORB_COUNT_FULL = 3;
const GLOW_ORB_COUNT_OPTIMIZED = 1;
const STAR_COUNT_FULL = 40;
const STAR_COUNT_OPTIMIZED = 15;
const NEBULA_COUNT_FULL = 3;
const NEBULA_COUNT_OPTIMIZED = 1;

const ParticleBackground = memo(() => {
  const mousePosition = { x: 0, y: 0 };
  const shootingStars: Array<{
    id: number;
    startX: number;
    startY: number;
    angle: number;
    duration: number;
    tailLength: number;
    intensity: number;
  }> = [];
  const isVisible = true;
  const isOptimized = true;

  // Static data - computed once based on optimized mode
  const particleCount = isOptimized ? PARTICLE_COUNT_OPTIMIZED : PARTICLE_COUNT_FULL;
  const glowOrbCount = isOptimized ? GLOW_ORB_COUNT_OPTIMIZED : GLOW_ORB_COUNT_FULL;
  const starCount = isOptimized ? STAR_COUNT_OPTIMIZED : STAR_COUNT_FULL;
  const nebulaCount = isOptimized ? NEBULA_COUNT_OPTIMIZED : NEBULA_COUNT_FULL;

  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 20}s`,
      animationDuration: `${15 + Math.random() * 15}s`,
      size: `${2 + Math.random() * 4}px`,
      opacity: 0.15 + Math.random() * 0.35,
      hue: 170 + Math.random() * 15,
      lightness: 45 + Math.random() * 25,
      parallaxFactor: 0.5 + Math.random() * 1.5,
    }));
  }, [particleCount]);

  const glowOrbs = useMemo(() => {
    const colors = [
      { hue: 174, sat: 72 },
      { hue: 174, sat: 80 },
      { hue: 190, sat: 60 },
      { hue: 320, sat: 50 },
      { hue: 174, sat: 65 },
      { hue: 200, sat: 55 },
    ];
    return Array.from({ length: glowOrbCount }, (_, i) => ({
      id: i,
      left: `${5 + (i * 16) + Math.random() * 10}%`,
      top: `${10 + Math.random() * 70}%`,
      animationDelay: `${i * 1.5}s`,
      animationDuration: `${8 + Math.random() * 10}s`,
      size: `${250 + Math.random() * 300}px`,
      opacity: 0.04 + Math.random() * 0.03,
      color: colors[i % colors.length],
      parallaxFactor: 2 + Math.random() * 3,
    }));
  }, [glowOrbCount]);

  const stars = useMemo(() => {
    return Array.from({ length: starCount }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${1 + Math.random() * 2}px`,
      animationDelay: `${Math.random() * 5}s`,
      opacity: 0.1 + Math.random() * 0.5,
      parallaxFactor: 0.2 + Math.random() * 0.8,
    }));
  }, [starCount]);

  const nebulaClouds = useMemo(() => {
    const nebulaColors = [
      { hue: 174, sat: 60, light: 45 },
      { hue: 190, sat: 55, light: 40 },
      { hue: 200, sat: 50, light: 42 },
      { hue: 168, sat: 65, light: 48 },
      { hue: 185, sat: 58, light: 44 },
    ];
    return Array.from({ length: nebulaCount }, (_, i) => ({
      id: i,
      left: `${10 + Math.random() * 80}%`,
      top: `${10 + Math.random() * 80}%`,
      width: `${400 + Math.random() * 400}px`,
      height: `${300 + Math.random() * 300}px`,
      color: nebulaColors[i % nebulaColors.length],
      animationDelay: `${i * 3}s`,
      animationDuration: `${25 + Math.random() * 15}s`,
      rotation: Math.random() * 360,
    }));
  }, [nebulaCount]);

  // Pause CSS animations when not visible
  const animationState = 'paused';

  return (
    <div 
      className="particles-bg background-breathing"
      style={{ animationPlayState: animationState }}
    >
      {/* Deep dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220,30%,4%)] via-[hsl(200,25%,6%)] to-[hsl(230,25%,5%)]" />
      
      {/* Mesh gradient overlay with parallax */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          transform: isVisible ? `translate(${mousePosition.x * 2}px, ${mousePosition.y * 2}px)` : undefined,
        }}
      >
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 0% 0%, hsl(174, 72%, 50%, 0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 0%, hsl(320, 80%, 50%, 0.05) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 100%, hsl(174, 72%, 50%, 0.06) 0%, transparent 50%),
              radial-gradient(ellipse at 0% 100%, hsl(200, 70%, 50%, 0.05) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      {/* Nebula clouds */}
      {nebulaClouds.map((nebula) => (
        <div
          key={`nebula-${nebula.id}`}
          className="nebula-cloud"
          style={{
            left: nebula.left,
            top: nebula.top,
            width: nebula.width,
            height: nebula.height,
            background: `radial-gradient(ellipse at center, hsl(${nebula.color.hue}, ${nebula.color.sat}%, ${nebula.color.light}%, 0.04) 0%, hsl(${nebula.color.hue}, ${nebula.color.sat}%, ${nebula.color.light}%, 0.02) 40%, transparent 70%)`,
            animationDelay: nebula.animationDelay,
            animationDuration: nebula.animationDuration,
            transform: `rotate(${nebula.rotation}deg)`,
            animationPlayState: animationState,
          }}
        />
      ))}

      {/* Animated aurora waves */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute w-[200%] h-[60%] top-0 -left-1/2 aurora-wave-primary"
          style={{
            transform: isVisible ? `rotate(-5deg) translate(${mousePosition.x * 6}px, ${mousePosition.y * 4}px)` : 'rotate(-5deg)',
            filter: 'blur(60px)',
            animationPlayState: animationState,
          }}
        />
        <div 
          className="absolute w-[200%] h-[40%] bottom-0 -right-1/2 aurora-wave-secondary"
          style={{
            transform: isVisible ? `rotate(3deg) translate(${mousePosition.x * -4}px, ${mousePosition.y * -3}px)` : 'rotate(3deg)',
            filter: 'blur(80px)',
            animationPlayState: animationState,
          }}
        />
      </div>

      {/* Central glow */}
      <div 
        className="absolute top-1/3 left-1/2 w-[800px] h-[800px] rounded-full animate-pulse-slow"
        style={{ 
          background: 'radial-gradient(circle, hsl(174, 72%, 50%, 0.04) 0%, hsl(174, 72%, 50%, 0.02) 30%, transparent 60%)',
          filter: 'blur(40px)',
          transform: isVisible ? `translate(calc(-50% + ${mousePosition.x * 8}px), ${mousePosition.y * 8}px)` : 'translate(-50%, 0)',
          animationPlayState: animationState,
        }} 
      />

      {/* Realistic shooting stars - only render when visible */}
      {isVisible && shootingStars.map((star) => (
        <div
          key={star.id}
          className="absolute pointer-events-none meteor"
          style={{
            left: `${star.startX}%`,
            top: `${star.startY}%`,
            '--angle': `${star.angle}deg`,
            '--duration': `${star.duration}s`,
            '--tail-length': `${star.tailLength}px`,
            '--intensity': star.intensity,
          } as React.CSSProperties}
        >
          <div className="meteor-trail" style={{ width: `${star.tailLength * 1.2}px` }} />
          <div className="meteor-body" style={{ width: `${star.tailLength}px` }} />
          <div className="meteor-head" />
        </div>
      ))}

      {/* Twinkling stars */}
      {stars.map((star) => (
        <div
          key={`star-${star.id}`}
          className="absolute rounded-full animate-twinkle"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: star.animationDelay,
            background: 'hsl(174, 60%, 85%)',
            boxShadow: '0 0 6px hsl(174, 70%, 70%)',
            transform: isVisible ? `translate(${mousePosition.x * star.parallaxFactor * 3}px, ${mousePosition.y * star.parallaxFactor * 3}px)` : undefined,
            animationPlayState: animationState,
          }}
        />
      ))}

      {/* Floating glow orbs */}
      {glowOrbs.map((orb) => (
        <div
          key={`glow-${orb.id}`}
          className="absolute rounded-full blur-3xl animate-float-slow"
          style={{
            left: orb.left,
            top: orb.top,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, hsl(${orb.color.hue}, ${orb.color.sat}%, 50%) 0%, transparent 70%)`,
            opacity: orb.opacity,
            animationDelay: orb.animationDelay,
            animationDuration: orb.animationDuration,
            transform: isVisible ? `translate(${mousePosition.x * orb.parallaxFactor * 3}px, ${mousePosition.y * orb.parallaxFactor * 3}px)` : undefined,
            animationPlayState: animationState,
          }}
        />
      ))}
      
      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="particle-comet"
          style={{
            left: particle.left,
            animationDelay: particle.animationDelay,
            animationDuration: particle.animationDuration,
            '--particle-size': particle.size,
            '--particle-hue': particle.hue,
            '--particle-lightness': particle.lightness,
            '--particle-opacity': particle.opacity,
            transform: isVisible ? `translate(${mousePosition.x * particle.parallaxFactor * 2}px, ${mousePosition.y * particle.parallaxFactor * 2}px)` : undefined,
            animationPlayState: animationState,
          } as React.CSSProperties}
        >
          <div className="particle-trail" />
          <div 
            className="particle-head"
            style={{
              width: particle.size,
              height: particle.size,
              background: `hsl(${particle.hue}, 72%, ${particle.lightness}%)`,
              boxShadow: `0 0 10px hsl(${particle.hue}, 72%, ${particle.lightness}%), 0 0 20px hsl(${particle.hue}, 72%, ${particle.lightness}%, 0.5)`,
            }}
          />
        </div>
      ))}

      {/* Subtle noise texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 30%, hsl(220, 30%, 3%, 0.8) 100%)',
        }} 
      />

      {/* Meteor styles */}
      <style>{`
        .meteor {
          transform: rotate(var(--angle));
          animation: meteor-flash var(--duration) cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .meteor-trail {
          position: absolute;
          height: 1px;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: linear-gradient(270deg, hsla(200, 40%, 70%, 0.3) 0%, hsla(200, 30%, 60%, 0.1) 30%, transparent 100%);
          opacity: 0;
          animation: trail-fade var(--duration) ease-out forwards;
          animation-delay: calc(var(--duration) * 0.1);
        }
        .meteor-body {
          position: absolute;
          height: 2px;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: linear-gradient(270deg, hsl(60, 100%, 97%) 0%, hsl(45, 100%, 90%) 2%, hsl(35, 95%, 75%) 8%, hsl(25, 90%, 60%) 20%, hsla(200, 50%, 55%, 0.5) 50%, transparent 100%);
          border-radius: 1px;
          opacity: 0;
          animation: meteor-streak var(--duration) ease-out forwards;
        }
        .meteor-head {
          position: absolute;
          width: 3px;
          height: 3px;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: radial-gradient(circle, hsl(60, 100%, 100%) 0%, hsl(50, 100%, 95%) 30%, hsl(40, 100%, 85%) 60%, hsl(30, 95%, 70%) 100%);
          border-radius: 50%;
          box-shadow: 0 0 4px 1px hsl(50, 100%, 95%), 0 0 8px 2px hsl(45, 100%, 85%), 0 0 15px 3px hsl(40, 90%, 70%, 0.8), 0 0 25px 5px hsl(35, 80%, 60%, 0.4);
          opacity: 0;
          animation: meteor-head-flash var(--duration) ease-out forwards;
        }
        @keyframes meteor-flash {
          0% { transform: rotate(var(--angle)) translateX(0); }
          100% { transform: rotate(var(--angle)) translateX(calc(var(--tail-length) * 2)); }
        }
        @keyframes meteor-streak {
          0% { opacity: 0; transform: translateY(-50%) scaleX(0.3); }
          10% { opacity: calc(var(--intensity) * 1); transform: translateY(-50%) scaleX(1); }
          80% { opacity: calc(var(--intensity) * 0.6); }
          100% { opacity: 0; transform: translateY(-50%) scaleX(0.8); }
        }
        @keyframes meteor-head-flash {
          0% { opacity: 0; transform: translateY(-50%) scale(0.5); }
          8% { opacity: 1; transform: translateY(-50%) scale(1.2); }
          20% { transform: translateY(-50%) scale(1); }
          85% { opacity: 0.9; }
          100% { opacity: 0; transform: translateY(-50%) scale(0.3); }
        }
        @keyframes trail-fade {
          0% { opacity: 0; }
          30% { opacity: 0.4; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
});

ParticleBackground.displayName = "ParticleBackground";

export default ParticleBackground;
