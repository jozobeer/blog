# mojiemoji 画像のリサイクル設計（spec）

- 日付: 2026-09-13
- 対象: emoji モードの記事ページ
- 前提 spec: `2026-08-18-plain-emoji-reading-modes-design.md`
- ステータス: 実装済み

## 何を解くか

iPhone の Safari で emoji モードの記事を続けて読むと、タブが固まる・リロードされる。
原因は画像の総量そのものではなく、タブに同時に保持される**デコード済みフレーム**の量。

### 実測（`dist/` をローカル配信し、Chromium を iPhone 相当（390×844）で操作）

| 記事 | GIF 枚数 |
|---|---|
| `macos-app-debug-utm-vm` | 609 |
| `gh-img` | 551 |
| `cloudflare-skill-five-landmines` | 334 |
| `cloudflare-injects-js` | 251 |
| `mojiemoji` | 163 |

- 1 枚は 64/96px・17〜24 フレーム（25 枚サンプルを ImageMagick で実測）。デコード後は
  32bit RGBA × フレーム数で 0.35〜0.9MB。
- 読了位置までスクロールすると 609 枚すべてが実体ロードされる。合計 300MB 超。
- WebKit は 100KB/フレーム未満のアニメ画像を「large for decoding」に含めず、フレームを
  破棄しない（WebKit PR #64109）。96px の 1 フレームは 37KB なので全フレームが残る。
- iOS Safari は要素の削除や `visibility` では画像メモリを解放しないが、`src` の差し替え
  では解放する。WebContent プロセスの上限に達するとページを再読み込みする。

## 決定

`MojiRecycler.astro` を emoji モードのページに 1 つだけ置く（933 バイトのインライン JS）。
`BlogPost.astro` が `reading.mode === 'emoji'` のときだけ描画する。

- 対象: `img[src*="mojiemoji.jozo.beer/emoji/"]`
- 初期化: `src` を `data-src` へ退避し、前後 1.5 画面の外にある画像だけを 1×1 透明 GIF に
  差し替える。画面近傍の画像は触らない（保留中のロードを中断させないため）。
- `IntersectionObserver`（rootMargin = 前後 1.5 画面）で、入ったら `data-src` に戻し、
  出たら透明に差し替える。戻すときだけ `loading="eager"` にして lazy の判定を挟ませない。
- 初期化で `loading="eager"` にしてはならない。lazy で保留中だった全画像が一斉にロードを
  始め、直後の差し替えで中断する（実測 528 件）。
- `IntersectionObserver` 非対応環境は現状の `loading="lazy"` のまま。JS 無効も同じ。

## 実測（対策後）

- 同時に実体を持つ画像: 148〜166 / 609（1 画面ぶんを 600ms で送る読み方）。
- 上下を往復したときの新規ネットワーク応答: 0。`Cache-Control: max-age=604800` の
  ブラウザキャッシュから復元する。中断・失敗 0。
- 素早くフリックすると、読み込み中の画像が範囲外に出て中断される。戻ればキャッシュから
  再取得する。読んでいる位置の画像は範囲内に十分留まるため、通常の閲覧では穴は開かない。

## 検証

- 画像 URL 列 1905 件が変更前と完全一致（`nextIndex()` を呼ばない。本数一致では不十分）。
- `astro check` / `vitest` / `astro build` が通る。
- リサイクル JS は emoji ページ 5 枚のみ。933 バイト（モード切替の 459 バイトとは別）。
- iPhone 実機での最終確認は未実施。

## 却下した代替案

| 案 | 却下理由 |
|---|---|
| CSS `content-visibility` | デコード済み画像を解放できない。Safari では再入時のレイアウトが重い既知バグもある |
| 全画像を静的 PNG にする | アニメーションが失われる（ユーザー判断で却下） |
| mojiemoji サーバ側でフレーム削減 | 別リポジトリの変更になり、動きの品質が下がる |
| 画像要素を DOM から外す | iOS Safari はメモリを解放しない |
