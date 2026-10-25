import { describe, expect, it } from 'vitest';
import { activityLabel, minutesLeft } from './constants';

describe('constants helpers', () => {
  it('maps activity keys to labels', () => {
    expect(activityLabel('chai_coffee')).toBe('Chai / Coffee');
  });

  it('returns zero for past times and rounds future minutes up', () => {
    const now = Date.parse('2026-10-25T00:00:00Z');

    expect(minutesLeft('2026-10-24T23:59:00Z', now)).toBe(0);
    expect(minutesLeft('2026-10-25T00:00:01Z', now)).toBe(1);
    expect(minutesLeft('2026-10-25T00:01:00Z', now)).toBe(1);
  });
});
