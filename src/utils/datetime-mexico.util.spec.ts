import {
  isoUtcToMexicoCityAsUtcDate,
  nowMexicoCityAsUtcDate,
} from './datetime-mexico.util';

describe('datetime-mexico.util', () => {
  it('convierte ISO UTC a hora de pared México para MySQL', () => {
    const d = isoUtcToMexicoCityAsUtcDate('2026-08-29T00:53:13.520Z');
    expect(d.toISOString()).toBe('2026-08-28T18:53:13.000Z');
  });

  it('nowMexicoCityAsUtcDate usa la misma convención', () => {
    const fixed = new Date('2026-08-29T06:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(fixed);
    try {
      const d = nowMexicoCityAsUtcDate();
      expect(d.toISOString()).toMatch(/^2026-08-29T00:00:00\.000Z$/);
    } finally {
      jest.useRealTimers();
    }
  });
});
