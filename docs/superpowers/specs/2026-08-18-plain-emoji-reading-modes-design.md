# プレーン／mojiemoji 表示モード 設計（spec）

- 日付: 2026-08-18
- 対象リポジトリ: JOZO's blog（Astro v6 SSG）
- ステータス: 設計合意済み（grilling による決定木確定）
- 実装計画: `docs/superpowers/plans/2026-08-18-plain-emoji-reading-modes.md`
- 前提 spec: `docs/superpowers/specs/2026-05-25-mojiemoji-mdx-component-design.md`

## 1. 目的・背景

記事を **プレーンテキスト**（`<Moji>` が素の文字列になる）と **mojiemoji**（現状の動く画像）の
2 通りで読めるようにする。デフォルトはプレーン。

### 実測（2026-08-18 ビルド時点）

| 記事 | mojiemoji 画像数 |
|---|---|
| `macos-app-debug-utm-vm` | 609 |
| `gh-img` | 551 |
| `cloudflare-skill-five-landmines` | 334 |
| `mojiemoji` | 160 |
| `hello` | 0 |

- 609 本は **URL が全て一意**（`deriveParams(text, index)` が出現位置ごとに別パラメータを吐くため）。
  ブラウザ・CDN いずれのキャッシュも効かない。
- HTML は gzip 後 35KB（`hello` は 11KB）。差 24KB。
- 全画像に `loading="lazy"` と `width`/`height` が付いており、**LCP と CLS は既に守られている**。
  したがって残る実コストは「読了までに積み上がる総リクエスト数」であり、これは
  閲覧速度と mojiemoji サーバ負荷の**両方が見ている同一の指標**。

### 目的の優先順位（ユーザー決定）

1. 表示速度
2. mojiemoji サーバ負荷
3. 読みにくさの緩和

## 2. コンセプト整合（`CLAUDE.md` 三本柱）

| 柱 | 本設計での扱い |
|---|---|
| 1. JS/CSS を排して SSG | 当初はクライアント JS ゼロ・カスタム CSS ゼロで実装した。公開後のユーザー判断で 2 点だけ足している（§12 参照）: 選択状態を見分けるための `global.css` 1 ルールと、モード往復を履歴に積まないための 391 バイトのインライン JS |
| 2. セマンティック HTML で表現 | 別表現へのリンクは `rel="alternate"`、切替 UI は `role="group"` + `role="button"` + `aria-current` |
| 3. mojiemoji で楽しい見た目 | デフォルトからは外れるが、記事冒頭の切替 UI で常に 1 クリック先に置く。`mojiemoji.mdx` のみ絵文字をデフォルトに固定 |

第 3 の柱がデフォルトで見えなくなるのは意図的なトレードオフ。優先順位 1・2 を満たす唯一の形として受容した。

## 3. ページ構成・URL 設計

**2 ページ構成。** 記事ごとにデフォルト側を `/blog/<slug>/` に、もう片方を副 URL に置く。

| 記事 | `/blog/<slug>/` | 副 URL |
|---|---|---|
| 通常記事 | プレーン | `/blog/<slug>/emoji/` |
| `mojiemoji.mdx` | mojiemoji | `/blog/<slug>/plain/` |
| `<Moji>` を含まない記事（`hello.md`） | プレーン | **生成しない** |

- 既存 URL `/blog/<slug>/` は公開済み・RSS 掲載済みのため動かさない。
- `<Moji>` を含まない記事に副 URL を作るとバイト単位で同一のページが増え、
  同じ表示への 2 択 UI が出るため、本文の `<Moji>` 有無で分岐して抑止する。
- 3 ページ構成（`/`＋`/plain/`＋`/emoji/`）は重複コンテンツを自ら作るため却下。

### メタ情報

- 副ページの `<link rel="canonical">` は `/blog/<slug>/` を指す
  （現 `BaseHead.astro` は `Astro.url.pathname` で自己参照 canonical を出すため、上書き用 prop の追加が要る）。
