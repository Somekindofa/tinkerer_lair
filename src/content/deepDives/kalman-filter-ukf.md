---
title: Unscented Kalman Filter
description: Never linearize anything — sample a handful of points, push each through the true nonlinear function, and refit a Gaussian to the results.
---

The **Unscented Kalman Filter** takes a different bet entirely: instead
of approximating the *function*, it approximates the *distribution* with
a small, deterministic set of **sigma points**, and pushes each one
through the real, unmodified $h(x) = e^x$ — no derivative anywhere. For a
single scalar state, three points suffice: the current estimate itself,
and one point spread to either side by an amount set by the current
uncertainty $P_k^-$:

$$
\chi_0 = \hat{x}_k^-, \qquad \chi_{1,2} = \hat{x}_k^- \pm \sqrt{3 P_k^-}
$$

Each sigma point is weighted ($W_0 = \tfrac{2}{3}$, $W_1 = W_2 =
\tfrac{1}{6}$ here), propagated through the *true* nonlinear function
($Z_i = e^{\chi_i}$), and the predicted measurement mean and covariance
are reconstructed directly from those weighted samples — statistics in,
statistics out, with the nonlinearity applied exactly rather than
approximated.

This is precisely the gap the EKF's tangent-line trick misses. Because
the three sigma points genuinely spread out by $\sqrt{3P_k^-}$ before
being exponentiated, their weighted average $E[e^\chi]$ naturally comes
out *larger* than $e^{\hat{x}_k^-}$ whenever there's real uncertainty —
the same Jensen's-inequality gap the EKF's point estimate ignores,
recovered here for free just by sampling around the mean instead of
evaluating only at it. It costs three function evaluations instead of
one derivative, but it never needs $h$ to be differentiable, and it stays
honest about a bias that the EKF has no mechanism to notice at all.
