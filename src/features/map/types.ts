import type { StyleProp, ViewStyle } from 'react-native';

export type MapPoint = { lat: number; lng: number };

export type RideMapProps = {
  /** Where to look when nothing else decides (no points to fit). */
  center?: MapPoint;
  zoom?: number;
  pickup?: MapPoint | null;
  destination?: MapPoint | null;
  driver?: (MapPoint & { heading?: number | null; stale?: boolean }) | null;
  /** Draw the trip line: the road route when given (`routePoints`), otherwise a straight line. Drawing only. */
  route?: boolean;
  /** Road route from the quote's polyline (rider-admin `route_polyline`). */
  routePoints?: MapPoint[] | null;
  /** Keep every given point in view, leaving room for overlays (e.g. a bottom sheet). */
  fitPadding?: { top: number; bottom: number; left: number; right: number };
  /** Pin mode: the map moves under a fixed centre pin and reports the centre. */
  onCenterChange?: (center: MapPoint, phase: 'moving' | 'settled') => void;
  interactive?: boolean;
  /** Imperatively recentre (e.g. "my location" button) by changing this key. */
  recenterKey?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const DHAKA: MapPoint = { lat: 23.7808, lng: 90.4074 };
