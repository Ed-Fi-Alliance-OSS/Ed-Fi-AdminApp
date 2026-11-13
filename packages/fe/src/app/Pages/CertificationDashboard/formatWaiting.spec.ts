import { formatWaiting } from './formatWaiting';

const NOW = new Date('2026-11-13T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatWaiting', () => {
  it('says <1m for 30 seconds', () => {
    expect(formatWaiting(ago(30 * 1000), NOW)).toBe('<1m');
  });

  it('formats minutes', () => {
    expect(formatWaiting(ago(12 * MIN), NOW)).toBe('12m');
  });

  it('formats hours and minutes', () => {
    expect(formatWaiting(ago(5 * HOUR + 12 * MIN), NOW)).toBe('5h 12m');
  });

  it('formats days and hours', () => {
    expect(formatWaiting(ago(3 * DAY + 4 * HOUR + 30 * MIN), NOW)).toBe('3d 4h');
  });

  it('says <1m for a future date instead of a negative duration', () => {
    expect(formatWaiting(new Date(NOW.getTime() + 5 * MIN).toISOString(), NOW)).toBe('<1m');
  });
});
