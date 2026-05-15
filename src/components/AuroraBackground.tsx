import { useEffect, useRef } from 'react';

const AuroraBackground = () => {
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
    };

    resize();
    window.addEventListener('resize', resize);

    // Floating orbs
    const orbs: Array<{
      x: number;
      y: number;
      radius: number;
      speed: number;
      offset: number;
      color: string;
    }> = [];

    const colors = [
      'rgba(45, 212, 191, 0.15)',  // Teal
      'rgba(34, 211, 238, 0.12)',  // Cyan
      'rgba(99, 102, 241, 0.10)',  // Indigo
      'rgba(168, 85, 247, 0.08)',  // Purple
    ];

    for (let i = 0; i < 8; i++) {
      orbs.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 200 + 100,
        speed: Math.random() * 0.0005 + 0.0002,
        offset: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Stars
    const stars: Array<{ x: number; y: number; size: number; twinkle: number }> = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.5,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    const draw = () => {
      time += 1;

      // Deep space gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, 'hsl(230, 20%, 4%)');
      bgGradient.addColorStop(0.4, 'hsl(225, 18%, 6%)');
      bgGradient.addColorStop(0.7, 'hsl(220, 15%, 7%)');
      bgGradient.addColorStop(1, 'hsl(215, 20%, 5%)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw twinkling stars
      stars.forEach((star) => {
        const twinkle = Math.sin(time * 0.02 + star.twinkle) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * twinkle, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.5})`;
        ctx.fill();
      });

      // Draw aurora waves
      for (let wave = 0; wave < 3; wave++) {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        const waveHeight = canvas.height * 0.4;
        const baseY = canvas.height * 0.6 - wave * 60;

        for (let x = 0; x <= canvas.width; x += 5) {
          const y = baseY + 
            Math.sin(x * 0.003 + time * 0.008 + wave) * 40 +
            Math.sin(x * 0.007 + time * 0.012 + wave * 2) * 25 +
            Math.sin(x * 0.001 + time * 0.005) * 60;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, baseY - 100, 0, canvas.height);
        if (wave === 0) {
          gradient.addColorStop(0, 'rgba(45, 212, 191, 0.08)');
          gradient.addColorStop(0.5, 'rgba(45, 212, 191, 0.03)');
          gradient.addColorStop(1, 'rgba(45, 212, 191, 0)');
        } else if (wave === 1) {
          gradient.addColorStop(0, 'rgba(34, 211, 238, 0.06)');
          gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.02)');
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        } else {
          gradient.addColorStop(0, 'rgba(168, 85, 247, 0.04)');
          gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.01)');
          gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
        }

        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw floating orbs with blur effect
      orbs.forEach((orb) => {
        const wobbleX = Math.sin(time * orb.speed * 1000 + orb.offset) * 50;
        const wobbleY = Math.cos(time * orb.speed * 800 + orb.offset) * 30;
        
        const gradient = ctx.createRadialGradient(
          orb.x + wobbleX, orb.y + wobbleY, 0,
          orb.x + wobbleX, orb.y + wobbleY, orb.radius
        );
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(0.4, orb.color.replace(/[\d.]+\)$/, '0.05)'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(orb.x + wobbleX, orb.y + wobbleY, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Subtle grid overlay
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.015)';
      ctx.lineWidth = 1;
      const gridSize = 80;
      
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Top glow accent
      const topGlow = ctx.createRadialGradient(
        canvas.width * 0.3, -100, 0,
        canvas.width * 0.3, -100, canvas.width * 0.6
      );
      topGlow.addColorStop(0, 'rgba(45, 212, 191, 0.08)');
      topGlow.addColorStop(0.5, 'rgba(45, 212, 191, 0.02)');
      topGlow.addColorStop(1, 'rgba(45, 212, 191, 0)');
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.5);

      // Corner vignette
      const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.height
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
      ctx.fillStyle = vignette;
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
      style={{ background: 'hsl(225, 18%, 5%)' }}
    />
  );
};

export default AuroraBackground;
