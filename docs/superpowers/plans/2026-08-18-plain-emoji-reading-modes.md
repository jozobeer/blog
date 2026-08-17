# プレーン／mojiemoji 表示モード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 記事を「プレーンテキスト（`<Moji>` が素の文字になる）」と「mojiemoji（現状の動く画像）」の 2 通りで読めるようにし、デフォルトをプレーンにして総リクエスト数を削る。

**Architecture:** 本文（`.mdx`）は 1 つのまま、`<Content components={{ Moji }} />` に注入するコンポーネントを差し替えて 2 種類の静的ページを生成する。デフォルト側は既存 URL `/blog/<slug>/`、もう片方は `/blog/<slug>/<mode>/`。切替 UI は pico classless の `[role=group]` + `[role=button]` + `aria-current` で描き、カスタム CSS もクライアント JS も追加しない。

**Tech Stack:** Astro v6（SSG, MDX, adapter なし）、TypeScript、vitest、pico.css v2 classless、Cloudflare Pages。

**Spec:** `docs/superpowers/specs/2026-08-18-plain-emoji-reading-modes-design.md`

## Global Constraints

- **クライアント JS を増やさない。** `<script>` / `client:*` を一切追加しない（現 `dist` 全体で `<script>` は 0 個）。
- **カスタム CSS を追加しない。** `src/styles/global.css` は触らない。`.astro` に `<style>` を書かない。
- **セマンティック HTML で表現する。** 見た目のための `<div>` を足さない（ARIA ロールを持つ要素は可）。
- **既存 URL `/blog/<slug>/` を動かさない。** 公開済みかつ RSS・sitemap 掲載済み。
- **`MojiPlain` は `nextIndex()` を呼ばない。** `src/lib/mojiemoji.ts:167` の `_occurrence` はビルド全体で共有されるモジュールグローバルで、呼び出し回数が変わると全記事の色・フォント・アニメが変わる。
- **切替 UI の並び順は常に「左＝プレーン／右＝mojiemoji」**。記事のデフォルトが `emoji` でも変えない。
- **文言は `プレーン` と `mojiemoji`。** 「絵文字」という語を UI に使わない（読者が Unicode の 😀 を想像するため）。
- インデントは触るファイルの既存スタイルに合わせる（`src/lib/*.ts` は 2 スペース、`.astro` と `src/content.config.ts` はタブ）。

## 事前に検証済みの事実（再確認不要）

| 事実 | 根拠 |
|---|---|
| `[...slug]` の rest パラメータは `"a/b"` のような多セグメント値を受け付け、`dist/a/b/index.html` を生成する | 検証用ルートで実測（2026-08-18） |
| `pico.classless.css` は `[role=group]` 13 ルール、`[role=button]` 37 セレクタ、`[role=button][aria-current]` で背景 `primary-hover-background` を持つ | `node_modules/@picocss/pico/css/pico.classless.css` |
| `@astrojs/sitemap@3.7.2` に `filter?(page: string): boolean` がある | `node_modules/@astrojs/sitemap/dist/index.d.ts:9` |
| `CollectionEntry` に `body?: string` がある | `.astro/content.d.ts:136` |
| `~/.claude/hooks/delegate-coding.sh` は `settings.json` に登録されておらず、`.astro` の直接編集は通る | 実測（2026-08-18） |
| **全ページの HTML に文字列 `mojiemoji.jozo.beer` が 1 件出る**（`global.css` の `img[src*="mojiemoji.jozo.beer"]` が inline 化されるため）。画像の有無は `mojiemoji.jozo.beer/emoji/` で判定すること | 実測: `dist/blog/hello/index.html`（`<Moji>` 0 個）で 1 件ヒット |
| RSS の `<link>` はチャンネル自身の 1 本を含む（記事 5 本 + 1 = 6 本） | 実測（2026-08-18） |

## File Structure

| ファイル | 責務 |
|---|---|
| `src/lib/readingMode.ts`（新規） | 純粋ロジック: モード型、もう一方のモード、生成すべきルート一覧、モード別 href、`<Moji>` 有無判定 |
| `src/lib/readingMode.test.ts`（新規） | 上記の vitest 単体テスト |
| `src/components/MojiPlain.astro`（新規） | `<Moji>` のプレーン版。語の素テキストのみを出力。`nextIndex()` を呼ばない |
| `src/components/ReadingModeSwitch.astro`（新規） | 切替 UI（`<nav>` + `role="group"` + `role="button"`） |
| `src/pages/blog/[...slug].astro`（変更） | `getStaticPaths` で記事ごとに 1〜2 ページを生成し、モードに応じて注入するコンポーネントを切り替える |
| `src/layouts/BlogPost.astro`（変更） | 任意 prop `reading?: ReadingContext` を追加し、`<hr />` の直後に切替 UI を差す。`BaseHead` に canonical / alternate を渡す。**`/about` と共用のため `reading` 無しでも壊れないこと** |
| `src/components/BaseHead.astro`（変更） | `canonicalPath` / `alternatePath` の任意 prop を追加 |
| `src/content.config.ts`（変更） | `defaultMode: z.enum(['plain','emoji']).optional()` を追加 |
| `src/content/blog/mojiemoji.mdx`（変更） | `defaultMode: 'emoji'` を frontmatter に追加。`<Moji>` 前後の和文どうしの空白 17 件を削除 |
| `astro.config.mjs`（変更） | sitemap の `filter` で副ページを除外 |
| `docs/writing-guide.md`（変更） | `<Moji>` 前後の空白ルールを追記 |
| `CLAUDE.md`（変更・別コミット） | テストランナーの記述を是正し、2 ページ方式を設計思想に追記 |

