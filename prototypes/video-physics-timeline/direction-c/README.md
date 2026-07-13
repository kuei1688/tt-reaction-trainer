# Direction C mobile visual experiment

This isolated page tests only the product meaning of a clear camera change: the table remains visible while the real-video observation layer plays through the post-contact follow-through, then exactly one fixed-entry training ball appears.

- C1 starts the training ball immediately after the configured video observation ends.
- C2 uses the same conditions but adds a 100 ms explicit exit after that observation ends.
- C3 starts the fixed-entry training ball at contact while the remaining video plays and fades out. It deliberately permits two balls to be visible, solely to assess visual interference.
- The fixed source is `real_backspin_001`; the fixed gameplay-approximation profile is `prototype_short`.

It does not calibrate the real video, alter physics values, represent a Trainer integration, or establish a physical-continuity claim.

The recorded human-review outcome is in [RESULT.md](./RESULT.md). C3 is the current preferred **prototype** presentation condition.

Run the state-machine check with:

```text
node prototypes/video-physics-timeline/direction-c/direction-c-engine.test.js
```
