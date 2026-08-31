# ブログ UI/UX の作り直し設計

- 日付: 2026-08-31
- 対象: 既存ページ全部（ホーム / 記事一覧 / 記事 / About）＋ 404
- 前提: コンセプト三本柱（高速 SSG・セマンティック HTML・mojiemoji）は変えない

## 何を解くか

実測（`dist/` を配信してヘッドレス Chromium で撮影）で確認した問題。

| 箇所 | 問題 |
| --- | --- |
| 記事本文 | 1280px 幅で 1 行 55〜60 字。可読の目安 35〜45 字を超える |
| ヘッダー | ナビが「Home Blog About」と密着。モバイルでタップ標的が隣接する |
| ヘッダー | 現在地の表示が無い |
| 記事一覧 | 箇条書きに著者と日付が不揃いに縦積み。`description` が出ておらず中身が分からない |
| ホーム | リンク 2 本だけで記事に触れられない |
| 記事ページ | `author: hondazn` が生表示。日付が `en-us`（`lang="ja"` の文書） |
| 記事ページ | 前後の記事へも一覧へも導線が無い |
| 記事ページ | 表示モード切替が全幅に伸び、タイトルより目立つ |
| 全体 | 404 ページが無い。RSS が `<head>` にしか無く読者から到達できない |

## 決定と根拠

### 配色はダーク固定を維持する

`data-theme="dark"` を全ページに残す。`global.css` の表示モード切替ルールはダークのホバー色を前提に書かれており、変えると再検証が要る。

### CSS は 2 ルールだけ足す

pico.classless の実装（`node_modules/@picocss/pico/css/pico.classless.css`）を読んで、マークアップだけで解ける範囲を確定した。

CSS が要らないと確認したもの:

- `article > header` / `article > footer` … カードの帯（`:1827-1847`）
- `hgroup > *:not(:first-child):last-child` … ミュート＋1rem（`:747-751`）
- `a[aria-current]` … 現在地の色と下線（`:829-834`）
- `nav li` … リンク間の余白（`:2129-2133`）
- `pre` … `overflow-x: auto`（`:1057-1060`）。幅を狭めても長い行は横スクロールで壊れない
- `img` … `max-width: 100%`（`:1002-1003`）

CSS が要ると確認したもの:

- `body > header, main, footer` の `max-width` は breakpoint ごとのベタ書きで変数化されていない（`:601-645`）。1024px 以上で 950 → 1200 → 1450px と伸びる。**マークアップでは解けない**
- `[role=group]` は `width: 100%`（`:1852-1862`）。切替 UI が全幅に伸びる原因

したがって `src/styles/global.css` に足すのは次の 2 ルールだけ（3 → 5 ルール）。

```css
@media (min-width: 1024px) {
  body > header, body > main, body > footer { max-width: 44rem; }
}

nav[aria-label="表示モード"] [role="group"] { width: auto; }
```

1024px 未満では pico の値（510 / 700px）が既に適切なので触らない。44rem ≒ 704px ≒ 日本語 44 字。

### 新機能は足さない

目次（TOC）とタグ分類は見送る。記事 6 本の規模に対して利得が小さく、タグは `public/_headers` へのパス追加とスキーマ拡張を伴う先行投資になる。

## 構成

### 新規

| ファイル | 役割 |
| --- | --- |
| `src/layouts/BaseLayout.astro` | `<html>` / `<head>` / Header / `<main>` / Footer の骨格。3 ファイルの重複を集約 |
| `src/components/PostCard.astro` | 記事 1 件の見出し + メタ + `description`。一覧とホームで共有 |
| `src/pages/404.astro` | Cloudflare Pages が `/404.html` を自動で使う |

### 変更

