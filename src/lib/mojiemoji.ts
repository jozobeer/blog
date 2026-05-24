/** FNV-1a 32-bit hash (deterministic, unsigned). */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export const FONTS = [
  'gothic', 'gothic-bold', 'maru', 'maru-bold', 'mincho', 'dela', 'akzk', 'zero',
  'kurobara', 'hachimaru', 'chikara', 'tamanegi', 'pixel', 'toge', 'rampart', 'noto',
] as const;

// inline で潰れる/ block 専用のものは除外（bakusan, chuuou_zoom, mozaiku, kage_kaiten, kage_bokashi）
export const ANIMATIONS = [
  'tate_scroll', 'yoko_scroll', 'ekken', 'tate_ekken', 'bane', 'gatagata', 'bure',
  'kirari', 'kira', 'tenmetsu', 'shuchusen', 'kaiten', 'neruneru', 'patapata',
  'yurayura', 'mabataki', 'norinori', 'mochimochi', 'poyoon', 'yatta', 'tatemoya',
  'nami', 'yokomoya', 'zairu', 'zanzo', 'chirichiri', 'disco', 'psycho', 'kage_neon',
] as const;

// 白背景で読める 6 桁 hex（おおむね Tailwind 600–700）。名前色は使わない。
export const COLORS = [
  'dc2626', 'ea580c', 'd97706', 'ca8a04', '16a34a', '059669', '0d9488', '0891b2',
  '0284c7', '2563eb', '4f46e5', '7c3aed', '9333ea', 'c026d3', 'db2777', 'e11d48',
] as const;

export interface MojiParams {
  font: string;
  color: string;
  animation: string;
  speed?: string;
}

/** text + 出現位置 index から決定論的に装飾パラメータを導出する。 */
export function deriveParams(text: string, index: number): MojiParams {
  const seed = fnv1a(`${text}#${index}`);
  const h2 = Math.imul(seed, 2654435761) >>> 0;
  const h3 = Math.imul(h2, 2246822519) >>> 0;
  const font = FONTS[seed % FONTS.length];
  const color = COLORS[h2 % COLORS.length];
  const animation = ANIMATIONS[h3 % ANIMATIONS.length];
  const params: MojiParams = { font, color, animation };
  if (animation === 'kaiten') params.speed = 'slow'; // 回転は遅くしないと読めない
  return params;
}

/** 導出値に明示 override をマージする。undefined は無視。kaiten は speed=slow を保証。 */
export function resolveParams(
  text: string,
  index: number,
  overrides: Partial<MojiParams> = {},
): MojiParams {
  const base = deriveParams(text, index);
  const merged: MojiParams = { ...base };
  for (const key of ['font', 'color', 'animation', 'speed'] as const) {
    const value = overrides[key];
    if (value !== undefined) merged[key] = value;
  }
  if (merged.animation === 'kaiten' && !merged.speed) merged.speed = 'slow';
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
  return `${MOJIEMOJI_BASE}/${encodeURIComponent(text)}?${query.toString()}`;
}
