# DRAFT: Development matrix
#
# Status: draft only.
# This file is a tentative matrix and must not be treated as a release-tracking source of truth.
# Last touched: 2026-07-06
# 開發對照表（草稿）

> **狀態聲明：** 本文件僅根據使用者提供的輸入整理，不新增事實，不做最終架構決策或物理判斷。不確定處已標示「不確定」。

---

## 一、穩定模組

| 模組 | 目前狀態 | 風險 | 相關檔案 | 測試方式 | 適合模型 | 備註 |
|---|---|---|---|---|---|---|
| 座標與單位規格 | 已部署 | 低 | `docs/physics-engine-v2-plan.md`, `physics-presets.json` | 文件審查 | GLM 整理 | Phase 0；旋轉單位 rad/s，下旋基準 20 rps ≈ −125.66 rad/s |
| 桌面接觸力學函式 | 已驗證（工具頁） | 低 | `tools/physics-v2-contact-mechanics.js` | Node 單元測試 13 通過 / 0 失敗（文件記錄） | Codex / 高階模型審查 | Phase 1；薄殼球轉動慣量 `I=(2/3)mR²` |
| 摩擦係數 μ 校準 | 已部署 | 低 | `tools/physics-v2-contact-mechanics.js`, `physics-v2-calibration.html` | `vz=1.5` 球感校準、apex 遞減驗證 | Codex / 高階模型審查 | Phase 2；`μ=0.13`；`EPSILON_MIN`、`SPIN_EPSILON_REFERENCE` 仍為暫定工程常數 |
| 發球 preset 真實單位換算 | 已部署 | 低 | `physics-presets.json` | 16 顆 preset 軌跡驗證 | GLM 整理 / Codex | Phase 3；`sidebackspin_short_forehand` 的 24rps 為工程判斷，無實測依據 |
| 整合進主要頁面 | 已部署 | 低 | `game4.html`, `return-studio.html` | 批次驗證無 NaN | Codex | Phase 4；取代舊 `applyBounceSpin()` |
| `physics-studio.html` 換成真實 v2 引擎 | 已部署 | 低 | `physics-studio.html` | 不確定 | Codex | 避免兩套物理不一致 |
| 球拍接觸力學通用框架 | 已部署 | 中 | `game4.html`, `return-studio.html`, `tools/racket-contact-mechanics.js` | 桌面退化案例對拍驗證（文件記錄全部通過） | 高階模型 / Codex | `bounceOffPlane()` 法向反彈 + 切向庫倫摩擦；球拍與桌面共用 |
| 速度相依反彈係數 `dynamicPaddleEpsilon()` | 已部署 | 中 | `game4.html`, `return-studio.html` | 16 preset 單拍驗證 | Codex | `PADDLE_RESTITUTION_LOW=0.9`、`HIGH=0.75`、`SPEED_LOW=2.0`、`HIGH=12.0` |
| 回擊起點偏移修正 | 已部署 | 低 | `game4.html`, `return-studio.html` | 516 樣本窗口驗證 | Codex | 從 `y+0.12` 改為 `{...hitPoint}` |
| 4 顆發球拋球高度修正 | 已部署 | 低 | `physics-presets.json` | 16 顆全過網驗證 | Codex | 修正後拋球高度比其他球高（如 1.55 vs 0.87~0.95），視覺較誇張 |

---

## 二、半穩定模組

