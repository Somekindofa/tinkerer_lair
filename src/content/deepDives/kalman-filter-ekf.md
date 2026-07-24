---
title: Extended Kalman Filter
description: Linearize the nonlinear measurement at the current estimate, then run the ordinary Kalman update as if it had been linear all along.
---

The **Extended Kalman Filter** keeps the original filter's machinery
almost unchanged. At every step, it takes the nonlinear measurement
function $h(x) = e^x$ and replaces it with its tangent line at the
current estimate — a first-order Taylor expansion. Conveniently, the
derivative of $e^x$ is $e^x$ itself, so the **Jacobian** is just:

$$
H_k = \left.\frac{\partial h}{\partial x}\right|_{\hat{x}_k^-} = e^{\hat{x}_k^-}
$$

With $H_k$ in hand, the rest is exactly the ordinary Kalman update, just
with $H_k$ standing in for the "1" that a direct linear sensor would have
had:

$$
K_k = \frac{P_k^- H_k}{H_k^2 P_k^- + R}, \qquad
\hat{x}_k = \hat{x}_k^- + K_k\left(z_k - e^{\hat{x}_k^-}\right)
$$

This is fast and simple — one derivative, otherwise identical to the
filter you already know. But it hides a systematic error: the EKF
predicts the next measurement as $e^{\hat{x}_k^-}$, treating the estimate
as if it were exact. It isn't — there's real uncertainty $P_k^-$ around
it, and because $e^x$ curves *upward*, the true expected reading is
higher than $e^{\hat{x}_k^-}$ by Jensen's inequality: $E[e^X] \geq
e^{E[X]}$ for any spread-out $X$, with equality only when there's no
uncertainty at all. The EKF's point estimate simply doesn't account for
that gap. The more uncertain the filter is, the more its predicted
measurement systematically undershoots — and it never notices, because
linearizing throws the curvature away entirely.
