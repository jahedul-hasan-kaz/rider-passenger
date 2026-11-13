import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';
import { Icon, Text } from '@/ui';

import { DHAKA, type RideMapProps } from './types';

// Web build of RideMap. MapLibre React Native has no web renderer, and the product ships on phones only; this
// stylised street grid (as in the mockups) lets screens be previewed in a browser during development.

export function RideMap({ center, pickup, destination, driver, onCenterChange, style, testID }: RideMapProps) {
  const { colors } = useTheme();
  const target = center ?? pickup ?? DHAKA;

  // Pin mode reports the centre once, as if the map had settled.
  useEffect(() => {
    onCenterChange?.(target, 'settled');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report once per centre
  }, [target.lat, target.lng]);

  return (
    <View testID={testID} style={[styles.map, { backgroundColor: colors.hero }, style]}>
      <View style={[styles.road, styles.h1, { backgroundColor: colors.surfaceSelected }]} />
      <View style={[styles.road, styles.h2, { backgroundColor: colors.surfaceSelected }]} />
      <View style={[styles.road, styles.v1, { backgroundColor: colors.surfaceSelected }]} />
      <View style={[styles.road, styles.v2, { backgroundColor: colors.surfaceSelected }]} />
      <View style={[styles.block, styles.b1, { backgroundColor: colors.surfaceSelected }]} />
      <View style={[styles.block, styles.b2, { backgroundColor: colors.surfaceSelected }]} />
      {pickup && !onCenterChange ? <View style={[styles.dot, styles.pickup, { backgroundColor: colors.accent, borderColor: colors.hero }]} /> : null}
      {destination && !onCenterChange ? <View style={[styles.dest, { backgroundColor: colors.danger }]} /> : null}
      {driver ? (
        <View style={[styles.driver, { backgroundColor: colors.surface, opacity: driver.stale ? 0.5 : 1 }]}>
          <Icon name="navigation" size={16} />
        </View>
      ) : null}
      <Text variant="caption" color="onHeroMuted" style={styles.note}>
        Map preview (web)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, overflow: 'hidden' },
  road: { position: 'absolute', opacity: 0.9 },
  h1: { left: 0, right: 0, top: '28%', height: 10, transform: [{ rotate: '-6deg' }] },
  h2: { left: 0, right: 0, top: '62%', height: 8, transform: [{ rotate: '4deg' }] },
  v1: { top: 0, bottom: 0, left: '30%', width: 9 },
  v2: { top: 0, bottom: 0, left: '72%', width: 7, transform: [{ rotate: '8deg' }] },
  block: { position: 'absolute', borderRadius: 12, opacity: 0.7 },
  b1: { width: 70, height: 60, left: '45%', top: '36%' },
  b2: { width: 50, height: 50, left: '10%', top: '44%' },
  dot: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 4 },
  pickup: { left: '34%', top: '40%' },
  dest: { position: 'absolute', width: 16, height: 16, borderRadius: 3, left: '68%', top: '20%' },
  driver: { position: 'absolute', width: 32, height: 32, borderRadius: 16, left: '26%', top: '54%', alignItems: 'center', justifyContent: 'center' },
  note: { position: 'absolute', right: 12, bottom: 12 },
});