---

## Task 0: ベースライン取得

**Files:** なし（計測のみ）

**Interfaces:**
- Produces: `/tmp/moji-baseline/<slug>.urls` — 記事ごとの mojiemoji URL 出現列。Task 2 以降の検証で参照する

- [ ] **Step 1: 作業ツリーが clean であることを確認**

```bash
git status --short
```

Expected: 出力が空、または未追跡の `docs/superpowers/` 配下のみ。`src/` に変更があってはならない。

- [ ] **Step 2: ベースラインをビルドして URL 出現列を保存**

```bash
npm run build
mkdir -p /tmp/moji-baseline
for d in dist/blog/*/; do
  n=$(basename "$d")
  grep -o 'mojiemoji.jozo.beer/emoji/[^"]*' "$d/index.html" > "/tmp/moji-baseline/$n.urls" || true
  printf '%-32s %s\n' "$n" "$(wc -l < "/tmp/moji-baseline/$n.urls")"
done
```

Expected:

```
cloudflare-skill-five-landmines  334
gh-img                           551
hello                            0
macos-app-debug-utm-vm           609
mojiemoji                        160
```

本数が違う場合は、この計画が想定したソースと異なる。先に差分を確認すること。

---

## Task 1: `readingMode` 純粋ロジック（TDD）

**Files:**
- Create: `src/lib/readingMode.ts`
- Test: `src/lib/readingMode.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type ReadingMode = 'plain' | 'emoji'`
  - `DEFAULT_READING_MODE: ReadingMode`（`'plain'`）
  - `alternateMode(mode: ReadingMode): ReadingMode`
  - `interface ModeRoute { slug: string; mode: ReadingMode; isDefault: boolean }`
  - `interface ReadingContext { slug: string; mode: ReadingMode; defaultMode: ReadingMode; hasAlternate: boolean }`
  - `modeRoutes(slug: string, defaultMode: ReadingMode, hasMoji: boolean): ModeRoute[]`
  - `modeHref(slug: string, mode: ReadingMode, defaultMode: ReadingMode): string`
  - `hasMoji(body: string | undefined): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/readingMode.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  alternateMode,
  modeRoutes,
  modeHref,
  hasMoji,
} from './readingMode';

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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- readingMode`
Expected: FAIL — `Failed to resolve import "./readingMode"`

- [ ] **Step 3: 最小の実装を書く**

`src/lib/readingMode.ts`:

```ts
export type ReadingMode = 'plain' | 'emoji';

/** frontmatter で指定が無い記事の既定モード。 */
export const DEFAULT_READING_MODE: ReadingMode = 'plain';

/**
 * レイアウトへ渡す表示モードの文脈。BlogPost は /about でも使われるため、
 * この 4 つは「全部そろうか、まったく無いか」のどちらかにする。
 */
export interface ReadingContext {
  slug: string;
  /** いま表示しているモード */
  mode: ReadingMode;
  /** この記事の既定モード */
  defaultMode: ReadingMode;
  /** もう片方のページが存在するか */
  hasAlternate: boolean;
}

/** もう一方のモード。 */
export function alternateMode(mode: ReadingMode): ReadingMode {
  return mode === 'plain' ? 'emoji' : 'plain';
}

/** 本文に `<Moji>` が現れるか。コードスパン内のリテラルも true になるが、副ページ生成の判定には十分。 */
export function hasMoji(body: string | undefined): boolean {
  return (body ?? '').includes('<Moji');
}

export interface ModeRoute {
  /** `[...slug]` に渡す params.slug。デフォルト側は記事 id そのもの。 */
  slug: string;
  mode: ReadingMode;
  isDefault: boolean;
}

/**
 * 記事 1 本が生成すべきページ。デフォルトモードは既存 URL `/blog/<slug>/` を保ち、
 * もう片方を `/blog/<slug>/<mode>/` に置く。
 * `<Moji>` が無い記事は 2 枚目が 1 枚目と同一内容になるので生成しない。
 */
export function modeRoutes(
  slug: string,
  defaultMode: ReadingMode,
  hasMojiInBody: boolean,
): ModeRoute[] {
  const routes: ModeRoute[] = [{ slug, mode: defaultMode, isDefault: true }];
  if (hasMojiInBody) {
    const alt = alternateMode(defaultMode);
    routes.push({ slug: `${slug}/${alt}`, mode: alt, isDefault: false });
  }
  return routes;
}

/** 指定モードで記事を読むための絶対パス。 */
export function modeHref(
  slug: string,
  mode: ReadingMode,
  defaultMode: ReadingMode,
): string {
  return mode === defaultMode ? `/blog/${slug}/` : `/blog/${slug}/${mode}/`;
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npm test`
Expected: PASS（既存の `mojiemoji.test.ts` 22 件 + 新規 10 件 = 32 件）

