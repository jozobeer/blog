import { describe, it, expect } from 'vitest';
import {
  fnv1a,
  FONTS,
  ANIMATIONS,
  COLORS,
  deriveParams,
  resolveParams,
  buildMojiemojiUrl,
  MOJIEMOJI_BASE,
  nextIndex,
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

describe('nextIndex', () => {
  it('returns strictly increasing values across calls', () => {
    const a = nextIndex();
    const b = nextIndex();
    const c = nextIndex();
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
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

describe('resolveParams', () => {
  it('falls back to derived params when no overrides', () => {
    expect(resolveParams('完成', 0)).toEqual(deriveParams('完成', 0));
  });

  it('lets explicit overrides win', () => {
    const p = resolveParams('完成', 0, { color: 'ffffff', font: 'pixel' });
    expect(p.color).toBe('ffffff');
    expect(p.font).toBe('pixel');
    expect(p.animation).toBe(deriveParams('完成', 0).animation);
  });

  it('forces speed=slow when animation is overridden to kaiten without speed', () => {
    const p = resolveParams('x', 0, { animation: 'kaiten' });
    expect(p.speed).toBe('slow');
  });

  it('ignores undefined overrides', () => {
    const p = resolveParams('完成', 0, { color: undefined });
    expect(p.color).toBe(deriveParams('完成', 0).color);
  });
});

describe('buildMojiemojiUrl', () => {
  const params = { font: 'maru-bold', color: '2563eb', animation: 'bane' };

  it('URL-encodes Japanese text into the path', () => {
    const url = buildMojiemojiUrl('やったー', params);
    expect(url.startsWith(`${MOJIEMOJI_BASE}/`)).toBe(true);
    expect(url).toContain(encodeURIComponent('やったー'));
  });

  it('includes font, color, animation and transparent background', () => {
    const url = buildMojiemojiUrl('完成', params);
    expect(url).toContain('font=maru-bold');
    expect(url).toContain('color=2563eb');
    expect(url).toContain('animation=bane');
    expect(url).toContain('background=transparent');
  });

  it('omits speed when absent and includes it when present', () => {
    expect(buildMojiemojiUrl('完成', params)).not.toContain('speed=');
    expect(buildMojiemojiUrl('完成', { ...params, animation: 'kaiten', speed: 'slow' }))
      .toContain('speed=slow');
  });
});
