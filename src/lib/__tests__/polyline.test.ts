import { decodePolyline } from '../polyline';

describe('decodePolyline', () => {
  it('decodes the reference example from the algorithm documentation', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('returns nothing for empty or malformed input', () => {
    expect(decodePolyline(null)).toEqual([]);
    expect(decodePolyline('')).toEqual([]);
    expect(decodePolyline('_p~iF~ps|U_ulL')).toEqual([]);
    expect(decodePolyline('\u0001\u0002')).toEqual([]);
  });
});
