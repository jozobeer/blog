# mojiemoji インライン MDX コンポーネント（M）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **このリポジトリ固有の制約:** ソースコード（`.ts` / `.astro`）への直接編集は `~/.claude/hooks/delegate-coding.sh` でブロックされる。実装は `cursor-code` スキル経由（Cursor Agent）で行う。`.md` / `.json` は Claude 直接編集可。

**Goal:** 記事の `.mdx` 本文に `<M>やったー</M>` と書くだけで、mojiemoji.jozo.beer のインライン画像を楽しげに差し込めるようにする。

**Architecture:** 純粋ロジック（ハッシュ・パラメータ導出・URL 生成・値プール）を `src/lib/mojiemoji.ts` に分離して vitest で TDD。`src/components/M.astro` は薄いラッパで、`Astro.slots.render()` で子要素テキストを取得し、モジュールスコープのビルド内カウンタで出現位置 `index` を採番して lib を呼ぶ。装飾は `text + index` から決定論的に導出するので「同じ語でも位置で変化／リビルドで不変（冪等）」。取得はランタイム外部 `<img>`。

**Tech Stack:** Astro v6（SSG, MDX）、TypeScript、vitest（新規 devDependency）。

**Spec:** `docs/superpowers/specs/2026-05-25-mojiemoji-mdx-component-design.md`

---

## File Structure

| ファイル | 責務 |
|---|---|
| `src/lib/mojiemoji.ts` | 純粋ロジック: `fnv1a` / `FONTS` / `ANIMATIONS` / `COLORS` / `deriveParams` / `resolveParams` / `buildMojiemojiUrl` |
| `src/lib/mojiemoji.test.ts` | 上記の vitest 単体テスト |
| `src/components/M.astro` | 薄いラッパ: slot テキスト取得＋ビルド内カウンタ＋lib 呼び出し→`<img>` 出力 |
| `src/pages/blog/[...slug].astro`（変更） | `<Content components={{ M }} />` で M を全 `.mdx` に注入 |
| `src/content/blog/mojiemoji.mdx`（新規） | M を実際に使うデモ記事 |
| `package.json`（変更） | vitest devDependency と `test` スクリプト |
| `docs/writing-guide.md`（変更） | M の使い方を追記 |
| `CLAUDE.md`（変更） | 設計思想 §3 の mojiemoji を「実装済み」に更新 |

---

## Task 1: vitest セットアップ

**Files:**
- Modify: `package.json`

- [ ] **Step 1: vitest を devDependency に追加**

Run: `npm install -D vitest`
Expected: `package.json` の `devDependencies` に `vitest` が入り、lockfile が更新される。

- [ ] **Step 2: `test` スクリプトを追加**

`package.json` の `scripts` に次を追加する（既存の `astro` 行の後ろ）:

```json
"test": "vitest run"
```

- [ ] **Step 3: スクリプトが動くこと（テスト未作成なので「no test files」で正常終了）を確認**

Run: `npm test`
Expected: vitest が起動し、テストファイルが無い旨を表示してエラーなく終了（exit 0）。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add vitest for unit testing pure logic"
```

---

## Task 2: `fnv1a` ハッシュ（TDD）

**Files:**
- Create: `src/lib/mojiemoji.ts`
- Test: `src/lib/mojiemoji.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/mojiemoji.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fnv1a } from './mojiemoji';

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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`fnv1a` が未定義 / モジュールが無い）。

- [ ] **Step 3: 最小実装**

`src/lib/mojiemoji.ts`:

```ts
/** FNV-1a 32-bit hash (deterministic, unsigned). */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（fnv1a の 3 ケース）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/mojiemoji.ts src/lib/mojiemoji.test.ts
git commit -m "feat(mojiemoji): add deterministic fnv1a hash"
```

---

## Task 3: 値プール ＋ `deriveParams`（TDD）

**Files:**
- Modify: `src/lib/mojiemoji.ts`
- Test: `src/lib/mojiemoji.test.ts`

- [ ] **Step 1: 失敗するテストを追記**

`src/lib/mojiemoji.test.ts` に追記:

```ts
import { FONTS, ANIMATIONS, COLORS, deriveParams } from './mojiemoji';

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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`FONTS` / `ANIMATIONS` / `COLORS` / `deriveParams` 未定義）。

- [ ] **Step 3: 最小実装を追記**

`src/lib/mojiemoji.ts` に追記:

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（deriveParams の 4 ケース＋既存）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/mojiemoji.ts src/lib/mojiemoji.test.ts
git commit -m "feat(mojiemoji): derive playful params from text and position"
```

---

## Task 4: `resolveParams`（上書き＋ kaiten 安全化）（TDD）

**Files:**
- Modify: `src/lib/mojiemoji.ts`
- Test: `src/lib/mojiemoji.test.ts`

- [ ] **Step 1: 失敗するテストを追記**

