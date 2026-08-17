import { describe, it, expect } from 'vitest';
import * as readingMode from './readingMode';
import {
  DEFAULT_READING_MODE,
  alternateMode,
  modeRoutes,
  modeHref,
  hasMoji,
} from './readingMode';
import type { ReadingMode, ReadingContext, ModeRoute } from './readingMode';

describe('module contract', () => {
  it('exports exactly the runtime API', () => {
    expect(Object.keys(readingMode).sort()).toEqual([
      'DEFAULT_READING_MODE',
      'alternateMode',
      'hasMoji',
      'modeHref',
      'modeRoutes',
    ]);
  });
  it('defaults an article without frontmatter to plain', () => {
    expect(DEFAULT_READING_MODE).toBe('plain');
  });
});

describe('alternateMode', () => {
  it('maps plain to emoji and back', () => {
    expect(alternateMode('plain')).toBe('emoji');
    expect(alternateMode('emoji')).toBe('plain');
  });
});

describe('hasMoji', () => {
  it('detects a Moji tag in the body', () => {
    expect(hasMoji('本文に <Moji emoji="語" /> がある')).toBe(true);
  });
  it('returns false for a body without Moji', () => {
    expect(hasMoji('ただの本文')).toBe(false);
  });
  it('returns false for undefined', () => {
    expect(hasMoji(undefined)).toBe(false);
  });
});

describe('modeRoutes', () => {
  it('emits the default page at the bare slug and the alternate below it', () => {
    expect(modeRoutes('hello-world', 'plain', true)).toEqual([
      { slug: 'hello-world', mode: 'plain', isDefault: true },
      { slug: 'hello-world/emoji', mode: 'emoji', isDefault: false },
    ]);
  });
  it('puts plain on the sub-path when the article defaults to emoji', () => {
    expect(modeRoutes('mojiemoji', 'emoji', true)).toEqual([
      { slug: 'mojiemoji', mode: 'emoji', isDefault: true },
      { slug: 'mojiemoji/plain', mode: 'plain', isDefault: false },
    ]);
  });
  it('emits only the default page when the article has no Moji', () => {
    expect(modeRoutes('hello', 'plain', false)).toEqual([
      { slug: 'hello', mode: 'plain', isDefault: true },
    ]);
  });
});

describe('modeHref', () => {
  it('points the default mode at the bare article URL', () => {
    expect(modeHref('hello-world', 'plain', 'plain')).toBe('/blog/hello-world/');
  });
  it('points the non-default mode at the sub-path', () => {
    expect(modeHref('hello-world', 'emoji', 'plain')).toBe('/blog/hello-world/emoji/');
  });
  it('inverts both when the article defaults to emoji', () => {
    expect(modeHref('mojiemoji', 'emoji', 'emoji')).toBe('/blog/mojiemoji/');
    expect(modeHref('mojiemoji', 'plain', 'emoji')).toBe('/blog/mojiemoji/plain/');
  });
});

// --- 型契約のアサーション ---
// 型は実行時に消えるので vitest では固定できない。ここは `npm run check`（astro check）が検証する。
type Assert<T extends true> = T;
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type _ReadingModeIsExactlyTwo = Assert<Equals<ReadingMode, 'plain' | 'emoji'>>;
type _ReadingContextShape = Assert<
  Equals<
    ReadingContext,
    { slug: string; mode: ReadingMode; defaultMode: ReadingMode; hasAlternate: boolean }
  >
>;
type _ModeRouteShape = Assert<
  Equals<ModeRoute, { slug: string; mode: ReadingMode; isDefault: boolean }>
>;
