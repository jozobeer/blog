# mojiemoji MDX コンポーネント 設計（spec）

- 日付: 2026-05-25
- 対象リポジトリ: JOZO's blog（Astro v6 SSG）
- ステータス: 設計合意済み（実装計画は `docs/superpowers/plans/2026-05-25-mojiemoji-mdx-component.md`）
- コンポーネント名: **`Moji`** / テキスト prop: **`emoji`**（`<Moji emoji="やったー" />`。"moji" ＋ "emoji" ＝ mojiemoji の語呂。`Moji` は一般名と衝突しにくい）

## 1. 目的・背景

記事本文（`.mdx`）の中に、`mojiemoji.jozo.beer`（テキスト → 128×128px の PNG/GIF 変換 API）で
生成した小さな画像を**インラインで手軽に**差し込み、楽しげな見た目にする。

執筆者の要件（ユーザー確認済み）:
- 執筆時は **テキストを書くだけ**。装飾パラメータ（animation/color/font 等）は考えたくない。
- それでも **楽しげで多彩な見た目**に自動変換される。
- **同じ語でも出現位置ごとに違う見た目**になる。
- ただし **ビルドは冪等**（同じソースをリビルドすれば同じ出力＝デプロイ差分・キャッシュが安定）。
- テキストは **Markdown 変換を受けない**（`*` `_` 等が解釈されない）。

## 2. コンセプト整合（`CLAUDE.md` 設計思想・三本柱との関係）

mojiemoji は三本柱の 3 番目「**楽しい見た目のための意図的な例外**」に該当する。
高速レンダリングには逆行するが、以下で影響を最小化し、思想と両立させる:

- クライアント JS は**増やさない**（GIF はブラウザがネイティブに動かす。`<script>`/`client:*` 不要）。
- CSS は**使わない**（サイズ・行内中央寄せは HTML 属性で行う）。
- 取得は**ランタイム外部参照**（後述）。将来ビルド時化に無痛移行できるよう `src` 生成を抽象化する。

## 3. 使い方（執筆 API）

テキストは **`emoji` prop（JSX 属性）** で渡す。

```mdx
今日は <Moji emoji="やったー" /> だ。もう一度 <Moji emoji="やったー" /> と言いたい。
```

- **テキストは `emoji` prop**（`<Moji emoji="やったー" />`）。属性値は文字列リテラルなので **Markdown 変換を受けない（verbatim）**。
  これが子要素方式（`<Moji>やったー</Moji>`）を採らない理由 —— 子要素は MDX の Markdown 処理を通り、`*` `_` `[]` バッククォート等が
  解釈されてテキストが壊れうる。コンポーネントは `Astro.props.emoji` を trim して `alt`・URL・シードに使う。
- 任意の上書き prop: `animation` / `color` / `font` / `speed` / `size`。指定があればそれを使い、無ければ自動導出（§5）。
- **import は不要**を目標とする: 記事描画箇所（`src/pages/blog/[...slug].astro`）で `<Content components={{ Moji }} />`
  として全 `.mdx` に注入する。カスタム名コンポーネントの注入は Astro 公式ドキュメントで明文化されていないため
  実装時に検証した → **注入は機能した（import 不要、fallback 不要）**。仮に効かない場合は各 `.mdx` 冒頭で
  `import Moji from '../../components/Moji.astro'` の 1 行 import に fallback する。
- 記事は `.mdx`（地の文は Markdown のまま書きたいため）。`<Moji>` を本文に埋め込めるのが `.mdx`。
  mojiemoji のテキストだけ `emoji` prop で Markdown を回避する。
- 運用ガイド: mojiemoji は「**語レベルのパンチ**」。文・節をまるごと入れない。1 語は短く
  （目安: 漢字 ≤2 / カタカナ ≤3 / ひらがな ≤5 文字。mojiemoji の最大 15 文字 / 5×3 グリッド制約に由来）。

## 4. コンポーネント構成（関心の分離）