```ts
import { resolveParams } from './mojiemoji';

describe('resolveParams', () => {
  it('falls back to derived params when no overrides', () => {
    expect(resolveParams('完成', 0)).toEqual(deriveParams('完成', 0));
  });

  it('lets explicit overrides win', () => {
    const p = resolveParams('完成', 0, { color: 'ffffff', font: 'pixel' });
    expect(p.color).toBe('ffffff');
    expect(p.font).toBe('pixel');
    // animation は導出値のまま
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`resolveParams` 未定義）。

- [ ] **Step 3: 最小実装を追記**

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（resolveParams の 4 ケース＋既存）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/mojiemoji.ts src/lib/mojiemoji.test.ts
git commit -m "feat(mojiemoji): merge explicit overrides over derived params"
```

---

## Task 5: `buildMojiemojiUrl`（TDD）

**Files:**
- Modify: `src/lib/mojiemoji.ts`
- Test: `src/lib/mojiemoji.test.ts`

- [ ] **Step 1: 失敗するテストを追記**

```ts
import { buildMojiemojiUrl, MOJIEMOJI_BASE } from './mojiemoji';

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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`buildMojiemojiUrl` / `MOJIEMOJI_BASE` 未定義）。

- [ ] **Step 3: 最小実装を追記**

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（buildMojiemojiUrl の 3 ケース＋既存すべて）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/mojiemoji.ts src/lib/mojiemoji.test.ts
git commit -m "feat(mojiemoji): build runtime mojiemoji image URL"
```

---

## Task 6: `M.astro` コンポーネント

**Files:**
- Create: `src/components/M.astro`

（`.astro` は単体テスト基盤が無いため、後続 Task 7 のビルド検証で確認する。）

- [ ] **Step 1: コンポーネントを作成**

`src/components/M.astro`:

```astro
---
import { resolveParams, buildMojiemojiUrl, type MojiParams } from '../lib/mojiemoji';

interface Props {
  font?: string;
  color?: string;
  animation?: string;
  speed?: string;
  size?: number;
}

// ビルド内カウンタ（モジュールスコープ）。レンダリングごとに increment され、
// 同じ語でも出現位置で見た目が変わる。ビルド内で順序が安定 => 出力は冪等。
let renderCount = 0;

const { font, color, animation, speed, size = 24 } = Astro.props;

// 子要素（プレーンテキスト）を文字列として取得し、タグを除去して trim。
const raw = await Astro.slots.render('default');
const text = raw.replace(/<[^>]*>/g, '').trim();

const index = renderCount++;

const overrides: Partial<MojiParams> = { font, color, animation, speed };
const params = resolveParams(text, index, overrides);
const src = buildMojiemojiUrl(text, params);
---
{text && (
  <img
    src={src}
    alt={text}
    width={size}
    height={size}
    align="absmiddle"
    loading="lazy"
    decoding="async"
  />
)}
```

- [ ] **Step 2: 型・構文チェック**

Run: `npx astro check`
Expected: `src/components/M.astro` にエラーが出ないこと（`align` 属性の警告が出る場合は許容。ビルドは通る）。

- [ ] **Step 3: Commit**

```bash
git add src/components/M.astro
git commit -m "feat(mojiemoji): add inline <M> component"
```

---

## Task 7: M の注入（components prop 検証）＋ デモ記事 ＋ ビルド検証

**Files:**
- Modify: `src/pages/blog/[...slug].astro`
- Create: `src/content/blog/mojiemoji.mdx`

- [ ] **Step 1: `[...slug].astro` で M を注入**

`src/pages/blog/[...slug].astro` を次のように変更する（`import` 追加と `<Content>` への `components` 追加のみ）:

```astro
---
import { type CollectionEntry, getCollection, render } from 'astro:content';
import BlogPost from '../../layouts/BlogPost.astro';
import M from '../../components/M.astro';

export async function getStaticPaths() {
	const posts = await getCollection('blog');
	return posts.map((post) => ({
		params: { slug: post.id },
		props: post,
	}));
}
type Props = CollectionEntry<'blog'>;

const post = Astro.props;
const { Content } = await render(post);
---

<BlogPost {...post.data}>
	<Content components={{ M }} />
</BlogPost>
```

- [ ] **Step 2: デモ記事を作成（import 無しで `<M>` を使う）**

`src/content/blog/mojiemoji.mdx`:

```mdx
---
title: 'もじえもじ、はじめました'
description: '本文の中に小さなアニメ画像を差し込めるようにしました。'
pubDate: 'May 25 2026'
author: jozo
---

このブログでは、文章の中に <M>もじ</M> を差し込んで <M>楽しく</M> できます。

同じ語でも、出てくる場所が違えば見た目が変わります。<M>やったー</M> と <M>やったー</M> は別の表情になります。

装飾は <M>自動</M> なので、書くときは語を囲むだけです。
```

- [ ] **Step 3: ビルドして「import 無し注入」が成功したか検証**

Run: `npm run build`
Expected: 成功し `dist/blog/mojiemoji/index.html` が生成される。

