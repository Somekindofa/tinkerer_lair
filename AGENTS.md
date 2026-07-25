# Maintaining Open Loop — instructions for LLM sessions

This file is protocol, taste, and hard-won lessons — the stuff a fresh
session needs so it doesn't repeat mistakes already paid for. For the
mechanical "how do I add a widget / deep-dive" walkthrough, see
[README.md](./README.md); this file assumes that one and doesn't duplicate
it.

## What this site is

Open Loop is a quick-glance gallery of small interactive science/engineering
widgets — **not a blog, not Medium-style long-form writing**. The tagline is
"a wandering mind, no feedback correction." If a change makes the site feel
more like an article platform (walls of prose, no interaction, generic blog
chrome), it's the wrong direction. The interactive component is the point;
prose exists to set it up and explain what it means.

## Where to look — reference implementations

Don't reinvent a pattern from the rules below; there's a working reference
for every piece of this site. Read the file, then follow its shape.

| Want to see... | Look at |
|---|---|
| A complete widget page (content + canvas + custom sliders + live equations + deep-dive tab) | `src/pages/widgets/venturi-effect.astro` |
| A widget's content markdown (intro → What's this for? → equations) | `src/content/widgets/venturi-effect.md` |
| A widget's interactive logic (mount/destroy, canvas sizing, on-canvas labels) | `src/islands/venturi-effect.ts` |
| **What a "go deeper" deep-dive page looks like**, structurally | `src/pages/widgets/venturi-effect/going-further.astro` |
| A deep-dive's content markdown | `src/content/deepDives/venturi-effect.md` |
| A deep-dive with its own bespoke interactive component (a real physics solver, not decoration) | `src/islands/choked-flow.ts` |
| **A deep-dive that's several declinations of one algorithm, presented as tabs** | `src/pages/widgets/kalman-filter/going-further.astro` (framing entry + EKF/UKF entries in separate `role="tabpanel"`s) |
| The reusable ARIA tabs controller (click + arrow-key, single `onActivate` callback) | `src/lib/tabs.ts` |
| A second widget/homepage-featured example (Q/R sliders, live gain equation) | `src/pages/widgets/kalman-filter.astro`, `src/islands/kalman-filter.ts` |
| A widget with 3 sliders driving a physical plant simulation, sub-stepped for numerical stability, with a naive-then-fixed instability worth knowing about (integral windup, derivative kick) | `src/islands/pid-controller.ts` |
| The Blueprint theme layout (vignette, drafting grid, fixed dark palette) | `src/layouts/DeepDiveLayout.astro` |
| The main site layout (theme toggle, ClientRouter, transition root) | `src/layouts/BaseLayout.astro` |
| The persistent "Go deeper" tab component | `src/components/DeepDiveTab.astro` |
| The slide+blur custom View Transition definition | `src/lib/transitions.ts` |
| Every theme's CSS custom properties (Paper & Ink light/dark + Blueprint) | top of `src/styles/global.css` |
| Shared control-card/slider/live-equation styling | `src/styles/global.css`, search `.control-card` |
| Content collection schemas (`widgets` + `deepDives`) | `src/content/config.ts` |
| The homepage gallery + tag filter | `src/pages/index.astro`, `src/components/TagFilter.astro` |
| The suggestion box + vote leaderboard | `src/pages/suggest.astro` |
| How suggestions get snapshotted from GitHub Issues | `.github/workflows/suggestions-snapshot.yml` |
| The GitHub Pages deploy workflow | `.github/workflows/deploy.yml` |

If you're about to build something that resembles one of these — another
widget, another deep-dive, another control — open the reference file
first. The rules below describe intent; the file shows the actual working
implementation, including details (exact CSS custom property names, exact
`mount()`/`destroy()` shape) that are easy to get subtly wrong from
description alone.

## Editorial rules

- **Widget content order is fixed**: intro paragraph (what the phenomenon
  is) → `## What's this for?` (one tight paragraph, 2-3 named real-world
  applications, not a lecture) → `## The equations` (KaTeX, with
  derivation) → the interactive demo. Equations before the demo, always.
