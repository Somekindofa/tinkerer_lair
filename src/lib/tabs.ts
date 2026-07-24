// Minimal accessible tabs controller (ARIA tabs pattern): wire up a
// tablist's buttons to show/hide their aria-controls panels, with
// Left/Right arrow key navigation. Reusable across any page that needs
// tabs -- not specific to any one deep-dive.
export function initTabs(container: HTMLElement, onActivate?: (index: number) => void) {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = buttons.map((btn) => {
    const id = btn.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
  });

  function activate(index: number, focus = true) {
    buttons.forEach((btn, i) => {
      const selected = i === index;
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;
      const panel = panels[i];
      if (panel) panel.hidden = !selected;
    });
    if (focus) buttons[index]?.focus();
    onActivate?.(index);
  }

  buttons.forEach((btn, i) => {
    btn.addEventListener('click', () => activate(i, false));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        activate((i + 1) % buttons.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activate((i - 1 + buttons.length) % buttons.length);
      }
    });
  });

  const initialIndex = buttons.findIndex((btn) => btn.getAttribute('aria-selected') === 'true');
  activate(initialIndex >= 0 ? initialIndex : 0, false);

  return { activate };
}
