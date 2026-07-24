---
title: The Venturi Effect
description: Squeeze a pipe and the fluid speeds up — but why does the pressure drop? Drag the constriction and watch Bernoulli's equation play out live.
date: 2026-07-24
updated: 2026-07-24
tags: [fluids, mechanical]
---

Push an incompressible fluid through a pipe with a narrowing throat and, by
conservation of mass, it has to speed up through the constriction — the same
volume has to pass through a smaller area in the same time. Bernoulli's
equation then ties that speed increase to a pressure *drop* at the throat:
total mechanical energy along a streamline is conserved, so what the fluid
gains in kinetic energy it loses in pressure.

## What's this for?

The Venturi effect shows up anywhere an engineer wants to trade velocity for
pressure, or use a pressure drop to pull something in. A carburetor uses the
low pressure at its throat to draw fuel into the airstream; medical oxygen
regulators and nebulizers use the same trick to entrain room air into a gas
line; industrial Venturi flow meters go the other direction, measuring the
pressure drop across a known constriction to infer flow rate without any
moving parts. It's also why a shower curtain billows inward once the water's
running — the fast-moving water drags air with it and drops the pressure
inside the curtain relative to the bathroom.

## The equations

**Continuity** (conservation of mass, incompressible flow): the volume
flow rate $A v$ stays constant along the pipe, so a smaller cross-section
means a faster flow:

$$
A_1 v_1 = A_2 v_2 \quad\Longrightarrow\quad v_2 = v_1 \frac{A_1}{A_2}
$$

**Bernoulli's equation** (conservation of energy along a streamline, no
height change): total pressure — static plus dynamic — is conserved, so the
speed gain at the throat has to come out of the static pressure:

$$
P_1 + \tfrac{1}{2}\rho v_1^2 \;=\; P_2 + \tfrac{1}{2}\rho v_2^2
$$

Solving for the pressure at the throat:

$$
P_2 = P_1 - \tfrac{1}{2}\rho \left(v_2^2 - v_1^2\right)
$$

Since $v_2 > v_1$ at the constriction, $P_2 < P_1$ — the throat is always
at lower pressure than the inlet, and by how much depends only on the
velocity ratio set by the geometry.

$P_2$ can land on either side of $P_1$ depending on which way the geometry
changes: narrowing ($A_2 < A_1$) speeds the flow up and drops the pressure
below $P_1$, while widening ($A_2 > A_1$) slows it back down and recovers
pressure above $P_1$ — both are physically normal.

## Cavitation

Push the constriction far enough, though, and this idealized equation will
happily predict a *negative* absolute pressure — which isn't physically
possible for a liquid. Real fluids can't sustain pressure much below their
vapor pressure without **cavitating**: vapor bubbles form locally in the
low-pressure throat, which breaks the incompressible-flow assumption the
whole derivation rests on.

A negative $P_2$ here isn't a real state the fluid reaches; it's the model
telling you where cavitation would actually kick in. Those bubbles don't
stay vapor for long — they collapse violently the instant they drift back
into higher-pressure flow downstream, and that collapse is what does the
damage. It's a genuine failure mode engineers have to design around: pump
impellers, ship propellers, and even valves and Venturi meters can pit and
erode from cavitation over time, sometimes badly enough to destroy the part
in a matter of weeks.

Adjust the inlet speed and the two areas below to see both equations play
out with live numbers directly on the diagram.
