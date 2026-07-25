// Self-contained Canvas simulation of a scalar Kalman filter tracking a
// noisy signal live. No framework, no external deps beyond katex.
import { renderEquation as renderKatex } from '../lib/katex-render';

interface KalmanRefs {
  canvas: HTMLCanvasElement;
  qSlider: HTMLInputElement;
  rSlider: HTMLInputElement;
  qValueOut: HTMLElement;
  rValueOut: HTMLElement;
  gainOut: HTMLElement;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 280;
const Y_MIN = -3;
const Y_MAX = 3;
const HISTORY_SECONDS = 12;
const TICK_MS = 150;

function yToPx(y: number): number {
  const t = (y - Y_MIN) / (Y_MAX - Y_MIN);
  return LOGICAL_HEIGHT - t * LOGICAL_HEIGHT;
}

// Box-Muller for a standard normal sample.
function randn(): number {
  const u1 = Math.max(1e-9, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

interface Sample {
  t: number;
  trueValue: number;
  measurement: number;
  estimate: number;
}

export function mount({ canvas, qSlider, rSlider, qValueOut, rValueOut, gainOut }: KalmanRefs): () => void {
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

  const styles = getComputedStyle(document.documentElement);
  const inkColor = styles.getPropertyValue('--ink').trim() || '#0b0b0b';
  const inkSecondary = styles.getPropertyValue('--ink-secondary').trim() || '#52514e';
  const hairlineColor = styles.getPropertyValue('--hairline').trim() || '#e1e0d9';
  const accentColor = styles.getPropertyValue('--accent').trim() || '#2a78d6';

  let t = 0;
  let trueValue = 0;
  let estimate = 0;
  let variance = 1;
  let gain = 0;
  let history: Sample[] = [];

  function readQR() {
    return { Q: parseFloat(qSlider.value), R: parseFloat(rSlider.value) };
  }

  function renderEquation() {
    const { Q, R } = readQR();
    const pPredict = variance + Q;
    renderKatex(
      String.raw`K_k = \dfrac{P_k^-}{P_k^- + R} = \dfrac{${pPredict.toFixed(2)}}{${pPredict.toFixed(2)} + ${R.toFixed(2)}} = ${gain.toFixed(2)}`,
      gainOut,
      { throwOnError: false, displayMode: true }
    );
  }

  function updateSliderVisual(slider: HTMLInputElement, valueOut: HTMLElement) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--fill', `${pct}%`);
    const numEl = valueOut.querySelector('.num');
    if (numEl) numEl.textContent = val.toFixed(2);
  }

  function tick() {
    const { Q, R } = readQR();
    const dt = TICK_MS / 1000;

    // True signal: mean-reverting drift plus a slow forcing sine, driven by
    // process noise Q so cranking Q up visibly makes the truth wander more.
    trueValue += (-0.15 * trueValue + 0.6 * Math.sin(t * 0.4)) * dt + Math.sqrt(Q) * Math.sqrt(dt) * randn();

    const measurement = trueValue + Math.sqrt(R) * randn();

    // Predict.
    const pPredict = variance + Q;
    // Update.
    gain = pPredict / (pPredict + R);
    estimate = estimate + gain * (measurement - estimate);
    variance = (1 - gain) * pPredict;

    history.push({ t, trueValue, measurement, estimate });
    const cutoff = t - HISTORY_SECONDS;
    while (history.length && history[0].t < cutoff) history.shift();

    t += dt;
    renderEquation();
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

  function drawMeasurements() {
    ctx.fillStyle = inkSecondary;
    for (const s of history) {
      const x = xForT(s.t);
      const y = yToPx(s.measurement);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    const last = history[history.length - 1];
    if (!last) return;
    ctx.fillStyle = inkColor;
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`estimate x̂ = ${last.estimate.toFixed(2)}`, 12, 18);
    ctx.fillText(`true x = ${last.trueValue.toFixed(2)}`, 12, 34);
    ctx.fillText(`gain K = ${gain.toFixed(2)}`, 12, 50);
  }

  function draw() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawGrid();
    drawMeasurements();
    drawLine(
      history.map((s) => ({ t: s.t, v: s.trueValue })),
      inkSecondary,
      1.5,
      0.65
    );
    drawLine(
      history.map((s) => ({ t: s.t, v: s.estimate })),
      accentColor,
      2.5,
      1
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
    updateSliderVisual(qSlider, qValueOut);
    updateSliderVisual(rSlider, rValueOut);
  }

  qSlider.addEventListener('input', onControlsChange);
  rSlider.addEventListener('input', onControlsChange);
  onControlsChange();

  if (!prefersReducedMotion) {
    tickHandle = window.setInterval(tick, TICK_MS);
  }
  // Seed some history immediately so the chart isn't empty on load.
  for (let i = 0; i < HISTORY_SECONDS * 1000 / TICK_MS; i++) tick();
  rafHandle = requestAnimationFrame(loop);

  return function destroy() {
    stopped = true;
    cancelAnimationFrame(rafHandle);
    window.clearInterval(tickHandle);
    window.removeEventListener('resize', fitCanvasToDisplay);
    qSlider.removeEventListener('input', onControlsChange);
    rSlider.removeEventListener('input', onControlsChange);
  };
}