- **A remarkable, textbook-standard phenomenon gets its own header +
  paragraph** in the main widget content (e.g. Cavitation on the Venturi
  page). The bar is "genuinely remarkable and typical for this topic," not
  "technically true and worth mentioning" — a real engineering caveat like
  discharge coefficients was explicitly considered and rejected for not
  clearing that bar. Don't clutter the page with everything that's
  technically relevant; only what makes the topic more interesting.
- **Deep-dives ("go deeper") are rare, not routine.** Reserve one for a
  tangent that's genuinely advanced and doesn't belong in the main
  explainer — most widgets will never have one. When a deep-dive's topic
  supports it, it can and should get its own bespoke interactive component,
  not just more prose (see `choked-flow.ts` — a real isentropic
  compressible-flow solver, not a hand-wave).
- **Physical/scientific accuracy is a real requirement, not a nice-to-have.**
  When a widget models a phenomenon, model it for real: the Venturi widget
  uses true continuity (area ∝ r²) and Bernoulli relations; the choked-flow
  nozzle solves the actual isentropic area-Mach relation via bisection
  rather than faking the subsonic/supersonic transition. If exact physics
  is genuinely impractical for a lightweight demo, that's a judgment call
  to make explicitly and explain in a comment — not a default to reach for.

## Visual system

- **Paper & Ink** is the base theme: warm paper light mode, near-black dark
  mode, defined as CSS custom properties in `global.css`. Both modes are
  validated for accessible contrast — don't hand-pick new colors without
  checking contrast against both surfaces.
- **Blueprint** (`[data-mode="pro"]`) is the fixed "you've gone deeper"
  register for deep-dive pages: navy/cyan palette, monospace type, a faint
  drafting grid, a radial vignette. It does **not** follow the light/dark
  toggle — it's deliberately one fixed look, independent of the visitor's
  preference, because that's what makes it read as a different register
  rather than just another theme variant.
- Controls (sliders) are never bare `<input type="range">`. Use the shared
  `.control-card` / `.control-slider` classes in `global.css`: gradient-fill
  track via a `--fill` custom property set on input, a big live-updating
  number in an `<output>` next to the label, card lift on hover/focus. This
  was a direct, explicit correction — the first version looked "coded in 15
  minutes" and that's the bar to stay above.
- Canvas labels (values, dimensions) belong **on the diagram**, at the
  station they describe, not in a separate text block below it. The
  equation readouts below the canvas are for the formula view; the canvas
  itself should be self-explanatory while dragging.
- Speed/state color gradients (e.g. particle color by velocity or Mach
  number) must be built from the theme's CSS custom properties
  (`--accent`, `--data-red`, etc.) fetched via `getComputedStyle`, never
  hardcoded hex — that's what makes them survive a theme change.

## Known bug classes — don't reintroduce these

These were each real, user-reported bugs. The fixes are in place; the
failure modes are documented here so a future change doesn't undo them.

1. **Canvas blur.** A `<canvas>`'s backing-store resolution must be set
   from its *actual rendered* `getBoundingClientRect()` size ×
   `devicePixelRatio`, with a `resize` listener keeping it current — never
   a hardcoded logical width. A fixed backing store stretched to fill a
   wider container is exactly what caused "320p video on a 4K monitor."
2. **ClientRouter script re-execution.** `<ClientRouter />` (Astro View
   Transitions) is enabled site-wide for the deep-dive slide+blur
   transition, which means internal navigation is SPA-style. Any
   `<script>` on a page or component **executes exactly once, ever** —
   never again on subsequent navigations, including back to a page you've
   already visited. Every script that touches the DOM must rebind on
   `astro:page-load` (which also fires on first load, so it's the only
   registration point needed):
   ```ts
   document.addEventListener('astro:page-load', () => {
     // re-query elements and (re)mount here, every time
   });
   ```
3. **Leaking rAF loops / listeners across navigation.** Any island that
   runs a `requestAnimationFrame` loop or adds a `window` listener must
   return a `destroy()` from `mount()`, and the page script must call the
   previous `destroy()` before mounting again. Skipping this doesn't
   error — it silently stacks duplicate loops and listeners against
   detached DOM every time a visitor navigates away and back.
