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

Node は `.nvmrc` で **22.12.0 に固定**（Cloudflare Pages のビルド環境と揃えるため。`package.json` の `engines` も `>=22.12.0`）。テストランナーは未導入。検証はビルドの成否と dev サーバでの目視確認で行う。

## 設計思想

「閲覧速度の最優先」を軸に、**表現は CSS ではなくセマンティック HTML（足りなければ MDX コンポーネント）で行い、mojiemoji という遊びだけは速度を多少譲ってでも入れる**、という三本柱で成り立つ。`SITE_DESCRIPTION` の「複雑なことをしなければ、CSSなんていらない。」はこの姿勢を表すスローガン。

1. **高速閲覧を目的に、JS / CSS をなるべく排除して SSG する**
   - 表示の速さが最優先指標（KPI）。OGP 生成・sitemap・画像最適化などビルド時処理は閲覧速度に無影響なので許容し、重い依存・極端なビルド遅延を避ける。
   - クライアント JS は原則ゼロ（`client:*` や装飾用 `<script>` をデフォルトでは足さない）。
   - スタイルは **pico.css（classless）を 1 つだけ**導入し `<head>` に**インライン化**（`astro.config.mjs` の `build.inlineStylesheets: 'always'`。外部 CSS リクエスト無し＝初回ペイント最速。`BaseHead.astro` で `@picocss/pico/css/pico.classless.min.css` を import）。クラスは使わず**セマンティック HTML をそのまま装飾**。カスタム CSS は `src/styles/global.css`（現状空・pico の上書き用）に最小限のみ。`.astro` への個別 `<style>` は足さない。

2. **CSS に頼らず、文脈的意味のある標準 HTML タグで表現する（規律）**
   - 見た目のための `<div>` 羅列を避け、`<article>` / `<section>` / `<nav>` / `<time>` / `<figure>` / `<address>` 等の**セマンティック要素**で構造と意味を表す。CSS ゼロでも崩れないのはブラウザの UA スタイルが合理的な既定体裁を当てるから。
   - **Markdown で表現できないセマンティック要素は MDX 化し、コンポーネントとして手軽に使えるようにする。** 「スタイルを足す」前に「正しいタグ／MDX コンポーネントで表現できないか」を先に問う。

3. **mojiemoji で楽しい見た目（意図的な例外）**
   - 高速レンダリングとは逆行するが、本文中に **mojiemoji**（`mojiemoji.jozo.beer`）を使って楽しい見た目にする。
   - 速度一辺倒ではなく "楽しさ" のための意図的なコストは許容する、という線引き。
   - **実装済み**: `.mdx` で `<Moji emoji="語" />` と書くと mojiemoji 画像になる（`src/components/Moji.astro` ＋ 純粋ロジック `src/lib/mojiemoji.ts`）。装飾は text＋出現位置から決定論的に導出（同じ語でも位置で変化・リビルドで不変）。テキストは prop（属性）で渡し Markdown 変換を回避。使い方は `docs/writing-guide.md`、設計は `docs/superpowers/specs/2026-05-25-mojiemoji-mdx-component-design.md`。

## アーキテクチャ

標準的な Astro 構成。ページは `src/pages/` のファイルベースルーティング。

- **コンテンツ層**: `src/content/blog/*.{md,mdx}` を `src/content.config.ts` の glob loader + Zod スキーマで型付け。frontmatter は `title` / `description` / `pubDate` / `author`（**いずれも必須**）、`updatedDate` / `heroImage`（任意）。`author` を必須にしているのは**複数人執筆**を型で担保するため（1記事1著者。将来は配列／著者コレクションに拡張余地）。
- **レイアウト**: 記事は `src/layouts/BlogPost.astro`。`src/pages/blog/[...slug].astro` が `getStaticPaths()` で全記事を静的生成し `BlogPost` に流し込む。
- **共通 `<head>`**: `src/components/BaseHead.astro` が canonical URL・OGP・Twitter Card・RSS/sitemap link を集約。`global.css` の import もここ。OG/Twitter 画像は `image` prop が渡された時だけ meta を出す（プレースホルダ削除に伴う壊れた `og:image` 参照を防ぐ意図）。
- **サイト定数**: `src/consts.ts` の `SITE_TITLE` / `SITE_DESCRIPTION` を各ページ・RSS が共有。
- **配信物**: `src/pages/rss.xml.js`（RSS）、`@astrojs/sitemap` 統合（`/sitemap-index.xml`）。
- **執筆ガイド**: `docs/writing-guide.md` は**サイトに公開しない**リポジトリ内メモ（Markdown/MDX 構文と frontmatter ルール）。記事として `src/content/blog/` に置かないこと。