- [ ] **Step 5: コミット**

```bash
git add src/lib/readingMode.ts src/lib/readingMode.test.ts
git commit -m "feat(reading-mode): add pure logic for plain/emoji route resolution"
```

---

## Task 2: 2 モードのページ生成

**Files:**
- Create: `src/components/MojiPlain.astro`
- Modify: `src/content.config.ts`
- Modify: `src/content/blog/mojiemoji.mdx`（frontmatter のみ。空白削除は Task 5）
- Modify: `src/pages/blog/[...slug].astro`
- Modify: `src/layouts/BlogPost.astro`（Props 追加のみ。UI は Task 3）

**Interfaces:**
- Consumes: `modeRoutes` / `hasMoji` / `ReadingMode`（Task 1）
- Produces:
  - `MojiPlain.astro` — `emoji` prop を受け取り素テキストを出力
  - `BlogPost.astro` の Props に任意の `reading?: ReadingContext` が増える（`/about` は渡さない）
  - frontmatter フィールド `defaultMode`（既定 `'plain'`）

- [ ] **Step 1: `MojiPlain.astro` を作る**

`src/components/MojiPlain.astro`:

```astro
---
// Moji のプレーン版。語をそのままテキストとして出す。
// nextIndex() を呼ばないこと。呼ぶとビルド全体の出現カウンタがずれ、
// 全記事の mojiemoji 画像の色・フォント・アニメが変わる。
interface Props {
  emoji: string;
}

const { emoji } = Astro.props;
---
{emoji.trim()}
```

- [ ] **Step 2: frontmatter に `defaultMode` を足す**

`src/content.config.ts` の `schema` に 1 行追加（タブインデント）:

```ts
			author: z.string(),
			defaultMode: z.enum(['plain', 'emoji']).optional(),
			heroImage: z.optional(image()),
```

`.default('plain')` ではなく `.optional()` にすること。`.default()` は Zod の**出力型を必須にする**ため、
`CollectionEntry<'blog'>['data']` を Props に使っている `BlogPost.astro` の利用者
（`src/pages/about.astro` は記事ではないので `defaultMode` を渡せない）が型不整合になる。
未指定は読み出し側で `DEFAULT_READING_MODE` にフォールバックする。

`src/content/blog/mojiemoji.mdx` の frontmatter に 1 行追加:

```yaml
author: hondazn
defaultMode: 'emoji'
```

- [ ] **Step 3: `[...slug].astro` を書き換える**

`src/pages/blog/[...slug].astro` の全文（タブインデント）:

```astro
---
import { type CollectionEntry, getCollection, render } from 'astro:content';
import BlogPost from '../../layouts/BlogPost.astro';
import Moji from '../../components/Moji.astro';
import MojiPlain from '../../components/MojiPlain.astro';
import {
	DEFAULT_READING_MODE,
	hasMoji,
	modeRoutes,
	type ReadingContext,
} from '../../lib/readingMode';

export async function getStaticPaths() {
	const posts = await getCollection('blog');
	return posts.flatMap((post) => {
		const defaultMode = post.data.defaultMode ?? DEFAULT_READING_MODE;
		const routes = modeRoutes(post.id, defaultMode, hasMoji(post.body));
		return routes.map((route) => ({
			params: { slug: route.slug },
			props: {
				post,
				reading: {
					slug: post.id,
					mode: route.mode,
					defaultMode,
					hasAlternate: routes.length > 1,
				},
			},
		}));
	});
}

type Props = {
	post: CollectionEntry<'blog'>;
	reading: ReadingContext;
};

const { post, reading } = Astro.props;
const { Content } = await render(post);
---

<BlogPost {...post.data} reading={reading}>
	<Content components={{ Moji: reading.mode === 'emoji' ? Moji : MojiPlain }} />
</BlogPost>
```

- [ ] **Step 4: `BlogPost.astro` の Props を広げる**

