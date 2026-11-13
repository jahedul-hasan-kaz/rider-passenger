import { useEffect } from 'react';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration } from '@/theme/tokens';

/**
 * Fade + slide in on mount. Used instead of Reanimated layout animations (`entering`), which do not start reliably
 * on every target. Instant when the user prefers reduced motion.
 */
export function useAppear(offsetY = -8) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.set(reduceMotion ? 1 : withTiming(1, { duration: duration.standard }));
  }, [progress, reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offsetY }],
  }));
}
