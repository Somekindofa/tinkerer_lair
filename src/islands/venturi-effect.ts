// Self-contained Canvas simulation. No framework, no external deps —
// mount() is called once by the host page with the elements it needs.
import { renderEquation as renderKatex } from '../lib/katex-render';

interface VenturiRefs {
  canvas: HTMLCanvasElement;
  v1Slider: HTMLInputElement;
  a1Slider: HTMLInputElement;
  a2Slider: HTMLInputElement;
  v1ValueOut: HTMLElement;
  a1ValueOut: HTMLElement;
  a2ValueOut: HTMLElement;
  continuityOut: HTMLElement;
  bernoulliOut: HTMLElement;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 320;
const CENTER_Y = 170;
const PARTICLE_COUNT = 90;
const FLUID_DENSITY = 1; // arbitrary units, for a relative pressure readout
const BASELINE_PRESSURE_KPA = 101.3;
const THROAT_SPAN = 220; // how wide the narrowing region is
const AREA_TO_PX = 10; // r_px = AREA_TO_PX * sqrt(area) -- keeps r_px^2 proportional to area

function radiusPx(area: number): number {
  return AREA_TO_PX * Math.sqrt(Math.max(area, 1));
}

// Pipe half-width at a given x, interpolating r1px -> r2px -> r1px across
// the throat span via a smoothstep profile.
function halfWidthAt(x: number, r1px: number, r2px: number): number {
  const center = LOGICAL_WIDTH / 2;
  const t = Math.max(0, Math.min(1, 1 - Math.abs(x - center) / THROAT_SPAN));
  const smooth = t * t * (3 - 2 * t);
  return r1px - smooth * (r1px - r2px);
}

// Continuity for a circular pipe: velocity scales with the inverse square of
// the radius, since area = pi * r^2.
function velocityAt(x: number, r1px: number, r2px: number, v1: number): number {
  const rx = halfWidthAt(x, r1px, r2px);
  return (v1 * (r1px * r1px)) / (rx * rx);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

interface Particle {
  x: number;
  lane: number; // fraction of half-width, in [-0.85, 0.85]
}

function makeParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * LOGICAL_WIDTH,
      lane: (Math.random() * 2 - 1) * 0.85,
    });
  }
  return particles;
}