> **`BlogPost.astro` は記事専用ではない。** `src/pages/about.astro:2` が同じレイアウトを
> `title` / `description` / `pubDate` / `author` の 4 つだけで使っている。
> 表示モードの props を必須にすると `/about/` が壊れる（Astro は props を実行時に強制しないので
> **ビルドは成功したまま** canonical が `/blog/undefined/` になる）。
> そのため `reading` は**任意の 1 グループ**として受け取り、無い場合は現状の挙動を保つ。

`src/layouts/BlogPost.astro` のフロントマターを差し替える（タブインデント）:

```astro
---
import { Image } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';
import BaseHead from '../components/BaseHead.astro';
import Footer from '../components/Footer.astro';
import FormattedDate from '../components/FormattedDate.astro';
import Header from '../components/Header.astro';
import type { ReadingContext } from '../lib/readingMode';

type Props = CollectionEntry<'blog'>['data'] & {
	/** 記事ページのみ渡る。/about のような記事以外の利用では undefined。 */
	reading?: ReadingContext;
};

const { title, description, pubDate, updatedDate, heroImage, author, reading } =
	Astro.props;
---
```

以降のテンプレートはこの時点では変更しない（`reading` は Task 3・4 で使う）。
`src/pages/about.astro` は**変更しない**。`reading` を渡さないままで正しく動くことが、この設計の要件。

- [ ] **Step 5: ビルドしてページが生成されることを確認**

```bash
npm run build
echo "記事ページ総数: $(find dist/blog -name index.html | wc -l)"
# 既存の主 URL 5 枚が動いていないこと（Global Constraint「既存 URL を動かさない」）
for want in cloudflare-skill-five-landmines gh-img hello macos-app-debug-utm-vm mojiemoji \
            cloudflare-skill-five-landmines/emoji gh-img/emoji macos-app-debug-utm-vm/emoji mojiemoji/plain; do
  test -f "dist/blog/$want/index.html" && echo "OK   $want" || echo "NG   $want が無い"
done
for ng in hello/emoji hello/plain mojiemoji/emoji; do
  test -e "dist/blog/$ng/index.html" && echo "NG   $ng があってはならない" || echo "OK   $ng は無い"
done
```

Expected: 記事ページ総数 `10`（変更前 6 = 記事 5 + `/blog/` 一覧 → 副ページ 4 枚が増える）。
`OK` 以外が 1 行も出ないこと。`hello` に副ページが無いこと、`mojiemoji` だけ `/plain/` であることを確認する。
副ページが 1 つも出ない場合は `post.body` が空。`console.log(post.body?.length)` を `getStaticPaths` に一時的に入れて確かめる。

- [ ] **Step 6: プレーン版に画像が無いことを確認**

判定パターンは `mojiemoji.jozo.beer/emoji/`（画像 URL の形）にすること。
`mojiemoji.jozo.beer` だけだと `global.css` の `img[src*="mojiemoji.jozo.beer"]` が
inline 化された分を拾い、**正しい実装でも 1 件ヒットする**。

```bash
for f in dist/blog/cloudflare-skill-five-landmines/index.html \
         dist/blog/gh-img/index.html \
         dist/blog/macos-app-debug-utm-vm/index.html \
         dist/blog/mojiemoji/plain/index.html; do
  printf '%-56s %s\n' "$f" "$(grep -o 'mojiemoji.jozo.beer/emoji/' "$f" | wc -l)"
done
```

Expected: すべて `0`

- [ ] **Step 7: 絵文字版の URL 出現列がベースラインと完全一致することを確認**

`nextIndex()` 汚染の検知。**この計画で最も重要な検証**。

```bash
fail=0
for n in cloudflare-skill-five-landmines gh-img macos-app-debug-utm-vm; do
  grep -o 'mojiemoji.jozo.beer/emoji/[^"]*' "dist/blog/$n/emoji/index.html" > "/tmp/moji-after-$n.urls"
  diff -q "/tmp/moji-baseline/$n.urls" "/tmp/moji-after-$n.urls" || fail=1
done
grep -o 'mojiemoji.jozo.beer/emoji/[^"]*' dist/blog/mojiemoji/index.html > /tmp/moji-after-mojiemoji.urls
diff -q /tmp/moji-baseline/mojiemoji.urls /tmp/moji-after-mojiemoji.urls || fail=1
echo "fail=$fail"
```

Expected: `fail=0`（差分出力なし）

差分が出たら `MojiPlain` が `nextIndex()` を呼んでいるか、`getStaticPaths` の並びが変わっている。**本数の一致では不十分**（カウンタがずれても本数は変わらない）ので、必ずこの列比較で判定する。

- [ ] **Step 8: 2 回ビルドして順序決定性を確認**

```bash
npm run build >/dev/null && grep -o 'mojiemoji.jozo.beer/emoji/[^"]*' dist/blog/macos-app-debug-utm-vm/emoji/index.html > /tmp/moji-2nd.urls
diff -q /tmp/moji-after-macos-app-debug-utm-vm.urls /tmp/moji-2nd.urls && echo OK
```

Expected: `OK`

