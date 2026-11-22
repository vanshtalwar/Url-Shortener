import { entitlements, monthStartIst } from '../src/plans';

const NOW = Date.parse('2026-06-15T12:00:00Z');
const future = new Date(NOW + 86_400_000);
const past = new Date(NOW - 86_400_000);

describe('entitlements', () => {
  it('no subscription → Free with limits', () => {
    expect(entitlements(null, NOW)).toEqual({
      plan: 'free',
      linkLimitPerMonth: 25,
      historyDays: 30,
      can: { geo: false, utmPresets: false, folders: false, variants: false, bio: false },
    });
  });

  it.each(['active', 'authenticated'])('%s subscription → Pro, no limits', (status) => {
    expect(entitlements({ status, currentPeriodEnd: future }, NOW)).toMatchObject({
      plan: 'pro',
      linkLimitPerMonth: null,
      historyDays: null,
      can: { geo: true, utmPresets: true, folders: true, variants: true, bio: true },
    });
  });

  it('cancelled → still Pro until the paid period ends, then Free', () => {
    expect(entitlements({ status: 'cancelled', currentPeriodEnd: future }, NOW).plan).toBe('pro');
    expect(entitlements({ status: 'cancelled', currentPeriodEnd: past }, NOW).plan).toBe('free');
  });

  it.each(['halted', 'completed', 'pending', 'created'])('%s → Free', (status) => {
    expect(entitlements({ status, currentPeriodEnd: future }, NOW).plan).toBe('free');
  });
});

describe('monthStartIst', () => {
  it('is midnight on the 1st in India, expressed in UTC', () => {
    expect(monthStartIst(NOW).toISOString()).toBe('2026-05-31T18:30:00.000Z');
  });

  it('switches month at IST midnight, not UTC midnight', () => {
    // 2026-06-30 19:00 UTC is already 1 July 00:30 in India.
    expect(monthStartIst(Date.parse('2026-06-30T19:00:00Z')).toISOString()).toBe('2026-06-30T18:30:00.000Z');
    expect(monthStartIst(Date.parse('2026-06-30T18:00:00Z')).toISOString()).toBe('2026-05-31T18:30:00.000Z');
  });
});
