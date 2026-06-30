import { useEffect, useState } from 'react';

export default function useCountUp(target, duration = 1400) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === null || target === undefined) {
      setCount(0);
      return;
    }

    const numericTarget = Number(target) || 0;
    const steps = Math.max(24, Math.min(60, Math.floor(duration / 25)));
    let current = 0;
    const increment = numericTarget / steps;
    const timer = window.setInterval(() => {
      current += increment;
      if (current >= numericTarget) {
        setCount(numericTarget);
        window.clearInterval(timer);
        return;
      }
      setCount(Math.floor(current));
    }, duration / steps);

    return () => window.clearInterval(timer);
  }, [target, duration]);

  return count;
}