- [ ] **Step 9: テストとコミット**

```bash
npm test
git add src/components/MojiPlain.astro src/content.config.ts \
        src/content/blog/mojiemoji.mdx src/pages/blog/'[...slug].astro' \
        src/layouts/BlogPost.astro
git commit -m "feat(reading-mode): generate plain and mojiemoji pages per post"
```

---

## Task 3: 切替 UI

**Files:**
- Create: `src/components/ReadingModeSwitch.astro`
- Modify: `src/layouts/BlogPost.astro`

**Interfaces:**
- Consumes: `modeHref` / `ReadingMode`（Task 1）、`BlogPost` の `reading`（Task 2）
- Produces: `ReadingModeSwitch` — props `slug` / `mode` / `defaultMode`

- [ ] **Step 1: `ReadingModeSwitch.astro` を作る**

`src/components/ReadingModeSwitch.astro`:

```astro
---
import { modeHref, type ReadingMode } from '../lib/readingMode';

interface Props {
  slug: string;
  /** いま表示しているモード */
  mode: ReadingMode;
  /** この記事の既定モード（href の組み立てに要る） */
  defaultMode: ReadingMode;
}

const { slug, mode, defaultMode } = Astro.props;

// 並び順は記事の既定モードによらず固定。
const items: { mode: ReadingMode; label: string }[] = [
  { mode: 'plain', label: 'プレーン' },
  { mode: 'emoji', label: 'mojiemoji' },
];
---

<nav aria-label="表示モード">
  <div role="group">
    {
      items.map((item) => (
        <a
          href={modeHref(slug, item.mode, defaultMode)}
          role="button"
          aria-current={item.mode === mode ? 'page' : undefined}
          rel={item.mode === mode ? undefined : 'alternate'}
        >
          {item.label}
        </a>
      ))
    }
  </div>
</nav>
```

pico が `[role=group]` に `display:inline-flex` と共有 `border-radius` を、`[role=button][aria-current]` に塗りを当てるので、CSS は書かない。

- [ ] **Step 2: `BlogPost.astro` に差し込む**

`src/layouts/BlogPost.astro` の import に 1 行足す:

```astro
import ReadingModeSwitch from '../components/ReadingModeSwitch.astro';
```

`<hr />` の直後（`<slot />` の前）に差す:

```astro
							<h1>{title}</h1>
							<hr />
							{
								reading?.hasAlternate && (
									<ReadingModeSwitch
										slug={reading.slug}
										mode={reading.mode}
										defaultMode={reading.defaultMode}
									/>
								)
							}
						</div>
						<slot />
```

- [ ] **Step 3: ビルドして出力を確認**

```bash
npm run build
grep -o '<nav aria-label="表示モード">.*</nav>' dist/blog/gh-img/index.html | head -c 400; echo
echo "--- hello（副ページ無し）には出ないこと ---"
grep -o 'aria-label="表示モード"' dist/blog/hello/index.html | wc -l
```

Expected: `gh-img` では `role="group"` と 2 本の `<a role="button">` が出力され、`プレーン` 側に `aria-current="page"` が付く。`hello` は `0`。

- [ ] **Step 4: `mojiemoji` 記事で選択側が反転していることを確認**

```bash
grep -o '<a href="/blog/mojiemoji/[^>]*>' dist/blog/mojiemoji/index.html
```

Expected: `プレーン` 側の href が `/blog/mojiemoji/plain/`、`mojiemoji` 側の href が `/blog/mojiemoji/` で、後者に `aria-current="page"` が付く。

- [ ] **Step 5: `<script>` が増えていないことを確認**

```bash
grep -ro '<script' dist/ | wc -l
```

Expected: `0`

- [ ] **Step 6: dev サーバで実物を見る**

```bash
npm run dev
```

`http://localhost:4321/blog/gh-img/` を開き、記事冒頭に連結されたセグメントコントロールが出て、左が選択状態になっていることを目視する。**全幅バーの見た目が許容できるかはここで人間が判断する。** 違和感がある場合のみ、`src/styles/global.css` に幅指定 1 行を足す判断を別途行う（この計画のスコープ外）。

- [ ] **Step 7: コミット**

```bash
git add src/components/ReadingModeSwitch.astro src/layouts/BlogPost.astro
git commit -m "feat(reading-mode): add segmented control for switching modes"
```

---

## Task 4: canonical・rel=alternate・sitemap

**Files:**
- Modify: `src/components/BaseHead.astro`
- Modify: `src/layouts/BlogPost.astro`
- Modify: `astro.config.mjs`

**Interfaces:**
- Consumes: `modeHref` / `alternateMode`（Task 1）、`BlogPost` の `reading`（Task 2）
- Produces: `BaseHead` の任意 prop `canonicalPath?: string` / `alternatePath?: string`

- [ ] **Step 1: `BaseHead.astro` に prop を足す**

