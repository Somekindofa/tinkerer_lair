---
title: The Kalman Filter
description: A noisy sensor and an imperfect model, fused into an estimate that beats either one alone — watch it happen in real time.
date: 2026-07-24
tags: [estimation, controls]
---

Every sensor lies a little. Point a noisy instrument at something and you
get a jittery reading that's somewhere near the truth, never exactly on
it. A Kalman filter doesn't try to clean up any single reading — it fuses
a *prediction* (what your model of the world expects) with each new
*measurement* (what the noisy sensor actually reports), weighting the two
by how much you trust each one. The result tracks the true value far more
closely than the raw sensor ever could, without needing to see the truth
directly.

## What's this for?

The Kalman filter is one of the most quietly ubiquitous algorithms in
engineering. It ran the navigation computer on the Apollo missions,
fusing noisy inertial sensors into a trustworthy spacecraft position long
before GPS existed. Every phone's GPS chip still uses it today, blending
satellite fixes with motion-sensor data to smooth out the jumps. Drones
and self-driving cars run it dozens of times a second to fuse noisy
sensor readings into a stable estimate of where they are; the same idea
shows up smoothing noisy financial time series and cleaning up radar
tracks.

## The equations

For a single noisy quantity, the filter alternates between two steps.
**Predict**, carrying the previous estimate forward and inflating its
uncertainty by the process noise $Q$ (how much the true value is expected
to drift on its own):

$$
\hat{x}_k^- = \hat{x}_{k-1}, \qquad P_k^- = P_{k-1} + Q
$$

**Update**, once a new noisy measurement $z_k$ arrives (with measurement
noise $R$): compute how much to trust it via the **Kalman gain** $K_k$,
then blend it into the prediction —

$$
K_k = \frac{P_k^-}{P_k^- + R} \qquad\Longrightarrow\qquad \hat{x}_k = \hat{x}_k^- + K_k\left(z_k - \hat{x}_k^-\right)
$$

$$
P_k = (1 - K_k)\, P_k^-
$$

The gain is the whole idea in one number: $K_k \to 1$ means "the
measurement is far more trustworthy than the model — lean on it
entirely," while $K_k \to 0$ means the opposite — trust the model and
barely move. Every Kalman filter, however elaborate, is this same
predict-then-correct rhythm underneath.

Adjust the process and measurement noise below and watch the gain — and
the estimate — respond live.
