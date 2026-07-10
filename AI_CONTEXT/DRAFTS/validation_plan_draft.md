DRAFT: Validation plan
#
# Status: draft only.
# This file is a candidate validation plan and must not be treated as a committed workflow.
# Last touched: 2026-07-06

# 驗證計畫草稿

> **狀態聲明：** 本文件僅根據使用者提供的輸入整理，不新增事實，不做最終物理判斷。所有數字來自既有文件紀錄，未經重新執行驗證。標示「不確定」者表示原文未明確記載或需進一步確認。

---

## 1. 目前可重跑的驗證種類

| 編號 | 驗證種類 | 可重跑性 | 備註 |
|---|---|---|---|
| V-01 | 桌面接觸力學單元測試 | 可重跑（獨立 Node 腳本） | 文件記錄 13 通過 / 0 失敗 |
| V-02 | 球拍接觸力學對拍驗證 | 可重跑（獨立 Node 腳本） | 桌面退化案例一致性 |
| V-03 | 發球軌跡批次驗證 | 可重跑（瀏覽器內函式） | 16 顆 preset |
| V-04 | 回擊單拍批次驗證 | 可重跑（瀏覽器內函式） | 16 顆 × 多種技術 |
| V-05 | 切球時機窗口取樣驗證 | 可重跑（瀏覽器內函式） | 196 / 516 樣本 |
| V-06 | 連續對打穩定性驗證 | 可重跑（`return-studio.html`） | 最多 60 拍展示 |
| V-07 | 範圍解模式驗證 | 可重跑（瀏覽器內函式） | 13 顆 × 10 次試驗 |
| V-08 | 參數聯合搜尋驗證 | 可重跑（`push-optimizer.js`） | 不確定此檔案是否在 repo 追蹤中 |
| V-09 | 視覺軌跡檢查 | 可重跑（`return-studio.html` 3D 畫面） | 主觀判斷 |
| V-10 | 敏感度掃描驗證 | 可重跑（`return-studio.html`） | 單參數掃描 |
| V-11 | 旋轉方向正確性驗證 | 可重跑（瀏覽器內函式） | `correctSpinFrac` 指標 |
| V-12 | 檔案同步一致性驗證 | 尚未存在（需新增工具） | `game4.html` vs `return-studio.html` diff |

---

## 2. 每種驗證的目的

| 編號 | 目的 |
|---|---|
| V-01 | 驗證桌面接觸力學函式（`bounceWithSpinPhysical`）在零旋轉、下旋、上旋、純滾動/打滑等分支的行為符合物理預期 |
| V-02 | 驗證通用版球拍接觸力學（`bounceOffPlane`）在退化為桌面條件時，跟已驗證的桌面版本完全一致 |
| V-03 | 驗證 16 顆發球 preset 在新引擎下的發球軌跡（第一跳、第二跳、過網高度）是否命中目標 |
| V-04 | 驗證攻球/切球/拉球對 16 顆 preset 的回擊是否成功過網並落在對方桌面界內 |
| V-05 | 驗證切球在彈跳後整個下降窗口的成功率（容錯率），不只單一擊球點 |
| V-06 | 驗證連續對打在固定參數下能否穩定持續，觀察旋轉衰減/反轉、球速收斂、落點規律 |
| V-07 | 驗證範圍解模式加入隨機抖動後，成功率是否仍在合理範圍內（不會做出明知不可行的動作） |
| V-08 | 在參數空間中搜尋最佳參數組合，評估 `okCount`（過網成功數）與 `correctCount`（旋轉方向正確數） |
| V-09 | 用眼睛直接看 3D 軌跡形狀，檢查弧線高度、落點合理性、是否有「子彈感」等異常 |
| V-10 | 對單一參數做獨立敏感度掃描，畫出參數與輸出指標的關係圖 |
| V-11 | 驗證切球回擊後的旋轉方向是否正確（應為反向下旋，不應反轉為上旋） |
| V-12 | 確認 `game4.html` 與 `return-studio.html` 的物理邏輯是否完全同步 |

---

## 3. 對應檔案或函式