| 模組 | 目前狀態 | 風險 | 相關檔案 | 測試方式 | 適合模型 | 備註 |
|---|---|---|---|---|---|---|
| UI / 頁面入口 | 半穩定 | 中 | `index.html`, `game4.html`, `return-studio.html`, `physics-studio.html` | 瀏覽器操作、手機版面檢查 | GLM 整理 / Codex | 需避免工具頁和正式頁行為混淆 |
| 飛行模型（軌跡模擬） | 半穩定 | 中 | `game4.html`, `return-studio.html`, `physics-studio.html` | 批次模擬、軌跡檢查 | Codex | 需建立可重跑命令 |
| 桌面反彈物理（整合版） | 半穩定 | 中 | `game4.html`, `return-studio.html`, `physics-v2-calibration.html` | 16 preset 批次驗證 | Codex / 高階模型審查 | 3 顆重下旋 preset 過不了網（已知問題，使用者確認暫不處理） |
| 旋轉模型（rad/s 單位） | 半穩定 | 高 | `physics-presets.json`, `tools/*contact-mechanics.js`, `game4.html` | rad/s 檢查、旋轉方向驗證 | 高階模型 / GLM 整理 | 需保留原始參數名；反手側旋方向仍有錯誤 |
| 球拍摩擦 `PADDLE_FRICTION=0.4` | 已部署 | 高 | `game4.html`, `return-studio.html` | 16 preset 單拍驗證 | 高階模型 / Codex | 工程估計值；已證實不可單獨改，必須聯合校準 |
| 回擊技術等級 | 已部署 | 中 | `game4.html`, `return-studio.html` | 2 顆無旋轉發球驗證 | Codex | `RETURN_SKILL_LEVEL` 初階/中階/熟練；中階與熟練目前補償品質相同 |
| 瞄準機制 | 已部署 | 中 | `game4.html`, `return-studio.html` | 16 preset 回擊驗證 | Codex | `solveRacketVelXForTargetLandingX()`，`RETURN_TARGET_X=0`；曾三次抓到瞄準求解與實際碰撞物理不一致的 bug |
| 範圍解模式 | 已部署 | 低 | `game4.html`, `return-studio.html` | 13 preset × 10 次試驗 | Codex | `RANGE_SOLUTION_MODE`；push 81/130、attack 30/130 |
| 連續對打負回饋控制律 | 半穩定 | 高 | `game4.html`, `return-studio.html` | 16 preset 連續對打，13/16 達 200+ 拍（文件記錄） | 高階模型 / Codex | 旋轉會逐拍衰減甚至反轉成上旋；球速收斂但落點「短、深、短、深」交替 |
| 拍面角度 `racketNormalTiltY` | 已部署 | 高 | `game4.html`, `return-studio.html` | 16 preset 單點驗證 | 高階模型 / Codex | `0.006×|topspin|`，clamp 0.4~0.55；在有 blend 後對應什麼物理量不確定 |
| 拍面角度 `racketNormalTiltX` | 已部署（研究中移除） | 高 | `game4.html`, `return-studio.html` | 16 preset 單點驗證 | 高階模型 / Codex | `−0.144 − 0.538×incomingVel.x`；研究版已移除此 hack，`game4.html` 同步狀態不確定 |
| 力道公式（目前部署版） | 已部署 | 高 | `game4.html`, `return-studio.html` | 16 preset 單拍 + 連續對打 | 高階模型 / Codex | `magnitude = 0.7 − 0.3 × (來球水平速度 − 2.0)`，clamp 0.02~2.0；短球力道偏高問題待測 |
| 揮拍方向 `swingDirection` | 已部署 | 高 | `game4.html`, `return-studio.html` | 16 preset 單拍驗證 | 高階模型 / Codex | `normalize({x:0, y:0.3, z:-1})`；使用者資料顯示 y 應為負值，尚未修正 |
| 弧線高度修正（tiltY 依殘留旋轉內插） | 已部署 | 中 | `game4.html`, `return-studio.html` | 16 preset 連續對打 | Codex | 平均弧線從 ~1.0~1.1m 降到 ~0.81m |
| 連續對打展示模式 | 已實作（研究版） | 中 | `return-studio.html` | 最多 60 拍展示 | Codex | 旋轉衰減問題未解決 |

---

## 三、研究中模組

