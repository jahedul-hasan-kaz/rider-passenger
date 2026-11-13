import type { ReactNode } from 'react';
import { Pressable as RNPressable, type PressableProps as RNPressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic, type HapticEvent } from '@/lib/haptics';
import { duration } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export type PressableProps = Omit<RNPressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Haptic fired on press (none by default). */
  feedback?: HapticEvent;
  /** Shrink slightly while pressed (skipped when the user prefers reduced motion). */
  scaleOnPress?: boolean;
};

/** Base for every tappable surface: press-down scale, optional haptic, reduced-motion aware. */
export function Pressable({ style, children, feedback, scaleOnPress = true, onPress, onPressIn, onPressOut, disabled, ...rest }: PressableProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animate = scaleOnPress && !reduceMotion;

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        if (animate) scale.set(withTiming(0.97, { duration: duration.fast }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (animate) scale.set(withTiming(1, { duration: duration.fast }));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (feedback) haptic(feedback);
        onPress?.(event);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
