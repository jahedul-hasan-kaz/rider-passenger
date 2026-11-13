import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useAppear } from './use-appear';

// Short, non-blocking messages (§5.3), e.g. "This ride was taken" or a push received while the app is open.
// Every toast is also announced to screen readers.

export type ToastTone = 'neutral' | 'success' | 'danger';
export type ToastInput = { message: string; tone?: ToastTone; icon?: IconName; durationMs?: number };
type ToastItem = Required<Omit<ToastInput, 'icon'>> & { id: number; icon?: IconName };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const ICONS: Record<ToastTone, IconName> = { neutral: 'info', success: 'check-circle', danger: 'alert-circle' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((input: ToastInput) => {
    const item: ToastItem = { id: nextId.current++, tone: input.tone ?? 'neutral', durationMs: input.durationMs ?? 3500, message: input.message, icon: input.icon };
    // Keep at most two on screen: the newest wins.
    setToasts((current) => [...current.slice(-1), item]);
    AccessibilityInfo.announceForAccessibility(input.message);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDone={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>.');
  return show;
}

function ToastStack({ toasts, onDone }: { toasts: ToastItem[]; onDone: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.stack, { top: insets.top + space[2] }]}>
      {toasts.map((toast) => (
        <ToastView key={toast.id} toast={toast} onDone={onDone} />
      ))}
    </View>
  );
}

function ToastView({ toast, onDone }: { toast: ToastItem; onDone: (id: number) => void }) {
  const { colors } = useTheme();
  const appear = useAppear();

  useEffect(() => {
    const timer = setTimeout(() => onDone(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  const fg = toast.tone === 'danger' ? 'dangerText' : toast.tone === 'success' ? 'successText' : 'onHero';
  const bg = toast.tone === 'danger' ? colors.dangerSurface : toast.tone === 'success' ? colors.successSurface : colors.hero;

  return (
    <Animated.View style={[styles.toast, elevation.card, { backgroundColor: bg, shadowColor: colors.shadow }, appear]}>
      <Icon name={toast.icon ?? ICONS[toast.tone]} color={fg} size={18} />
      <Text variant="label" color={fg} style={styles.text}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: space[4], right: space[4], gap: space[2], zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4], borderRadius: radius.md },
  text: { flex: 1 },
});