| ファイル | 変更 |
| --- | --- |
| `src/components/Header.astro` | `<div>` → `<ul><li>`。Home 項目を削除（ロゴが担う）。ラベルを日本語化 |
| `src/components/HeaderLink.astro` | 死んでいる `class="active"` → `aria-current="page"` |
| `src/components/Footer.astro` | `<nav>` 化し RSS リンクを追加 |
| `src/components/FormattedDate.astro` | `en-us` → `ja-JP` |
| `src/layouts/BlogPost.astro` | `<div>` 入れ子を全廃し `<header>` / `<figure>` / `<footer>` へ。`reading` を必須化 |
| `src/pages/index.astro` | `BaseLayout` 利用。最新 3 件の `PostCard` を置く |
| `src/pages/blog/index.astro` | `BaseLayout` 利用。`<li>` → `PostCard` |
| `src/pages/about.astro` | `BlogPost` → `BaseLayout`。日付と著者の表示が消える |
| `src/pages/blog/[...slug].astro` | 前後記事を props で渡す |
| `src/lib/readingMode.ts` | `/about` に言及したコメントを実態へ |
| `src/styles/global.css` | 上記 2 ルールを追加 |

### マークアップ

ヘッダー:

```html
<header><nav>
  <ul><li><strong><a href="/" aria-current=…>JOZO's blog</a></strong></li></ul>
  <ul><li><a href="/blog/" aria-current=…>記事</a></li>
      <li><a href="/about/" aria-current=…>このブログについて</a></li></ul>
</nav></header>
```

`PostCard`:

```html
<article>
  <hgroup>
    <h2><a href="/blog/…/">タイトル</a></h2>
    <p><time datetime="…">2026年8月21日</time> · hondazn</p>
  </hgroup>
  <p>description</p>
</article>
```

記事ページ:

```html
<article>
  <header>
    <hgroup><h1>タイトル</h1><p>description</p></hgroup>
    <p><time>2026年8月21日</time> · hondazn</p>
    <nav aria-label="表示モード">…</nav>
  </header>
  <figure>ヒーロー画像</figure>
  <slot />
  <footer><nav>
    <ul><li><a>← 前の記事</a></li></ul>
    <ul><li><a>次の記事 →</a></li></ul>
  </nav></footer>
</article>
```

著者に `<address>` は使わない。HTML 仕様の `<address>` は連絡先のための要素で、リンクの無い表示名だけを入れるのは誤用になる。

前後記事のリンク先は隣接記事の canonical（`/blog/<slug>/`）。`/emoji/` の副ページからも canonical 側へ出す。

## 壊してはいけないもの

### mojiemoji の画像列

`src/lib/mojiemoji.ts` の `nextIndex()` はビルド全体で共有されるカウンタで、`<Moji>` の描画順が変わると公開済み全記事の色・フォント・アニメが変わる。

守るべき制約:

- ホームでも一覧でも記事本文を `render()` しない。frontmatter だけを読む
- `[...slug].astro` の `getStaticPaths()` が返す順序を変えない
- 新しく足すページ（404）に `<Moji>` を置かない

担保: 変更前の `dist/` から採取した画像 URL の出現列 1905 件（ファイル名つき）と、変更後の列を `diff` で完全一致させる。本数一致では検出できない。

### クライアント JS はこのブログで 391 バイトの 1 本だけ

切替 UI を持つ 8 ページ以外に `<script>` を足さない。

## 検証

| 対象 | 手段 |
| --- | --- |
| mojiemoji 画像列 | ベースラインと `diff` で完全一致 |
| 型契約 | `astro check` |
| 純粋ロジック | `vitest`（`readingMode.ts` を触る） |
| 描画 | 変更後スクリーンショットを before と並べる（home / 一覧 / 記事 / 404、desktop・mobile） |
| JS 量 | `dist/` の `<script>` 出現が切替 UI の 8 ページのみ |

ビルドは `./node_modules/.bin/astro build` を使う。`aube` は依存 `tinyexec@1.2.2` の trust downgrade で止まる（本設計の対象外）。

## 既知の穴

`public/_headers` はリクエストパス一致で動くため、存在しない URL への 404 応答には `no-transform` が付かない。`/*` を足せば付くが、アセットの `max-age=14400` も上書きしてしまうので見送る。404 本文にメールアドレス風の文字列を置かないことで実害を避ける。

## 申し送り

`CLAUDE.md` は `SITE_DESCRIPTION` を「複雑なことをしなければ、CSSなんていらない。」というスローガンと書いているが、コミット `788d265` で `'jozo.beer のブログです。'` に変わっている。ホームのリード文としては弱いが、意図的な変更に見えるので本作業では触らない。
