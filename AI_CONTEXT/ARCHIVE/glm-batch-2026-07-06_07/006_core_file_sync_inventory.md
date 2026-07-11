# GLM 任務 006：核心檔案同步盤點

你是本專案的文件整理助理。請比較核心檔案中的物理模型與回擊/發球邏輯，產生同步盤點，不要修改程式，不要判斷哪一版正確。

## 輸入資料

請讀取：

- AI_CONTEXT/00_READ_ME_FIRST.md
- AI_CONTEXT/DRAFTS/physics_engine_v2_structured_summary.md
- AI_CONTEXT/DRAFTS/push_model_summary.md
- game4.html
- return-studio.html
- physics-studio.html
- physics-v2-calibration.html
- tools/physics-v2-contact-mechanics.js
- tools/racket-contact-mechanics.js

## 任務

請產生：

`AI_CONTEXT/DRAFTS/core_file_sync_inventory.md`

請比較以下主題在各檔案中的狀態：

1. 桌面反彈模型
2. 球拍接觸模型
3. 切球 push/adaptivePush 模型
4. 攻球 attack 模型
5. loop/拉球是否仍使用舊模型
6. blend / substepped / wristBrakeRate 等研究機制
7. 發球 simulateServe / preset solve 邏輯
8. 回擊 simulateReturn / returnBall 邏輯
9. 常數是否一致
10. UI/工具頁專用功能與正式遊戲功能的差異

## 輸出格式

- 先給總覽表
- 再按主題列出：檔案、函式/常數、狀態、差異、風險、需要 Codex 人工確認的問題
- 最後列出「不可直接下結論」的事項

## 限制

- 不要修改任何程式
- 不要宣稱某一版是正確版本
- 不要把工具頁研究功能誤寫成正式遊戲已部署
- 不確定請標示「不確定」
