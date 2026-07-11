DRAFT: Physics engine structured summary
#
# Status: draft only.
# This file is a summary and must not be treated as the final specification.
# Last touched: 2026-07-06

# physics-engine-v2-plan 結構化摘要

## 1. 狀態分類說明

依據專案文件整理，將各項發展內容分類為以下六種狀態：

1. **已部署到核心檔案**：已正式寫入 `game4.html`、`return-studio.html` 或 `physics-presets.json` 等核心檔案。
2. **只在研究版或工具頁驗證**：在 `tools/`、`physics-v2-calibration.html` 或 `return-studio.html` 的特定研究功能中驗證，尚未正式成為預設行為。
3. **已被後續取代**：曾經使用或驗證過，但已被新的物理模型或公式取代。
4. **待驗證**：已有初步結果或原型，但尚未通過完整驗證或未寫入正式檔案。
5. **不確定或需要人類確認**：涉及物理假設、人類手感或需要使用者決策的事項。
6. **路徑分歧或同步風險**：不同檔案或分支間存在不一致的風險。

---

## 2. 時間線 / Phase 對照表

| Phase / Stage | 狀態 | 涉及檔案 | 簡述 |
|---|---|---|---|
| Phase 0 | 已部署到核心檔案 | `docs/`, `physics-presets.json` | 座標與單位規格定案，旋轉單位改為 rad/s。 |
| Phase 1 | 只在研究版或工具頁驗證 | `tools/physics-v2-contact-mechanics.js` | 獨立接觸力學函式驗證。 |
| Phase 2 | 已部署到核心檔案 | `tools/`, `physics-v2-calibration.html` | 摩擦係數 μ 校準，動態 ε 實作。 |
| Phase 3 | 已部署到核心檔案 | `physics-presets.json` | 16 顆發球換算成真實單位。 |
| Phase 4 | 已部署到核心檔案 | `game4.html`, `return-studio.html` | 整合新引擎進主要頁面。 |
| Phase 5 | 已被後續取代 / 待驗證 | `game4.html`, `return-studio.html` | 重新驗證，發現回擊不感知旋轉問題，部分校準被 Phase 6 取代。 |
| Phase 6 | 已部署到核心檔案 / 待驗證 | `game4.html`, `return-studio.html`, `tools/racket-contact-mechanics.js` | 球拍接觸力學、技術等級、範圍解模式、連續對打探索。 |
| Phase 7 | 不確定 | `docs/` | 收尾與文件化，尚未完成。 |
| Stage 1 | 待驗證 | `return-studio.html`, `push-optimizer.js` | 球拍速度尺度校準，引入 scale 因子與 outputRescale。 |
| Stage 2 | 待驗證 | `return-studio.html`, `push-optimizer.js` | 揮拍方向、摩擦係數、力道、拍面角度聯合校準，引入 blend 機制。 |
| Stage 3/4 | 不確定 | `return-studio.html` | 接觸期間球拍加速與海綿彈性儲能，規劃與原型驗證中。 |

---

## 3. 各階段詳細狀態與涉及檔案

### Phase 0：資料結構與約定設計
- **狀態**：已部署到核心檔案
- **涉及檔案**：`docs/physics-engine-v2-plan.md`, `physics-presets.json`
- **內容**：座標系統定義、單位改為 rad/s、下旋基準 20 rps 錨點定案。

### Phase 1：獨立的接觸力學函式
- **狀態**：只在研究版或工具頁驗證
- **涉及檔案**：`tools/physics-v2-contact-mechanics.js`
- **內容**：實作入射角判斷、純滾動/打滑分支。單元測試 13 通過 / 0 失敗。

### Phase 2：摩擦係數 μ 校準
- **狀態**：已部署到核心檔案
- **涉及檔案**：`tools/physics-v2-contact-mechanics.js`, `physics-v2-calibration.html`
- **內容**：定案 `μ = 0.13`，實作動態 `ε`（依撞擊角度與旋轉調整）。

### Phase 3：既有 16 顆發球換算成真實單位
- **狀態**：已部署到核心檔案
- **涉及檔案**：`physics-presets.json`
- **內容**：主群集統一 `topspin=-125.66`，修正側旋方向與遺留測試值。