- 副ページは `@astrojs/sitemap` の `filter` で除外（`filter?(page: string): boolean` が v3.7.2 に存在）。
- `<head>` に `<link rel="alternate" type="text/html">` でもう片方を示す。
  `type` を付けるのは、既存の RSS リンクが同じ `rel="alternate"`（`type="application/rss+xml"`）を使っているため。
- RSS・OGP・記事一覧は**変更しない**。一覧のリンク先は `/blog/<slug>/` のみ。

## 4. コンポーネント構成

`src/pages/blog/[...slug].astro` の `<Content components={{ Moji }} />` による注入を利用し、
**同一の本文に別のコンポーネント実装を差し込む**。本文（`.mdx`）は 1 つのまま。

| モード | 注入 | 出力 |
|---|---|---|
| mojiemoji | `components={{ Moji }}` | 現状どおり `<img>` |
| プレーン | `components={{ Moji: MojiPlain }}` | **語の素テキストのみ**（ラッパー要素なし。§10） |

### `BlogPost.astro` は記事専用ではない

`src/pages/about.astro:2` が同じレイアウトを `title` / `description` / `pubDate` / `author` の
4 つだけで使っている。表示モードの情報を必須 prop にすると `/about/` が壊れる
（Astro は props を実行時に強制しないため**ビルドは成功したまま** canonical が `/blog/undefined/` になる）。

そのため表示モードの情報は `reading?: ReadingContext`（slug / mode / defaultMode / hasAlternate）という
**任意の 1 グループ**で渡す。「4 つ全部そろうか、まったく無いか」に限定し、中途半端な組み合わせを型で排除する。
`reading` が無ければ切替 UI も canonical 上書きも行わず、現状の挙動をそのまま保つ。

frontmatter の `defaultMode` は `.default('plain')` ではなく `.optional()` にする。
Zod の `.default()` は出力型を必須にするため、`CollectionEntry<'blog'>['data']` を
Props に使う `about.astro` が型不整合になる。

> **`MojiPlain` は `nextIndex()` を呼んではならない。**
> `src/lib/mojiemoji.ts:165` の `_occurrence` は**ビルド全体で共有されるモジュールグローバル**で、
> 呼び出し回数が変わると全記事の色・フォント・アニメが変化する。§7 の検証で担保する。

## 5. 表示モード切替 UI

記事冒頭（`<h1>` と `<hr />` の直後、本文の前）に置く。末尾では 609 個の画像を読み終えた後になり、
初見の読者が mojiemoji の存在を知らないまま読了してしまう。

```html
<nav aria-label="表示モード">
  <div role="group">
    <a href="/blog/<slug>/"      role="button" aria-current="page">プレーン</a>
    <a href="/blog/<slug>/emoji/" role="button" rel="alternate">mojiemoji</a>
  </div>
</nav>
```

- 並び順は**常に左＝プレーン／右＝mojiemoji**（記事のデフォルトが絵文字でも変えない）。
- 現在のモード側に `aria-current="page"` を付ける。
- 文言に「絵文字」を使わない。読者が Unicode の 😀 を想像し、実物（動く文字画像）と一致しないため。

### pico classless での描画（実測）

`@picocss/pico@2.1.1` の `pico.classless.css` は属性セレクタを `[role=group]`（引用符なし）で書いている。

| セレクタ | 効果 |
|---|---|
| `[role=group]` | `display:inline-flex` + 共有 `border-radius` + `box-shadow` = 連結バー |
| `[role=group] > *` | `flex:1 1 auto` = 等幅セグメント |
| `[role=button][aria-current]` | `--pico-background-color: primary-hover-background` + `color: primary-inverse` = 選択中セグメントが塗られる |

**カスタム CSS は不要。** `[role=group]` の `width:100%` により記事幅いっぱいのバーになるが、
まずこのまま採用する。実物を見て違和感があれば `src/styles/global.css` に幅指定 1 行を足す
（装飾目的のカスタム CSS 追加は初になるため、必要が確認できてから）。

