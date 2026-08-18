// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.jozo.beer',
	integrations: [
		mdx(),
		sitemap({
			// プレーン／mojiemoji の副ページは同一記事の別表現なので、
			// canonical 側（/blog/<slug>/）だけを sitemap に載せる。
			// 記事 id はネストしうる（glob が **/*.{md,mdx}）ので、`/blog/` と
			// モード名の間は 1 セグメントとは限らない。`.+` で受ける。
			// 「多セグメントで末尾がモード名」の主ページは assertRoutableSlug が
			// ビルド時に落とすため、この形にマッチするのは副ページだけになる。
			filter: (page) => !/\/blog\/.+\/(plain|emoji)\/$/.test(page),
		}),
	],
	build: {
		// 全 CSS を <head> にインライン化し、外部 CSS リクエスト（レンダーブロック）を無くす。
		// 既定 'auto' は 4KB 未満のみインラインのため、pico を確実に inline するには 'always'。
		inlineStylesheets: 'always',
	},
});