### Phase 4：整合進 game4.html + return-studio.html
- **狀態**：已部署到核心檔案
- **涉及檔案**：`game4.html`, `return-studio.html`
- **內容**：正式換上新引擎，取代舊的 `applyBounceSpin()`。

### Phase 5：全面重新驗證
- **狀態**：已被後續取代 / 待驗證
- **涉及檔案**：`game4.html`, `return-studio.html`
- **內容**：發現 3 顆重下旋 preset 過不了網（已知問題，暫不處理）。`techniqueVel` 校準結果被 Phase 6 取代。

### Phase 6：球拍接觸力學
- **狀態**：已部署到核心檔案 / 待驗證
- **涉及檔案**：`game4.html`, `return-studio.html`, `tools/racket-contact-mechanics.js`
- **內容**：
  - **已部署**：球拍接觸力學、速度相依反彈係數、回擊技術等級、範圍解模式、拍面角度與揮拍方向解耦、修正回擊起點抬高 0.12m、拍面平面角度改為相對揮拍方向、瞄準機制升級（打直改為瞄準落地點）、連續對打負回饋控制律。
  - **待驗證/研究中**：連續對打模式卡住（技術模型需重新設計）、切球沒有真的製造反向下旋問題。

### Phase 7：收尾與文件化
- **狀態**：不確定
- **涉及檔案**：`docs/physics-engine-v2-plan.md`, `README.md`
- **內容**：尚未完成。

### Stage 1：球拍速度尺度校準
- **狀態**：待驗證
- **涉及檔案**：`return-studio.html`, `push-optimizer.js` (Node 腳本)
- **內容**：發現需連同來球速度一起等比例放大（`scale` 因子），內部尺度轉換，不動發球可見速度。引入 `outputRescale` 縮小輸出速度。目前最佳候選 `okCount=9, correctCount=14`。

### Stage 2：揮拍方向+摩擦係數+力道/拍面角度聯合校準
- **狀態**：待驗證
- **涉及檔案**：`return-studio.html`, `push-optimizer.js`
- **內容**：引入 `blend`（反彈方向與切向滑動耦合）機制。發現 `tiltX` hack 不合理，改為 y-z 限制 blend。目前最佳候選 `okCount=11, correctCount=12`。

### Stage 3/4：接觸期間球拍加速/海綿彈性儲能
- **狀態**：不確定
- **涉及檔案**：`return-studio.html` (原型)
- **內容**：規劃中，原型驗證彈簧-阻尼法向碰撞，發現 catapult 效應是「損失得比較少」而非免費能量。

---

## 4. 已知測試或驗證方式

- **獨立 Node 腳本單元測試**：
  - `node tools/physics-v2-contact-mechanics.js`：13 通過 / 0 失敗。
  - `node tools/racket-contact-mechanics.js`：桌面退化案例對拍驗證。
- **批次驗證**：
  - 16 顆發球 preset 的發球軌跡驗證（`simulateServe()`）。
  - attack/push/loop 對 16 顆 preset 的回擊批次驗證。
  - 16 顆發球沿彈跳後下降窗口的切球取樣測試（196、516 樣本）。
- **連續對打驗證**：
  - 連續對打展示/穩定性驗證，部分版本可讓 13/16 顆達到 200+ 拍。
- **Node 優化腳本搜尋**：
  - `push-optimizer.js` 進行隨機搜尋+座標爬山法，尋找最佳參數組合。

---

## 5. 已知失敗案例

- **3 顆重下旋 preset 過不了網**：`backspin_long_backhand`、`backspin_short_forehand`、`backspin_short_forehand_2` 在新引擎下水平動能衰減過多。使用者已確認暫不處理。
- **連續對打模式失敗**：技術模型泛化到連續對打時失效，球速超出校準範圍，單一「切球」技術無法涵蓋所有距離/球速。
- **切球沒有真的製造反向下旋**：連續對打中旋轉逐漸變成上旋，發現摩擦力/球拍動力學建模的根本落差。
- **Stage 2 聯合搜尋準確率與旋轉方向互斥**：在原尺度下，無法同時滿足「過網準確率」與「旋轉方向正確」。
- **反手側旋旋轉方向錯誤**：`sidebackspin_half_long_backhand`、`sidebackspin_long_backhand` 等反手側旋系列旋轉方向持續錯誤。
- **6 顆過網失敗（垂直分量異常偏高）**：`sidebackspin_half_long_backhand`、`sidebackspin_long_backhand` 等 6 顆球出球垂直速度偏高，導致飛行距離過遠。

