# Video Library Shell (prototype)

## Status

Batch video library + annotator prototype. Reads an entire folder of videos at
once, displays them in a browsable thumbnail grid grouped by category, and lets
you annotate each video with contact time, observation end, and an optional
entry point. Reuses all shared physics modules from the direction-c-annotator
without modifying it.

## How to use

Open `index.html` from Chrome or Edge (via `file://` double-click or a static
server). Click "選擇影片資料夾" and select your video directory (e.g. `images`).
All MP4/WebM/MOV files are loaded into the browser — nothing is uploaded.

The thumbnail grid appears, grouped by subfolder name. Each card shows a
thumbnail, filename, and a status badge:

- **Gray** — not yet annotated
- **Yellow** — draft saved
- **Green** — marked complete

Click any card to enter the annotator. Set the contact frame (T) and observation
end frame (E) using the transport controls. The entry point (yellow marker) is
optional — adjust it only if you want to run the C3 preview. Save the draft or
mark the video complete, then click "返回庫" to return to the grid.

Use "匯出全部草稿" to download all drafts as a single JSON manifest. Use
"匯入草稿" to restore a previously exported manifest.

## Architecture

```
video-library-shell/
  index.html              — library grid + embedded annotator (single page)
  library-app.js          — folder intake, grid, thumbnails, annotator logic
  library-contract.js     — index building, status tracking, manifest export/import
  library-contract.test.js — pure-logic tests (node, zero-dep)
  README.md
```

Reuses shared modules via relative script tags:

- `shared-physics-core.js` (repo root)
- `prototype-physics-bridge.js`, `projection-helper.js` (video-physics-timeline/)
- `direction-c-engine.js`, `entry-drag-controller.js` (direction-c/)
- `annotation-contract.js`, `preview-runtime.js` (direction-c-annotator/)

## Design decisions

- Entry point is optional: drafts can be saved and videos marked complete
  without adjusting the entry point. The C3 preview requires it.
- Editing a completed video and saving keeps it green (no revert to yellow).
- Status tracking uses localStorage: per-video draft keys (same keys as the
  single-video annotator) plus a separate completed-set key.
- Thumbnails are generated lazily from video first frames (max 3 concurrent).
- All output remains `annotation_status: "draft"` and `review_status:
  "pending_coach"`. No red-line config files are written.

## Run tests

```text
node prototypes/video-physics-timeline/tools/video-library-shell/library-contract.test.js
```

The existing annotator tests also still pass:

```text
node prototypes/video-physics-timeline/tools/direction-c-annotator/annotation-contract.test.js
node prototypes/video-physics-timeline/tools/direction-c-annotator/preview-runtime.test.js
```
