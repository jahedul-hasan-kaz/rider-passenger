import { clean, setAnalyticsSink, track } from '../analytics';

describe('analytics', () => {
  it('keeps numbers, booleans and code-like strings, and drops anything personal', () => {
    expect(
      clean({
        category: 'bike',
        stage: 'driver_arriving',
        seconds: 42.123,
        granted: true,
        address: 'House 42, Road 11',
        phone: '01712345678',
        e164: '+8801712345678',
        email: 'a@b.co',
        missing: undefined,
        nan: Number.NaN,
      }),
    ).toEqual({ category: 'bike', stage: 'driver_arriving', seconds: 42.12, granted: true });
  });

  it('delivers cleaned events and never throws', () => {
    const seen: unknown[] = [];
    setAnalyticsSink((event, props) => seen.push([event, props]));
    track('ride_requested', { category: 'cng', has_note: true, note: 'Gate 2' });
    expect(seen).toEqual([['ride_requested', { category: 'cng', has_note: true }]]);

    setAnalyticsSink(() => {
      throw new Error('sink down');
    });
    expect(() => track('sos_triggered', { repeat: false })).not.toThrow();
  });
});
