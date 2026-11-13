import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs`. Lets components show live durations without reading the clock
 *  during render (React Compiler requires render to be pure). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
