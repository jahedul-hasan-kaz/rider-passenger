import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef, type LngLatBounds } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { env } from '@/lib/env';
import { useTheme } from '@/theme/theme';
import { Icon } from '@/ui';

import { DHAKA, type MapPoint, type RideMapProps } from './types';

// One map for every screen (MapLibre, docs/spec/04-integration.md §11). Markers: mint ring = pickup, coral square =
// destination, arrow = driver (dimmed when its position is stale).

const lngLat = (p: MapPoint): [number, number] => [p.lng, p.lat];

function boundsOf(points: MapPoint[]): LngLatBounds {
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export function RideMap({
  center,
  zoom = 15,
  pickup,
  destination,
  driver,
  route,
  routePoints,
  fitPadding = { top: 80, bottom: 320, left: 48, right: 48 },
  onCenterChange,
  interactive = true,
  recenterKey,
  style,
  testID,
}: RideMapProps) {
  const { colors } = useTheme();
  const camera = useRef<CameraRef>(null);
  const points = useMemo(() => [pickup, destination, driver].filter((p): p is MapPoint => !!p), [pickup, destination, driver]);
  const pinMode = onCenterChange !== undefined;

  // Fit all points (ride screens), or follow the requested centre (pin mode, home).
  const fitKey = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (pinMode || points.length < 2) return;
    camera.current?.fitBounds(boundsOf(points), { padding: fitPadding, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the points really move
  }, [fitKey, pinMode]);

  useEffect(() => {
    const target = center ?? (points.length === 1 ? points[0] : undefined);
    if (!target || (!pinMode && points.length >= 2)) return;
    camera.current?.easeTo({ center: lngLat(target), zoom, duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recentre on explicit request or a new centre only
  }, [recenterKey, center?.lat, center?.lng]);

  const line = useMemo(() => {
    if (!route || !pickup || !destination) return null;
    const coordinates = routePoints && routePoints.length >= 2 ? routePoints.map(lngLat) : [lngLat(pickup), lngLat(destination)];
    return { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } };
  }, [route, routePoints, pickup, destination]);
  const roadRoute = !!routePoints && routePoints.length >= 2;

  const start = center ?? points[0] ?? DHAKA;

  return (
    <Map
      testID={testID}
      style={[styles.map, style]}
      mapStyle={env().EXPO_PUBLIC_MAP_STYLE_URL}
      attribution
      logo={false}
      compass={false}
      dragPan={interactive}
      touchZoom={interactive}
      touchRotate={false}
      touchPitch={false}
      onRegionIsChanging={pinMode ? (e) => onCenterChange?.({ lng: e.nativeEvent.center[0], lat: e.nativeEvent.center[1] }, 'moving') : undefined}
      onRegionDidChange={pinMode ? (e) => onCenterChange?.({ lng: e.nativeEvent.center[0], lat: e.nativeEvent.center[1] }, 'settled') : undefined}>
      <Camera ref={camera} initialViewState={{ center: lngLat(start), zoom }} />
      {line ? (
        <GeoJSONSource id="route" data={line}>
          <Layer
            type="line"
            id="route-line"
            style={{ lineColor: colors.hero, lineWidth: roadRoute ? 5 : 4, lineCap: 'round', lineJoin: 'round', ...(roadRoute ? {} : { lineDasharray: [1.5, 1.5] }) }}
          />
        </GeoJSONSource>
      ) : null}
      {pickup && !pinMode ? (
        <Marker id="pickup" lngLat={lngLat(pickup)} anchor="center">
          <View style={[styles.pickup, { borderColor: colors.hero, backgroundColor: colors.accent }]} />
        </Marker>
      ) : null}
      {destination && !pinMode ? (
        <Marker id="destination" lngLat={lngLat(destination)} anchor="center">
          <View style={[styles.destination, { backgroundColor: colors.danger, borderColor: colors.surface }]} />
        </Marker>
      ) : null}
      {driver ? (
        <Marker id="driver" lngLat={lngLat(driver)} anchor="center">
          <View
            style={[
              styles.driver,
              { backgroundColor: colors.hero, opacity: driver.stale ? 0.5 : 1, transform: [{ rotate: `${driver.heading ?? 0}deg` }] },
            ]}>
            <Icon name="navigation" color="onHero" size={16} />
          </View>
        </Marker>
      ) : null}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  pickup: { width: 20, height: 20, borderRadius: 10, borderWidth: 4 },
  destination: { width: 16, height: 16, borderRadius: 3, borderWidth: 3 },
  driver: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
