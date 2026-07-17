# MVP Mainline Spec

> This file is a draft for the MVP mainline only.
> It is not a full physics spec, not a roadmap, not a TODO list, and not a commitment that the work is already done.
> The purpose is to define a narrow playable loop that can coexist with research tools without turning into a full match simulation.
>
> **Status (accepted 2026-07-15):** `game5.html` is the implementation of this mainline direction — a user decision, not something derived from code alone (see `AI_CONTEXT/OPEN_ITEMS.md` "產品方向決策"). Known physics/data gaps still remain open (attack-technique sidespin compensation not calibrated, left/right sidespin video camera direction not human-verified, 47 generated serve presets not individually calibrated, and the core still uses a legacy x-kick sidespin proxy) — accepting the direction does not mean this spec is fully realized. Direction naming is governed by `docs/SPIN_DIRECTION_CONTRACT.md`.

## 1. Mainline Goal

The MVP mainline uses the existing serve-video system to present a serve clip first, then hands the player a physically generated serve that corresponds to that clip.

After the serve lands, the player makes two decisions:

- technique choice: chop / backhand flat push / forehand attack
- direction correction: left / none / right

The system simulates the result with the current gameplay physics model. If the return succeeds, the opponent automatically performs one reply shot. That reply should still respect the rough ideas of short-pimple and long-pimple spin response, but only at the level needed for the MVP loop.

The point of this mainline is to create a controlled natural result: the player’s choice should plausibly lead to net, table, out, or a visible successful rally continuation without hard-writing every ball outcome.

## 2. Full One-Rally Flow

1. Show one serve video.
2. Convert that serve into the corresponding physical serve setup.
3. Let the player read the serve and choose technique plus direction correction.
4. Simulate the player return using gameplay physics.
5. Judge whether the technique choice and direction correction are both reasonable.
6. If the return is successful, let the opponent automatically return once.
7. Apply a simple short-pimple / long-pimple response concept for the opponent return.
8. End the point when the ball goes out, hits the net, or the observation window is complete.

## 3. First-Version Scope

The first version only does the following:

- reuse the existing serve-video library
- map a small curated serve set to physical serve entries
- support exactly three player return techniques plus three direction corrections
- simulate one player return and one opponent reply
- use controlled approximations where the full physical model is not ready
- preserve the difference between gameplay physics and research physics
- keep the loop single-point and short

## 4. Explicit Non-Goals

This MVP does not do the following:

- full tournament or match management
- unlimited rally chaining
- complete universal contact mechanics
- detailed blade, rubber, sponge, and mass modeling for every case
- research-page experiments promoted directly into the mainline
- parameter search, optimizer flows, or tuning UI as part of the mainline
- a full coaching / training curriculum
- automatic decision-making for all techniques and ball types
- a complete side-spin physics research program
- a complete long-pimple side-spin model

## 5. 12-Serve Candidate Plan

The mainline should start with a small serve set of 12 candidate entries, each one being a stable serve-to-physics mapping.

Suggested planning groups:

1. backspin serve A
2. backspin serve B
3. backspin serve C
4. side-backspin serve A
5. side-backspin serve B
6. side-backspin serve C
7. side-spin serve A
8. side-spin serve B
9. side-spin serve C
10. no-spin / flat serve A
11. no-spin / flat serve B
12. no-spin / flat serve C

Each serve entry should be treated as a mainline cue, not as a final physical truth. The goal is to cover the common return shapes and to keep the MVP loop varied enough to feel alive.

## 6. Player Return Dimensions

The player return interface is split into two dimensions.

### Technique choice

- chop
- backhand flat push
- forehand attack

### Direction correction

- left
- none
- right

The mainline should keep both dimensions visible so the player learns that not every ball requires a left or right correction.

## 7. 3 Player Return Techniques

### Chop

Used when the player wants to absorb pace and keep the ball low. The gameplay result should usually favor controlled return depth, lower risk, and moderate spin response.

### Backhand Flat Push

Used for a compact, stable return against shorter or slower balls. The gameplay result should emphasize forward control, less swing travel, and a clear table-clearance decision.

### Forehand Attack

Used when the player has enough time and height to play a more aggressive return. The gameplay result should feel faster, more committed, and more likely to force a stronger opponent reply.

## 8. Direction Logic by Serve Type

The MVP should treat the following direction patterns as the default learning target:

- side-backspin: usually needs chop plus a correct direction correction
- side-spin: usually needs flat push or attack plus a correct direction correction
- backspin: usually expects no direction correction
- no-spin / flat: usually expects no direction correction

The UI may still show left / none / right for every serve so the player learns that not every ball requires lateral compensation.

## 9. Scoring and Feedback

The MVP feedback should be split into four parts:

1. whether the technique choice was reasonable
2. whether the direction correction was reasonable
3. the physical result: net / table / out / hit net / pop up
4. what the player should understand about the spin response after the particle-like reply

This feedback is for learning and should stay lightweight.

## 10. Opponent Short-Pimple / Long-Pimple Reply Concept

The opponent reply only needs a conceptual response layer in the MVP.

- short-pimple style reply should tend to reduce spin sensitivity and make the ball feel more direct
- long-pimple style reply should tend to invert or soften the incoming spin effect in a visible but simplified way

This is not a full rubber model. It is only a gameplay-facing response concept that keeps the opponent reply from feeling identical in all cases.

## 11. Point End Conditions

A point ends when any of the following happens:

- the ball goes out
- the ball hits the net
- the observation / replay window is complete
- the single-reply MVP loop has finished its intended sequence

The MVP should not keep the point alive just to simulate more rallies.

## 12. Questions That Need Later Verification

The following questions remain open and need later validation:

- which serve-to-physics mappings feel most natural
- whether the three return techniques plus direction correction are enough for the first playable loop
- how much gameplay physics can stand in for incomplete contact mechanics
- whether the short-pimple / long-pimple reply concept is readable to players
- how to keep the serve video system and the physics serve model aligned
- which cases should remain in the research tool pages only
- how to prevent a single-point loop from drifting into a full match simulator

## 13. Limits That Prevent Scope Creep Into Full Match Simulation

This spec must remain narrow. It should not expand into a full competition model.

The limits are:

- only one serve, one player return, and one opponent reply in the MVP loop
- only the three player return techniques and the three direction corrections listed above
- no full scoring ladder, no set structure, no tournament logic
- no detailed per-rubber physical modeling for every opponent case
- no optimizer or tuning workflow in the MVP mainline
- no conversion of research-page mechanisms into automatic mainline behavior
- no expansion into a general-purpose table tennis simulator

If a feature pushes beyond these limits, it belongs in research tooling or a later draft, not in this MVP mainline spec.