export function mount({
  canvas,
  v1Slider,
  a1Slider,
  a2Slider,
  v1ValueOut,
  a1ValueOut,
  a2ValueOut,
  continuityOut,
  bernoulliOut,
}: VenturiRefs): () => void {
  const ctx2dRaw = canvas.getContext('2d');
  if (!ctx2dRaw) return () => {};
  const ctx = ctx2dRaw;

  // Size the backing store to the canvas's *actual rendered* CSS size (not a
  // fixed guess), scaled by devicePixelRatio -- then map our fixed logical
  // 800x320 coordinate space onto that full native resolution. Using a
  // hardcoded backing-store width regardless of layout is what causes a
  // canvas to look upscaled/blurry whenever it renders wider than that
  // fixed size, which happens on any non-retina (1x) display since the
  // container can stretch past 800 CSS px.
  function fitCanvasToDisplay() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.round(rect.width * dpr));
    const displayHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    ctx.setTransform(displayWidth / LOGICAL_WIDTH, 0, 0, displayHeight / LOGICAL_HEIGHT, 0, 0);
  }

  canvas.style.width = '100%';
  canvas.style.aspectRatio = `${LOGICAL_WIDTH} / ${LOGICAL_HEIGHT}`;
  fitCanvasToDisplay();
  window.addEventListener('resize', fitCanvasToDisplay);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = makeParticles();
  let lastTime = performance.now();

  const styles = getComputedStyle(document.documentElement);
  const inkColor = styles.getPropertyValue('--ink').trim() || '#0b0b0b';
  const hairlineColor = styles.getPropertyValue('--hairline').trim() || '#e1e0d9';
  const accentRgb = hexToRgb(styles.getPropertyValue('--accent').trim() || '#2a78d6');
  const redRgb = hexToRgb(styles.getPropertyValue('--data-red').trim() || '#e34948');

  // Slow particles are accent blue, fast particles shift toward red.
  function speedColor(t: number): string {
    return lerpColor(accentRgb, redRgb, Math.max(0, Math.min(1, t)));
  }

  function readParams() {
    const v1 = parseFloat(v1Slider.value);
    const A1 = parseFloat(a1Slider.value);
    const A2 = parseFloat(a2Slider.value);
    return { v1, A1, A2, r1px: radiusPx(A1), r2px: radiusPx(A2) };
  }

  function renderEquation(target: HTMLElement, tex: string) {
    renderKatex(tex, target, { throwOnError: false, displayMode: true });
  }

  function updateReadout() {
    const { v1, r1px, r2px } = readParams();
    const throatX = LOGICAL_WIDTH / 2;
    const vThroat = velocityAt(throatX, r1px, r2px, v1);
    const ratio = vThroat / v1;
    const dPressure = 0.5 * FLUID_DENSITY * (v1 * v1 - vThroat * vThroat);
    const pThroat = BASELINE_PRESSURE_KPA + dPressure / 1000;

    renderEquation(
      continuityOut,
      String.raw`\dfrac{v_2}{v_1} = \dfrac{A_1}{A_2} = ${ratio.toFixed(2)}`
    );
    renderEquation(
      bernoulliOut,
      String.raw`P_2 = P_1 - \tfrac{1}{2}\rho\left(v_2^2 - v_1^2\right) = ${pThroat.toFixed(2)}\ \text{kPa}`
    );
  }

  function drawPipeOutline(r1px: number, r2px: number) {
    ctx.strokeStyle = hairlineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const y = CENTER_Y - halfWidthAt(x, r1px, r2px);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const y = CENTER_Y + halfWidthAt(x, r1px, r2px);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawDimensionLine(x: number, r: number) {
    ctx.strokeStyle = hairlineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, CENTER_Y - r);
    ctx.lineTo(x, CENTER_Y + r);
    ctx.moveTo(x - 5, CENTER_Y - r);
    ctx.lineTo(x + 5, CENTER_Y - r);
    ctx.moveTo(x - 5, CENTER_Y + r);
    ctx.lineTo(x + 5, CENTER_Y + r);
    ctx.stroke();
  }

  function drawLabelBlock(x: number, y: number, lines: string[], align: CanvasTextAlign) {
    ctx.fillStyle = inkColor;
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = align;
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * 13));
  }

  function drawStationLabels(params: ReturnType<typeof readParams>) {
    const { v1, A1, A2, r1px, r2px } = params;
    const throatX = LOGICAL_WIDTH / 2;
    const vThroat = velocityAt(throatX, r1px, r2px, v1);
    const dPressure = 0.5 * FLUID_DENSITY * (v1 * v1 - vThroat * vThroat);
    const pThroat = BASELINE_PRESSURE_KPA + dPressure / 1000;

    drawDimensionLine(60, r1px);
    drawLabelBlock(
      60,
      CENTER_Y - r1px - 42,
      [`A₁ = ${A1.toFixed(0)} cm²`, `v₁ = ${v1.toFixed(0)} m/s`, `P₁ = ${BASELINE_PRESSURE_KPA.toFixed(2)} kPa`],
      'center'
    );

    drawDimensionLine(throatX, r2px);
    drawLabelBlock(
      throatX,
      CENTER_Y - r2px - 42,
      [`A₂ = ${A2.toFixed(0)} cm²`, `v₂ = ${vThroat.toFixed(0)} m/s`, `P₂ = ${pThroat.toFixed(2)} kPa`],
      'center'
    );
  }

  function drawParticles(params: ReturnType<typeof readParams>) {
    const { v1, r1px, r2px } = params;
    for (const p of particles) {
      const hw = halfWidthAt(p.x, r1px, r2px);
      const y = CENTER_Y + p.lane * hw;
      const v = velocityAt(p.x, r1px, r2px, v1);
      const speedFrac = Math.min(1, v / (v1 * 3));
      ctx.fillStyle = speedColor(speedFrac);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(p.x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let stopped = false;
  let rafHandle = 0;

  function step(now: number) {
    if (stopped) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const params = readParams();

    if (!prefersReducedMotion) {
      for (const p of particles) {
        p.x += velocityAt(p.x, params.r1px, params.r2px, params.v1) * dt;
        if (p.x > LOGICAL_WIDTH) p.x = 0;
      }
    }

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawPipeOutline(params.r1px, params.r2px);
    drawParticles(params);
    drawStationLabels(params);

    rafHandle = requestAnimationFrame(step);
  }

  // Drives both the gradient-filled slider track (via a --fill custom
  // property the CSS reads) and the live number next to it -- so the
  // control itself shows what it's currently set to, not just the canvas.
  function updateSliderVisual(slider: HTMLInputElement, valueOut: HTMLElement, tintBySpeed: boolean) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--fill', `${pct}%`);

    const numEl = valueOut.querySelector('.num');
    if (numEl) numEl.textContent = val.toFixed(0);
    if (tintBySpeed) {
      (valueOut as HTMLElement).style.color = speedColor(pct / 100);
    }
  }

  function onParamsChange() {
    updateSliderVisual(v1Slider, v1ValueOut, true);
    updateSliderVisual(a1Slider, a1ValueOut, false);
    updateSliderVisual(a2Slider, a2ValueOut, false);
    updateReadout();
  }

  v1Slider.addEventListener('input', onParamsChange);
  a1Slider.addEventListener('input', onParamsChange);
  a2Slider.addEventListener('input', onParamsChange);

  onParamsChange();
  rafHandle = requestAnimationFrame(step);

  // With the ClientRouter, navigating away doesn't reload the page -- the
  // caller must stop this loop and the resize listener before mounting
  // again on return, or they'd stack up against a detached canvas forever.
  return function destroy() {
    stopped = true;
    cancelAnimationFrame(rafHandle);
    window.removeEventListener('resize', fitCanvasToDisplay);
  };
}
