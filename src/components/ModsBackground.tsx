import { useEffect, useRef } from 'react';

const ModsBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    // Stars
    let stars: Array<{ x: number; y: number; size: number; phase: number; speed: number; brightness: number }> = [];

    const initStars = () => {
      stars = [];
      const count = Math.floor((canvas.width * canvas.height) / 4000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.8 + 0.3,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.008 + 0.003, // slow gentle twinkle
          brightness: Math.random() * 0.6 + 0.4,
        });
      }
    };

    // Shooting stars
    interface ShootingStar {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      length: number;
      brightness: number;
    }

    const shootingStars: ShootingStar[] = [];
    let nextShootingTime = 200 + Math.random() * 400;

    const spawnShootingStar = () => {
      const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2; // diagonal
      const speed = 4 + Math.random() * 4;
      shootingStars.push({
        x: Math.random() * canvas.width * 0.8,
        y: Math.random() * canvas.height * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 40 + Math.random() * 30,
        length: 60 + Math.random() * 80,
        brightness: 0.7 + Math.random() * 0.3,
      });
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      time += 1;

      // Sky gradient
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, 'hsl(228, 30%, 4%)');
      bg.addColorStop(0.4, 'hsl(225, 25%, 6%)');
      bg.addColorStop(1, 'hsl(230, 28%, 3%)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars — gentle slow twinkle, blue-tinted
      stars.forEach((s) => {
        const twinkle = Math.sin(time * s.speed + s.phase) * 0.3 + 0.7;
        const alpha = s.brightness * twinkle;
        const r = 80 + Math.floor(Math.random() * 20);
        const g = 220 + Math.floor(Math.random() * 35);
        const b = 140 + Math.floor(Math.random() * 40);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * twinkle, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();

        // Subtle glow on brighter stars
        if (s.size > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 3);
          glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`);
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = glow;
          ctx.fill();
        }
      });

      // Shooting stars
      nextShootingTime -= 1;
      if (nextShootingTime <= 0) {
        spawnShootingStar();
        nextShootingTime = 300 + Math.random() * 600; // every ~5-15 seconds at 60fps
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life += 1;

        const progress = ss.life / ss.maxLife;
        const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
        const alpha = Math.max(0, fade) * ss.brightness;

        // Trail
        const tailX = ss.x - ss.vx * (ss.length / Math.hypot(ss.vx, ss.vy));
        const tailY = ss.y - ss.vy * (ss.length / Math.hypot(ss.vx, ss.vy));

        const trail = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        trail.addColorStop(0, `rgba(80, 220, 140, 0)`);
        trail.addColorStop(0.7, `rgba(100, 240, 160, ${alpha * 0.4})`);
        trail.addColorStop(1, `rgba(180, 255, 200, ${alpha})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Head glow
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 255, 200, ${alpha})`;
        ctx.fill();

        if (ss.life >= ss.maxLife) {
          shootingStars.splice(i, 1);
        }
      }

      // Soft vignette
      const v = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.4,
        canvas.width / 2, canvas.height / 2, canvas.height
      );
      v.addColorStop(0, 'rgba(0, 0, 0, 0)');
      v.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ background: 'hsl(228, 30%, 4%)' }}
    />
  );
};

export default ModsBackground;
