export type ReadingMode = 'plain' | 'emoji';

/** frontmatter で指定が無い記事の既定モード。 */
export const DEFAULT_READING_MODE: ReadingMode = 'plain';

/**
 * レイアウトへ渡す表示モードの文脈。BlogPost は /about でも使われるため、
 * この 4 つは「全部そろうか、まったく無いか」のどちらかにする。
 */
export interface ReadingContext {
  slug: string;
  /** いま表示しているモード */
  mode: ReadingMode;
  /** この記事の既定モード */
  defaultMode: ReadingMode;
  /** もう片方のページが存在するか */
  hasAlternate: boolean;
}

/** もう一方のモード。 */
export function alternateMode(mode: ReadingMode): ReadingMode {
  return mode === 'plain' ? 'emoji' : 'plain';
}

/** 本文に `<Moji>` が現れるか。コードスパン内のリテラルも true になるが、副ページ生成の判定には十分。 */
export function hasMoji(body: string | undefined): boolean {
  return (body ?? '').includes('<Moji');
}

export interface ModeRoute {
  /** `[...slug]` に渡す params.slug。デフォルト側は記事 id そのもの。 */
  slug: string;
  mode: ReadingMode;
  isDefault: boolean;
}

/** 副ページに使うパスセグメント。記事 id の末尾がこれと衝突すると URL が曖昧になる。 */
const MODE_SEGMENTS: readonly string[] = ['plain', 'emoji'];

/**
 * 記事 id が副ページ URL と衝突しないことを確かめる。
 * `edge/emoji` のような多セグメント id は主 URL が `/blog/edge/emoji/` となり、
 * 別記事 `edge` の副ページと見分けが付かなくなる。
 */
export function assertRoutableSlug(slug: string): void {
  const segments = slug.split('/');
  const last = segments[segments.length - 1];
  if (segments.length > 1 && MODE_SEGMENTS.includes(last)) {
    throw new Error(
      `記事 id "${slug}" は表示モードの副ページ URL と衝突します。` +
        `末尾のディレクトリ名を "${last}" 以外に変えてください。`,
    );
  }
}

/**
 * 記事 1 本が生成すべきページ。デフォルトモードは既存 URL `/blog/<slug>/` を保ち、
 * もう片方を `/blog/<slug>/<mode>/` に置く。
 * `<Moji>` が無い記事は 2 枚目が 1 枚目と同一内容になるので生成しない。
 */
export function modeRoutes(
  slug: string,
  defaultMode: ReadingMode,
  hasMojiInBody: boolean,
): ModeRoute[] {
  assertRoutableSlug(slug);
  const routes: ModeRoute[] = [{ slug, mode: defaultMode, isDefault: true }];
  if (hasMojiInBody) {
    const alt = alternateMode(defaultMode);
    routes.push({ slug: `${slug}/${alt}`, mode: alt, isDefault: false });
  }
  return routes;
}

/** 指定モードで記事を読むための絶対パス。 */
export function modeHref(
  slug: string,
  mode: ReadingMode,
  defaultMode: ReadingMode,
): string {
  return mode === defaultMode ? `/blog/${slug}/` : `/blog/${slug}/${mode}/`;
}
