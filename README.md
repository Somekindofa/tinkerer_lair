# Open Loop

A wandering mind, no feedback correction. A quick-glance gallery of small,
interactive science and engineering widgets — not a blog.

Built with [Astro](https://astro.build), hosted on GitHub Pages.

## Structure

- `src/content/widgets/*.md` — one entry per widget: title, description, tags,
  date, and whether it's the homepage's "this week's pick." The prose body is
  the short explainer shown above the interactive demo.
- `src/islands/*.ts` — the interactive part of each widget, plain
  TypeScript + Canvas/SVG, no framework. Each exports a `mount()` function.
- `src/pages/widgets/*.astro` — one page per widget, wiring the content entry
  and its island together.
- `src/pages/index.astro` — the tag-filterable grid gallery + featured hero.
- `src/pages/suggest.astro` — the suggestion box and vote leaderboard.

## Adding a new widget

Every widget follows the same shape — equations before the demo, not just an
animation. Use `venturi-effect` as the reference implementation.

1. Add `src/content/widgets/<slug>.md` with frontmatter (`title`,
   `description`, `date`, `tags`, `featured`) and a body with, in order:
   - a short intro paragraph (what the phenomenon is),
   - a `## What's this for?` section — one tight paragraph, 2-3 named
     real-world applications, not a lecture,
   - a `## The equations` section with the governing formula(s) written as
     KaTeX (`$...$` inline, `$$...$$` display) and a line or two of
     derivation/interpretation.
2. Add `src/islands/<slug>.ts` with a `mount()` function for the interactive
   part (plain TS + Canvas/SVG, no framework). Where the widget has a
   headline equation, render it live with `katex.render(tex, el, {
   throwOnError: false, displayMode: true })`, substituting the current
   numbers into the LaTeX string on every interaction — the equation *is*
   the readout, not a separate stats line next to it. If the canvas has any
   labels/dimensions, draw them directly on the diagram (not as a separate
   text block below it) so values stay attached to the thing they describe
   as the user drags controls.
3. Add `src/pages/widgets/<slug>.astro` modeled on `venturi-effect.astro`:
   content renders first (intro → applications → equations), the
   interactive stage comes after, with containers for the live equations
   wired into `mount()`.

Math rendering (`remark-math` + `rehype-katex`) is already wired into
`astro.config.mjs` for the static equations in content bodies; `katex` is a
direct dependency for the live client-side re-renders.

### The ClientRouter tax

`<ClientRouter />` (Astro's View Transitions) is enabled site-wide, so
internal navigation is SPA-style, not a hard reload. That means any
`<script>` in a widget page or component only *executes once* — a fresh
`mount()` call is required on every navigation, including the very first
one. Every widget's script must follow this shape:

```ts
document.addEventListener('astro:page-load', () => {
  // re-query elements and re-mount here, every time
});
```

If the island runs a `requestAnimationFrame` loop or adds a `window`
listener (like `venturi-effect.ts`'s resize handler), `mount()` must return
a `destroy()` that cancels/removes them, and the page script must call the
previous `destroy()` before mounting again. Skipping this doesn't error —
it silently stacks duplicate loops/listeners against detached DOM on every
back-and-forth visit. `venturi-effect.ts` + `venturi-effect.astro` are the
reference for the correct pattern.

## Deep-dives ("go deeper")

Some widgets have a genuinely advanced tangent worth its own page rather
than cluttering the main explainer — Venturi's is choked flow. This is for
the rare, remarkable case, not routine detail: most widgets won't have one.

1. Add `src/content/deepDives/<slug>.md` (same slug as the parent widget)
   with `title` + `description` frontmatter and the deep-dive prose (KaTeX
   works the same as in widget content).
2. In the widget's page, fetch it and conditionally render the tab:
   ```astro
   const deepDive = await getEntry('deepDives', '<slug>');
   ...
   {deepDive && <DeepDiveTab href={`${import.meta.env.BASE_URL}widgets/<slug>/going-further/`} />}
   ```
   No deep-dive file, no tab — nothing else to wire up.
3. That's it — `src/pages/widgets/[slug]/going-further.astro` is a single
   dynamic route that generates the page for every `deepDives` entry
   automatically, rendered through `DeepDiveLayout`.

The deep-dive page always uses the fixed "blueprint" palette
(`[data-mode="pro"]` in `global.css`) regardless of the site's light/dark
toggle, with a vignette and drafting-grid background — a deliberately
different register from the rest of the site, signaling "you've left the
quick-glance version." Navigating to and from it uses a custom slide+blur
View Transition (`src/lib/transitions.ts`).

## Suggestions & voting

No database — suggestions live as GitHub Issues labeled `suggestion`, and
votes are 👍 reactions on those issues. A scheduled workflow
(`.github/workflows/suggestions-snapshot.yml`, every 6 hours) snapshots open
suggestions sorted by vote count into `public/suggestions.json`, which the
`/suggest/` page reads client-side. No runtime GitHub API calls, no rate
limits, no auth to build.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every
push to `main`. In the repo's Settings → Pages, set the source to "GitHub
Actions."

`astro.config.mjs` assumes the project stays at
`github.com/Somekindofa/tinkerer_lair` (site `https://somekindofa.github.io`,
base `/tinkerer_lair`). If you rename the repo, move it under a
`username.github.io` root, or attach a custom domain, update `site`/`base`
there accordingly.

## Local development

```sh
npm install
npm run dev
```
