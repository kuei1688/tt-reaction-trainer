# Isolated semantics-aware 3D table-tennis rally

Date: 2026-07-17T06:23:36.530Z

## Contract

The isolated flow enforces the basic rally sequence:

`serve → server-side table bounce → receiver-side table bounce → receiver racket contact → server-side table bounce`

The world-space coordinate contract is `z < 0 = server half` and `z > 0 = receiver half`.

## Results

| Scenario | Result | Physical time | Contacts | Table order | Racket after second bounce |
|---|---:|---:|---:|---:|---:|
| zero spin | pass | 2.233 s | 4 | yes | yes |
| omega.y + side spin | pass | 2.250 s | 4 | yes | yes |
| mixed omega | pass | 2.242 s | 4 | yes | yes |

Overall status: **pass**

## Boundary

This is a semantics and state-flow screen. The receiver-facing return plane is an explicit isolated adapter so the return can be checked for server-side landing; it is not a calibrated racket-pose or material model and is not formal mainline behavior.

The preview HTML embeds the isolated bundle so its start interaction does not depend on loading sibling files from a `file:///` page.

Playback uses a fixed 60 Hz UI timer and two 1/120 simulation steps per tick, so it does not depend on requestAnimationFrame timing in a local file page.

## Why this exists

The earlier mainline-v2 integration preview drove the product shell from the first table contact directly to racket contact and treated `secondBounce` as a validation reference. That is useful plumbing evidence, but it is not a rules-correct table-tennis rally. This screen keeps that limitation isolated and makes the actual three-table-contact sequence observable.