| 編號 | 對應檔案 | 對應函式 / 機制 |
|---|---|---|
| V-01 | `tools/physics-v2-contact-mechanics.js` | `bounceWithSpinPhysical()`, `bounceTangentialAxis()`, `dynamicEpsilon()`, 內嵌單元測試區塊 |
| V-02 | `tools/racket-contact-mechanics.js` | `bounceOffPlane()`, `bounceWithSpinPhysical()`（對照組）, 內嵌驗證區塊 |
| V-03 | `game4.html`, `return-studio.html`, `physics-studio.html` | `simulateServe()`, `solveServeBounceVelocity()`, `serveBounceScore()`, `getServeBounces()` |
| V-04 | `game4.html`, `return-studio.html` | `simulateReturnForPreset()`, `makeReturnVelocity()`, `makeRacketReturnVelocity()`, `judgeReturn()` / `judgeResult()` |
| V-05 | `game4.html`, `return-studio.html` | `findPushHitIndex()`, `simulatePath()`, 沿窗口逐點取樣邏輯 |
| V-06 | `return-studio.html` | `runRallyReal()`, `startRally()`, 鏡射座標系 `mirrorVec()` / `mirrorSpin()` |
| V-07 | `game4.html`, `return-studio.html` | `applyExecutionVariance()`, `RANGE_SOLUTION_MODE` 開關 |
| V-08 | `push-optimizer.js`（不確定是否在 repo 追蹤中） | 隨機搜尋 + 座標爬山法，內含簡化版桌面反彈物理 |
| V-09 | `return-studio.html` | 3D 場景 `scenes[]`, `setLine()`, `updateSwingArrows()` |
| V-10 | `return-studio.html` | 參數掃描手動操作（`DISABLE_AIM_CORRECTION` 等） |
| V-11 | `return-studio.html`, `push-optimizer.js` | `correctSpinFrac` 計算邏輯（不確定具體函式名） |
| V-12 | `game4.html`, `return-studio.html` | 需新增專門 diff 工具 |

---

## 4. 前置條件

| 編號 | 前置條件 |
|---|---|
| V-01 | Node.js 環境；不需瀏覽器；不需 `physics-presets.json` |
| V-02 | Node.js 環境；不需瀏覽器；不需 `physics-presets.json` |
| V-03 | 瀏覽器環境；需載入 `physics-presets.json`；需 `vendor/three.r128.min.js` |
| V-04 | 同 V-03；需 `physics-presets.json` 中 preset 的 `variation.spin` 已換算為 rad/s |
| V-05 | 同 V-04；需確認 `findPushHitIndex()` 邏輯與目前部署版本一致 |
| V-06 | 同 V-04；`return-studio.html` 需能正常載入 `physics-presets.json` |
| V-07 | 同 V-04；需確認 `executionVariance` 數值與目前部署版本一致 |
| V-08 | Node.js 環境；需 `push-optimizer.js` 存在且可執行；不確定是否需要額外依賴 |
| V-09 | 瀏覽器環境；`return-studio.html` 需能正常渲染 3D 場景 |
| V-10 | 同 V-09；需手動操作參數欄位 |
| V-11 | 同 V-04；需能讀取回擊後的 `spin.topspin` 值 |
| V-12 | 需新增專門 diff 工具腳本；目前不存在 |

### 共通前置條件

- 所有瀏覽器驗證：頁面不在背景分頁（`document.hidden === true` 會暫停 `requestAnimationFrame`，文件有記錄此問題）
- 所有批次驗證：需確認 `gravity` 值（目前 `physics-presets.json` 常見 `gravity: -4.2`，是否為正式設計值不確定）
- 所有涉及切球的驗證：需確認 `game4.html` 與 `return-studio.html` 的切球邏輯是否同步（不確定）

---

## 5. 預期輸出格式

| 編號 | 預期輸出格式 |
|---|---|
| V-01 | console 文字輸出：每項測試 `[OK]` 或 `[FAIL]`，結尾 `總結：N 通過 / M 失敗` |
| V-02 | console 文字輸出：每項 `checkEqual()` 結果 `[OK]` 或 `[FAIL]`，結尾 `=== 全部通過 ===` 或 `=== 有失敗 ===` |
| V-03 | 物件 `{points, velocities, spins, bounces, netY, netHit, firstLanding, groundLanding}`；可從 `bounces` 提取第一跳/第二跳座標，從 `netY` 提取過網高度 |
| V-04 | 物件 `{servePathPoints, hitPoint, hitVel, result}`；`judgeResult()` 回傳 `{ok, reason, firstBounce, netClearance}` |
| V-05 | 逐點成功率列表（每個取樣點的過網/落點判定）；彙整為 `N/M 成功` |
| V-06 | `{segments, rounds, failReason}`；`rounds` 為連續拍數，`failReason` 為 `'掛網'` / `'出界'` / `'找不到下一次擊球點'` / `null` |
| V-07 | 逐次試驗的成功/失敗；彙整為 `push 81/130`、`attack 30/130` 等格式 |
| V-08 | `{okCount, correctCount, total}` 或類似評分物件；最佳候選參數組合 |
| V-09 | 3D 畫面視覺結果（主觀判斷）；螢幕截圖 |
| V-10 | 參數-指標對照表或曲線（手動記錄） |
| V-11 | `correctSpinFrac`（旋轉方向正確比例，0~1）；逐顆 `topspin` 值列表 |
| V-12 | 不確定（尚未定義） |

