# mojiemoji MDX コンポーネント 設計（spec）

- 日付: 2026-05-25
- 対象リポジトリ: JOZO's blog（Astro v6 SSG）
- ステータス: 設計合意済み（実装計画はこの後 writing-plans で作成）

## 1. 目的・背景

記事本文（`.mdx`）の中に、`mojiemoji.jozo.beer`（テキスト → 128×128px の PNG/GIF 変換 API）で
生成した小さな画像を**インラインで手軽に**差し込み、楽しげな見た目にする。

執筆者の要件（ユーザー確認済み）:
- 執筆時は **text を書くだけ**。装飾パラメータ（animation/color/font 等）は考えたくない。
- それでも **楽しげで多彩な見た目**に自動変換される。
- **同じ語でも出現位置ごとに違う見た目**になる。
- ただし **ビルドは冪等**（同じソースをリビルドすれば同じ出力＝デプロイ差分・キャッシュが安定）。

## 2. コンセプト整合（`CLAUDE.md` 設計思想・三本柱との関係）

mojiemoji は三本柱の 3 番目「**楽しい見た目のための意図的な例外**」に該当する。
高速レンダリングには逆行するが、以下で影響を最小化し、思想と両立させる:

- クライアント JS は**増やさない**（GIF はブラウザがネイティブに動かす。`<script>`/`client:*` 不要）。
- CSS は**使わない**（サイズ・行内中央寄せは HTML 属性で行う）。
- 取得は**ランタイム外部参照**（後述）。将来ビルド時化に無痛移行できるよう `src` 生成を抽象化する。

## 3. 使い方（執筆 API）

コンポーネント名は極限まで短く **`M`**。テキストは子要素で渡す。

```mdx
今日は <M>やったー</M> だ。もう一度 <M>やったー</M> と言いたい。
```

- **テキストは子要素**（`<M>やったー</M>`）。コンポーネントは `Astro.slots.render('default')` で子要素を
  文字列として取得し、trim して `alt`・URL・シードに使う。子要素は**プレーンテキストのみ**（マークアップを入れない）。
- 任意の上書き prop: `animation` / `color` / `font` / `speed` / `size`。指定があればそれを使い、無ければ自動導出（§5）。
- **import は不要**を目標とする: 記事描画箇所（`src/pages/blog/[...slug].astro`）で `<Content components={{ M }} />`
  として全 `.mdx` に注入する。カスタム名コンポーネントの注入は Astro 公式ドキュメントで明文化されていないため
  **実装時に検証**し、不可なら各 `.mdx` 冒頭で `import M from '../../components/M.astro'` の 1 行 import に fallback する。
- mojiemoji を使う記事は `.mdx` にする（`.md` では JSX コンポーネントを使えない）。
- 運用ガイド: mojiemoji は「**語レベルのパンチ**」。文・節をまるごと入れない。1 語は短く
  （目安: 漢字 ≤2 / カタカナ ≤3 / ひらがな ≤5 文字。mojiemoji の最大 15 文字 / 5×3 グリッド制約に由来）。

## 4. コンポーネント構成（関心の分離）

| ファイル | 役割 | 純粋性 |
|---|---|---|
| `src/lib/mojiemoji.ts` | 純粋ロジック: ハッシュ、`deriveParams(text, index)`、`buildMojiemojiUrl(text, params)`、値プール定数 | 純粋（テスト対象） |
| `src/components/M.astro` | 薄いラッパ: `Astro.slots.render()` で子要素テキストを取得し、ビルド内カウンタで出現位置 `index` を採番し、lib を呼んで `<img>` を出力 | 不純（ビルド順依存・slot 読みはここに閉じる） |

ロジック（交換可能・再生成可能）とビルド順依存（カウンタ）を分離する。

## 5. パラメータ自動導出（位置シード・冪等）

- **シード**: `seed = fnv1a(`${text}#${index}`)`（32bit FNV-1a）。`text` は子要素を trim した文字列、`index` は §4 のビルド内カウンタによる出現順（0 始まり）。
  - 同じ `text` でも `index` が違えば別の見た目。違う語も当然多彩。
  - 同じソースをリビルドすれば描画順は不変 → `index` も不変 → **冪等**。
- **導出**: `seed` から派生させた 3 つの値で、font / color / animation をそれぞれの値プールから選ぶ
  （例: `font = FONTS[seed % FONTS.length]`、`h2 = (seed*2654435761)>>>0; color = COLORS[h2 % COLORS.length]`、
  `h3 = (h2*2246822519)>>>0; animation = ANIMS[h3 % ANIMS.length]`。実装は決定論的であれば手段は問わない）。
- **speed**: 既定は省略。ただし `animation === 'kaiten'` のときは `speed=slow`（回転が速いと読めないため。reference 準拠）。
- **上書き**: `Astro.props` に明示された `animation/color/font/speed` は導出値より優先。

注意（既知の落とし穴）: ビルド内カウンタはレンダリング順に依存する。`astro build` の SSG レンダリングは
所与のツールチェーン・ソースに対して決定論的なので冪等は保たれるが、`astro dev` では再評価のタイミングにより
**dev の見え方がビルドと一致しないことがある**（最終ビルド出力が正）。記事を編集して mojiemoji の前後関係が
変わると、それ以降の `index` がずれて見た目が変わる（編集による変化なので想定内）。

## 6. 値プール（mojiemoji-github 由来・白背景向け差分）

`mojiemoji-github` スキルの正準リストを流用しつつ、**このブログは CSS ゼロ＝白背景**である点を補正する。

