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
			// 副ページは同一記事の別表現なので canonical 側だけを載せる。
			// 記事 id はネストしうる（glob が **/*.{md,mdx}）ため `/blog/` とモード名の
			// 間は 1 セグメントとは限らない。`.+` で受けても、末尾がモード名の主ページは
			// assertRoutableSlug がビルド時に落とすので、残るのは副ページだけ。
			filter: (page) => !/\/blog\/.+\/(plain|emoji)\/$/.test(page),
		}),
	],
	build: {
		// 全 CSS を <head> にインライン化し、外部 CSS リクエスト（レンダーブロック）を無くす。
		// 既定 'auto' は 4KB 未満のみインラインのため、pico を確実に inline するには 'always'。
		inlineStylesheets: 'always',
	},
});
