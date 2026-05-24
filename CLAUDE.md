# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

JOZO's blog — Astro v6 の SSG（静的サイト生成、adapter なし）で作る個人ブログ。
コンセプトは **「複雑なことをしなければ、CSSなんていらない。」** （`SITE_DESCRIPTION` 兼スローガン）。

- 公開ドメイン: `blog.jozo.beer`（`astro.config.mjs` の `site`）
- デプロイ先: **Cloudflare Pages**（`npm run build` の `dist/` を配信）
- ベース: Astro 公式 blog スターター（Bear Blog 由来）を JOZO 向けに改変したもの

プロジェクトの確定仕様・ロードマップ・未決事項・運用制約は **`PLAN.md` が一次情報源**。
新しいセッションはまず `PLAN.md` を読むこと（コードからは読み取れない意思決定が書かれている）。

## コマンド

```sh
npm install          # 依存インストール
npm run dev          # 開発サーバ（astro dev --host、localhost:4321）
npm run build        # 本番ビルド → dist/
npm run preview      # ビルド結果のローカルプレビュー
npm run astro -- --help   # astro check など CLI
```

Node は `.nvmrc` で **22.12.0 に固定**（Cloudflare Pages のビルド環境と揃えるため。`package.json` の `engines` も `>=22.12.0`）。テストランナーは未導入。検証はビルドの成否と dev サーバでの目視確認で行う。

## 設計思想

**コンセプトの本質は「閲覧速度の最優先」** であって、「CSS が不要」という主張ではない。`SITE_DESCRIPTION` の「複雑なことをしなければ、CSSなんていらない。」は、それを表すスローガン（実証テーマ）であり教条ではない。

- **閲覧速度が最優先指標（KPI）**: 表示の速さを最上位に置く。OGP 生成・sitemap・画像最適化などビルド時処理は閲覧速度に無影響なので許容し、重い依存・極端なビルド遅延を避ける。
- **CSS はゼロ起点（現状の出発点）**: スターターのスタイルを全て剥がした状態から始めている。`src/styles/global.css` は現状空（`import` は残す）で、`.astro` にも `<style>` は無い。ただし**恒久禁止ではない**。必要に迫られれば最小限の CSS を入れる方針で、フェーズ2 で「本当に要るものだけ」足す（`PLAN.md` §4）。
- **クライアント JS は原則ゼロ**: `client:*` や装飾用 `<script>` をデフォルトでは足さない。ただし「必要が証明できたら使う」余地は残す。

判断基準は **速度への影響と必要性**。速度を損なわず必要性を示せるなら、最小限の CSS / JS を入れてよい。反射的・装飾目的では足さない、という運用。したがって現状スタイルが当たっていないのは「まだ足していない」だけで未完成ではない。基本はセマンティックな標準 HTML 要素（`<article>`, `<nav>`, `<hr>` 等）で表現する。

## アーキテクチャ

標準的な Astro 構成。ページは `src/pages/` のファイルベースルーティング。

- **コンテンツ層**: `src/content/blog/*.{md,mdx}` を `src/content.config.ts` の glob loader + Zod スキーマで型付け。frontmatter は `title` / `description` / `pubDate` / `author`（**いずれも必須**）、`updatedDate` / `heroImage`（任意）。`author` を必須にしているのは**複数人執筆**を型で担保するため（1記事1著者。将来は配列／著者コレクションに拡張余地）。
- **レイアウト**: 記事は `src/layouts/BlogPost.astro`。`src/pages/blog/[...slug].astro` が `getStaticPaths()` で全記事を静的生成し `BlogPost` に流し込む。
- **共通 `<head>`**: `src/components/BaseHead.astro` が canonical URL・OGP・Twitter Card・RSS/sitemap link を集約。`global.css` の import もここ。OG/Twitter 画像は `image` prop が渡された時だけ meta を出す（プレースホルダ削除に伴う壊れた `og:image` 参照を防ぐ意図）。
- **サイト定数**: `src/consts.ts` の `SITE_TITLE` / `SITE_DESCRIPTION` を各ページ・RSS が共有。
- **配信物**: `src/pages/rss.xml.js`（RSS）、`@astrojs/sitemap` 統合（`/sitemap-index.xml`）。
- **執筆ガイド**: `docs/writing-guide.md` は**サイトに公開しない**リポジトリ内メモ（Markdown/MDX 構文と frontmatter ルール）。記事として `src/content/blog/` に置かないこと。

## このリポジトリ固有のワークフロー（`PLAN.md` §6 由来・ユーザー指示）

グローバル設定の委譲ワークフローに対し、本リポジトリでは以下の**プロジェクト固有の上書き**がある:

- **worktree は使わない**: ローカル `main` で直接作業する（ユーザー指示）。
- **軽量フロー: PR は不要**（ユーザー指示）。コミットメッセージは既存履歴の Conventional Commits 風（`feat:` / `ci:` 等）に合わせる。
- **検証をユーザーに丸投げしない**: 変更後は Claude 自身が `npm run build` / dev サーバで確認する。
- **初回 push・Cloudflare Pages 連携は外部副作用＋ユーザー認証が必要** → 実行前に必ずユーザーへ確認する。
- ソースコード（`.astro` / `.ts` / `.js` 等）の直接編集は `~/.claude/hooks/delegate-coding.sh` でブロックされる。実装は `cursor-code` スキル経由で委譲する。`.md` / `.json` / `.mjs` / `.yml` / `.claude/**` など非ソースは Claude 直接編集可。
