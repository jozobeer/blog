# Writing guide — Markdown / MDX（Astro）

このファイルはサイトには公開しないリポジトリ内メモです。`src/content/blog/` の記事および MDX で使える基本的な構文をまとめています。

## 記事フロントマター（このブログ向け）

`src/content/blog/` に置く Markdown / MDX では Astro のコレクションスキーマに合わせ、少なくとも次を書きます。

- `title`（必須）— 記事タイトル
- `description`（必須）— 短い概要
- `pubDate`（必須）— 公開日（日付として解釈できる文字列で可）
- `author`（必須）— 著者識別子（ユーザー名などの任意の文字列）
- `updatedDate`（任意）— 更新日
- `heroImage`（任意）— `src/` 側の画像を参照するときに使用

ヒーロー画像がない場合は `heroImage` 行ごと省略して構いません。

## Headings

The following HTML `<h1>`—`<h6>` elements represent six levels of section headings.

# H1

## H2

### H3

#### H4

##### H5

###### H6

## Paragraph

通常の段落は空行で区切ります。複数行に分けて書いても、レンダラーによってはひとつの段落にまとめられることがあります。

## Images

Markdown の画像構文です。保存場所が `src/assets/` の場合は、プロジェクト構成に合わせた相対パスで参照してください。

````markdown
```markdown
![代替テキスト](./full/or/relative/path/of/image)
```
````

## Blockquotes

### Blockquote without attribution

````markdown
```markdown
> 引用本文の一行目。続きの行。  
> 引用内にも **強調** や _斜体_ などの Markdown を書けます。
```
````

> 引用本文の一行目。続きの行。  
> 引用内にも **強調** や _斜体_ などの Markdown を書けます。

### Blockquote with attribution

````markdown
```markdown
> Don't communicate by sharing memory, share memory by communicating.<br>
> — <cite>Rob Pike[^1]</cite>
```
````

> Don't communicate by sharing memory, share memory by communicating.<br>
> — <cite>Rob Pike[^1]</cite>

[^1]: The above quote is excerpted from Rob Pike's [talk](https://www.youtube.com/watch?v=PAAkCSZUG1c) during Gopherfest, November 18, 2015.

## Tables

````markdown
```markdown
| Italics   | Bold     | Code   |
| --------- | -------- | ------ |
| _italics_ | **bold** | `code` |
```
````

| Italics   | Bold     | Code   |
| --------- | -------- | ------ |
| _italics_ | **bold** | `code` |

## Code blocks

3 つのバッククォートで囲み、開始行に言語名を付けるとシンタックスハイライトが付くことがあります。

````markdown
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Example HTML5 Document</title>
  </head>
  <body>
    <p>Test</p>
  </body>
</html>
```
````

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Example HTML5 Document</title>
  </head>
  <body>
    <p>Test</p>
  </body>
</html>
```

## List types

### Ordered list

````markdown
```markdown
1. First item
2. Second item
3. Third item
```
````

1. First item
2. Second item
3. Third item

### Unordered list

````markdown
```markdown
- List item
- Another item
- And another item
```
````

- List item
- Another item
- And another item

### Nested list

````markdown
```markdown
- Fruit
  - Apple
  - Orange
  - Banana
- Dairy
  - Milk
  - Cheese
```
````

- Fruit
  - Apple
  - Orange
  - Banana
- Dairy
  - Milk
  - Cheese

## Other HTML inline elements — abbr, sub, sup, kbd, mark

````markdown
```markdown
<abbr title="Graphics Interchange Format">GIF</abbr> is a bitmap image format.

H<sub>2</sub>O

X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

Press <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> to end the session.

Most <mark>salamanders</mark> are nocturnal, and hunt for insects, worms, and other small creatures.
```
````

<abbr title="Graphics Interchange Format">GIF</abbr> is a bitmap image format.

H<sub>2</sub>O

X<sup>n</sup> + Y<sup>n</sup> = Z<sup>n</sup>

Press <kbd>CTRL</kbd> + <kbd>ALT</kbd> + <kbd>Delete</kbd> to end the session.

Most <mark>salamanders</mark> are nocturnal, and hunt for insects, worms, and other small creatures.

## MDX について

MDX にすると JSX コンポーネントを本文に組み込めます。クライアント JS を増やしたくない方針の場合は、静的生成だけに留まるようコンポーネント選びや `client:*` ディレクティブには注意してください。詳しくは Astro の公式ドキュメントを参照してください。