| ファイル | 役割 | 純粋性 |
|---|---|---|
| `src/lib/mojiemoji.ts` | 純粋ロジック: ハッシュ、`deriveParams(text, index)`、`resolveParams`、`buildMojiemojiUrl(text, params)`、値プール定数 | 純粋（テスト対象） |
| `src/components/Moji.astro` | 薄いラッパ: `Astro.props.emoji`（テキスト）を受け取り、lib の `nextIndex()` で出現位置 `index` を採番し、lib を呼んで `<img>` を出力 | 不純（ビルド順依存はここに閉じる） |

ロジック（交換可能・再生成可能）とビルド順依存（カウンタ）を分離する。

## 5. パラメータ自動導出（位置シード・冪等）

- **シード**: `seed = fnv1a(`${text}#${index}`)`（32bit FNV-1a）。`text` は `emoji` prop を trim した文字列、`index` は §4 のビルド内カウンタによる出現順（0 始まり）。
  - 同じ `text` でも `index` が違えば別の見た目。違う語も当然多彩。
  - 同じソースをリビルドすれば描画順は不変 → `index` も不変 → **冪等**。
- **導出（`deriveParams`）**: `seed` から派生させた 3 値で font / color / animation を各プールから選ぶ
  （`font = FONTS[seed % …]`、`h2 = (seed*2654435761)>>>0; color = COLORS[h2 % …]`、`h3 = (h2*2246822519)>>>0; animation = ANIMS[h3 % …]`）。
- **描画ルール（`resolveParams`、§6 の `mojiemoji-github` 準拠）**: 上書きをマージしたうえで適用 ——
  rotational `{kaiten, kage_kaiten}` は `speed=slow`、color-shifting `{kira, disco, psycho}` は outline 除外、
  それ以外は `outline=triadic(色相+120°)` + `outline_width=2`。
- **上書き**: `Astro.props` に明示された `animation/color/font/speed` は導出値より優先（outline は最終 color から再計算される）。

注意（既知の落とし穴・実装で判明）: カウンタは **lib（`src/lib/mojiemoji.ts`）のモジュール状態 `nextIndex()`** に置く。
`.astro` の `---` フロントマターは**毎レンダリング再実行**されるため、フロントマター内に `let count = 0` を置くと
毎回リセットされ、全 `<Moji>` が index 0 になり「同じ語が位置で変わらない」不具合になる（実際に踏んで修正済み）。
また、カウンタはレンダリング順に依存する。`astro build` の SSG レンダリングは
所与のツールチェーン・ソースに対して決定論的なので冪等は保たれるが、`astro dev` では再評価のタイミングにより
**dev の見え方がビルドと一致しないことがある**（最終ビルド出力が正）。記事を編集して mojiemoji の前後関係が
変わると、それ以降の `index` がずれて見た目が変わる（編集による変化なので想定内）。

## 6. 値プール・装飾ルール（`mojiemoji-github` に完全一致）

ユーザー決定（2026-05-25）により、装飾方針は **`mojiemoji-github` スキルに完全一致**させる
（白背景向けの独自調整はしない。`mojiemoji-github` は GitHub のダーク背景前提のため白背景では
薄く見えうるが、triadic outline の縁取りで補う方針も含めて踏襲）。出典は `mojiemoji-github` の
`scripts/lib/constants.py` と `scripts/mojiemoji_markdown.py`。

- **font（正準 16 種）**: `akzk, chikara, dela, gothic, gothic-bold, hachimaru, kurobara, maru, maru-bold,
  mincho, noto, pixel, rampart, tamanegi, toge, zero`。
- **animation（正準 34 − INLINE_PROBLEMATIC = 32）**: 除外は `bakusan`, `chuuou_zoom` の **2 つだけ**
  （`INLINE_PROBLEMATIC_ANIMATIONS` に一致。mozaiku / kage_* は含める）。
- **color（明るめパレット・6 桁 hex）**: `mojiemoji-github` の推奨（Tailwind 300–500）から採り、
  **`FORBIDDEN_COLORS`（600+：`dc2626` / `16a34a` / `2563eb` / `ca8a04` 等）は使わない**。名前色も不可。
