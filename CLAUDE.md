# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

JOZO's blog — Astro v6 の SSG（静的サイト生成、adapter なし）で作るブログ。
コンセプトは **「複雑なことをしなければ、CSSなんていらない。」** （`SITE_DESCRIPTION` 兼スローガン）。

- 公開ドメイン: `blog.jozo.beer`（`astro.config.mjs` の `site`）
- デプロイ先: **Cloudflare Pages**（`npm run build` の `dist/` を配信）
- ベース: Astro 公式 blog スターター（Bear Blog 由来）を JOZO 向けに改変したもの

## コマンド

```sh
aube install          # 依存インストール
aube dev          # 開発サーバ（astro dev --host、localhost:4321）
aube build        # 本番ビルド → dist/
aube preview      # ビルド結果のローカルプレビュー
aube astro -- --help   # astro check など CLI
```

Node は `.nvmrc` で **22.12.0 に固定**（Cloudflare Pages のビルド環境と揃えるため。`package.json` の `engines` も `>=22.12.0`）。

検証は3層。純粋ロジック（`src/lib/*.ts`）は `aube test`（vitest）で単体テスト、型は `aube check`（`astro check`）、`.astro` の描画はビルド成果物（`dist/`）の検査と dev サーバでの目視で確認する。型は実行時に消えるため、`aube test` も `aube build` も型の誤りを検出しない — 型契約を固定したいときは `aube check` が唯一の手段。

## 設計思想

「閲覧速度の最優先」を軸に、**表現は CSS ではなくセマンティック HTML（足りなければ MDX コンポーネント）で行い、mojiemoji という遊びだけは速度を多少譲ってでも入れる**、という三本柱で成り立つ。`SITE_DESCRIPTION` の「複雑なことをしなければ、CSSなんていらない。」はこの姿勢を表すスローガン。

1. **高速閲覧を目的に、JS / CSS をなるべく排除して SSG する**
   - 表示の速さが最優先指標（KPI）。OGP 生成・sitemap・画像最適化などビルド時処理は閲覧速度に無影響なので許容し、重い依存・極端なビルド遅延を避ける。
   - クライアント JS は原則ゼロ（`client:*` や装飾用 `<script>` をデフォルトでは足さない）。**唯一の例外**は表示モード切替の 391 バイト（柱 3 参照）。足すときは「HTML/CSS で代替できないか」を先に問い、`is:inline` でバンドルさせず、JS 不在でも機能が壊れない形にする。
   - スタイルは **pico.css（classless）を 1 つだけ**導入し `<head>` に**インライン化**（`astro.config.mjs` の `build.inlineStylesheets: 'always'`。外部 CSS リクエスト無し＝初回ペイント最速。`BaseHead.astro` で `@picocss/pico/css/pico.classless.min.css` を import）。クラスは使わず**セマンティック HTML をそのまま装飾**。カスタム CSS は `src/styles/global.css`（pico の上書き用）に最小限のみ（現在 3 ルール）。`.astro` への個別 `<style>` は足さない。

2. **CSS に頼らず、文脈的意味のある標準 HTML タグで表現する（規律）**
   - 見た目のための `<div>` 羅列を避け、`<article>` / `<section>` / `<nav>` / `<time>` / `<figure>` / `<address>` 等の**セマンティック要素**で構造と意味を表す。CSS ゼロでも崩れないのはブラウザの UA スタイルが合理的な既定体裁を当てるから。
   - **Markdown で表現できないセマンティック要素は MDX 化し、コンポーネントとして手軽に使えるようにする。** 「スタイルを足す」前に「正しいタグ／MDX コンポーネントで表現できないか」を先に問う。

3. **mojiemoji で楽しい見た目（意図的な例外）**
   - 高速レンダリングとは逆行するが、本文中に **mojiemoji**（`mojiemoji.jozo.beer`）を使って楽しい見た目にする。
   - 速度一辺倒ではなく "楽しさ" のための意図的なコストは許容する、という線引き。
   - **実装済み**: `.mdx` で `<Moji emoji="語" />` と書くと mojiemoji 画像になる（`src/components/Moji.astro` ＋ 純粋ロジック `src/lib/mojiemoji.ts`）。装飾は text＋出現位置から決定論的に導出（同じ語でも位置で変化・リビルドで不変）。テキストは prop（属性）で渡し Markdown 変換を回避。使い方は `docs/writing-guide.md`、設計は `docs/superpowers/specs/2026-05-25-mojiemoji-mdx-component-design.md`。
   - **表示モード**: 記事は**既定でプレーン**（`<Moji>` が素の文字）で配信し、mojiemoji 版は `/blog/<slug>/emoji/` に静的生成して記事冒頭のセグメントコントロールから選ぶ。1記事あたり画像が数百枚・URL は全て一意でキャッシュが効かないため、既定で払わせない判断。記事ごとに frontmatter の `defaultMode` で反転できる（`mojiemoji.mdx` は `'emoji'`。mojiemoji 本体のショーケースを兼ねるため）。切替 UI は pico の `[role=group]` と `[role=button]` で描き、`global.css` の 1 ルールで「選択中＝塗り／非選択＝枠線」にする（pico 既定は選択側にホバー色を当てるが、dark ではそれが base より暗く差も出ないため）。切替リンクだけ 391 バイトのインライン JS で `location.replace()` に差し替え、モード往復が履歴に積まれないようにしている（**このブログで唯一のクライアント JS**。切替 UI を持つ 8 ページのみ・外部リクエスト無し・JS 不在でも普通のリンクとして動く）。設計は `docs/superpowers/specs/2026-08-18-plain-emoji-reading-modes-design.md`。
   - **`src/lib/mojiemoji.ts` の `nextIndex()` はビルド全体で共有されるカウンタ**。呼び出し回数が変わると公開済み全記事の色・フォント・アニメが変わる。`<Moji>` を別実装に差し替えるときは、この関数を呼ばないこと。担保は「変更前の画像 URL 出現列を保存し、変更後と完全一致するか比較する」（本数一致では検出できない）。

## アーキテクチャ

標準的な Astro 構成。ページは `src/pages/` のファイルベースルーティング。

- **コンテンツ層**: `src/content/blog/*.{md,mdx}` を `src/content.config.ts` の glob loader + Zod スキーマで型付け。frontmatter は `title` / `description` / `pubDate` / `author`（**いずれも必須**）、`updatedDate` / `heroImage`（任意）。`author` を必須にしているのは**複数人執筆**を型で担保するため（1記事1著者。将来は配列／著者コレクションに拡張余地）。
- **レイアウト**: 記事は `src/layouts/BlogPost.astro`。`src/pages/blog/[...slug].astro` が `getStaticPaths()` で全記事を静的生成し `BlogPost` に流し込む。
- **共通 `<head>`**: `src/components/BaseHead.astro` が canonical URL・OGP・Twitter Card・RSS/sitemap link を集約。`global.css` の import もここ。OG/Twitter 画像は `image` prop が渡された時だけ meta を出す（プレースホルダ削除に伴う壊れた `og:image` 参照を防ぐ意図）。
- **サイト定数**: `src/consts.ts` の `SITE_TITLE` / `SITE_DESCRIPTION` を各ページ・RSS が共有。
- **配信物**: `src/pages/rss.xml.js`（RSS）、`@astrojs/sitemap` 統合（`/sitemap-index.xml`）。
- **執筆ガイド**: `docs/writing-guide.md` は**サイトに公開しない**リポジトリ内メモ（Markdown/MDX 構文と frontmatter ルール）。記事として `src/content/blog/` に置かないこと。