---

## 6. 不應該用來判斷的指標

| 指標 | 不應用來判斷的原因 |
|---|---|
| `blend=0.9` 或高 blend 值單獨作為「最終物理解」 | 接手指令明確要求不可視為最終物理解；高 blend 可能補償缺少的 tangential compliance、contact-point velocity、finite racket mass / passive giving 等機制 |
| `push-optimizer.js` 的分數單獨作為正式引擎驗證結果 | 內部桌面反彈物理是簡化版，不完全等於正式引擎，算出的分數僅供參考 |
| 單獨的「過網成功率」不檢查旋轉方向 | EXP-025 已證實評分函式漏洞：只看上桌不看旋轉方向，會找到旋轉方向完全錯誤的參數組合 |
| 單獨調整摩擦係數 `PADDLE_FRICTION` 的效果 | EXP-024 已證實單獨換摩擦係數會讓上層所有公式一起跑掉，必須聯合校準 |
| 單獨調整 `swingDirection.y` 正負號的效果 | EXP-023 已證實光換揮拍方向會讓其他公式全垮，需聯合校準 |
| `tiltX` 拍面誇張旋轉作為正常切球機制 | EXP-037 已確認此為不合理機制，已被「blend 只看 y-z 平面」取代 |
| 連續對打拍數單獨作為模型正確性判斷 | 旋轉會逐拍衰減甚至反轉成上旋（EXP-023），拍數穩定不代表旋轉正確 |
| `no_spin` 兩顆的切球成功率作為切球技術校準指標 | EXP-025 已修正：弱旋轉/不轉球不應硬套切球公式，已從 Stage 2 校準範圍排除 |
| 視覺檢查單獨作為物理正確性判斷 | 主觀判斷，需與數據指標交叉驗證 |
| `gravity: -4.2` 作為已確認的正式設計值 | 是否為正式設計值不確定，需進一步確認 |
| `wristBrakeRate` 作為已確認的有效正式機制 | 是否為有效正式機制不確定，需整理確認 |
| `scale` / `outputRescale` 的物理意義作為已確認結論 | 物理意義不確定，代表模型漏掉的物理效應還是應分別建模待判斷 |
| `PADDLE_SPRING_K` / `PADDLE_DAMPING_RATIO` 的確切預設值 | 研究版常數，確切預設值不確定 |
| `BLADE_NODE_MASS` / `BLADE_SPRING_K` / `BLADE_DAMPING_RATIO` 作為已校準值 | 均為工程估計，之後應重新校準 |
| `TANGENT_KP` 作為已校準值 | 套進專案單位系統後需要重新校準的工程估計值 |

---

## 7. 需要新增工具腳本但尚未存在的驗證