| 模組 | 目前狀態 | 風險 | 相關檔案 | 測試方式 | 適合模型 | 備註 |
|---|---|---|---|---|---|---|
| `PADDLE_BLEND` 機制 | 研究中 | 最高 | `return-studio.html`, `push-optimizer.js` | 14 preset 聯合搜尋、旋轉方向驗證 | 高階模型 / Codex | 預設 0；兩階段動態模型（`blendCompress`/`blendRelease`）尚未寫回檔案 |
| blend 只看 y-z 平面 | 研究中 | 高 | `return-studio.html`, `push-optimizer.js` | 14 preset 聯合搜尋 | 高階模型 / Codex | 已驗證修正反手側旋方向（`correctCount=14/14`），尚未寫回檔案 |
| `scale` 因子 | 研究中 | 高 | `return-studio.html`, `push-optimizer.js` | 14 preset 泛化測試 | 高階模型 / Codex | `scale=2.0~3.5`；首次讓過網跟旋轉正確同時成立；物理意義不確定 |
| `outputRescale` | 研究中 | 高 | `return-studio.html`, `push-optimizer.js` | 14 preset 聯合搜尋 | 高階模型 / Codex | 輸出速度縮放，不等於內部 `scale`；物理意義不確定 |
| Stage 1 球拍速度尺度校準 | 研究中 | 高 | `return-studio.html`, `push-optimizer.js` | 14 preset 自適應力道校準 | 高階模型 / Codex | 目前最佳 `okCount=9, correctCount=14`；正式部署尚未開始 |
| Stage 2 聯合搜尋（修正後） | 研究中 | 最高 | `return-studio.html`, `push-optimizer.js` | 14 preset 聯合搜尋 | 高階模型 / Codex | 準確率跟旋轉方向互斥問題尚未完全解決；短球力道公式行為不合理 |
| Stage 3 接觸期間球拍持續加速 | 尚未開始 | 不確定 | `return-studio.html`（規劃中） | 不確定 | 高階模型 | 規劃中；數值實驗顯示可能只需簡單乘數 |
| Stage 4 海綿彈性儲能 | 研究中（原型） | 不確定 | `return-studio.html` | 彈簧-阻尼原型驗證 | 高階模型 / Codex | catapult 效應是「損失得比較少」非免費能量；`PADDLE_SPRING_K`/`PADDLE_DAMPING_RATIO` 值不確定 |
| Stage 5 動作時機品質 | 尚未開始 | 不確定 | 不確定 | 不確定 | 高階模型 | 規劃中 |
| 彈簧-阻尼法向碰撞模型 | 研究中（原型） | 中 | `return-studio.html` | 逐步積分 vs 單點模型逐位精確吻合 | 高階模型 / Codex | 阻尼比 0.05~0.5 旋轉維持不變，只有速度隨阻尼比下降 |
| 膠皮/海綿參數化 | 尚未開始 | 不確定 | 不確定 | 不確定 | 高階模型 | `RUBBER_TYPES` 規劃中；應覆寫既有 `epsilon`/`friction`，非新增獨立路徑 |
| 削球/擋球技術（`model:'chop'`） | 尚未開始 | 不確定 | 不確定 | 不確定 | 高階模型 / 人類決策 | 連續對打需要不同技術模型；切球與削球是不同技術 |
| 參數搜尋工具 | 研究中 | 高 | `push-optimizer.js` | 隨機搜尋 + 座標爬山法 | Codex / 高階模型 | 簡化版桌面反彈物理，算出的分數僅供參考，需回真實引擎驗證 |
| Phase 7 文件化 | 尚未開始 | 中 | `docs/`, `README.md` | 不確定 | GLM 整理 / Codex | `README.md` 尚未更新旋轉數值代表真實 rad/s |
| `bounceOffPlaneSubstepped()` | 已實作（研究版） | 中 | `return-studio.html` | `PUSH_CONTACT_MODEL='instant'` 切回時一致性驗證 | Codex | 預設 instant 不影響既有行為 |

---

## 四、只適合高階模型判斷的模組

| 模組 | 目前狀態 | 風險 | 相關檔案 | 測試方式 | 適合模型 | 備註 |
|---|---|---|---|---|---|---|
| 切球法向反彈係數是否應低於攻球 | 待驗證 | 高 | `game4.html`, `return-studio.html` | 不確定 | 高階模型 | 使用者觀察「子彈感」；單獨降低 epsilon 會讓落點準確率崩潰 |
| blend 機制物理合理性 | 研究中 | 最高 | `return-studio.html` | 14 preset 聯合搜尋 | 高階模型 | 接手指令明確要求不可視為最終物理解；高 blend 可能補償缺少的機制 |
| blend 只看 y-z 平面是否物理正確 | 研究中 | 高 | `return-studio.html` | 14 preset 聯合搜尋 | 高階模型 | 已驗證能修正反手側旋，但是否為正確物理修正待判斷 |
| `scale` 因子物理意義 | 研究中 | 高 | `return-studio.html` | 不確定 | 高階模型 | 代表模型漏掉的物理效應？還是應分別建模？ |
| `outputRescale` 物理意義 | 研究中 | 高 | `return-studio.html` | 不確定 | 高階模型 | 輸出速度部分縮放，不等於內部 `scale`；物理意義是否清楚待判斷 |
| 弱旋轉/不轉球技術選擇 | 待驗證 | 高 | 不確定 | 不確定 | 高階模型 / 人類決策 | 使用者指出真實球員會換技術；已從 Stage 2 校準範圍排除 |
| 連續對打是否需新增削球/擋球技術 | 待驗證 | 高 | 不確定 | 不確定 | 高階模型 / 人類決策 | 文獻指出切球與削球是不同技術，適用不同情境 |
| 拍面角度插值是否應加入旋轉量維度 | 待驗證 | 中 | 不確定 | 27 組網格回歸 | 高階模型 | 文獻指出拍面角度要依來球衝擊力道與旋轉調整 |
| 「時鐘接觸面」幾何模型是否正式納入 | 待驗證 | 中 | 不確定 | 模擬數據驗證成立 | 高階模型 | 已驗證成立但尚未套用 |
| 搜尋目標函式設計 | 研究中 | 高 | `push-optimizer.js` | 不確定 | 高階模型 | 硬性雙門檻 vs Pareto 多目標搜尋 |
| `swingDirection.y` 方向修正 | 待驗證 | 高 | `game4.html`, `return-studio.html` | 不確定 | 高階模型 / 人類決策 | 使用者資料顯示應為負值；修正會讓其他公式全垮，需聯合校準 |
| 舊公式在引入 blend 後是否需全部重新推導 | 研究中 | 高 | `game4.html`, `return-studio.html` | 不確定 | 高階模型 | `tiltX` 回歸、`tiltY` 範圍、`friction`、`epsilon` 動態公式全部在無 blend 下校準 |
| `gravity: -4.2` 是否為正式設計值 | 不確定 | 低 | `physics-presets.json` | 不確定 | 高階模型 / 人類確認 | 需進一步確認 |
| `wristBrakeRate` 是否為有效正式機制 | 不確定 | 中 | 不確定 | 不確定 | 高階模型 / Codex | 需整理確認 |
| `game4.html` 與 `return-studio.html` 同步狀態 | 不確定 | 高 | `game4.html`, `return-studio.html` | 專門 diff | Codex / 高階模型 | 兩檔案物理邏輯是否完全同步，不確定 |
| Codex 平行分支 `dwell_grip` 整合 | 不確定 | 高 | `return-studio.html`（平行分支） | 不確定 | 高階模型 / 人類決策 | `contactOffset` 有物理錯誤，應如何處理待決策 |

