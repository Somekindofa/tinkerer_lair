---
title: Beyond Linear — Extended & Unscented Kalman Filters
description: What happens when the sensor itself is nonlinear? The scalar Kalman filter's tidy math stops applying — here's how its two most common descendants patch that.
---

The filter on the previous page assumes everything is linear: the true
value drifts by simple addition, and the sensor reports something close
to the true value itself. Most real sensors aren't that polite. A radar
reports range and bearing, not position. A camera reports pixel angles,
not distance. Whenever the measurement is some nonlinear function
$z_k = h(x_k) + v_k$ of the true state, the tidy scalar equations from
before no longer apply — the Kalman gain formula was derived assuming
everything stays Gaussian and linear, and pushing a Gaussian through a
nonlinear function doesn't generally give you a Gaussian back.

Both variants below patch this the same way conceptually: approximate
*something* well enough that the ordinary Kalman update still works. They
just disagree on what to approximate.

To make the difference concrete, both tabs track the same true signal
through the same nonlinear sensor: one that reports $z_k = e^{x_k} + v_k$
— an exponential response, the kind absorbance and fluorescence-intensity
sensors actually have. The nonlinearity here isn't a single problem point
like a sign flip; it's a *systematic bias* that's present everywhere,
which is what makes it a cleaner demonstration of the general problem.
Watch how the two filters' estimates diverge as the signal swings through
its range.
