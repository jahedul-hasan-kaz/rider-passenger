import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Text } from './Text';

// Modal bottom sheet (§5.3): drag handle, sized to content, themed, scrim behind, reduced-motion aware.
// Screens open it imperatively: `sheet.current?.present()`.

export { BottomSheetModalProvider as SheetProvider };

export type SheetHandle = { present: () => void; dismiss: () => void };

export const Sheet = forwardRef<
  SheetHandle,
  { children: ReactNode; title?: string; onDismiss?: () => void; dismissible?: boolean; testID?: string }
>(function Sheet({ children, title, onDismiss, dismissible = true, testID }, ref) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const modal = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({ present: () => modal.current?.present(), dismiss: () => modal.current?.dismiss() }), []);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior={dismissible ? 'close' : 'none'} />
    ),
    [dismissible],
  );

  return (
    <BottomSheetModal
      ref={modal}
      enableDynamicSizing
      enablePanDownToClose={dismissible}
      onDismiss={onDismiss}
      backdropComponent={backdrop}
      animateOnMount={!reduceMotion}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong, width: 40 }}
      accessibilityLabel={title}>
      <BottomSheetView testID={testID} style={[styles.content, { paddingBottom: insets.bottom + space[4] }]}>
        {title ? (
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[5], paddingTop: space[2], gap: space[4] },
});