4. **Theme resetting on navigation.** `data-theme` is a pure runtime
   attribute (set by JS, never part of the served HTML), so the fresh
   `<html>` the ClientRouter swaps in on every navigation doesn't have it —
   it silently fell back to `prefers-color-scheme`, undoing an explicit
   toggle. Looked like "dark mode turns on by itself" whenever the
   visitor's OS defaults to dark. Fixed by listening for
   `astro:before-swap` and reapplying the stored theme to
   `event.newDocument` before it becomes visible — registered on **every**
   layout (`BaseLayout` and `DeepDiveLayout`), since whichever page a
   visitor lands on first is the one that has to register it.
5. **KaTeX version drift.** `katex` is pinned to match the version
   `rehype-katex` bundles internally (currently `0.16.47`). A newer KaTeX
   (`0.18.x`) renamed a CSS class (`sizing` → `katex-sizing`), which
   silently broke subscript/superscript sizing in build-time-rendered
   equations while client-rendered ones looked fine — each was internally
   consistent with its own version, just mismatched with each other. Don't
   bump `katex` without also checking what `rehype-katex` actually bundles
   (`node_modules/rehype-katex/node_modules/katex/package.json`).
6. **Blueprint grid vs. text contrast.** The drafting-grid background uses
   its own `--grid-line` custom property, deliberately much fainter than
   `--hairline` (which is shared with real UI borders). Reusing `--hairline`
   for the grid made it compete with body text of a similar hue instead of
   receding as background texture.
7. **Comparing two independently-evolving processes to demonstrate a math
   property.** The EKF/UKF deep-dive (`kalman-ekf-ukf.ts`) needed to show
   that the UKF's predicted measurement is always ≥ the EKF's (Jensen's
   inequality on a convex `h`). The first two attempts — a time-averaged
   RMSE, then a time-averaged signed bias — both ran the two filters as
   fully independent recursions and compared *their own* evolving state.
   That's not a valid test of the inequality: independent recursions
   accumulate different gain histories and their means drift apart for
   reasons that have nothing to do with curvature, and in testing that
   drift was large enough to flip the sign on ~1/3 of samples, some by 10x
   the size of the real effect. Jensen's inequality is a statement about
   *one* distribution — to demonstrate it live, both sides (the linearized
   prediction and the sigma-point prediction) must be evaluated from the
   *same* shared belief (mean + variance) at each tick, not read off two
   separately-diverged trajectories. Once fixed this way, the gap is
   provably non-negative every tick with no accumulation window needed.
   The lesson generalizes: **when a live demo claims a mathematical
   guarantee ("always ≥ 0", "provably converges faster"), verify the
   guarantee actually holds for what's being computed — run it for a
   few hundred ticks and check, don't trust that the math "should" work
   out because each half looks correct in isolation.**
8. **Sliders feeding a live simulation must be stress-tested across their
   full range, not just the defaults, before shipping.** The PID widget's
   default gains track cleanly, but the *point* of exposing Kp/Ki/Kd
   sliders is to let a visitor find the bad corners (low Kp + high Ki
   winds up badly) — and a naive integrator there doesn't just overshoot
   once, it compounds worse on every setpoint cycle and drifts unboundedly
   over a long-enough visit. Before writing any canvas/drawing code, write
   a throwaway Node script (`pid_sim*.js` in scratch, not committed) that
   grid-searches the full slider range over several *simulated minutes*
   and checks the state stays bounded — this is exactly what caught both
   the EKF/UKF divergence above and the PID integral runaway, and it's
   far faster than discovering either by dragging sliders in a browser.
   Where the physics itself can legitimately run away for some slider
   combination, a bounded, mentioned-in-a-comment measure (the Kalman
   state clamp, the PID integral clamp) is a reasonable fix — don't
   silently narrow the slider range just to hide the behavior instead.
