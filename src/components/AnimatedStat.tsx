import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

interface AnimatedStatProps {
  value: number;
  fallback?: string;
  className?: string;
}

export function AnimatedStat({ value, fallback, className = '' }: AnimatedStatProps) {
  const animated = useAnimatedNumber(value, 600);
  return <div className={className}>{animated.toLocaleString()}</div>;
}