`src/components/BaseHead.astro` の Props と canonical 算出を差し替える（タブインデント）:

```astro
interface Props {
	title: string;
	description: string;
	image?: ImageMetadata;
	/** 自己参照ではない canonical を出したいとき（副ページ用） */
	canonicalPath?: string;
	/** 同一文書の別表現へのリンク */
	alternatePath?: string;
}

const { title, description, image, canonicalPath, alternatePath } = Astro.props;

const canonicalURL = new URL(canonicalPath ?? Astro.url.pathname, Astro.site);
```

`<link rel="canonical" href={canonicalURL} />` の直後に 1 行足す:

```astro
{alternatePath && (
	<link rel="alternate" type="text/html" href={new URL(alternatePath, Astro.site)} />
)}
```

- [ ] **Step 2: `BlogPost.astro` から渡す**

import に足す:

```astro
import { alternateMode, modeHref } from '../lib/readingMode';
```

フロントマター末尾で算出する:

```astro
// reading が無い利用（/about）では canonical を上書きせず、BaseHead の自己参照に任せる。
const canonicalPath = reading
	? modeHref(reading.slug, reading.defaultMode, reading.defaultMode)
	: undefined;
const alternatePath = reading?.hasAlternate
	? modeHref(reading.slug, alternateMode(reading.mode), reading.defaultMode)
	: undefined;
```

`<BaseHead ... />` に渡す:

```astro
<BaseHead
	title={title}
	description={description}
	image={heroImage}
	canonicalPath={canonicalPath}
	alternatePath={alternatePath}
/>
```

- [ ] **Step 3: sitemap から副ページを除外**

`astro.config.mjs` の `integrations` を差し替える:

```js
	integrations: [
		mdx(),
		sitemap({
			// プレーン／mojiemoji の副ページは同一記事の別表現なので、
			// canonical 側（/blog/<slug>/）だけを sitemap に載せる。
			filter: (page) => !/\/blog\/[^/]+\/(plain|emoji)\/$/.test(page),
		}),
	],
```

- [ ] **Step 4: ビルドして canonical を確認**

```bash
npm run build
echo "--- 副ページの canonical は本体を指す ---"
grep -o '<link rel="canonical" href="[^"]*"' dist/blog/gh-img/emoji/index.html
grep -o '<link rel="canonical" href="[^"]*"' dist/blog/mojiemoji/plain/index.html
echo "--- 本体の canonical は自分自身 ---"
grep -o '<link rel="canonical" href="[^"]*"' dist/blog/gh-img/index.html
echo "--- rel=alternate ---"
grep -o '<link rel="alternate" type="text/html" href="[^"]*"' dist/blog/gh-img/index.html
echo "--- /about は影響を受けていないこと（BlogPost 共用の回帰チェック）---"
grep -o '<link rel="canonical" href="[^"]*"' dist/about/index.html
echo "切替UI: $(grep -o 'aria-label=\"表示モード\"' dist/about/index.html | wc -l)"
echo "モードのalternate: $(grep -o 'rel=\"alternate\" type=\"text/html\"' dist/about/index.html | wc -l)"
echo "RSSのalternate（既存・1件のはず）: $(grep -o 'application/rss+xml' dist/about/index.html | wc -l)"
```

Expected:
- `dist/blog/gh-img/emoji/index.html` → `https://blog.jozo.beer/blog/gh-img/`
- `dist/blog/mojiemoji/plain/index.html` → `https://blog.jozo.beer/blog/mojiemoji/`
- `dist/blog/gh-img/index.html` → `https://blog.jozo.beer/blog/gh-img/`
- alternate → `https://blog.jozo.beer/blog/gh-img/emoji/`
- **`dist/about/index.html` → `https://blog.jozo.beer/about/`**（`/blog/undefined/` になっていたら `reading` の任意化が効いていない）
- `/about` の切替 UI `0` 件、モードの alternate `0` 件、RSS の alternate `1` 件（RSS リンクは `BaseHead.astro:26-31` が全ページに出す既存の出力。実測で 1 件であることを確認済み）

- [ ] **Step 5: sitemap を確認**

```bash
grep -o '<loc>[^<]*</loc>' dist/sitemap-0.xml | wc -l
grep -o '<loc>[^<]*</loc>' dist/sitemap-0.xml
```

Expected: 8 件のみ（変更前と同数）。`/emoji/` と `/plain/` を含む URL が 1 つも無いこと。

- [ ] **Step 6: RSS が変わっていないことを確認**

```bash
echo "item数: $(grep -o '<item>' dist/rss.xml | wc -l)"
echo "link総数: $(grep -o '<link>[^<]*</link>' dist/rss.xml | wc -l)"
echo "副ページへのlink: $(grep -o '<link>[^<]*/\(emoji\|plain\)/</link>' dist/rss.xml | wc -l)"
```

