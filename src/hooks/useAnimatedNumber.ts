import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(target: number, baseDuration = 500): number {
  const [display, setDisplay] = useState(Math.round(target));
  const rafRef = useRef<number>();
  const currentRef = useRef(Math.round(target));

  useEffect(() => {
    const from = currentRef.current;
    const to = Math.round(target);
    const diff = to - from;

    if (diff === 0) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const totalSteps = Math.abs(diff);
    const direction = Math.sign(diff);
    const millisecondsPerUnit = 20;
    const maxDuration = 12000;
    const duration = Math.max(baseDuration, Math.min(totalSteps * millisecondsPerUnit, maxDuration));
    const minFrameTime = 1000 / 60;
    const maxVisibleTicks = Math.max(1, Math.floor(duration / minFrameTime));
    const stepSize = totalSteps > maxVisibleTicks ? Math.ceil(totalSteps / maxVisibleTicks) : 1;
    const tickCount = Math.ceil(totalSteps / stepSize);
    const tickInterval = duration / tickCount;

    let currentValue = from;
    let previousTime = performance.now();
    let accumulated = 0;

    const step = (now: number) => {
      accumulated += now - previousTime;
      previousTime = now;

      if (accumulated >= tickInterval) {
        const ticksToAdvance = Math.floor(accumulated / tickInterval);
        accumulated -= ticksToAdvance * tickInterval;

        const nextValue = currentValue + direction * stepSize * ticksToAdvance;
        currentValue = direction > 0 ? Math.min(nextValue, to) : Math.max(nextValue, to);

        if (currentValue !== currentRef.current) {
          currentRef.current = currentValue;
          setDisplay(currentValue);
        }
      }

      if (currentValue !== to) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, baseDuration]);

  return display;
}
