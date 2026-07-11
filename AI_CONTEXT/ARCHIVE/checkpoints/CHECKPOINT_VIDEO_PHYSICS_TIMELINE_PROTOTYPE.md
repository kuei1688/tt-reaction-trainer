# CHECKPOINT：隔離式影片—物理時間軸編排原型

日期：2026-07-10

## 結果

已完成隔離式時間軸編排原型。它證明兩組逐影片設定、純狀態機、事件驅動 Hit、三方向對手節奏、程序化替代球路與 Canvas／SVG 動畫可以串接；不代表正式物理整合、真實影片校準或 WebM 驗收完成。

本階段未接入主線，且停止於原型邊界。接回正式遊戲需另行評估與建立任務包。

## 新增檔案

- `prototypes/video-physics-timeline/SPEC.md`
- `prototypes/video-physics-timeline/index.html`
- `prototypes/video-physics-timeline/timeline-engine.js`
- `prototypes/video-physics-timeline/prototype-app.js`
- `prototypes/video-physics-timeline/timeline-config.json`
- `prototypes/video-physics-timeline/video-physics-timeline.test.js`
- `prototypes/video-physics-timeline/assets/README.md`
- `prototypes/video-physics-timeline/assets/opponent-prep.svg`
- `prototypes/video-physics-timeline/assets/opponent-counter.svg`
- `AI_CONTEXT/CHECKPOINT_VIDEO_PHYSICS_TIMELINE_PROTOTYPE.md`

依使用者要求，spec 與 Node 測試都位於 `prototypes/video-physics-timeline/`，未放入 `docs/` 或 `tools/`。

## WebM 決策狀態

`serve-short.webm` 與 `serve-long.webm` 的產製方式尚未定義，本輪未建立或偽造檔案。設定以 `generation_status: "pending_generation"` 明示，頁面使用程序化媒體時鐘與已知球點軌跡作替代。`assets/README.md` 記錄未來產製流程至少必須固定的版本、場景、解析度、幀率、codec、pixel format、seed、duration 與重跑命令。

因此以下仍為未驗收：真實 `<video>` metadata、WebM 解碼、兩支影片的 `currentTime` trigger `±0.05 秒`、真實影片 crossfade 畫面品質。不得以程序化替代結果宣稱這些項目通過。

## 自動驗證

命令：

```text
node prototypes/video-physics-timeline/video-physics-timeline.test.js
node --check prototypes/video-physics-timeline/timeline-engine.js
node --check prototypes/video-physics-timeline/prototype-app.js
git diff --check
```

結果：17 tests passed；兩個 JavaScript 檔案語法通過；`git diff --check` 通過。

測試涵蓋：兩組 trigger、跳時跨越、單次 trigger、無 Hit 停留、三方向選取、prep／delay 順序、單次 contact、單次 rally complete、Reset 舊 session 阻擋、事件 ID 唯一、缺欄位、負數、重複 ID、缺方向、正式路徑阻擋、pending WebM fallback 必填及 fallback UV 驗證。

## localhost 瀏覽器驗收

以 Chromium localhost 頁面操作程序化替代模式，已確認：

- 短版使用 1.25 秒 trigger，跨過後只產生一次 `VIDEO_TRIGGER_REACHED`。
- 長版使用 2.10 秒 trigger，跨過後只產生一次 trigger 並進入 Hit window。
- 兩者程序化 overlay handoff delta 顯示為 0.0 px；這只量測已知替代軌跡，不代表真實影片 anchor 誤差。
- Hit 後一個 frame 內進入 `OPPONENT_SEQUENCE/PREP` 並顯示預備 SVG。
- 事件順序為 `PLAYER_HIT → PREP_FINISHED → COUNTER_DELAY_FINISHED → COUNTER_CONTACT → RALLY_COMPLETE`，contact 一次。
- left／center／right 可選；瀏覽器實際操作了 center 與 right。
- trigger 後立即 Reset／重播連續執行 10 次，最後維持 `IDLE`，沒有殘留事件、對手圖或啟用的 Hit。
- console error／warning：0。

瀏覽器驗收後另修正兩項純顯示／session 清理：`IDLE`、`COMPLETE` 的 phase elapsed 固定為 0；事件時間改為 session 相對時間；直接開始新一輪時清空上一輪事件並重置 adapter。這些修正已再通過 Node 與語法檢查。

## 邊界核對

本輪沒有修改：

- `game4.html`
- `match-trainer.html`
- `shared-physics-core.js`
- `videos.json`
- `physics-presets.json`
- `return-studio.html`
- `physics-studio.html`
- `index.html`

開始前既有的 `AI_CONTEXT/test_output.txt` 修改及 `.claude/` 未追蹤內容保持不動，未納入本原型內容。

## 下一個合法步驟

先另行決定合成 WebM 的可重現產製契約，再產生兩支資產並執行真實 `<video>` 驗收。即使該驗收通過，也只能先建立主線接入評估／任務包，不能直接修改正式遊戲。

## 後續進展（2026-07-11）

合成 WebM 的產製契約已決定並完成，見 `AI_CONTEXT/CHECKPOINT_WEBM_GENERATOR.md`；shared-core physics bridge 已接上，見 `AI_CONTEXT/CHECKPOINT_VIDEO_PHYSICS_BRIDGE.md`；軌跡視覺化預覽器已建置，見 `AI_CONTEXT/CHECKPOINT_WEBM_PREVIEWER.md`。目前已開始「真實影片接上 physics handoff」的探索性實驗（單支題庫影片，尚未做 SPEC §8 定義的正式驗收），見 `AI_CONTEXT/CHECKPOINT_REAL_VIDEO_HANDOFF_EXPERIMENT.md`。主線接入評估仍未開始。