Expected: item 数 `5`、link 総数 `6`（記事 5 本 + **チャンネル自身の `<link>https://blog.jozo.beer/</link>` 1 本**）、
副ページへの link `0`。いずれも変更前と同じ値であること。

- [ ] **Step 7: コミット**

```bash
git add src/components/BaseHead.astro src/layouts/BlogPost.astro astro.config.mjs
git commit -m "feat(reading-mode): point sub-pages at canonical and drop them from sitemap"
```

---

## Task 5: `<Moji>` 前後の空白整理

**Files:**
- Modify: `src/content/blog/mojiemoji.mdx`
- Modify: `docs/writing-guide.md`

**Interfaces:**
- Consumes: なし
- Produces: なし（本文と執筆ルールのみ）

削除対象は**両側が和文の空白 17 箇所、すべて `mojiemoji.mdx`**。以下は残す:

- リストマーカー直後 2 箇所（`macos-app-debug-utm-vm.mdx:24,34`）— 消すと Markdown のリスト構文が壊れる
- 和欧間 65 箇所 — 日本語組版の慣習。プレーン版でこそ可読性に効く
- 記号に隣接する 5 箇所（`cloudflare-skill-five-landmines.mdx:149,171` / `macos-app-debug-utm-vm.mdx:121,149,222`）— 片側だけ消えて左右非対称になる

- [ ] **Step 1: 該当 7 行の空白を削除する**

`src/content/blog/mojiemoji.mdx` の以下の箇所で、`<Moji ... />` に隣接する半角スペースを削る。**両側が和文のものだけ**。

行番号は **Task 2 Step 2 で frontmatter に `defaultMode` を足した後**の値（元の行番号 +1）。
ずれていた場合は、行番号ではなく下表の変更前テキストで対象を特定すること（いずれも文書内で一意）。

| 行 | 削除箇所 |
|---|---|
| 9 | `たとえば <Moji emoji="もじ" /> や <Moji emoji="えもじ" /> のように。` → `たとえば<Moji emoji="もじ" />や<Moji emoji="えもじ" />のように。` |
| 23 | `一度貼った <Moji emoji="了解" /> が、` → `一度貼った<Moji emoji="了解" />が、` |
| 31 | `と書くと、その <Moji emoji="語" /> が mojiemoji の` → `と書くと、その<Moji emoji="語" />が mojiemoji の`（`が` の後の空白は和欧間なので残す） |
| 35 | `さっきの <Moji emoji="自動" /> と、この <Moji emoji="自動" /> は別の` → `さっきの<Moji emoji="自動" />と、この<Moji emoji="自動" />は別の` |
| 37 | `<Moji emoji="表情" />は <Moji emoji="不変" /> です。` → `<Moji emoji="表情" />は<Moji emoji="不変" />です。` |
| 41 | `1 語は <Moji emoji="短く" />。` → `1 語は<Moji emoji="短く" />。`（`1 語` の空白は残す） |
| 59 | `そんな <Moji emoji="例外" /> です。` → `そんな<Moji emoji="例外" />です。` |

- [ ] **Step 2: 削除件数を検証する**