| 編號 | 驗證名稱 | 需求描述 | 優先級 |
|---|---|---|---|
| N-01 | `game4.html` 與 `return-studio.html` 物理邏輯 diff | 逐函式比對兩檔案的物理相關函式（`bounceWithSpinPhysical`, `bounceOffPlane`, `bounceOffPlaneSubstepped`, `makeRacketReturnVelocity`, `computeAdaptivePushMagnitude`, `computeAdaptivePushTiltY` 等），列出差異 | 高 |
| N-02 | 獨立批次回擊驗證腳本 | 可在 Node.js 或無頭瀏覽器中跑 16 顆 preset × 多種技術的批次驗證，輸出結構化 JSON 結果（不需手動操作瀏覽器） | 高 |
| N-03 | 旋轉方向正確性自動驗證腳本 | 逐顆檢查回擊後 `spin.topspin` 的正負號是否符合預期（切球應為負值），輸出 `correctSpinFrac` | 高 |
| N-04 | 連續對打旋轉追蹤腳本 | 逐拍記錄旋轉值變化，輸出旋轉衰減/反轉曲線 | 中 |
| N-05 | 切球時機窗口自動取樣腳本 | 沿彈跳後下降窗口自動逐點取樣，輸出每點的成功/失敗 + 旋轉方向 | 中 |
| N-06 | 參數敏感度自動掃描腳本 | 對指定參數在指定範圍內自動掃描，輸出參數-指標對照表 | 中 |
| N-07 | `physics-presets.json` 單位一致性檢查腳本 | 檢查所有 preset 的 `spin` 值是否為 rad/s、`gravity` 值是否一致 | 低 |
| N-08 | `return-studio.html` 研究版常數清單提取腳本 | 自動提取 `PADDLE_BLEND`, `PADDLE_SPRING_K`, `PADDLE_DAMPING_RATIO`, `TANGENT_KP`, `BLADE_*` 等研究版常數，與 `game4.html` 比對 | 中 |

---

## 8. 第一輪不該跑的高風險驗證

| 編號 | 驗證種類 | 高風險原因 |
|---|---|---|
| V-08 | 參數聯合搜尋驗證（`push-optimizer.js`） | 1. 不確定此檔案是否在 repo 追蹤中；2. 內部物理是簡化版，結果僅供參考；3. 搜尋目標函式設計尚未定案（硬性雙門檻 vs Pareto 多目標）；4. 可能產生誤導性的「最佳參數」 |
| V-06 | 連續對打穩定性驗證（完整 60 拍） | 1. 旋轉衰減/反轉問題未解決；2. `game4.html` 與 `return-studio.html` 同步狀態不確定；3. 連續對打技術模型需重新設計（EXP-012 已確認失效） |
| V-10 | 敏感度掃描驗證（涉及 `blend` / `scale` / `outputRescale`） | 1. 這些參數的物理意義不確定；2. 掃描結果可能被誤解為物理結論；3. 需高階模型先確認參數的物理合理性 |
| V-11 | 旋轉方向正確性驗證（在 `return-studio.html` 研究版上） | 1. `return-studio.html` 含有 `PADDLE_BLEND`、`bounceOffPlaneSubstepped` 等研究機制，與 `game4.html` 可能不同步；2. 結果可能不適用於正式遊戲 |
| N-01 | 檔案同步一致性驗證 | 1. 需先新增工具腳本；2. 可能發現大範圍不一致，需人類決策處理方式 |
| 任何涉及修改 `PADDLE_FRICTION` 的驗證 | EXP-024 已證實單獨改摩擦係數會讓上層所有公式一起跑掉，必須聯合校準 |
| 任何涉及修改 `swingDirection.y` 正負號的驗證 | EXP-023 已證實光換揮拍方向會讓其他公式全垮 |
| 任何涉及 `dwell_grip` 接觸模型的驗證 | Codex 平行分支開發，`contactOffset` 有物理錯誤，處理方式待決策 |

---

## 9. 建議後續 Codex 寫成正式命令的清單

