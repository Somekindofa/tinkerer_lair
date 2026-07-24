// Self-contained Canvas simulation. No framework, no external deps —
// mount() is called once by the host page with the elements it needs.
import katex from 'katex';

interface VenturiRefs {
  canvas: HTMLCanvasElement;
  slider: HTMLInputElement;
  continuityOut: HTMLElement;
  bernoulliOut: HTMLElement;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 280;
const INLET_HALF_WIDTH = 100; // px, half the pipe opening at inlet/outlet
const PARTICLE_COUNT = 90;
const BASE_SPEED = 90; // px/s at the inlet
const FLUID_DENSITY = 1; // arbitrary units, for a relative pressure readout
const BASELINE_PRESSURE_KPA = 101.3;

// Pipe half-width at a given x (0..LOGICAL_WIDTH), given a constriction
// ratio in [0, 1] (0 = straight pipe, 1 = tightest throat).
function halfWidthAt(x: number, constriction: number): number {
  const center = LOGICAL_WIDTH / 2;
  const throatSpan = 220; // how wide the narrowing region is
  const t = Math.max(0, Math.min(1, 1 - Math.abs(x - center) / throatSpan));
  const smooth = t * t * (3 - 2 * t); // smoothstep
  const minHalfWidth = INLET_HALF_WIDTH * (1 - constriction * 0.7);
  return INLET_HALF_WIDTH - smooth * (INLET_HALF_WIDTH - minHalfWidth);
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

export function mount({ canvas, slider, continuityOut, bernoulliOut }: VenturiRefs) {
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return;
  const ctx = ctx2d;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = LOGICAL_WIDTH * dpr;
  canvas.height = LOGICAL_HEIGHT * dpr;
  canvas.style.width = '100%';
  canvas.style.aspectRatio = `${LOGICAL_WIDTH} / ${LOGICAL_HEIGHT}`;
  ctx.scale(dpr, dpr);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let particles = makeParticles();
  let constriction = parseFloat(slider.value);
  let lastTime = performance.now();

  const styles = getComputedStyle(document.documentElement);
  const inkColor = styles.getPropertyValue('--ink').trim() || '#0b0b0b';
  const accentColor = styles.getPropertyValue('--accent').trim() || '#2a78d6';
  const hairlineColor = styles.getPropertyValue('--hairline').trim() || '#e1e0d9';

  function velocityAt(x: number): number {
    const inletHW = halfWidthAt(0, constriction);
    const localHW = halfWidthAt(x, constriction);
    return BASE_SPEED * (inletHW / localHW); // continuity: A1 v1 = A2 v2
  }

  function renderEquation(target: HTMLElement, tex: string) {
    katex.render(tex, target, { throwOnError: false, displayMode: true });
  }

  function updateReadout() {
    const throatX = LOGICAL_WIDTH / 2;
    const vInlet = velocityAt(0);
    const vThroat = velocityAt(throatX);
    const ratio = vThroat / vInlet;
    const dPressure = 0.5 * FLUID_DENSITY * (vInlet * vInlet - vThroat * vThroat);
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

  function drawPipe() {
    ctx.strokeStyle = hairlineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const hw = halfWidthAt(x, constriction);
      const y = LOGICAL_HEIGHT / 2 - hw;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 4) {
      const hw = halfWidthAt(x, constriction);
      const y = LOGICAL_HEIGHT / 2 + hw;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawParticles() {
    for (const p of particles) {
      const hw = halfWidthAt(p.x, constriction);
      const y = LOGICAL_HEIGHT / 2 + p.lane * hw;
      const v = velocityAt(p.x);
      const speedFrac = Math.min(1, v / (BASE_SPEED * 3));
      ctx.fillStyle = speedFrac > 0.55 ? accentColor : inkColor;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(p.x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function step(now: number) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (!prefersReducedMotion) {
      for (const p of particles) {
        p.x += velocityAt(p.x) * dt;
        if (p.x > LOGICAL_WIDTH) p.x = 0;
      }
    }

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawPipe();
    drawParticles();

    requestAnimationFrame(step);
  }

  slider.addEventListener('input', () => {
    constriction = parseFloat(slider.value);
    updateReadout();
  });

  updateReadout();
  requestAnimationFrame(step);
}
