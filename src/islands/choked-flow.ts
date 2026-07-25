// Self-contained Canvas simulation of a converging-diverging (de Laval)
// nozzle. Real isentropic compressible-flow relations, not a hand-wave --
// solved numerically where there's no closed form. No framework, no deps.
import { renderEquation as renderKatex } from '../lib/katex-render';

interface ChokedFlowRefs {
  canvas: HTMLCanvasElement;
  ratioSlider: HTMLInputElement;
  ratioValueOut: HTMLElement;
  regimeOut: HTMLElement;
  equationOut: HTMLElement;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 300;
const CENTER_Y = 150;
const PARTICLE_COUNT = 90;
const GAMMA = 1.4; // air

// Fixed nozzle geometry (radius in px): converges from the inlet to the
// throat, then diverges out to a wider exit. Only the back-pressure ratio
// is adjustable here -- the geometry itself isn't the point of this demo.
const R_INLET = 65;
const R_THROAT = 26;
const R_EXIT = 90;
const THROAT_X = LOGICAL_WIDTH / 2;

const R_CRIT = Math.pow(2 / (GAMMA + 1), GAMMA / (GAMMA - 1)); // ~0.5283

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function radiusAt(x: number): number {
  if (x <= THROAT_X) {
    return R_INLET - smoothstep(x / THROAT_X) * (R_INLET - R_THROAT);
  }
  return R_THROAT + smoothstep((x - THROAT_X) / (LOGICAL_WIDTH - THROAT_X)) * (R_EXIT - R_THROAT);
}

// Isentropic area-Mach relation: A/A* as a function of Mach number.
function areaRatioFromMach(M: number): number {
  const term = (2 / (GAMMA + 1)) * (1 + ((GAMMA - 1) / 2) * M * M);
  return (1 / M) * Math.pow(term, (GAMMA + 1) / (2 * (GAMMA - 1)));
}

// Exact inversion of the isentropic P/P0(M) relation -- the Mach number
// whose static-to-stagnation pressure ratio equals the given value.
function machFromPressureRatio(pRatio: number): number {
  const x = Math.pow(Math.max(pRatio, 1e-6), -(GAMMA - 1) / GAMMA) - 1;
  return Math.sqrt(Math.max(0, (2 / (GAMMA - 1)) * x));
}

// Invert the area-Mach relation via bisection (it has no closed form). Each
// area ratio has two roots -- pick the subsonic (0<M<1) or supersonic (M>1)
// branch explicitly, since which one applies depends on flow regime, not
// on the math alone.
function solveMachFromAreaRatio(epsilon: number, branch: 'sub' | 'super'): number {
  const target = Math.max(1, epsilon);
  let lo = branch === 'sub' ? 1e-3 : 1 + 1e-6;
  let hi = branch === 'sub' ? 1 - 1e-6 : 8;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const ar = areaRatioFromMach(mid);
    if (branch === 'sub') {
      if (ar > target) lo = mid;
      else hi = mid;
    } else {
      if (ar < target) lo = mid;
      else hi = mid;
    }
  }
  return (lo + hi) / 2;
}

interface FlowState {
  choked: boolean;
  machThroat: number;
  machExit: number;
  effectiveThroatRadius: number; // the virtual A* for unchoked flow
}

function computeFlow(backPressureRatio: number): FlowState {
  const choked = backPressureRatio <= R_CRIT;
  const machThroat = choked ? 1 : Math.max(1e-3, machFromPressureRatio(backPressureRatio));
  // The "effective" throat radius that this Mach number's area ratio
  // implies -- equals the real throat exactly when choked (areaRatio(1)=1).
  const effectiveThroatRadius = R_THROAT / Math.sqrt(areaRatioFromMach(machThroat));
  const exitEpsilon = (R_EXIT * R_EXIT) / (R_THROAT * R_THROAT);
  const machExit = choked
    ? solveMachFromAreaRatio(exitEpsilon, 'super')
    : solveMachFromAreaRatio((R_EXIT * R_EXIT) / (effectiveThroatRadius * effectiveThroatRadius), 'sub');
  return { choked, machThroat, machExit, effectiveThroatRadius };
}