| 編號 | 命令名稱 | 描述 | 輸入 | 預期輸出 | 風險 |
|---|---|---|---|---|---|
| C-01 | `run-table-contact-tests` | 執行 `node tools/physics-v2-contact-mechanics.js` | 無 | console 輸出：`N 通過 / M 失敗` | 低 |
| C-02 | `run-racket-contact-tests` | 執行 `node tools/racket-contact-mechanics.js` | 無 | console 輸出：全部通過或有失敗 | 低 |
| C-03 | `run-serve-batch` | 對 16 顆 preset 執行 `simulateServe()`，輸出每顆的第一跳/第二跳/過網高度 | `physics-presets.json` | JSON：`[{id, firstBounce, secondBounce, netClearance, ok}]` | 低 |
| C-04 | `run-return-batch` | 對 16 顆 preset × 指定技術執行回擊驗證，輸出每顆的過網高度/落點/判定 | `physics-presets.json`, 技術清單 | JSON：`[{id, technique, netClearance, firstBounce, ok, reason}]` | 低 |
| C-05 | `run-push-window-scan` | 對指定 preset 沿彈跳後下降窗口逐點取樣切球，輸出每點成功率 | `physics-presets.json`, preset ID | JSON：`[{index, point, vel, spin, ok, reason}]` | 中 |
| C-06 | `run-rally-stability` | 對 16 顆 preset 執行連續對打，輸出每顆的持續拍數與失敗原因 | `physics-presets.json` | JSON：`[{id, rounds, failReason}]` | 中 |
| C-07 | `run-spin-direction-check` | 對 16 顆 preset × 切球技術，檢查回擊後 `spin.topspin` 正負號 | `physics-presets.json` | JSON：`[{id, topspin, expected, correct}]` | 中 |
| C-08 | `diff-physics-logic` | 逐函式比對 `game4.html` 與 `return-studio.html` 的物理相關函式 | 兩檔案路徑 | Markdown diff 報告 | 高 |
| C-09 | `extract-research-constants` | 從 `return-studio.html` 提取所有研究版常數，與 `game4.html` 比對 | 兩檔案路徑 | Markdown 表格：常數名 / `return-studio` 值 / `game4` 值 / 是否一致 | 中 |
| C-10 | `run-range-solution-batch` | 對 13 顆有效發球 × 10 次試驗執行範圍解模式驗證 | `physics-presets.json`, 技術清單 | JSON：`[{id, technique, trialResults: [bool]}]` | 低 |
| C-11 | `check-preset-units` | 檢查 `physics-presets.json` 所有 preset 的 spin 值是否為 rad/s、gravity 是否一致 | `physics-presets.json` | Markdown 報告 | 低 |
| C-12 | `run-sensitivity-scan` | 對指定參數在指定範圍內掃描，輸出參數-指標對照表 | 參數名 / 範圍 / 指標 | JSON：`[{paramValue, metricValue}]` | 中 |

---

## 附錄：驗證狀態摘要

| 驗證編號 | 對應實驗 | 來源文件狀態 | 可重跑性確認 |
|---|---|---|---|
| V-01 | EXP-001 | 文件記錄「✅ 已達成」 | 可重跑（獨立 Node 腳本） |
| V-02 | EXP-007（部分） | 文件記錄「全部通過」 | 可重跑（獨立 Node 腳本） |
| V-03 | EXP-005 | 文件記錄 13 顆有效、3 顆過不了網 | 可重跑（瀏覽器內函式） |
| V-04 | EXP-007, EXP-020 | 文件記錄 backspin 6/7、no_spin 2/2、sidebackspin 5/7 | 可重跑（瀏覽器內函式） |
| V-05 | EXP-015, EXP-017 | 文件記錄 196 樣本 41%、516 樣本 35% | 可重跑（瀏覽器內函式） |
| V-06 | EXP-021, EXP-022 | 文件記錄 13/16 達 200+ 拍 | 可重跑（`return-studio.html`） |
| V-07 | EXP-011 | 文件記錄 push 81/130、attack 30/130 | 可重跑（瀏覽器內函式） |
| V-08 | EXP-025, EXP-035, EXP-037, EXP-038 | 文件記錄最佳 `okCount=9, correctCount=14` | 不確定（`push-optimizer.js` 追蹤狀態不確定） |
| V-09 | EXP-036 | 文件記錄使用者視覺檢查發現 scale 輸出問題 | 可重跑（`return-studio.html`） |
| V-10 | EXP-031 | 文件記錄敏感度測試結論指向 Stage 1 | 可重跑（`return-studio.html`） |
| V-11 | EXP-028, EXP-038 | 文件記錄 `correctSpinFrac` 從 0.02 衝到 0.93~1.0 | 可重跑（瀏覽器內函式） |
| V-12 | 不確定 | 文件多次提及需專門 diff | 尚未存在 |

---

> **注意事項：**
> - 本文件中所有「可重跑」標記均基於檔案可見的函式結構，不代表已驗證可成功執行。
> - `game4.html` 與 `return-studio.html` 的物理邏輯是否完全同步，不確定，需要第一輪優先確認。
> - `push-optimizer.js` 是否為 repo 追蹤檔案，不確定。
> - `return-studio.html` 含有 `PADDLE_BLEND`、`bounceOffPlaneSubstepped`、`TANGENT_KP` 等研究機制，與 `game4.html` 的可見段落看起來不完全一致。
> - 所有研究版常數（`PADDLE_SPRING_K`、`PADDLE_DAMPING_RATIO`、`BLADE_*`、`TANGENT_KP`）均為工程估計值，非最終校準值。
> - Stage 3~5 的完整執行計畫尚未完成，目前停留在 EXP-038 的階段性成果。