- **animation（インライン安全のみ）**: `tate_scroll, yoko_scroll, ekken, tate_ekken, bane, gatagata, bure,
  kirari, kira, tenmetsu, shuchusen, kaiten, neruneru, patapata, yurayura, mabataki, norinori, mochimochi,
  poyoon, yatta, tatemoya, nami, yokomoya, zairu, zanzo, chirichiri, disco, psycho, kage_neon`。
  - 除外（小サイズで letterform が潰れる/ block 専用）: `bakusan`, `chuuou_zoom`, `mozaiku`, `kage_kaiten`, `kage_bokashi`。
- **font（16 種すべて）**: `gothic, gothic-bold, maru, maru-bold, mincho, dela, akzk, zero, kurobara,
  hachimaru, chikara, tamanegi, pixel, toge, rampart, noto`。
- **color（白背景で読める 6 桁 hex・名前色は使わない）**: `dc2626, ea580c, d97706, ca8a04, 16a34a, 059669,
  0d9488, 0891b2, 0284c7, 2563eb, 4f46e5, 7c3aed, 9333ea, c026d3, db2777, e11d48`（おおむね Tailwind 600–700）。
  - reference の推奨（300–500）は GitHub のダーク背景前提。白背景では薄すぎるため濃いめに振る。
- **outline**: v1 では付けない（白背景＋濃いめ fill で可読。`background=transparent`）。将来 pop が欲しければ追加検討。

正準リストはサービス側で予告なく変わりうる（reference 「パラメータが効かなくなったとき」）。
値が効かなくなったら `mojiemoji.jozo.beer` を確認し、`src/lib/mojiemoji.ts` のプールを更新する。

## 7. 出力 HTML

```html
<img src="https://mojiemoji.jozo.beer/emoji/%E3%82%84%E3%81%A3%E3%81%9F%E3%83%BC?font=maru-bold&color=2563eb&animation=bane&background=transparent"
     alt="やったー" width="24" height="24" align="absmiddle"
     loading="lazy" decoding="async">
```

- URL: `https://mojiemoji.jozo.beer/emoji/{encodeURIComponent(text)}` ＋ クエリ（`font` `color` `animation` `background=transparent`、必要時 `speed`）。
- `alt = text`（読み上げ・コピー・画像不可時に意味が残る）。
- `width`/`height` = `size`（既定 24）。正方キャンバスなので等値。レイアウトシフト防止。
- 行内中央寄せは CSS を使わず `align="absmiddle"`（HTML 属性。現行ブラウザで動作。CSS ゼロ方針のため採用）。
- `loading="lazy"` / `decoding="async"` で閲覧速度への影響を最小化。

## 8. 取得タイミング（ランタイム）と将来のビルド時化

- v1 は**ランタイム外部参照**（閲覧時にブラウザが mojiemoji から取得）。実装最小。
- トレードオフ（受容済み）: 閲覧速度・可用性が mojiemoji 依存（落ちると画像が出ない）。
- 移行余地: `buildMojiemojiUrl` で `src` を抽象化しておくことで、後日「ビルド時に取得してローカル静的アセット化」へ
  コンポーネント API（執筆側）を変えずに差し替えられる。

## 9. テスト方針（TDD）

純粋ロジックを vitest で単体テストする（dev/ビルド時のみの devDependency。閲覧速度に無影響）:

- `fnv1a` / `deriveParams(text, index)`: 同一 `(text, index)` → 同一結果（決定論）。`index` 違いで結果が変わる。
  導出値が必ず各プール内の有効値である。
- `buildMojiemojiUrl`: 日本語の URL エンコード、クエリ組み立て、`background=transparent` 付与、
  `animation=kaiten` で `speed=slow` 注入、明示 prop が導出値を上書きすること。

注: vitest 追加で `package.json` / lockfile が変わる（実装フェーズのレビュー観点）。

## 10. スコープ / 非対象（YAGNI）

対象:
- `src/lib/mojiemoji.ts`（純粋ロジック＋プール）
- `src/components/M.astro`（薄いラッパ）
- `src/pages/blog/[...slug].astro`（`<Content components={{ M }} />` で M を全 `.mdx` に注入。検証で不可なら fallback）
- 単体テスト（vitest）
- デモ用サンプル記事 1 本（mojiemoji を実際に使う `.mdx`）
- `docs/writing-guide.md` に使い方を追記、`CLAUDE.md` の mojiemoji 項を「実装済み」に更新

非対象（v1 ではやらない）:
- ビルド時取得 → 静的アセット化（§8 の移行余地として設計のみ残す）
- 文字数オーバーの自動分割（漢字 ≤2 等の自動チャンク化）。ガイドで「短く」案内するのみ。
- block 装飾（独立行の大きなスタンプ）。inline のみ。
- outline / gradient 等の追加装飾。

## 11. 変更ファイル一覧（想定）

- 追加: `src/lib/mojiemoji.ts`、`src/components/M.astro`、`src/lib/mojiemoji.test.ts`、サンプル `.mdx`
- 変更: `package.json`（vitest）、`src/pages/blog/[...slug].astro`（M 注入。fallback 時は不要）、`docs/writing-guide.md`、`CLAUDE.md`
- 生成: lockfile

## 12. リスク・既知の落とし穴

- ランタイム外部依存（§8）: mojiemoji ダウン時に画像欠損。受容済み・将来ビルド時化で解消可能。
- ビルド順依存カウンタ（§5）: 冪等は保たれるが dev とビルドで見え方が一部ずれうる。
- mojiemoji 仕様ドリフト（§6）: 値が無効化されたら静止画に無音フォールバック。プール更新で対応。
- 色の可読性: 白背景前提。将来ダークテーマ対応するなら color プール/outline を再検討。
