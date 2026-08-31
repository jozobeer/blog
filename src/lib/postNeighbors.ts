/** 前後リンクに要る記事の最小情報。 */
export interface PostRef {
  id: string;
  title: string;
}

/** 並べ替えの材料。frontmatter だけで足り、本文は要らない。 */
export interface DatedPost extends PostRef {
  pubDate: Date;
}

export interface PostNeighbors {
  /** 1 つ古い記事 */
  older?: PostRef;
  /** 1 つ新しい記事 */
  newer?: PostRef;
}

const refOf = (post: DatedPost | undefined): PostRef | undefined =>
  post && { id: post.id, title: post.title };

/**
 * 記事 id から前後の記事を引ける表。
 *
 * 引数の配列は複製してから並べ替える。呼び出し側の `getStaticPaths()` は
 * 元の順序で `flatMap` するため、ここで破壊すると mojiemoji の採番がずれて
 * 公開済み全記事の見た目が変わる。
 */
export function neighborsById(posts: readonly DatedPost[]): Map<string, PostNeighbors> {
  // 同日の記事は id で決着させる。入力順に委ねると、ファイル名が変わっただけで前後が入れ替わる。
  const newestFirst = [...posts].sort(
    (a, b) => b.pubDate.valueOf() - a.pubDate.valueOf() || a.id.localeCompare(b.id),
  );
  return new Map(
    newestFirst.map((post, i) => [
      post.id,
      { older: refOf(newestFirst[i + 1]), newer: refOf(newestFirst[i - 1]) },
    ]),
  );
}
