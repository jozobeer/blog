import { describe, it, expect } from 'vitest';
import {
  fnv1a,
  FONTS,
  ANIMATIONS,
  COLORS,
  triadic,
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

describe('pools', () => {
  it('exclude inline-problematic animations (bakusan, chuuou_zoom)', () => {
    expect(ANIMATIONS).not.toContain('bakusan');
    expect(ANIMATIONS).not.toContain('chuuou_zoom');
  });
  it('do not include forbidden 600+ colors', () => {
    for (const f of ['dc2626', 'ca8a04', '16a34a', '2563eb', '7e22ce', 'be185d']) {
      expect(COLORS).not.toContain(f);
    }
  });
});

describe('triadic', () => {
  it('returns a valid 6-hex color', () => {
    expect(triadic('3b82f6')).toMatch(/^[0-9a-f]{6}$/);
  });
  it('differs from the input', () => {
    expect(triadic('3b82f6')).not.toBe('3b82f6');
  });
  it('is deterministic', () => {
    expect(triadic('ef4444')).toBe(triadic('ef4444'));
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
});

describe('resolveParams (mojiemoji-github render rules)', () => {
  it('lets explicit overrides win', () => {
    const p = resolveParams('完成', 0, { color: 'ffffff', font: 'pixel' });
    expect(p.color).toBe('ffffff');
    expect(p.font).toBe('pixel');
  });
  it('injects speed=slow for rotational animations', () => {
    expect(resolveParams('x', 0, { animation: 'kaiten' }).speed).toBe('slow');
    expect(resolveParams('x', 0, { animation: 'kage_kaiten' }).speed).toBe('slow');
  });
  it('drops outline for color-shifting animations', () => {
    for (const anim of ['kira', 'disco', 'psycho']) {
      const p = resolveParams('x', 0, { animation: anim });
      expect(p.outline).toBeUndefined();
      expect(p.outlineWidth).toBeUndefined();
    }
  });
  it('adds a triadic outline (width 2) for non-color-shifting animations', () => {
    const p = resolveParams('x', 0, { animation: 'bane', color: '3b82f6' });
    expect(p.outline).toBe(triadic('3b82f6'));
    expect(p.outlineWidth).toBe(2);
  });
  it('recomputes the triadic outline from an overridden color', () => {
    const p = resolveParams('x', 0, { animation: 'bane', color: 'ef4444' });
    expect(p.outline).toBe(triadic('ef4444'));
  });
  it('respects an explicit outline override', () => {
    const p = resolveParams('x', 0, { animation: 'bane', outline: '000000' });
    expect(p.outline).toBe('000000');
  });
});

describe('buildMojiemojiUrl', () => {
  const params = {
    font: 'maru-bold',
    color: '3b82f6',
    animation: 'bane',
    outline: 'f63b82',
    outlineWidth: 2,
  };
  it('URL-encodes Japanese text into the path', () => {
    const url = buildMojiemojiUrl('やったー', params);
    expect(url.startsWith(`${MOJIEMOJI_BASE}/`)).toBe(true);
    expect(url).toContain(encodeURIComponent('やったー'));
  });
  it('includes font, color, animation, transparent background and outline', () => {
    const url = buildMojiemojiUrl('完成', params);
    expect(url).toContain('font=maru-bold');
    expect(url).toContain('color=3b82f6');
    expect(url).toContain('animation=bane');
    expect(url).toContain('background=transparent');
    expect(url).toContain('outline=f63b82');
    expect(url).toContain('outline_width=2');
  });
  it('omits speed and outline when absent', () => {
    const url = buildMojiemojiUrl('完成', { font: 'maru', color: '22c55e', animation: 'disco' });
    expect(url).not.toContain('speed=');
    expect(url).not.toContain('outline=');
  });
  it('includes speed when present', () => {
    expect(buildMojiemojiUrl('完成', { ...params, speed: 'slow' })).toContain('speed=slow');
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
