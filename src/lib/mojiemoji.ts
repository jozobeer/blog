/** FNV-1a 32-bit hash (deterministic, unsigned). */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// 正準 16 フォント（mojiemoji-github lib.constants.CANONICAL_FONTS）
export const FONTS = [
  'akzk', 'chikara', 'dela', 'gothic', 'gothic-bold', 'hachimaru',
  'kurobara', 'maru', 'maru-bold', 'mincho', 'noto', 'pixel',
  'rampart', 'tamanegi', 'toge', 'zero',
] as const;

// 正準 34 アニメ − INLINE_PROBLEMATIC {bakusan, chuuou_zoom} = 32
export const ANIMATIONS = [
  'bane', 'bure', 'chirichiri', 'disco', 'ekken', 'gatagata', 'kage_bokashi',
  'kage_kaiten', 'kage_neon', 'kaiten', 'kira', 'kirari', 'mabataki', 'mochimochi',
  'mozaiku', 'nami', 'neruneru', 'norinori', 'patapata', 'poyoon', 'psycho',
  'shuchusen', 'tate_ekken', 'tate_scroll', 'tatemoya', 'tenmetsu', 'yatta',
  'yoko_scroll', 'yokomoya', 'yurayura', 'zairu', 'zanzo',
] as const;

// mojiemoji-github の明るめパレット（Tailwind 300-500）。FORBIDDEN_COLORS(600+) は含めない。
export const COLORS = [
  'ef4444', 'f87171', 'fca5a5', 'f97316', 'fb923c', 'fdba74', 'f59e0b', 'fbbf24',
  'facc15', 'fde047', '22c55e', '4ade80', '86efac', '10b981', '34d399', '06b6d4',
  '22d3ee', '67e8f9', '3b82f6', '60a5fa', '93c5fd', '6366f1', '818cf8', 'a5b4fc',
  '8b5cf6', 'a78bfa', 'a855f7', 'c084fc', 'd8b4fe', 'ec4899', 'f472b6', 'f9a8d4',
  '94a3b8',
] as const;

// 色相がフレーム毎に回るので outline を落とす（mojiemoji-github COLOR_SHIFTING_ANIMATIONS）
export const COLOR_SHIFTING_ANIMATIONS = new Set<string>(['kira', 'disco', 'psycho']);
// グリフが回転するので speed=slow が要る（mojiemoji-github ROTATIONAL_ANIMATIONS）
export const ROTATIONAL_ANIMATIONS = new Set<string>(['kaiten', 'kage_kaiten']);

export interface MojiParams {
  font: string;
  color: string;
  animation: string;
  speed?: string;
  outline?: string;
  outlineWidth?: number;
}

// --- HSL 変換（mojiemoji_markdown.py を移植。triadic outline 用） ---
function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let hue: number;
  if (mx === r) hue = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return [((hue * 60) % 360 + 360) % 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hFrac = ((((h % 360) + 360) % 360)) / 360;
  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, hFrac + 1 / 3);
    g = hueToRgb(p, q, hFrac);
    b = hueToRgb(p, q, hFrac - 1 / 3);
  }
  const hex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `${hex(r)}${hex(g)}${hex(b)}`;
}

/** fill 色から triadic（色相 +120°）の outline 色を導く。 */
export function triadic(colorHex: string): string {
  const [h, s, l] = hexToHsl(colorHex);
  return hslToHex(h + 120, s, l);
}

/** text + 出現位置 index から font/color/animation を決定論的に選ぶ（生の選択）。 */
export function deriveParams(text: string, index: number): MojiParams {
  const seed = fnv1a(`${text}#${index}`);
  const h2 = Math.imul(seed, 2654435761) >>> 0;
  const h3 = Math.imul(h2, 2246822519) >>> 0;
  return {
    font: FONTS[seed % FONTS.length],
    color: COLORS[h2 % COLORS.length],
    animation: ANIMATIONS[h3 % ANIMATIONS.length],
  };
}

/**
 * deriveParams に override をマージし、mojiemoji-github の描画ルールを適用する:
 * rotational は speed=slow、color-shifting は outline を落とす、
 * それ以外は outline=triadic(色相+120°) + outline_width=2。
 */
export function resolveParams(
  text: string,
  index: number,
  overrides: Partial<MojiParams> = {},
): MojiParams {
  const base = deriveParams(text, index);
  const merged: MojiParams = {
    font: overrides.font ?? base.font,
    color: overrides.color ?? base.color,
    animation: overrides.animation ?? base.animation,
  };
  if (overrides.speed !== undefined) merged.speed = overrides.speed;
  if (overrides.outline !== undefined) merged.outline = overrides.outline;
  if (overrides.outlineWidth !== undefined) merged.outlineWidth = overrides.outlineWidth;

  if (ROTATIONAL_ANIMATIONS.has(merged.animation) && !merged.speed) {
    merged.speed = 'slow';
  }

  if (COLOR_SHIFTING_ANIMATIONS.has(merged.animation)) {
    delete merged.outline;
    delete merged.outlineWidth;
  } else if (merged.outline === undefined) {
    merged.outline = triadic(merged.color);
    merged.outlineWidth = 2;
  }
  return merged;
}

export const MOJIEMOJI_BASE = 'https://mojiemoji.jozo.beer/emoji';

/** mojiemoji の <img src> を組み立てる。src 生成はここに閉じる（将来ビルド時化の差し替え点）。 */
export function buildMojiemojiUrl(text: string, params: MojiParams): string {
  const query = new URLSearchParams();
  query.set('font', params.font);
  query.set('color', params.color);
  query.set('animation', params.animation);
  query.set('background', 'transparent');
  if (params.speed) query.set('speed', params.speed);
  if (params.outline) query.set('outline', params.outline);
  if (params.outlineWidth !== undefined) query.set('outline_width', String(params.outlineWidth));
  return `${MOJIEMOJI_BASE}/${encodeURIComponent(text)}?${query.toString()}`;
}

// ビルド内の出現順カウンタ。モジュール状態としてレンダリング間で保持される
// （.astro の `---` フロントマターは毎レンダリング再実行されるため、ここに置く）。
let _occurrence = 0;

export function nextIndex(): number {
  return _occurrence++;
}