---

## 6. 已被推翻或取代的結論

- **Phase 5 的 `techniqueVel` 校準**：第一版校準只用「盡量讓球過網」當目標，完全沒考慮旋轉，已被 Phase 6 的球拍接觸力學取代。
- **切球固定角度／`speedScaledZ`**：被「拍面角度＋力道聯合控制律」取代，時機窗口成功率從 6% 提升到 41%。
- **拍面角度＋力道聯合公式**：被「拍面角度與揮拍方向解耦」的新架構取代，理論上限從 41% 提升到 46%。
- **舊的 `tiltX` 回歸公式**：被「真正瞄準落地點」的 `solveRacketVelXForTargetLandingX()` 取代。
- **`tiltX` hack（拍面誇張旋轉修正反手側旋）**：被發現是不合理的機制，已改為「`blend` 只看 y-z 平面」修正。
- **「切球對下旋不敏感是缺點」的判斷**：使用者修正為「切球是對付下旋的專門技術，成功率提高是往正確方向修正」。
- **「合力/timing 能無中生有創造效率」的假設**：彈簧-阻尼原型驗證發現，catapult 效應是「能量損失得比較少」，而非免費能量。

---

## 7. 路徑分歧或同步風險

- **`game4.html` 與 `return-studio.html` 同步狀態**：不確定兩者目前的物理邏輯是否完全同步。`return-studio.html` 含有 `PADDLE_BLEND`、substepped push 等研究機制，`game4.html` 的可見段落看起來不完全一致。
- **Codex 平行分支路徑分歧**：Codex 在另一個本機路徑工作，修改了 `return-studio.html` 研究版（引入 `dwell_grip` 接觸模型），未動 `game4.html`。下次交接前需確認兩邊是否同步。
- **`physics-studio.html` 的物理引擎**：已改成真實 v2 引擎以避免兩套物理不一致。
- **Node 優化腳本與真實引擎的差異**：`push-optimizer.js` 內部的桌面反彈物理是簡化版，不完全等於正式引擎，算出的分數僅供參考，需回真實引擎驗證。

---

## 8. 給 Codex 下一輪審查的問題清單

1. **檔案同步確認**：`game4.html` 與 `return-studio.html` 目前的物理邏輯是否完全同步？`return-studio.html` 中的 `PADDLE_BLEND`、substepped push 等研究機制是否已寫入 `game4.html`？
2. **Stage 1 參數定案**：`scale` 因子與 `outputRescale` 的最終參數值為何？如何確保內部尺度轉換不影響發球本身的視覺效果與時間軸？
3. **Stage 2 架構實作**：y-z 限制 blend 的乾淨架構是否已正式寫進 `return-studio.html` 研究版？`push-optimizer.js` 中的 `computeCorrectiveTiltX` 相關程式碼是否已移除？
4. **短球力道公式診斷**：短球（來球速度慢）被力道公式推到比下限更高的力道值，導致過網失敗，此行為是否合理？應如何修正力道公式對慢速來球的反應？
5. **反手側旋根因**：反手側旋系列旋轉方向錯誤的根因是否已完全解決？y-z 限制 blend 是否足以修正所有反手側旋案例？
6. **`blend=0.9` 的最終地位**：文件中提到 `blend=0.9` 或高 blend 值曾被用來改善結果，但接手指令明確要求不可視為最終物理解。Codex 下一輪應如何評估 blend 機制的物理合理性？
7. **弱旋轉/不轉球技術模型**：弱旋轉/不轉球是否應改用其他技術模型（如上旋拉球或撥球擋球），而非硬套切球公式？此決策需人類確認。
8. **膠皮/海綿參數化**：膠皮/海綿參數化構想如何整合進現有架構？是否應覆寫既有 `epsilon` 和 `friction` 參數，並與 Stage 2 一起聯合校準？
9. **Codex 平行分支整合**：Codex 在平行分支開發的 `dwell_grip` 接觸模型與 `contactOffset` 偏移，文件指出 `contactOffset` 有物理錯誤，應如何處理或退回？
10. **連續對打模式**：連續對打模式卡住的案例（球速超出訓練範圍），是否需要專門收集更高球速範圍的真實樣本重新擬合，或另開 session 處理？
