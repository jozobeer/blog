import { describe, it, expect } from 'vitest';
import {
  fnv1a,
  FONTS,
  ANIMATIONS,
  COLORS,
  deriveParams,
} from './mojiemoji';

describe('fnv1a', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1a('やったー#0')).toBe(fnv1a('やったー#0'));
  });

  it('differs for different inputs', () => {
    expect(fnv1a('やったー#0')).not.toBe(fnv1a('やったー#1'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = fnv1a('完成#3');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('deriveParams', () => {
  it('is deterministic for the same (text, index)', () => {
    expect(deriveParams('完成', 0)).toEqual(deriveParams('完成', 0));
  });

  it('varies by occurrence index for the same word', () => {
    const variants = new Set(
      Array.from({ length: 10 }, (_, i) => JSON.stringify(deriveParams('完成', i))),
    );
    expect(variants.size).toBeGreaterThan(1);
  });

  it('only picks values from the canonical pools', () => {
    for (let i = 0; i < 30; i++) {
      const p = deriveParams('テスト', i);
      expect(FONTS).toContain(p.font);
      expect(ANIMATIONS).toContain(p.animation);
      expect(COLORS).toContain(p.color);
    }
  });

  it('injects speed=slow when animation is kaiten', () => {
    for (let i = 0; i < 200; i++) {
      const p = deriveParams('回転', i);
      if (p.animation === 'kaiten') {
        expect(p.speed).toBe('slow');
      }
    }
  });
});