`<div role="group">` は ARIA ロールという意味を持つため、`CLAUDE.md` が禁じる「見た目のための div」には当たらない。
外側の `<nav aria-label="表示モード">` は、`role="group"` が `<nav>` の暗黙ロールを上書きするのを避けるため。

## 6. frontmatter・空白処理

### スキーマ

`src/content.config.ts` に追加:

```ts
defaultMode: z.enum(['plain', 'emoji']).optional()
```

`mojiemoji.mdx` のみ `defaultMode: 'emoji'`。同記事は mojiemoji 本体のショーケースを兼ねており、
`mojiemoji.jozo.beer` からの導線が絵文字なしのページに着地するのは事故になるため。
（`rss.xml.js` の `...post.data` に混ざるが、`author` / `heroImage` と同様に無害。）

### `<Moji>` 前後の半角スペース

プレーン化すると `たとえば もじ や えもじ のように。` のように空きが残る。全 1655 個中の該当は 89 個で、内訳は 3 種類:

| 種別 | 件数 | 扱い |
|---|---|---|
| リストマーカー直後（`- <Moji>`） | 2 | **残す**（消すと Markdown のリスト構文が壊れる） |
| 和欧間スペース（`Claude Code <Moji>`） | 62 | **残す**（日本語組版の慣習。プレーン版でこそ可読性に効く） |
| 和文どうし | 25 | **削除**。ただし `<Moji /> → 「次へ」` `**太字** <Moji>` `: <Moji>` のように記号の片側だけを消して左右非対称になるものは残す |

実質の削除対象は 10 件前後。`docs/writing-guide.md` に
「`<Moji>` の前後が和文なら空白を入れない」を 1 行追記して今後に効かせる。

## 7. 検証・完了条件

生の HTML diff は使えない。絵文字版は `/blog/<slug>/` から `/blog/<slug>/emoji/` へ**パスが移動する**ため、
同一パスでの比較対象が存在しない。代わりに **mojiemoji URL の出現列**を比較する。
空白削除は `emoji` prop も出現順も変えないため、URL 列は不変であるべき。

```sh
# 着手前（tree が clean な状態で実行し、記事ごとに保存しておく）
npm run build
for d in dist/blog/*/; do
  grep -o 'mojiemoji.jozo.beer/emoji/[^"]*' "$d/index.html" > "<baseline>/$(basename $d).urls"
done
```

ベースラインはソース未変更なら何度でも取り直せる。実装着手が後日になる場合は、
**最初のソース編集の前に**上記を実行し直すこと。

1. `npm run build` が成功する
2. 各記事の**絵文字版レンダリング**の URL 列がベースライン（旧 `/blog/<slug>/`）と**完全一致** — `nextIndex()` 汚染の検知。
   照合先のパスは通常記事が `/blog/<slug>/emoji/`、`mojiemoji.mdx` は `/blog/mojiemoji/` のまま（絵文字がデフォルトのため `/emoji/` は存在しない）
3. プレーン版ページの mojiemoji URL が **0 本**。
   本数一致だけでは不十分（カウンタがずれても本数は 160 本のまま変わらない）なので、判定は必ず 2 の URL 列比較で行う
4. 2 回ビルドして URL 列が一致（順序決定性。着手前の同条件では一致を確認済み）
5. `dist/sitemap-0.xml` に副 URL が含まれない
6. 副ページの canonical が主ページを指す
7. `npm test`（vitest）が通る
8. `npm run dev` で切替 UI の実物を目視（見た目の最終判断は人間が行う）

## 8. スコープ / 非対象（YAGNI）

**やらない:**

- クライアント JS（モード記憶、回線判定、プレーン→絵文字の段階的置換）
- remark / rehype プラグインの追加
- 記事一覧・RSS・OGP の変更
- 3 ページ構成、query string によるモード指定

