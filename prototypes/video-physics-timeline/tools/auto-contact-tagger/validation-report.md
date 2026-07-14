# auto-contact-tagger 實機驗證報告

日期：2026-07-15

## 環境

- Ollama：本地 `127.0.0.1:11434`（原生 `/api/chat`）
- 模型：`kimi-k2.7-code:cloud`（reasoning，思考開啟）
- ffmpeg：PATH（winget Gyan.FFmpeg 8.1.2）
- 影格：60fps，全片抽幀

## 驗證集

| 影片 | 人工真值 | 來源 |
|---|---|---|
| `serve-real-backspin-001.mp4`（real_backspin_001） | 4.300s（frame 258） | `CHECKPOINT_REAL_VIDEO_HANDOFF_EXPERIMENT.md` 逐幀視覺判讀 |

目前僅這 1 支有人工真值。計畫 §9.1 要求 2–4 支才能判定量產。

## 結果

| 影片 | 腳本偵測 | 誤差 | 信心 | stage | via | 警告 |
|---|---|---|---|---|---|---|
| real_backspin_001 | 4.350s | 3 frame（50ms）偏晚 | 0.85 | fine | contact | 無 |

- `error_frames = round(|4.350 - 4.300| * 60) = 3`
- 方向：偏晚（+0.050s）

## 達標判準（計畫 §9.3）

- 可量產：所有影片 ≤ 3 frame 且 ≥80% ≤ 1 frame。
- 本次：1/1 影片 ≤ 3 frame（通過邊界），但 0/1 ≤ 1 frame。
- **結論：初步結果可信，但樣本不足，無法判定量產**。需另請教練為 2–4 支影片標記真值後重測。

## 重要發現：think:false 不可用

`kimi-k2.7-code:cloud` 是 reasoning 模型。實測：

- 關閉思考（`think:false`）：模型把 3.5s–4.5s 所有幀一律判成 `before_contact`，
  完全無法區分觸球前後。原因：不思考時模型直接猜最安全的「球還沒碰到」。
  結果粗掃找不到邊界、細掃全 before，偵測退到影片末幀（4.567s，誤差 16 frame）。
- 開啟思考（預設）：4.0s→before_contact、4.3s→contact、4.567s→unclear，
  能正確區分。代價是每次呼叫 ~6–11s。

因此 vision-backend 刻意不設 `think:false`。批次量產的加速（更快的 vision 模型、
更少呼叫、`--hint` 縮窗）列為 Phase 2 課題。

## 重現

```text
node auto-contact-tagger.js prototypes/video-physics-timeline/assets/serve-real-backspin-001.mp4 \
  --model kimi-k2.7-code:cloud --out real_backspin_001.draft.json --rate-limit 10
```

輸出 `real_backspin_001.draft.json`（已隨本工具 commit，作為驗證產物）。