```bash
python3 - <<'PY'
import re
pat=re.compile(r'<Moji\s+emoji="([^"]*)"[^>]*?/>')
ASCII=re.compile(r'[A-Za-z0-9`)\](\[]')
SYM=re.compile(r'[→←↔:：、。」』】\)\]\*`＝=…]')
n=0
for ln,line in enumerate(open('src/content/blog/mojiemoji.mdx').read().split('\n'),1):
    for m in pat.finditer(line):
        w=m.group(1); pre,post=line[:m.start()],line[m.end():]
        if pre.endswith(' ') and not (ASCII.match(pre[:-1][-1:] or ' ') or ASCII.match(w[:1]) or SYM.match(pre[:-1][-1:] or ' ')):
            print(f'残存 {ln} 前 {w}'); n+=1
        if post.startswith(' ') and post[1:2] and not (ASCII.match(w[-1:]) or ASCII.match(post[1:2]) or SYM.match(post[1:2])):
            print(f'残存 {ln} 後 {w}'); n+=1
print('残り', n)
PY
```

Expected: `残り 0`

- [ ] **Step 3: プレーン版の日本語を目視する**

```bash
npm run build
python3 -c "
import re,html
s=open('dist/blog/mojiemoji/plain/index.html').read()
t=re.sub(r'<[^>]+>','',s)
print(html.unescape(t)[:1200])"
```

`たとえばもじやえもじのように。` のように**詰まりすぎて読めない箇所がないか**を人間の目で確認する。読みにくい箇所があれば、その空白だけ Step 1 の変更を戻す。

- [ ] **Step 4: 絵文字版の URL 列が変わっていないことを確認**

空白削除は `emoji` prop も出現順も変えないので、URL 列は不変であるべき。

```bash
grep -o 'mojiemoji.jozo.beer/emoji/[^"]*' dist/blog/mojiemoji/index.html > /tmp/moji-ws.urls
diff -q /tmp/moji-baseline/mojiemoji.urls /tmp/moji-ws.urls && echo OK
```

Expected: `OK`

- [ ] **Step 5: 執筆ガイドに規則を書く**

`docs/writing-guide.md` の `<Moji>` の節に追記:

```markdown
- `<Moji>` の前後が和文なら、半角スペースを入れない。プレーン表示のとき語の前後に不要な空きが残る。
  英数字やコードスパンと隣り合う場合は、和欧間の空きとして残してよい。
```

- [ ] **Step 6: コミット**

```bash
git add src/content/blog/mojiemoji.mdx docs/writing-guide.md
git commit -m "fix(mojiemoji): drop spaces around Moji between Japanese text"
```

---

## Task 6: ドキュメント是正（別コミット）

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: テストランナーの記述を直す**

`CLAUDE.md` の「Node は `.nvmrc` で…」の段落にある
「テストランナーは未導入。検証はビルドの成否と dev サーバでの目視確認で行う。」を、次に置き換える:

```markdown
純粋ロジック（`src/lib/*.ts`）は vitest で単体テストする（`npm test`）。`.astro` の描画は
ビルド成果物（`dist/`）の検査と dev サーバでの目視確認で検証する。
```

- [ ] **Step 2: 設計思想に表示モードを追記**

`CLAUDE.md` の設計思想「3. mojiemoji で楽しい見た目（意図的な例外）」の末尾に追記:

```markdown
   - **表示モード**: 記事は既定でプレーン（`<Moji>` が素の文字）で配信し、mojiemoji 版は
     `/blog/<slug>/emoji/` に静的生成して記事冒頭のセグメントコントロールから選ぶ。
     JS もカスタム CSS も使わない（`role="group"` + `aria-current` を pico が描く）。
     記事ごとに frontmatter の `defaultMode` で既定を反転できる（`mojiemoji.mdx` は `'emoji'`）。
     設計: `docs/superpowers/specs/2026-08-18-plain-emoji-reading-modes-design.md`
```

- [ ] **Step 3: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: correct test runner note and record reading-mode design"
```

---

## 完了条件（全タスク後に通しで実行）

- [ ] `npm run build` が成功する
- [ ] `npm test` が通る
- [ ] 絵文字版の URL 出現列がベースラインと完全一致（Task 2 Step 7 の手順を再実行）
- [ ] プレーン版ページの mojiemoji URL が 0 本
- [ ] 2 回ビルドして URL 列が一致
- [ ] `dist/sitemap-0.xml` に `/emoji/` `/plain/` を含む URL が無い
- [ ] 副ページの canonical が本体を指す
- [ ] `grep -ro '<script' dist/ | wc -l` が `0`
- [ ] `/about/` の canonical が `https://blog.jozo.beer/about/` のまま（`BlogPost` 共用の回帰）
- [ ] `src/styles/global.css` に差分が無い（`git diff --stat src/styles/global.css` が空）
- [ ] dev サーバで切替 UI を目視し、双方向に行き来できる

## Self-Review

**1. Spec coverage**

| spec の節 | 対応タスク |
|---|---|
| §3 ページ構成・URL 設計 | Task 1（ルート算出）、Task 2（生成） |
| §3 メタ情報（canonical / sitemap / rel=alternate / RSS 不変） | Task 4 |
| §4 コンポーネント構成（MojiPlain、nextIndex 非呼出） | Task 2（Step 1・Step 7 で検証） |
| §5 切替 UI（位置・並び順・pico ネイティブ） | Task 3 |
| §6 frontmatter `defaultMode` | Task 2 Step 2 |
| §6 空白処理 | Task 5 |
| §7 検証・完了条件 | Task 0（ベースライン）＋ 各タスクの検証ステップ＋末尾の完了条件 |
| §8 スコープ外（JS・CSS・プラグイン・一覧/RSS/OGP） | Global Constraints ＋ 完了条件の `<script>` 0 件・`global.css` 無差分チェック |
| §9 `mojiemoji.mdx` プレーン版の破綻は放置 | 意図的に対応タスクを置かない |

**2. Placeholder scan:** TBD／TODO／「適切に」等の記述なし。全コードステップに実コードあり。

**3. Type consistency:** `ReadingMode` / `ReadingContext` / `ModeRoute` / `modeRoutes` / `modeHref` / `alternateMode` / `hasMoji` / `DEFAULT_READING_MODE` は Task 1 の定義と Task 2・3・4 の呼び出しで一致。`BlogPost` の追加 Prop は任意の `reading?: ReadingContext` 1 つに集約し、Task 2 で定義して Task 3・4 で `reading?.` 経由で消費する。`defaultMode` は `post.data` ではなく `reading` に載せて渡すため、`/about` の利用が型・実行時とも壊れない。
