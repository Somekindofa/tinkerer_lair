---
title: Choked Flow
description: Push a gas hard enough and the Venturi equations stop telling the whole story — the flow hits a hard limit set by the speed of sound itself.
---

Everything on the previous page assumes incompressible flow — exactly true
for liquids, and a good approximation for gases moving well below the speed
of sound. Push a gas hard enough through a constriction, though, and
continuity and Bernoulli's equation as written stop telling the whole
story.

## The sonic limit

As the throat narrows and velocity rises, at some point the gas right at
the throat reaches the local speed of sound — Mach 1. Past that point,
dropping the downstream pressure further does nothing to increase the mass
flow rate. The reason is causal, not just mathematical: pressure
disturbances travel through a gas at the speed of sound, and once the flow
itself is moving that fast, a pressure drop downstream literally cannot
propagate upstream in time to "tell" the gas before the throat to speed up.
The flow is **choked**.

For an ideal gas, the throat chokes once the pressure ratio across the
constriction crosses a critical value set only by the gas's specific heat
ratio $\gamma$:

$$
\left(\frac{P_{throat}}{P_0}\right)_{crit} = \left(\frac{2}{\gamma+1}\right)^{\gamma/(\gamma-1)}
$$

For air ($\gamma \approx 1.4$), that works out to about $0.528$ — once the
throat pressure drops to roughly 53% of the upstream stagnation pressure
$P_0$, no further downstream pressure reduction increases the flow. It's
capped, full stop.

## Going supersonic: the converging-diverging nozzle

Here's the counterintuitive part. Once flow is choked at the throat,
accelerating it further past Mach 1 requires the duct to *widen* again, not
narrow — the opposite of everything the subsonic Venturi tube taught us.
This converging-diverging shape is the de Laval nozzle, and it's why rocket
engines and supersonic wind tunnels are built the way they are: exhaust gas
chokes at the throat, then the diverging section afterward expands it to
supersonic exit speeds.

It's the same continuity and energy-conservation logic as the Venturi
effect the whole way through — it just flips which way area and velocity
trade off once you cross Mach 1, because past that point the gas itself is
compressing and expanding fast enough to change the rules.

Drag the back pressure ratio below and watch the flow cross that line for
yourself — cyan is subsonic, amber is supersonic, and the dashed marker at
the throat lights up the instant the flow chokes.
