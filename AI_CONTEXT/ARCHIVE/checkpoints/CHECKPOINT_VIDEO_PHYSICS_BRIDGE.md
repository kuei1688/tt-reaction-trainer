# CHECKPOINT：隔離原型 shared physics bridge

日期：2026-07-10

## 結果

隔離時間軸原型已從固定螢幕曲線改成 shared-core physics bridge。正式 `shared-physics-core.js` 未修改；原型只以 script dependency 讀取球桌／球網常數與 `bounceWithSpinPhysical()`。

`timeline-config.json` 的 `position_m`、`velocity_mps`、`spin_rps`、`gravity_mps2`、`hit_window_z_m` 現在都會進入固定 1/120 秒物理步進。兩組 handoff 初始狀態位於過網後、接球方第一次落桌前，正常流程各觸發一次含旋轉桌面反彈，再進入玩家 hit window。

這仍不是主線整合，也未讀取 `physics-presets.json`；使用的是隔離原型自己的逐支初始狀態。

## 視覺修正

- 接球方視角改為遠端桌邊在上且較窄、近端桌邊在下且較寬。
- `z=0` 的中央球網加入實際高度、上緣、兩側網柱與網格。
- 世界座標球路依桌面透視投影到 Canvas。
- 第一個物理 frame 仍以 handoff offset 對齊影片 anchor，offset 在 crossfade 期間退回真正世界投影。
- WebM renderer 使用同一組桌面方向與球網構圖，兩支 WebM 已重建。

## 驗證

- `prototype-physics-bridge.test.js`：8/8 通過。
- `video-physics-timeline.test.js`：18/18 通過。
- `webm-generator.test.mjs`：10/10 通過。
- 瀏覽器流程：物理位置與速度持續更新，短版完整 rally 到 `COMPLETE`；長版使用不同 position／velocity 且 trigger 一次。
- 最後的 handoff 參數微調由 Node 固定步進驗證：短版與長版各落桌一次後進入 hit window，均未提前停止。
- Overlay handoff delta：0.0 px。
- 瀏覽器 console error／warning：0。
- 修正後桌面透視與中央球網已以實際 localhost screenshot 目視驗收；最後一次 physics-only config 重載被 in-app localhost 安全政策阻擋，未繞過。
- WebM 的 render inputs（serve id 與 video 區塊）在調整 physics 前後 SHA-256 都是 `a8d2b0676fc748c1972351b5c1336a732b090c978b33272129ea4ac223b8cb18`，所以前一輪已驗證影片仍對應相同 render inputs；report 另保留生成當時完整 timeline config hash。

## 停止線

原型 bridge 複用 shared core，但不代表 `game4.html` 已接入此時間軸，也不代表這兩組發球初始狀態已完成真實校準。`physics-presets.json`、正式遊戲頁、正式核心與 `videos.json` 均未修改。

## 後續修正（2026-07-11）

上方「驗證」一節記錄的「Overlay handoff delta：0.0 px」是顯示層 bug：`PhysicsAdapter.startServe()` 把 `overlayDeltaPx` 寫死為 `0`，從未依 `handoffOffset` 實際計算，導致不論真實誤差多大都顯示零。已於 2026-07-11 修正為 `Math.hypot(handoffOffset.x, handoffOffset.y)`。此修正不影響本檔其餘驗證結果（frame 對齊、shared-core 物理積分、事件序列），只影響這一項顯示數字的真實性。詳見 `AI_CONTEXT/CHECKPOINT_REAL_VIDEO_HANDOFF_EXPERIMENT.md`。