**モードは記憶されない。** JS なしで状態を保持する手段がない（SSG では Cookie も読めない）ため、
読者は記事ごとに切り替え直すことになる。受容済みの制約。

## 9. リスク・既知の落とし穴

| リスク | 対処 |
|---|---|
| `MojiPlain` が `nextIndex()` を呼び、全記事の見た目が変わる | §7-2 の URL 列比較で検知 |
| 空白の一律削除で Markdown のリスト構文が壊れる | §6 のとおり種別ごとに扱いを変える。git diff で全件目視 |
| `mojiemoji.mdx` のプレーン版は本文が破綻する（「さっきの自動と、この自動は別の見た目です」など画像前提の文が残る） | **放置**。同記事は絵文字がデフォルトで、プレーン版は保険的な存在 |

## 10. 却下した代替案

| 案 | 却下理由 |
|---|---|
| プレーン先出し → 読み込み後に絵文字へ置換 | CSS には画像の読み込み完了を判定するセレクタが無く、実現には JS が必須。かつ総リクエスト数（＝優先順位 1・2 の実体）は 1 本も減らず、削減は gzip 20KB のみ |
| 絵文字をデフォルトに据えたまま逃げ道を用意 | 読者はリンクを押す時点で全リクエストを払い終えており、優先順位 1・2 が達成されない |
| 回線速度（`navigator.connection`）で自動切替 | JS 必須 |
| プレーン版で `<strong>` 等の強調 | 元が装飾である以上「強い重要性」を当てるのは意味の詐称。かつ記事によっては地の文の 1/3 が太字になる |
| 空白除去を remark プラグインで自動化 | 対象が 10 件規模。記事数が増えて手作業が回らなくなった時点で移行する |
| モードをクエリパラメータ（`?mode=emoji`）で指定 | 静的配信はパスでファイルを解決するため、クエリを解釈する主体（JS か SSR）が要る。redirect で振り分けても飛び先にパスが必要になり、往復が 1 回増えるだけ。なお静的サイトの別表現をパスに置くのは AMP の `/amp/` 等と同じ慣例で、`rel="alternate"` + canonical がその規約 |

## 11. 付随作業

- `docs/writing-guide.md`: `<Moji>` 前後の空白ルールを 1 行追記
- `CLAUDE.md`: 「テストランナーは未導入」を是正（`vitest@^4.1.7` 導入済み、`npm test` = `vitest run`、
  `src/lib/mojiemoji.test.ts` が存在）。あわせて本設計の 2 ページ方式を設計思想に追記。**別コミットとする**

## 12. 公開後の追加（2026-08-19）

実物を見たユーザーからの指摘 2 件に対応し、当初の「JS ゼロ・カスタム CSS ゼロ」から 2 点だけ外れた。

**選択状態が見分けにくい。** pico は `[role=button][aria-current]` にホバー色を当てるが、
dark テーマではホバー色 `#02659a` が base `#0172ad` より**暗い**ため、選択中のほうが沈んで見えるうえ差も小さい。
`aria-invalid` や `disabled` を流用する案は、前者が支援技術への虚偽、後者が選択中を薄くする逆効果で採れない。
`global.css` に 1 ルール 1 宣言を足し、非選択の背景だけを透明にして「塗り vs 枠線」にした。
文字色は触らない — `--pico-primary` に変えると背景 `#13171f` に対して 3.43:1 となり WCAG AA を割る（白のままなら 17.95:1）。
`:not(:hover)` を挟むことで、ホバー時は自分のルールが外れて pico の既定に戻る。

**切替が履歴に積まれる。** `<a href>` は必ず履歴エントリを作り、`<form method=get>` でも同じ。
置き換えるには `location.replace()` が要るため、ここだけクライアント JS を許容した。
`is:inline` でバンドルさせず、切替 UI を持つ 8 ページにだけ 391 バイトが入る（外部リクエスト無し）。
修飾キー・中クリックは横取りせず、JS が動かない環境では普通のリンクとして今までどおり動く。
