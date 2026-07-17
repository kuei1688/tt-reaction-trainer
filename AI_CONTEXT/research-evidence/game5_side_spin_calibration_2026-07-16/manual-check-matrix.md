# G10 manual video / browser check matrix

> This is a required human-observation record. Numerical sweep output cannot prove camera viewpoint, visual curve direction, or Game 5 gesture semantics.

| Video ID | Category | Viewpoint | Spin label | Curve direction | Contact frame/time | Game 5 gesture matches | Confidence | Evidence |
|---|---|---|---|---|---|---|---|---|
| contact_sidebackspin_003 | contact_sidebackspin_right | unresolved | metadata only | left | 1.1667 s (metadata) | blocked | low | declared `src=images/contact_sidebackspin_right/contact_sidebackspin_002.mp4`; ID/file naming is offset |
| contact_sidebackspin_004 | contact_sidebackspin_left | unresolved | metadata only | right | 0.5167 s (metadata) | blocked | low | declared `src=images/contact_sidebackspin_left/contact_sidebackspin_003.mp4`; ID/file naming is offset |
| contact_backspin_005 | contact_backspin | unresolved | metadata only | none | 1.0000 s (metadata) | blocked | low | declared `src=images/contact_backspin/contact_backspin_004.mp4`; ID/file naming is offset |
| contact_sidespin_002 | contact_sidespin_left | unresolved | metadata only | right | 0.5000 s (metadata) | blocked | low | declared `src=images/contact_sidespin_left/contact_sidespin_001.mp4`; ID/file naming is offset |
| contact_sidespin_020 | contact_sidespin_right | unresolved | metadata only | left | 0.7667 s (metadata) | blocked | low | declared `src=images/contact_sidespin_right/contact_sidespin_019.mp4`; ID/file naming is offset |
| contact_nospin_004 | contact_nospin | unresolved | metadata only | none | 0.8333 s (metadata) | blocked | low | declared `src=images/contact_nospin/contact_nospin_003.mp4`; ID/file naming is offset |

## Browser evidence

- Browser page: `game5.html` served locally.
- Page load passed and the active video card was visually captured in the browser. The video element reached `readyState=4` and played in the card.
- Six random Game 5 rounds were sampled. Observed metadata/source pairs included `contact_sidespin_007 → contact_sidespin_006.mp4`, `contact_backspin_006 → contact_backspin_005.mp4`, `contact_sidespin_021 → contact_sidespin_020.mp4`, `contact_sidebackspin_006 → contact_sidebackspin_005.mp4`, `contact_sidespin_018 → contact_sidespin_017.mp4`, and `contact_sidespin_017 → contact_sidespin_016.mp4`.
- Because the representative metadata IDs and loaded file names are offset, viewpoint, visual spin direction, curve direction, and gesture agreement cannot be honestly marked as confirmed. Fix or explain the ID/source contract, then repeat G10 with the six named clips.
- Browser screenshot was captured during an active video handoff in the execution session; no screenshot file is claimed here because the browser tool returned it as session evidence only.
