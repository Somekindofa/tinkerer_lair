// Self-contained Canvas simulation of a PID controller driving a
// force-saturated mass-damper plant toward a step-changing setpoint. No
// framework, no external deps beyond katex.
import { renderEquation as renderKatex } from '../lib/katex-render';

interface PidRefs {
  canvas: HTMLCanvasElement;
  kpSlider: HTMLInputElement;
  kiSlider: HTMLInputElement;
  kdSlider: HTMLInputElement;
  kpValueOut: HTMLElement;
  kiValueOut: HTMLElement;
  kdValueOut: HTMLElement;
  eqOut: HTMLElement;
}

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 280;
const Y_MIN = -6;
const Y_MAX = 6;
const HISTORY_SECONDS = 14;
const TICK_MS = 150;
// Explicit Euler at TICK_MS directly goes numerically unstable at the
// higher end of the gain sliders (a discretization artifact, not real
// physics) -- sub-stepping the physics well below the redraw rate keeps
// the simulation stable across the whole slider range.
const SUBSTEPS = 10;

// Plant: a unit mass with linear drag, driven by a force-saturated
// actuator -- a stand-in for a motor, thruster, or heater fighting to
// reach a commanded target. m*x'' = u - c*x'
const MASS = 1;
const DRAG = 1.2;
const FORCE_MAX = 3;
// Naive anti-windup: clamp the accumulated integral itself, rather than
// letting it grow without bound while the actuator sits saturated. Without
// this, a poorly-tuned combination (low Kp, high Ki) doesn't just
// overshoot -- it compounds worse with every setpoint flip and drifts
// unboundedly over long exposure (stress-tested across the full slider
// grid over 5 simulated minutes). It's a blunt instrument next to real
// anti-windup techniques (back-calculation, conditional integration) --
// that contrast is exactly what a future deep-dive would cover.
const INTEGRAL_CLAMP = 4;
const SETPOINT_PERIOD_S = 6;
const SETPOINT_AMPLITUDE = 0.8;

function yToPx(y: number): number {
  const clamped = Math.max(Y_MIN, Math.min(Y_MAX, y));
  const t = (clamped - Y_MIN) / (Y_MAX - Y_MIN);
  return LOGICAL_HEIGHT - t * LOGICAL_HEIGHT;
}

interface Sample {
  t: number;
  setpoint: number;
  position: number;
}

export function mount({
  canvas,
  kpSlider,
  kiSlider,
  kdSlider,
  kpValueOut,
  kiValueOut,
  kdValueOut,
  eqOut,
}: PidRefs): () => void {
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
  const redColor = styles.getPropertyValue('--data-red').trim() || '#e34948';

  let t = 0;
  let position = 0;
  let velocity = 0;
  let integral = 0;
  let prevPosition = 0;
  let setpoint = SETPOINT_AMPLITUDE;
  let pTerm = 0;
  let iTerm = 0;
  let dTerm = 0;
  let uRaw = 0;
  let uApplied = 0;
  let history: Sample[] = [];

  function readGains() {
    return {
      Kp: parseFloat(kpSlider.value),
      Ki: parseFloat(kiSlider.value),
      Kd: parseFloat(kdSlider.value),
    };
  }

  function renderEquation() {
    const sign = (v: number) => (v >= 0 ? '+' : '-');
    renderKatex(
      String.raw`u = K_p e + K_i\!\displaystyle\int\! e\,dt - K_d \dot{x} = ${pTerm.toFixed(2)} ${sign(iTerm)} ${Math.abs(iTerm).toFixed(2)} ${sign(dTerm)} ${Math.abs(dTerm).toFixed(2)} = ${uRaw.toFixed(2)} \;\Longrightarrow\; u_{applied} = ${uApplied.toFixed(2)}`,
      eqOut,
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
    const { Kp, Ki, Kd } = readGains();
    const dt = TICK_MS / 1000;
    const dtSub = dt / SUBSTEPS;

    // The setpoint steps back and forth on a timer -- a standard
    // step-response test, and it keeps the demo doing something without
    // needing input.
    setpoint = Math.floor(t / SETPOINT_PERIOD_S) % 2 === 0 ? SETPOINT_AMPLITUDE : -SETPOINT_AMPLITUDE;

    for (let s = 0; s < SUBSTEPS; s++) {
      const error = setpoint - position;
      integral += error * dtSub;
      integral = Math.max(-INTEGRAL_CLAMP, Math.min(INTEGRAL_CLAMP, integral));

      // Derivative on measurement, not on error: differentiating the error
      // directly spikes whenever the setpoint itself steps (a classic
      // "derivative kick"), since the setpoint's jump isn't something a
      // derivative-of-error term should be reacting to.
      const dMeasurement = (position - prevPosition) / dtSub;
      prevPosition = position;

      pTerm = Kp * error;
      iTerm = Ki * integral;
      dTerm = -Kd * dMeasurement;
      uRaw = pTerm + iTerm + dTerm;
      uApplied = Math.max(-FORCE_MAX, Math.min(FORCE_MAX, uRaw));

      const accel = (uApplied - DRAG * velocity) / MASS;
      velocity += accel * dtSub;
      position += velocity * dtSub;
    }

    history.push({ t, setpoint, position });
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
    for (const y of [-4, -2, 0, 2, 4]) {
      const py = yToPx(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(LOGICAL_WIDTH, py);
      ctx.stroke();
    }
  }

  function drawLine(points: { t: number; v: number }[], color: string, width: number, alpha: number, dashed = false) {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xForT(p.t);
      const y = yToPx(p.v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = inkColor;
    ctx.fillText('- - setpoint', 12, 18);
    ctx.fillStyle = accentColor;
    ctx.fillText('— position', 108, 18);

    const isSaturated = Math.abs(uRaw - uApplied) > 1e-6;
    ctx.fillStyle = inkColor;
    ctx.fillText(`P ${pTerm.toFixed(2)}   I ${iTerm.toFixed(2)}   D ${dTerm.toFixed(2)}`, 12, 38);
    ctx.fillText(`u = ${uRaw.toFixed(2)}`, 12, 54);
    if (isSaturated) {
      ctx.fillStyle = redColor;
      ctx.fillText(`⚠ actuator saturated — clamped to ${uApplied.toFixed(2)}`, 90, 54);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawGrid();
    drawLine(
      history.map((s) => ({ t: s.t, v: s.setpoint })),
      inkSecondary,
      1.5,
      0.75,
      true
    );
    drawLine(
      history.map((s) => ({ t: s.t, v: s.position })),
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
    updateSliderVisual(kpSlider, kpValueOut);
    updateSliderVisual(kiSlider, kiValueOut);
    updateSliderVisual(kdSlider, kdValueOut);
  }

  kpSlider.addEventListener('input', onControlsChange);
  kiSlider.addEventListener('input', onControlsChange);
  kdSlider.addEventListener('input', onControlsChange);
  onControlsChange();

  if (!prefersReducedMotion) {
    tickHandle = window.setInterval(tick, TICK_MS);
  }
  // Seed some history immediately so the chart isn't empty on load.
  for (let i = 0; i < (HISTORY_SECONDS * 1000) / TICK_MS; i++) tick();
  rafHandle = requestAnimationFrame(loop);

  return function destroy() {
    stopped = true;
    cancelAnimationFrame(rafHandle);
    window.clearInterval(tickHandle);
    window.removeEventListener('resize', fitCanvasToDisplay);
    kpSlider.removeEventListener('input', onControlsChange);
    kiSlider.removeEventListener('input', onControlsChange);
    kdSlider.removeEventListener('input', onControlsChange);
  };
}
