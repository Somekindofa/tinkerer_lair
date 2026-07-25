---
title: The PID Controller
description: Three numbers turn an error into a correction — cruise control, thermostats, and drones all run on this loop.
date: 2026-07-25
tags: [controls, mechanical]
featured: true
---

A PID controller is the workhorse of feedback control. Give it a target
(the setpoint) and a measurement of where the system actually is, and it
turns the gap between them into a correction from three simple terms — how
far off you are right now, how long and how badly you've been off, and how
fast you're closing the gap — fed straight back into the system as a
driving force. No model of the plant, no state estimation, no
linearization: just a weighted sum reacting to error as it happens. It's
unglamorous next to a Kalman filter or an LQR controller, and it runs
almost everything anyway.

## What's this for?

Cruise control holding highway speed against hills and headwinds, a
thermostat cycling a furnace to hold room temperature, a drone stabilizing
its altitude, a 3D printer's hotend tracking a target temperature — anywhere
something needs to reach and hold a target despite disturbances pushing
back, a PID loop is probably doing the work.

## The equations

$$
u(t) = K_p\, e(t) + K_i \int_0^t e(\tau)\, d\tau + K_d \frac{de}{dt}, \qquad e(t) = r(t) - x(t)
$$

$u$ is the correction, $e$ is the gap between the setpoint $r$ and the
current state $x$: $K_p$ reacts to the error right now, $K_i$ reacts to how
much error has piled up over time, $K_d$ reacts to how fast the error is
changing. Below, $u$ drives a simple mass toward a target position that
steps back and forth on a timer — a stand-in for a motor, thruster, or
heater fighting to reach a commanded value:
$m\ddot{x} = u - c\dot{x}$. The derivative term below actually reacts to
the *state's* rate of change rather than the error's — differentiating the
error directly would spike every time the setpoint itself jumps, which
isn't something a derivative term should be reacting to.

## Integral windup

Push $K_i$ up relative to $K_p$ and watch what happens: the correction
starts demanding more force than the actuator can supply, so the actuator
saturates at its maximum. The integral term doesn't know that — as long as
error persists, it keeps accumulating, even though the actuator is already
maxed out and can't act on any more of it. When the error finally reverses,
the controller first has to unwind all that excess before it starts easing
off, producing a large, sluggish overshoot that looks nothing like the
underlying tracking error actually was. Real controllers don't just accept
this: dedicated anti-windup logic (back-calculation, conditional
integration) stops the integral from piling up past what the actuator can
use in the first place.
