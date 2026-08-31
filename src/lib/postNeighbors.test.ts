import { describe, it, expect } from 'vitest';
import * as postNeighbors from './postNeighbors';
import { neighborsById } from './postNeighbors';
import type { DatedPost, PostNeighbors, PostRef } from './postNeighbors';

const post = (id: string, date: string): DatedPost => ({
  id,
  title: `title of ${id}`,
  pubDate: new Date(date),
});

describe('module contract', () => {
  it('exports exactly the runtime API', () => {
    expect(Object.keys(postNeighbors).sort()).toEqual(['neighborsById']);
  });
});

describe('neighborsById', () => {
  it('links each post to the one published just before and just after it', () => {
    const posts = [
      post('old', '2026-05-24'),
      post('mid', '2026-06-04'),
      post('new', '2026-08-21'),
    ];

    const table = neighborsById(posts);

    expect(table.get('mid')).toEqual({
      older: { id: 'old', title: 'title of old' },
      newer: { id: 'new', title: 'title of new' },
    });
  });

  it('leaves the newest post without a newer neighbour', () => {
    const table = neighborsById([post('old', '2026-05-24'), post('new', '2026-08-21')]);

    expect(table.get('new')).toEqual({
      older: { id: 'old', title: 'title of old' },
      newer: undefined,
    });
  });

  it('leaves the oldest post without an older neighbour', () => {
    const table = neighborsById([post('old', '2026-05-24'), post('new', '2026-08-21')]);

    expect(table.get('old')).toEqual({
      older: undefined,
      newer: { id: 'new', title: 'title of new' },
    });
  });

  it('gives a lone post no neighbours at all', () => {
    const table = neighborsById([post('only', '2026-05-24')]);

    expect(table.get('only')).toEqual({ older: undefined, newer: undefined });
  });

  it('has an entry for every post and nothing else', () => {
    const posts = [post('a', '2026-05-24'), post('b', '2026-06-04')];

    const table = neighborsById(posts);

    expect([...table.keys()].sort()).toEqual(['a', 'b']);
  });

  it('orders by date, not by the order the posts were given', () => {
    const posts = [
      post('mid', '2026-06-04'),
      post('new', '2026-08-21'),
      post('old', '2026-05-24'),
    ];

    const table = neighborsById(posts);

    expect(table.get('mid')?.older?.id).toBe('old');
    expect(table.get('mid')?.newer?.id).toBe('new');
  });

  // getStaticPaths() の反復順が変わると mojiemoji の採番がずれ、
  // 公開済み全記事の色・フォント・アニメが変わる。件数は一致するので気付けない。
  it('does not reorder the array it was given', () => {
    const posts = [
      post('mid', '2026-06-04'),
      post('new', '2026-08-21'),
      post('old', '2026-05-24'),
    ];

    neighborsById(posts);

    expect(posts.map((p) => p.id)).toEqual(['mid', 'new', 'old']);
  });

  it('breaks a same-date tie by id so the order never drifts between builds', () => {
    const forwards = neighborsById([post('b', '2026-06-04'), post('a', '2026-06-04')]);
    const backwards = neighborsById([post('a', '2026-06-04'), post('b', '2026-06-04')]);

    expect(forwards.get('a')).toEqual(backwards.get('a'));
    expect(forwards.get('a')?.older?.id).toBe('b');
  });

  it('carries only the id and title of a neighbour', () => {
    const table = neighborsById([post('old', '2026-05-24'), post('new', '2026-08-21')]);

    expect(Object.keys(table.get('new')?.older as PostRef).sort()).toEqual(['id', 'title']);
  });

  it('returns an empty table for no posts', () => {
    const table: Map<string, PostNeighbors> = neighborsById([]);

    expect(table.size).toBe(0);
  });
});
