// Google encoded polyline → points (https://developers.google.com/maps/documentation/utilities/polylinealgorithm).
// Used to draw the road route a quote returns (rider-admin `route_polyline`). Malformed input gives no points rather
// than a broken line.

export type LatLng = { lat: number; lng: number };

export function decodePolyline(encoded: string | null | undefined, precision = 5): LatLng[] {
  if (!encoded) return [];
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) return null;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && shift < 35);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) return [];
    lat += dLat;
    lng += dLng;
    const point = { lat: lat / factor, lng: lng / factor };
    if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return [];
    points.push(point);
  }
  return points;
}
