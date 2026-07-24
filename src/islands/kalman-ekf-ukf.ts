// Runs an Extended and an Unscented Kalman filter simultaneously against
// the same live measurement stream from a genuinely nonlinear sensor
// (z = e^x + noise), so the two can be compared directly rather than
// taken on faith. No framework, no external deps beyond katex.
import katex from 'katex';

interface EkfUkfRefs {
  canvas: HTMLCanvasElement;
  rSlider: HTMLInputElement;
  rValueOut: HTMLElement;
  ekfEqOut: HTMLElement;
  ukfEqOut: HTMLElement;
  linearZhatOut: HTMLElement;
  sigmaZhatOut: HTMLElement;
  gapOut: HTMLElement;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 280;
const Y_MIN = -2.5;
const Y_MAX = 2.5;
const HISTORY_SECONDS = 12;
const TICK_MS = 150;
// Fixed process noise -- the point of this demo is R and the nonlinearity,
// not a second slider. Deliberately not tiny: the EKF's bias (E[e^X] vs
// e^E[X]) scales with the filter's own uncertainty P, so keeping P
// meaningfully large is what makes the gap between the two filters show
// up reliably instead of being swamped by per-run noise variance.
const Q = 0.2;

function yToPx(y: number): number {
  const t = (y - Y_MIN) / (Y_MAX - Y_MIN);
  return LOGICAL_HEIGHT - t * LOGICAL_HEIGHT;
}

function randn(): number {
  const u1 = Math.max(1e-9, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

interface Sample {
  t: number;
  trueValue: number;
  ekf: number;
  ukf: number;
}

type ActiveFilter = 'ekf' | 'ukf';

export function mount({ canvas, rSlider, rValueOut, ekfEqOut, ukfEqOut, linearZhatOut, sigmaZhatOut, gapOut }: EkfUkfRefs) {
  const ctxRaw = canvas.getContext('2d');
  if (!ctxRaw) return { destroy: () => {}, setActiveFilter: (_f: ActiveFilter) => {} };
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

  const styles = getComputedStyle(document.documentElement);
  const inkColor = styles.getPropertyValue('--ink').trim() || '#eaf4ff';
  const inkSecondary = styles.getPropertyValue('--ink-secondary').trim() || '#9fc3e0';
  const hairlineColor = styles.getPropertyValue('--hairline').trim() || 'rgba(148,199,255,0.25)';
  const accentColor = styles.getPropertyValue('--accent').trim() || '#5ee6d0';
  const redColor = styles.getPropertyValue('--data-red').trim() || '#ff9a6b';

  let t = 0;
  let trueValue = 0;

  // EKF state.
  let xEkf = 0;
  let pEkf = 1;
  let hJacobian = 0;
  let kEkf = 0;

  // UKF state.
  let xUkf = 0;
  let pUkf = 1;
  let kUkf = 0;
  let sigmaSpread = 0;

  // The side-by-side demo below deliberately does NOT compare the two
  // recursive filters' own zHat values against each other: xEkf and xUkf
  // diverge over time (different gain histories), so their means can differ
  // for reasons that have nothing to do with curvature -- that confound
  // dwarfed the Jensen's-inequality gap often enough to flip its sign in
  // testing. Instead, both quantities below are evaluated at the SAME
  // belief (the UKF's own current predicted mean/variance), so the only
  // difference between them is linearizing vs. sampling -- see tick().
  let zHatLinear = 0; // h(x̂⁻): what a first-order Taylor expansion predicts.
  let zHatUkf = 0; // E[h(x)] via sigma points: what full sampling predicts.

  let history: Sample[] = [];
  let activeFilter: ActiveFilter = 'ekf';

  function readR(): number {
    return parseFloat(rSlider.value);
  }

  function updateSliderVisual() {
    const min = parseFloat(rSlider.min);
    const max = parseFloat(rSlider.max);
    const val = readR();
    const pct = ((val - min) / (max - min)) * 100;
    rSlider.style.setProperty('--fill', `${pct}%`);
    const numEl = rValueOut.querySelector('.num');
    if (numEl) numEl.textContent = val.toFixed(2);
  }

  function renderEquations() {
    katex.render(
      String.raw`H_k = e^{\hat{x}_k^-} = ${hJacobian.toFixed(2)} \quad\Longrightarrow\quad K_k = ${kEkf.toFixed(2)}`,
      ekfEqOut,
      { throwOnError: false, displayMode: true }
    );
    katex.render(
      String.raw`\chi_{1,2} = \hat{x}_k^- \pm ${sigmaSpread.toFixed(2)} \quad\Longrightarrow\quad K_k = ${kUkf.toFixed(2)}`,
      ukfEqOut,
      { throwOnError: false, displayMode: true }
    );
    linearZhatOut.textContent = zHatLinear.toFixed(3);
    sigmaZhatOut.textContent = zHatUkf.toFixed(3);
    const gap = zHatUkf - zHatLinear;
    gapOut.textContent = (gap >= 0 ? '+' : '') + gap.toFixed(3);
  }

  function h(x: number): number {
    return Math.exp(x);
  }

  function tick() {
    const R = readR();
    const dt = TICK_MS / 1000;

    trueValue += (-0.08 * trueValue + 0.9 * Math.sin(t * 0.3)) * dt + Math.sqrt(Q) * Math.sqrt(dt) * randn();
    trueValue = Math.max(-3, Math.min(3, trueValue));
    const z = h(trueValue) + Math.sqrt(R) * randn();

    // --- EKF: linearize h(x) = e^x at the current estimate ---
    const xEkfPred = xEkf;
    const pEkfPred = pEkf + Q;
    hJacobian = h(xEkfPred); // d/dx[e^x] = e^x
    const zHatEkf = h(xEkfPred);
    kEkf = (pEkfPred * hJacobian) / (hJacobian * hJacobian * pEkfPred + R);
    xEkf = xEkfPred + kEkf * (z - zHatEkf);
    pEkf = (1 - kEkf * hJacobian) * pEkfPred;

    // --- UKF: propagate 3 sigma points through the true h(x) = e^x,
    // no linearization anywhere (standard scalar scaling, n=1, lambda=2) ---
    const xUkfPred = xUkf;
    const pUkfPred = pUkf + Q;
    sigmaSpread = Math.sqrt(3 * Math.max(pUkfPred, 1e-6));
    const chi0 = xUkfPred;
    const chi1 = xUkfPred + sigmaSpread;
    const chi2 = xUkfPred - sigmaSpread;
    const w0 = 2 / 3;
    const w12 = 1 / 6;
    const Z0 = h(chi0);
    const Z1 = h(chi1);
    const Z2 = h(chi2);
    zHatUkf = w0 * Z0 + w12 * Z1 + w12 * Z2;
    const pzz = w0 * (Z0 - zHatUkf) ** 2 + w12 * (Z1 - zHatUkf) ** 2 + w12 * (Z2 - zHatUkf) ** 2 + R;
    const pxz = w0 * (chi0 - xUkfPred) * (Z0 - zHatUkf) + w12 * (chi1 - xUkfPred) * (Z1 - zHatUkf) + w12 * (chi2 - xUkfPred) * (Z2 - zHatUkf);
    kUkf = pxz / pzz;
    xUkf = xUkfPred + kUkf * (z - zHatUkf);
    pUkf = pUkfPred - kUkf * kUkf * pzz;

    // The demo comparison: linearize the SAME belief (xUkfPred, pUkfPred)
    // the sigma points above were just drawn from, instead of using the
    // separately-diverged EKF trajectory's own xEkfPred. That isolates
    // linearize-vs-sample as the only difference between zHatLinear and
    // zHatUkf, so the gap reduces to w12 * e^xUkfPred * 2*(cosh(sigmaSpread)
    // - 1) -- provably >= 0 for any real sigmaSpread, no confound possible.
    zHatLinear = h(xUkfPred);

    history.push({ t, trueValue, ekf: xEkf, ukf: xUkf });
    const cutoff = t - HISTORY_SECONDS;
    while (history.length && history[0].t < cutoff) history.shift();

    t += dt;
    renderEquations();
  }

  function xForT(sampleT: number): number {
    const frac = (sampleT - (t - HISTORY_SECONDS)) / HISTORY_SECONDS;
    return frac * LOGICAL_WIDTH;
  }

  function drawGrid() {
    ctx.strokeStyle = hairlineColor;
    ctx.lineWidth = 1;
    for (const y of [-2, -1, 0, 1, 2]) {
      const py = yToPx(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(LOGICAL_WIDTH, py);
      ctx.stroke();
    }
  }

  function drawLine(points: { t: number; v: number }[], color: string, width: number, alpha: number) {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xForT(p.t);
      const y = yToPx(p.v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    ctx.fillStyle = inkColor;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('— true', 12, 18);
    ctx.fillStyle = accentColor;
    ctx.fillText('— EKF', 70, 18);
    ctx.fillStyle = redColor;
    ctx.fillText('— UKF', 128, 18);
  }

  function draw() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawGrid();
    drawLine(
      history.map((s) => ({ t: s.t, v: s.trueValue })),
      inkSecondary,
      1.5,
      0.6
    );
    drawLine(
      history.map((s) => ({ t: s.t, v: s.ekf })),
      accentColor,
      activeFilter === 'ekf' ? 2.75 : 1.5,
      activeFilter === 'ekf' ? 1 : 0.55
    );
    drawLine(
      history.map((s) => ({ t: s.t, v: s.ukf })),
      redColor,
      activeFilter === 'ukf' ? 2.75 : 1.5,
      activeFilter === 'ukf' ? 1 : 0.55
    );
    drawLabels();
  }

  let stopped = false;
  let rafHandle = 0;
  let tickHandle = 0;

  function loop() {
    if (stopped) return;
    draw();
    rafHandle = requestAnimationFrame(loop);
  }

  function onControlsChange() {
    updateSliderVisual();
  }

  rSlider.addEventListener('input', onControlsChange);
  onControlsChange();

  if (!prefersReducedMotion) {
    tickHandle = window.setInterval(tick, TICK_MS);
  }
  for (let i = 0; i < (HISTORY_SECONDS * 1000) / TICK_MS; i++) tick();
  rafHandle = requestAnimationFrame(loop);

  return {
    setActiveFilter(filter: ActiveFilter) {
      activeFilter = filter;
    },
    destroy() {
      stopped = true;
      cancelAnimationFrame(rafHandle);
      window.clearInterval(tickHandle);
      window.removeEventListener('resize', fitCanvasToDisplay);
      rSlider.removeEventListener('input', onControlsChange);
    },
  };
}
