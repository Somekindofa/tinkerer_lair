// Self-contained Canvas simulation. No framework, no external deps —
// mount() is called once by the host page with the elements it needs.
import katex from 'katex';

interface VenturiRefs {
  canvas: HTMLCanvasElement;
  canvas3d: HTMLCanvasElement;
  v1Slider: HTMLInputElement;
  a1Slider: HTMLInputElement;
  a2Slider: HTMLInputElement;
  continuityOut: HTMLElement;
  bernoulliOut: HTMLElement;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 320;
const LOGICAL_HEIGHT_3D = 220;
const CENTER_Y = 170;
const CENTER_Y_3D = LOGICAL_HEIGHT_3D / 2;
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

export function mount({ canvas, canvas3d, v1Slider, a1Slider, a2Slider, continuityOut, bernoulliOut }: VenturiRefs) {
  const ctx2dRaw = canvas.getContext('2d');
  const ctx3dRaw = canvas3d.getContext('2d');
  if (!ctx2dRaw || !ctx3dRaw) return;
  const ctx = ctx2dRaw;
  const ctx3d = ctx3dRaw;

  function setupCanvas(target: HTMLCanvasElement, context: CanvasRenderingContext2D, height: number) {
    const dpr = window.devicePixelRatio || 1;
    target.width = LOGICAL_WIDTH * dpr;
    target.height = height * dpr;
    target.style.width = '100%';
    target.style.aspectRatio = `${LOGICAL_WIDTH} / ${height}`;
    context.scale(dpr, dpr);
  }
  setupCanvas(canvas, ctx, LOGICAL_HEIGHT);
  setupCanvas(canvas3d, ctx3d, LOGICAL_HEIGHT_3D);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = makeParticles();
  let lastTime = performance.now();

  const styles = getComputedStyle(document.documentElement);
  const inkColor = styles.getPropertyValue('--ink').trim() || '#0b0b0b';
  const hairlineColor = styles.getPropertyValue('--hairline').trim() || '#e1e0d9';
  const surfaceColor = styles.getPropertyValue('--surface').trim() || '#fffdf8';
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
    katex.render(tex, target, { throwOnError: false, displayMode: true });
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

  function drawPipeOutline(context: CanvasRenderingContext2D, centerY: number, r1px: number, r2px: number, squash = 1) {
    context.strokeStyle = hairlineColor;
    context.lineWidth = 2;
    context.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const y = centerY - halfWidthAt(x, r1px, r2px) * squash;
      x === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
    }
    context.stroke();
    context.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const y = centerY + halfWidthAt(x, r1px, r2px) * squash;
      x === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
    }
    context.stroke();
  }

  function drawDimensionLine(context: CanvasRenderingContext2D, x: number, centerY: number, r: number) {
    context.strokeStyle = hairlineColor;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, centerY - r);
    context.lineTo(x, centerY + r);
    context.moveTo(x - 5, centerY - r);
    context.lineTo(x + 5, centerY - r);
    context.moveTo(x - 5, centerY + r);
    context.lineTo(x + 5, centerY + r);
    context.stroke();
  }

  function drawLabelBlock(context: CanvasRenderingContext2D, x: number, y: number, lines: string[], align: CanvasTextAlign) {
    context.fillStyle = inkColor;
    context.font = '11px system-ui, -apple-system, sans-serif';
    context.textAlign = align;
    lines.forEach((line, i) => context.fillText(line, x, y + i * 13));
  }

  function drawStationLabels(context: CanvasRenderingContext2D, centerY: number, params: ReturnType<typeof readParams>) {
    const { v1, A1, A2, r1px, r2px } = params;
    const throatX = LOGICAL_WIDTH / 2;
    const vThroat = velocityAt(throatX, r1px, r2px, v1);
    const dPressure = 0.5 * FLUID_DENSITY * (v1 * v1 - vThroat * vThroat);
    const pThroat = BASELINE_PRESSURE_KPA + dPressure / 1000;

    drawDimensionLine(context, 60, centerY, r1px);
    drawLabelBlock(
      context,
      60,
      centerY - r1px - 42,
      [`A₁ = ${A1.toFixed(0)} cm²`, `v₁ = ${v1.toFixed(0)} m/s`, `P₁ = ${BASELINE_PRESSURE_KPA.toFixed(2)} kPa`],
      'center'
    );

    drawDimensionLine(context, throatX, centerY, r2px);
    drawLabelBlock(
      context,
      throatX,
      centerY - r2px - 42,
      [`A₂ = ${A2.toFixed(0)} cm²`, `v₂ = ${vThroat.toFixed(0)} m/s`, `P₂ = ${pThroat.toFixed(2)} kPa`],
      'center'
    );
  }

  function drawParticles(context: CanvasRenderingContext2D, centerY: number, params: ReturnType<typeof readParams>) {
    const { v1, r1px, r2px } = params;
    for (const p of particles) {
      const hw = halfWidthAt(p.x, r1px, r2px);
      const y = centerY + p.lane * hw;
      const v = velocityAt(p.x, r1px, r2px, v1);
      const speedFrac = Math.min(1, v / (v1 * 3));
      context.fillStyle = speedColor(speedFrac);
      context.globalAlpha = 0.85;
      context.beginPath();
      context.arc(p.x, y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function step(now: number) {
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
    drawPipeOutline(ctx, CENTER_Y, params.r1px, params.r2px);
    drawParticles(ctx, CENTER_Y, params);
    drawStationLabels(ctx, CENTER_Y, params);

    requestAnimationFrame(step);
  }

  // Static, angled companion view -- redrawn only when parameters change,
  // not animated (an "immutable" fixed-camera illustration of the tube).
  function draw3D() {
    const params = readParams();
    const { v1, A1, A2, r1px, r2px } = params;
    const squash = 0.4; // vertical squash to suggest a viewing angle
    const ringRx = 15; // horizontal radius of the end rings (opening depth)

    ctx3d.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT_3D);

    // Tube body silhouette.
    ctx3d.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const y = CENTER_Y_3D - halfWidthAt(x, r1px, r2px) * squash;
      x === 0 ? ctx3d.moveTo(x, y) : ctx3d.lineTo(x, y);
    }
    for (let x = LOGICAL_WIDTH; x >= 0; x -= 4) {
      const y = CENTER_Y_3D + halfWidthAt(x, r1px, r2px) * squash;
      ctx3d.lineTo(x, y);
    }
    ctx3d.closePath();
    ctx3d.fillStyle = surfaceColor;
    ctx3d.fill();
    ctx3d.strokeStyle = hairlineColor;
    ctx3d.lineWidth = 1.5;
    ctx3d.stroke();

    // End/throat rings, giving the tube a sense of depth.
    const ringXs = [18, LOGICAL_WIDTH / 2, LOGICAL_WIDTH - 18];
    for (const rx of ringXs) {
      const hw = halfWidthAt(rx, r1px, r2px) * squash;
      ctx3d.beginPath();
      ctx3d.ellipse(rx, CENTER_Y_3D, ringRx, hw, 0, 0, Math.PI * 2);
      ctx3d.fillStyle = surfaceColor;
      ctx3d.fill();
      ctx3d.strokeStyle = hairlineColor;
      ctx3d.stroke();
    }

    // A handful of static, speed-colored particles for visual continuity
    // with the animated view (fixed positions -- this view doesn't animate).
    for (let i = 0; i < 16; i++) {
      const x = ((i + 0.5) / 16) * LOGICAL_WIDTH;
      const hw = halfWidthAt(x, r1px, r2px) * squash;
      const lane = Math.sin(i * 12.9898) * 0.7;
      const y = CENTER_Y_3D + lane * hw;
      const v = velocityAt(x, r1px, r2px, v1);
      const speedFrac = Math.min(1, v / (v1 * 3));
      ctx3d.fillStyle = speedColor(speedFrac);
      ctx3d.beginPath();
      ctx3d.arc(x, y, 2, 0, Math.PI * 2);
      ctx3d.fill();
    }

    drawLabelBlock(ctx3d, 60, 16, [`A₁ = ${A1.toFixed(0)} cm²`], 'center');
    drawLabelBlock(ctx3d, LOGICAL_WIDTH / 2, 16, [`A₂ = ${A2.toFixed(0)} cm²`], 'center');
  }

  function onParamsChange() {
    updateReadout();
    draw3D();
  }

  v1Slider.addEventListener('input', onParamsChange);
  a1Slider.addEventListener('input', onParamsChange);
  a2Slider.addEventListener('input', onParamsChange);

  onParamsChange();
  requestAnimationFrame(step);
}