9. **`:hover` reveal states have no equivalent on touch.** `DeepDiveTab`
   sits at `right: 0` but rests translated `0.9rem` further off-screen,
   sliding fully into view on `:hover`/`:focus-visible` — deliberate on
   desktop (a "peek, then reveal" affordance), but touch devices have no
   hover, so the tab was permanently stuck ~22% off-screen there, reading
   as "doesn't show up" rather than "slightly cut off." Any component whose
   resting state relies on `:hover` to become fully usable needs its resting
   state gated behind `@media (hover: hover) and (pointer: fine)`, with a
   sane touch-friendly default outside it — verify with a real
   `hasTouch: true, isMobile: true` Playwright context, not just a narrow
   desktop viewport (desktop Chromium narrowed to phone width still has
   `:hover`, so it won't reproduce this class of bug).
10. **`katex.render()` on a live-updating equation destroys its own scroll
    state on every re-render.** Every widget's `.live-eq` box has
    `overflow-x: auto` for equations too wide on narrow screens, but
    `katex.render()` fully replaces the target element's content on every
    tick, and KaTeX's own CSS *also* puts `overflow-x: auto` on the inner
    `.katex-display` node it creates each time — a second, nested scroll
    container that gets destroyed and rebuilt from scratch every render,
    taking any scroll position with it. On a fast tick interval that makes
    genuine horizontal scrolling on mobile impossible: any progress
    scrolling right snaps back within one tick. Fixed two ways together:
    `src/lib/katex-render.ts`'s `renderEquation()` saves/restores
    `el.scrollLeft` around every `katex.render()` call (every island now
    calls this instead of `katex.render` directly), and
    `.live-eq .katex-display { overflow: visible }` in `global.css`
    neutralizes the inner nested scroll container so `.live-eq` — the
    stable node whose scroll position actually gets preserved — is the
    only element left doing the scrolling. Note both axes must be set:
    `overflow-x: visible` alone is silently computed back to `auto` by the
    UA whenever `overflow-y` isn't also `visible` (a real CSS Overflow
    spec rule, not a bug — cost real debugging time to track down).

## Git / deployment protocol

- **Default: merge directly onto `main`.** Do not open a PR unless the
  user explicitly asks for one they'll review themselves. This is an
  explicit standing instruction, not a per-task judgment call.
- **The user merges PRs themselves, often mid-session, without saying so.**
  `git fetch origin main` and compare against `HEAD` before every push —
  don't assume the local branch's idea of `origin/main` is current. This
  has happened repeatedly, including via the automated
  `suggestions-snapshot` bot commit.
- **Never keep stacking commits on a branch that already backs a merged
  PR.** If `origin/main` has moved past your branch's base, rebase (or
  reset a working branch) onto the current `origin/main` tip before
  pushing again — otherwise you risk an unrelated-histories mess that
  breaks GitHub's compare view.
- **Build clean before every push**: `rm -rf .astro && npm run build`
  (the cache occasionally reports a spurious "duplicate id" warning after
  a content-schema change; clearing `.astro` resolves it). `npm run build`
  runs `astro check` first, so type errors block it too.
- **Verify in an actual browser before calling something done.** This
  project has repeatedly had bugs that a clean build did not catch —
  canvas blur, the theme-reset bug, contrast issues — all only visible by
  actually loading pages and interacting with them. Use Playwright with the
  pre-installed Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
  `NODE_PATH="$(npm root -g)"` for the global `playwright` package) and
  check both light and dark `colorScheme`, and both the "first load" and
  "after navigating away and back" cases for anything touching the
  ClientRouter.

## Working style

- Prefer shared/reused CSS classes over duplicating styles per page —
  `global.css` carries the control-card/slider/canvas/live-equation chrome
  precisely so new pages don't reinvent it.
- When something looks or behaves wrong, find the actual root cause before
  proposing a fix — several bugs in this project's history looked like one
  thing (a slider bug, a random dark-mode toggle) and turned out to be
  something structurally different (a physics unit mismatch, a View
  Transitions lifecycle gap). Reproduce it, instrument it, confirm the
  mechanism, then fix that.
- Terse, direct feedback should be taken literally and acted on, not
  hedged around — if something is described as looking "coded in 15
  minutes," the fix is to make it not look that way, not to explain why it
  was reasonable.
