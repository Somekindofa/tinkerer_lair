import katex from 'katex';

// katex.render() replaces its target element's entire content on every
// call. For a live-updating equation inside an overflow-x:auto box (every
// widget's .live-eq, refreshed on a TICK_MS interval), that resets or
// clamps the element's scrollLeft on every single tick -- on a narrow
// screen where the equation genuinely needs horizontal scrolling, this
// makes it impossible to hold a scrolled-into-view position long enough to
// read the truncated part; it snaps back before a visitor can. Saving and
// restoring scrollLeft around the render call fixes that without changing
// anything about how the equation itself renders.
export function renderEquation(tex: string, el: HTMLElement, options: Parameters<typeof katex.render>[2]): void {
  const { scrollLeft } = el;
  katex.render(tex, el, options);
  el.scrollLeft = scrollLeft;
}
