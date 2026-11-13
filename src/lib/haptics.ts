import * as Haptics from 'expo-haptics';

// Semantic haptics (§5.4). Screens name the moment, not the vibration, so the feel stays consistent app-wide.
// Failures are ignored: haptics are a nicety and some devices have no motor.

export type HapticEvent = 'selection' | 'tap' | 'requestSent' | 'driverFound' | 'cancelled' | 'error' | 'sos';

export function haptic(event: HapticEvent): void {
  const run = () => {
    switch (event) {
      case 'selection':
        return Haptics.selectionAsync();
      case 'tap':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'requestSent':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'driverFound':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'cancelled':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case 'sos':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };
  void run()?.catch(() => undefined);
}