Run: `grep -c 'mojiemoji.jozo.beer/emoji' dist/blog/mojiemoji/index.html`
Expected: `1` 以上（`<M>` が mojiemoji の `<img>` に展開されている）。

- [ ] **Step 4（分岐）: 注入が効かなかった場合の fallback**

もし Step 3 で `<img>` が 0 個、またはビルドが `M is not defined` 等で失敗した場合のみ実施する:

1. `src/pages/blog/[...slug].astro` の `<Content components={{ M }} />` を `<Content />` に戻し、`import M` 行も削除する。
2. `src/content/blog/mojiemoji.mdx` の frontmatter 直後に import 行を追加する:

```mdx
---
title: 'もじえもじ、はじめました'
description: '本文の中に小さなアニメ画像を差し込めるようにしました。'
pubDate: 'May 25 2026'
author: jozo
---

import M from '../../components/M.astro'

このブログでは、文章の中に <M>もじ</M> を差し込んで <M>楽しく</M> できます。
```

3. 再度 Step 3 のビルド検証を行う。
4. **どちらの方式を採用したか（注入 / 1 行 import）を Task 8 のガイドに反映する。**

- [ ] **Step 5: 生成 URL が有効か（任意・ネットワーク確認）**

Run: `grep -o 'https://mojiemoji.jozo.beer/emoji/[^"]*' dist/blog/mojiemoji/index.html | head -1 | xargs curl -s -o /dev/null -w '%{http_code}\n'`
Expected: `200`（mojiemoji が画像を返す。ネットワーク不可環境ならスキップしてよい）。

- [ ] **Step 6: Commit**

```bash
git add src/pages/blog/[...slug].astro src/content/blog/mojiemoji.mdx
git commit -m "feat(mojiemoji): wire <M> into mdx rendering and add demo post"
```

---

## Task 8: ドキュメント更新

**Files:**
- Modify: `docs/writing-guide.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 執筆ガイドに使い方を追記**

`docs/writing-guide.md` の末尾（`## MDX について` セクションの後）に次を追記する。
**Task 7 で「1 行 import」方式を採用した場合は、冒頭の一文を「各記事の冒頭で `import M from '../../components/M.astro'` を書いてから …」に直すこと。**

```markdown
## mojiemoji（`<M>` で楽しい見た目）

`.mdx` 記事では、語を `<M>` で囲むと mojiemoji.jozo.beer のアニメ画像になります。import は不要です。

\`\`\`mdx
今日は <M>やったー</M> だ。ついに <M>完成</M> した。
\`\`\`

- テキストを囲むだけ。色・アニメ・フォントは自動で決まります（同じ語でも出てくる場所で見た目が変わります）。
- mojiemoji は「語レベルのワンポイント」です。文や節をまるごと囲まないでください。1 語は短く（漢字 2 / カタカナ 3 / ひらがな 5 文字くらいが目安）。
- どうしても見た目を指定したいときだけ `<M animation="kaiten" color="dc2626">回転</M>` のように上書きできます（色は 6 桁 hex）。
```

- [ ] **Step 2: `CLAUDE.md` の mojiemoji を「実装済み」に更新**

`CLAUDE.md` の「## 設計思想」§3 にある mojiemoji の項目に、実装済みである旨と使い方を 1 行追記する。`設計思想` セクションの 3 番目（mojiemoji）の箇条書きに次を加える:

```markdown
   - 実装済み: `.mdx` で `<M>語</M>` と書くと mojiemoji 画像になる（`src/components/M.astro` ＋ `src/lib/mojiemoji.ts`）。装飾は text＋出現位置から決定論的に導出。
```

- [ ] **Step 3: ビルドが通ること（ドキュメント変更の最終確認）**

Run: `npm run build && npm test`
Expected: ビルド成功、テスト全通過。

- [ ] **Step 4: Commit**

```bash
git add docs/writing-guide.md CLAUDE.md
git commit -m "docs: document the <M> mojiemoji component"
```

---

## Self-Review（記入済み）

- **Spec coverage:** §3 使い方 → Task 6,7,8 / §4 構成 → Task 2-6 / §5 導出（位置シード・冪等・kaiten） → Task 3,4 / §6 値プール → Task 3 / §7 出力 HTML → Task 6 / §8 ランタイム取得・src 抽象化 → Task 5,6 / §9 テスト → Task 1-5 / §10-11 ファイル → 全 Task / §12 リスク（注入検証・ドリフト） → Task 7 Step 4。全要件にタスクが対応。
- **Placeholder scan:** なし（各ステップに実コード・実コマンド・期待出力を記載）。
- **Type consistency:** `MojiParams` / `fnv1a` / `deriveParams` / `resolveParams` / `buildMojiemojiUrl` / `MOJIEMOJI_BASE` / `FONTS` / `ANIMATIONS` / `COLORS` の名称は全タスクで一致。`M.astro` は `resolveParams` + `buildMojiemojiUrl` のみ呼ぶ（定義済み）。