---

## 五、可交給 GLM 整理的模組

| 模組 | 目前狀態 | 風險 | 相關檔案 | 測試方式 | 適合模型 | 備註 |
|---|---|---|---|---|---|---|
| AI 文件整理 | 新建立 | 中 | `AI_CONTEXT/`, `docs/` | 檢查 Markdown 完整性 | GLM / Codex | 本輪核心工作 |
| 實驗紀錄整理 | 新建立 | 中 | `AI_CONTEXT/DRAFTS/`, `docs/physics-engine-v2-plan.md` | 對照原文紀錄 | GLM | 不新增事實，不做物理判斷；EXP-001~038 已整理 |
| 開發對照表 | 新建立 | 中 | `AI_CONTEXT/DRAFTS/` | 檢查表格完整性 | GLM | 本文件 |
| 參數表整理 | 新建立 | 中 | `AI_CONTEXT/DRAFTS/`, `docs/physics-engine-v2-plan.md` | 對照原文參數值 | GLM | 保留原始參數名，標示「已套用」、「研究中」、「已被取代」、「不確定」 |
| push/chop 模型年表 | 新建立 | 中 | `AI_CONTEXT/DRAFTS/`, `docs/physics-engine-v2-plan.md` | 對照 Phase/Stage 紀錄 | GLM | 每個結論標示狀態；區分「已套用」、「只在研究版驗證」、「尚未開始」 |
| 測試報告整理 | 不完整 | 高 | `docs/physics-engine-v2-plan.md` | 將舊紀錄轉成 log | GLM / Codex | 沒有 `package.json`/npm test；現有測試為獨立 Node 腳本與瀏覽器批次模擬 |
| AI handoff 模板 | 新建立 | 中 | `AI_CONTEXT/` | 檢查模板完整性 | GLM | 讓之後任務可明確指定可改/不可改範圍、驗收標準與高階模型審查問題 |
| 失敗案例整理 | 新建立 | 中 | `AI_CONTEXT/DRAFTS/`, `docs/physics-engine-v2-plan.md` | 對照原文紀錄 | GLM | 不任意刪除失敗案例；保留原始參數名 |

---

## 附錄：不確定性摘要

| 項目 | 不確定內容 |
|---|---|
| `game4.html` 與 `return-studio.html` 同步 | 兩檔案物理邏輯是否完全同步，不確定；`return-studio.html` 含 `PADDLE_BLEND`、substepped push 等研究機制，`game4.html` 可見段落看起來不完全一致 |
| 各階段驗證數字 | 來自不同時期文件記錄，最新部署版本確切數字不確定 |
| `PADDLE_SPRING_K` / `PADDLE_DAMPING_RATIO` | 研究版常數，確切預設值不確定 |
| `PUSH_WRIST_BRAKE_RATE` | 是否為有效正式機制，不確定 |
| `gravity: -4.2` | 是否為正式設計值，不確定 |
| `.claude/` 資料夾 | 未檢查內容、未修改 |
| Codex 平行分支 | `dwell_grip` 接觸模型與本路徑是否已同步，不確定 |
| `push-optimizer.js` | 是否為 repo 追蹤檔案，不確定；文件中多次引用但主要檔案清單未列出 |
| `AI_CONTEXT/test_output.txt` | 是否存在，不確定 |
| Stage 3~5 | 規劃中或尚未開始，具體實作方式與測試方式不確定 |