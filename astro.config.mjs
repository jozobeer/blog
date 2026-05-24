// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.jozo.beer',
	integrations: [mdx(), sitemap()],
	build: {
		// 全 CSS を <head> にインライン化し、外部 CSS リクエスト（レンダーブロック）を無くす。
		// 既定 'auto' は 4KB 未満のみインラインのため、pico を確実に inline するには 'always'。
		inlineStylesheets: 'always',
	},
});
