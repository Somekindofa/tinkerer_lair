import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// GitHub Pages project-site defaults. If you rename the repo or attach a
// custom domain, update `site`/`base` accordingly (base becomes '/' for a
// custom domain or a username.github.io root repo).
export default defineConfig({
  site: 'https://somekindofa.github.io',
  base: '/tinkerer_lair/',
  output: 'static',
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});