- **outline = triadic**: fill 色の **色相 +120°**（HSL 変換は `mojiemoji_markdown.py` を移植）を `outline`、
  `outline_width=2` を付与。
- **color-shifting `{kira, disco, psycho}`**: 色が循環するので outline を**落とす**。
- **rotational `{kaiten, kage_kaiten}`**: グリフ回転で読めなくなるため `speed=slow` を注入。
- **inline 既定 height = 20**（`mojiemoji-github` の観測上の既定）＋ `align=absmiddle`。

正準リストはサービス側で予告なく変わりうる。値が効かなくなったら `mojiemoji.jozo.beer` /
`mojiemoji-github` skill を確認し、`src/lib/mojiemoji.ts` のプール・ルールを更新する。

## 7. 出力 HTML

```html
<img src="https://mojiemoji.jozo.beer/emoji/%E3%82%84%E3%81%A3%E3%81%9F%E3%83%BC?font=maru-bold&color=3b82f6&animation=bane&background=transparent&outline=f63b82&outline_width=2"
     alt="やったー" width="20" height="20" align="absmiddle"
     loading="lazy" decoding="async">
```

- URL: `https://mojiemoji.jozo.beer/emoji/{encodeURIComponent(text)}` ＋ クエリ（`font` `color` `animation` `background=transparent`、§6 のルールに応じて `speed` / `outline` / `outline_width`）。
- `alt = text`（読み上げ・コピー・画像不可時に意味が残る）。
- `width`/`height` = `size`（既定 20）。正方キャンバスなので等値。レイアウトシフト防止。
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
- `resolveParams`: 明示 prop が導出値を上書きすること、undefined は無視、kaiten override で `speed=slow`。
- `buildMojiemojiUrl`: 日本語の URL エンコード、クエリ組み立て、`background=transparent` 付与、`speed` の有無。

注: vitest 追加で `package.json` / lockfile が変わる（実装フェーズのレビュー観点）。

## 10. スコープ / 非対象（YAGNI）

対象:
- `src/lib/mojiemoji.ts`（純粋ロジック＋プール）
- `src/components/Moji.astro`（薄いラッパ）
- `src/pages/blog/[...slug].astro`（`<Content components={{ Moji }} />` で Moji を全 `.mdx` に注入。検証で不可なら fallback）
- 単体テスト（vitest）
- デモ用サンプル記事 1 本（mojiemoji を実際に使う `.mdx`）
- `docs/writing-guide.md` に使い方を追記、`CLAUDE.md` の mojiemoji 項を「実装済み」に更新

非対象（v1 ではやらない）:
- ビルド時取得 → 静的アセット化（§8 の移行余地として設計のみ残す）
- 文字数オーバーの自動分割（漢字 ≤2 等の自動チャンク化）。ガイドで「短く」案内するのみ。
- block 装飾（独立行の大きなスタンプ）。inline のみ。
- outline / gradient 等の追加装飾。

## 11. 変更ファイル一覧（想定）

- 追加: `src/lib/mojiemoji.ts`、`src/components/Moji.astro`、`src/lib/mojiemoji.test.ts`、サンプル `.mdx`
- 変更: `package.json`（vitest）、`src/pages/blog/[...slug].astro`（Moji 注入。fallback 時は不要）、`docs/writing-guide.md`、`CLAUDE.md`
- 生成: lockfile

## 12. リスク・既知の落とし穴

- ランタイム外部依存（§8）: mojiemoji ダウン時に画像欠損。受容済み・将来ビルド時化で解消可能。
- ビルド順依存カウンタ（§5）: 冪等は保たれるが dev とビルドで見え方が一部ずれうる。
- mojiemoji 仕様ドリフト（§6）: 値が無効化されたら静止画に無音フォールバック。プール更新で対応。
- 色の可読性: 白背景前提。将来ダークテーマ対応するなら color プール/outline を再検討。
