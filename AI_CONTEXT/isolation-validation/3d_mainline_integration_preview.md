# Isolated 3D mainline integration preview

Date: 2026-07-16T13:01:07.750Z

## Scope

This isolated check drives the existing mainline-v2 product controller through `serve → flight → table contact → racket contact → return → result` while preserving canonical schema-2 BallState and world-space omega. It reads existing shared/core and mainline-v2 files; it does not modify them.

## Results

| Scenario | Result | Physical time | Contacts | Required events | omega.y preserved |
|---|---:|---:|---:|---:|---:|
| zero spin | pass | 1.308 s | 2 | yes | yes |
| omega.y + side spin | pass | 1.283 s | 2 | yes | yes |
| mixed omega | pass | 1.275 s | 2 | yes | yes |

Overall status: **pass**

## Boundary

The preview demonstrates engineering data flow and visible qualitative behavior. It is not a claim of material identification, measured trajectory agreement, product readiness, or formal mainline promotion.