function machAt(x: number, flow: FlowState): number {
  const r = radiusAt(x);
  if (x <= THROAT_X) {
    const epsilon = (r * r) / (flow.effectiveThroatRadius * flow.effectiveThroatRadius);
    return solveMachFromAreaRatio(epsilon, 'sub');
  }
  if (flow.choked) {
    const epsilon = (r * r) / (R_THROAT * R_THROAT);
    return solveMachFromAreaRatio(epsilon, 'super');
  }
  const epsilon = (r * r) / (flow.effectiveThroatRadius * flow.effectiveThroatRadius);
  return solveMachFromAreaRatio(epsilon, 'sub');
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const c = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(lerp(c1[0], c2[0], c))}, ${Math.round(lerp(c1[1], c2[1], c))}, ${Math.round(lerp(c1[2], c2[2], c))})`;
}

interface Particle {
  x: number;
  lane: number;
}

function makeParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({ x: Math.random() * LOGICAL_WIDTH, lane: (Math.random() * 2 - 1) * 0.8 });
  }
  return particles;
}

export function mount({ canvas, ratioSlider, ratioValueOut, regimeOut, equationOut }: ChokedFlowRefs): () => void {
  const ctxRaw = canvas.getContext('2d');
  if (!ctxRaw) return () => {};
  const ctx = ctxRaw;

  function fitCanvasToDisplay() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(w / LOGICAL_WIDTH, 0, 0, h / LOGICAL_HEIGHT, 0, 0);
  }

  canvas.style.width = '100%';
  canvas.style.aspectRatio = `${LOGICAL_WIDTH} / ${LOGICAL_HEIGHT}`;
  fitCanvasToDisplay();
  window.addEventListener('resize', fitCanvasToDisplay);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = makeParticles();
  let lastTime = performance.now();

  const styles = getComputedStyle(document.documentElement);
  const inkColor = styles.getPropertyValue('--ink').trim() || '#eaf4ff';
  const hairlineColor = styles.getPropertyValue('--hairline').trim() || 'rgba(148,199,255,0.25)';
  const accentRgb = hexToRgb(styles.getPropertyValue('--accent').trim() || '#5ee6d0');
  const redRgb = hexToRgb(styles.getPropertyValue('--data-red').trim() || '#ff9a6b');

  // Subsonic -> accent (cyan), sonic -> ink, supersonic fades toward
  // data-red (amber). The M=1 crossing is the whole point of the demo, so
  // it's a distinct color right at the boundary, not a smooth gradient
  // straight through it.
  function machColor(M: number): string {
    if (M <= 0.98) return `rgb(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]})`;
    if (M < 1.02) return inkColor;
    return lerpColor(accentRgb, redRgb, Math.min(1, (M - 1) / 1.5));
  }

  function readRatio(): number {
    return parseFloat(ratioSlider.value);
  }

  function renderEquation(target: HTMLElement, tex: string) {
    renderKatex(tex, target, { throwOnError: false, displayMode: true });
  }

  function updateReadout(flow: FlowState, ratio: number) {
    const pct = ((ratio - parseFloat(ratioSlider.min)) / (parseFloat(ratioSlider.max) - parseFloat(ratioSlider.min))) * 100;
    ratioSlider.style.setProperty('--fill', `${pct}%`);
    const numEl = ratioValueOut.querySelector('.num');
    if (numEl) numEl.textContent = ratio.toFixed(2);

    regimeOut.textContent = flow.choked ? 'CHOKED' : 'not choked';
    regimeOut.classList.toggle('is-choked', flow.choked);

    renderEquation(
      equationOut,
      flow.choked
        ? String.raw`\frac{P_{back}}{P_0} = ${ratio.toFixed(2)} \le ${R_CRIT.toFixed(3)} \implies \textbf{CHOKED},\ M_{exit} = ${flow.machExit.toFixed(2)}`
        : String.raw`\frac{P_{back}}{P_0} = ${ratio.toFixed(2)} > ${R_CRIT.toFixed(3)} \implies \text{subsonic throughout},\ M_{throat} = ${flow.machThroat.toFixed(2)}`
    );
  }

  function drawNozzleOutline() {
    ctx.strokeStyle = hairlineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const y = CENTER_Y - radiusAt(x);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const y = CENTER_Y + radiusAt(x);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawThroatMarker(flow: FlowState) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = flow.choked ? machColor(1.01) : hairlineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(THROAT_X, CENTER_Y - R_THROAT - 14);
    ctx.lineTo(THROAT_X, CENTER_Y + R_THROAT + 14);
    ctx.stroke();
    ctx.restore();

    if (flow.choked) {
      ctx.fillStyle = inkColor;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('M = 1', THROAT_X, CENTER_Y - R_THROAT - 20);
    }
  }

  function drawParticles(flow: FlowState) {
    for (const p of particles) {
      const r = radiusAt(p.x);
      const y = CENTER_Y + p.lane * r;
      const M = machAt(p.x, flow);
      ctx.fillStyle = machColor(M);
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
    const ratio = readRatio();
    const flow = computeFlow(ratio);

    if (!prefersReducedMotion) {
      for (const p of particles) {
        const M = machAt(p.x, flow);
        p.x += (40 + M * 130) * dt;
        if (p.x > LOGICAL_WIDTH) p.x = 0;
      }
    }

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawNozzleOutline();
    drawParticles(flow);
    drawThroatMarker(flow);

    rafHandle = requestAnimationFrame(step);
  }

  function onRatioChange() {
    const ratio = readRatio();
    const flow = computeFlow(ratio);
    updateReadout(flow, ratio);
  }

  ratioSlider.addEventListener('input', onRatioChange);
  onRatioChange();
  rafHandle = requestAnimationFrame(step);

  return function destroy() {
    stopped = true;
    cancelAnimationFrame(rafHandle);
    window.removeEventListener('resize', fitCanvasToDisplay);
    ratioSlider.removeEventListener('input', onRatioChange);
  };
}
