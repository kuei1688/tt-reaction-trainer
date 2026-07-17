# Game 5 MVP Readiness Plan

> 狀態：已執行，MVP candidate；manual semantic review pending  
> 目標：先完成 Game 5 的 MVP readiness gate，再決定是否進入全 repo 的 TODO-009 真 3D sidespin 遷移。

> 2026-07-16 交接：47-serve calibration、attack narrow calibration、prototype browser review、fixed-serve direction review 與 readiness validator 均已留下證據。Game 5 push/chop 的 `C=2.9` 已作最小範圍整合；attack 仍是 controlled approximation，影片 camera view／左右語意仍不等於物理校準完成。

## 1. 決策與目標

本計畫的下一步不是立刻把 `game4.html`、`match-trainer.html` 與 shared physics core 全部改成新的 3D sidespin 模型，而是先證明 `game5.html` 已足以作為可用的 MVP 主線。

Game 5 readiness gate 要回答的是：

1. 47 組 serve preset 與影片 metadata 是否能穩定、可重現地進入 Game 5。
2. 左右 sidespin / side-backspin 的輸入方向、影片方向與物理結果是否沒有反轉。
3. push/chop 與 attack 是否被清楚分開處理，而不是共用未校準的補償假設。
4. 100 ms swing delay、影片交接與 mobile layout 是否足以支援實際訓練流程。
5. 失敗時能否定位為資料、Game 5 UI/流程、shared physics 或 stale snapshot，而不是用改參數把測試硬壓過去。
6. 以現有 47 組發球作為固定輸入，量出球拍角度、揮拍速度、方向補償與揮拍時機對回球軌跡的實際影響。

本計畫把「校準」與「驗證」分開：47 組發球先固定不重新生成，作為測試台；球拍/揮拍參數作為變因；回球速度、旋轉、過網高度、第一落點、側向偏移與容錯率作為輸出。參數探索先在 prototype 批次工具中進行，只有結果在未參與選參的樣本上仍成立，才回寫 Game 5。

本 gate 通過後，結論只能是「Game 5 MVP candidate」，不代表已完成完整物理真實性驗證，也不代表 TODO-009 已關閉。

## 2. 現況與依據

執行時以以下文件與診斷結果為基準：

- `docs/MVP_MAINLINE_SPEC.md`：MVP 範圍、回球決策與回饋分層。
- `docs/SPIN_DIRECTION_CONTRACT.md`：左右 spin 語義與 sign contract。
- `docs/VALIDATION_PLAN.md`：既有 L1–L5 驗證層級與驗收命名。
- `AI_CONTEXT/3d_diagnostic_2026-07-15/3d_physics_diagnostic_summary.md`：3D 診斷結果、contact-coupling 分類與 G-04 stale expected-model-change 分類。
- `AI_CONTEXT/STATUS.md`、`AI_CONTEXT/OPEN_ITEMS.md`：目前已知缺口與紅線邊界。

已知正向證據：

- 47 組生成 serve preset 已通過 legal-serve gate。
- 47 個影片已有一對一 serve mapping。
- `contact_time_sec` 已加入影片資料，但仍需要代表影片的人眼確認。
- 3D spin diagnostic 與既有 3D spin tests 已可執行。

已知未完成項目：

- attack 的 side-spin compensation 尚未校準。
- 影片左右 camera view 與 Game 5 左右輸入的對應尚未完成人工確認。
- 100 ms swing delay、影片交接、mobile layout 尚未完成實機/瀏覽器驗證。
- TODO-009 真 3D sidespin migration 仍未完成正式跨頁驗證。

## 3. 範圍與非範圍

### 本次範圍

- 建立 Game 5 專用的自動 readiness validator。
- 驗證 47 組資料契約、左右方向契約、有限值與基本物理結果。
- 將 47 組發球固定成 baseline，建立球拍/揮拍參數的批次 sweep 與敏感度報告。
- 分別檢查 push/chop 與 attack 的拍面、揮拍速度、側旋補償與時機參數。
- 對 6 支代表影片做 mobile-first browser manual check。
- 驗證影片交接、swing delay、按鈕/手勢語義與回饋文字。
- 只修正已被 gate 證明的 MVP 阻塞問題。
- 將原始結果、摘要、人工檢查矩陣與剩餘風險寫入 `AI_CONTEXT/`。

### 本次非範圍

- 不把 TODO-009 的完整真 3D sidespin migration 當成本次必要條件。
- 不同步改造 `game4.html`、`match-trainer.html` 或整個產品流程。
- 不因 snapshot 不同就直接更新 expected 值。
- 不做完整 tournament、通用 contact mechanics、side-spin 研究或 optimizer。
- 不把 calibrated approximation 宣稱為完整物理真實性。
- 不同時重新求解 serve preset 與回球參數；若兩者一起變動，結果無法歸因。

## 4. 紅線變更政策

已獲授權在本計畫列明範圍內採取一次性紅線例外，但本次仍採「最小必要變更」；這不改變專案全域的 R0/R1 紅線原則：

| 優先序 | 可變更檔案 | 使用條件 | 必須附帶的證據 |
|---|---|---|---|
| 1 | `game5.html` | Game 5 流程、方向、timing、handoff 或 mobile 問題 | 失敗案例、修正前後測試結果、人工重測結果 |
| 2 | `shared-physics-core.js` | 問題確定來自共用 canonical physics、scale、NaN 或 spin coupling | 最小 reproducible case、受影響頁面、全套相關測試 |
| 3 | `videos.json` | 人工確認影片方向或 contact metadata 確實錯誤 | 影片檔案、原 metadata、修正 mapping、重跑報告 |
| 暫緩 | `game4.html`、`match-trainer.html`、`physics-presets.json` | 只有在 Game 5 gate 明確證明無法繞過時才開啟 | 另立 migration note，說明跨頁相容性與 rollback |

任何 shared-core 或 metadata 變更都要保留 legacy adapter / 舊欄位相容性，並以完整測試確認沒有把 Game 4 或既有 trainer 的語義悄悄改掉。

## 5. 執行階段

### Phase 0：建立 baseline 與可重現性

執行前先記錄：

- `git status --short --branch`。
- 當前 `game5.html`、`shared-physics-core.js`、`videos.json` 與 diagnostics 的版本狀態。
- 既有測試輸出與已知失敗分類。

建議 baseline commands：

```powershell
node tools/serve-generator-contract.test.js
node tools/serve-batch-validation.test.js
node tools/physics-3d-spin.test.js
node tools/batch-validation.test.js --report-file <temporary-report-path>
```

若 batch validation 仍只有 G-04 snapshot mismatch，應標記為 `expected-model-change`，保留 snapshot 不動；只有出現新的 runtime、schema、finite 或 serve legality failure 才阻擋進入下一階段。

### Phase 1：固定 47 組發球並建立參數校準工具

新增隔離的 prototype 工具，例如 `prototypes/game5-47-serve-calibration/run-47-serve-sweep.js`。工具以目前 `physics-presets.json` 的 47 組 per-video preset 為固定輸入，使用參數 override 執行批次模擬，不直接改寫 `game5.html`、`shared-physics-core.js`、`videos.json` 或 `physics-presets.json`。

這一階段的原則是：不重新尋找所有參數，而是只搜尋目前證據不足、且直接影響 Game 5 回球的參數。第一輪不調整 restitution、摩擦、彈簧與阻尼等底層係數；若高層球拍/揮拍參數已能解釋結果，就不擴大物理模型變更面。

初始候選範圍如下；這些是 sweep 起點，不是宣稱的真值：

| 參數群 | 初始候選值 | 目的 |
|---|---|---|
| `SWING_DELAY_MS` | 60 / 80 / 100 / 120 / 140 | 找出時機對擊球點、落點與可擊窗口的影響 |
| attack `racketNormalTiltY` | 0.0 / 0.1 / 0.2 | 觀察拍面開合對出球高度、過網與落點的影響 |
| attack `techniqueVel.z` | -0.8 / -1.0 / -1.2 | 觀察揮拍前進速度對回球深度與失誤率的影響 |
| push `PADDLE_BLEND` | 0.55 / 0.605 / 0.66 | 驗證既有切球校準值在不同發球上的穩定範圍 |
| push `PUSH_LIFT_BASE` | 0.24 / 0.28 / 0.32 | 觀察拖高分量對過網高度與長短的影響 |
| push `PUSH_DRIVE_BASE` | 0.48 / 0.56 / 0.64 | 觀察往前送分量對回球深度的影響 |
| `SIDESPIN_COMPENSATION_C` | push：2.9 / 3.4 / 3.8；attack：獨立 coarse sweep | 不把只校準過 push 的 3.4 直接當成 attack 真值 |

每個樣本至少記錄：接觸時間與接觸點、接觸前後速度、接觸前後 spin、過網高度、第一落點 x/z、飛行時間、最大高度、結果分類、是否出界/掛網，以及相對 baseline 的差值。

### Phase 2：分層執行 47-serve sweep

不直接做巨大 Cartesian product，採三段式以降低過擬合與執行成本：

1. **Baseline：** 47 組發球全部使用目前參數，分別測 push/chop、attack，以及適用的正確方向、錯誤方向與不按方向。
2. **Coarse calibration：** 先用 6 支代表球（左右 side-backspin、左右 sidespin、backspin、no-spin）找出敏感參數與安全區間。
3. **Holdout/generalization：** 將候選最佳的 2–3 組參數套回其餘 41 組，再與全部 47 組的 baseline 比較；不能只用參與選參的 6 球宣稱改善。

方向條件應依 spin 類別解讀：side-spin / side-backspin 要檢查正確方向優於不按與按錯；backspin / no-spin 主要檢查不按方向的 baseline，左右鍵只作為錯誤輸入的負控制，不應被誤當成必要修正。

候選參數的通過條件不是單看「成功率最高」，而是同時滿足：

- 所有結果 finite，沒有 NaN、Infinity、越界或未處理 preset。
- 回球能合理過網並在對方桌面形成可解釋的第一落點。
- side-spin 的正確方向確實改善側向結果，錯誤方向有可預期的負面影響。
- backspin / no-spin 不會因為沒有方向修正而被模型不合理懲罰。
- push/chop 與 attack 產生可辨識的軌跡差異，不是只換 UI label。
- 在 execution variance 或小幅時機變動下仍有安全帶，而不是只有單一精確參數點通過。

輸出寫入 `AI_CONTEXT/game5_47_serve_calibration_YYYY-MM-DD/`，至少包含 raw JSON、依 spin/球長分類的摘要、參數敏感度表、baseline-vs-candidate 比較與尚未解釋的 outlier。

### Phase 3：建立 Game 5 自動 readiness validator

新增 `tools/game5-mvp-validation.test.js`，保持 read-only，不直接修改產品資料。報告輸出至日期化的 `AI_CONTEXT/game5_mvp_validation_YYYY-MM-DD/`。

Validator 至少應涵蓋：

| ID | 驗證內容 | 通過條件 |
|---|---|---|
| DATA-01 | 47 組 approved video / serve mapping | 數量、唯一性、路徑與 preset 對應完整 |
| DATA-02 | `contact_time_sec` 與 metadata schema | 欄位存在、範圍合理、無 NaN/Infinity |
| DIR-01 | sidespin / side-backspin sign contract | 左右輸入在 Game 5 不反轉；22 組純 side-spin 維持正確語義 |
| PHYS-01 | 代表 serve 的 deterministic replay | 位置、速度、spin、bounce 結果全為 finite，且落點/方向在合理範圍 |
| PHYS-02 | push/chop 與 attack 分流 | compensation 只套用已校準的 push/chop；attack 未校準時明確輸出 warning，不得偽裝成同等可信 |
| TIME-01 | swing delay | 100 ms 延遲在 early / in-window / late 案例下可重現，沒有負時間或重複觸發 |
| HANDOFF-01 | video-to-physics handoff | 交接使用 `contact_time_sec` 或明確 fallback，影片與物理球不重疊、不同時冒充同一個結果 |
| SAFETY-01 | runtime safety | 沒有 NaN、Infinity、越界 table state 或未處理的 missing preset |

每一項要輸出 raw JSON、可讀摘要與 failure classification。測試不得把 stale snapshot mismatch 與 runtime/contract failure 混為一類。

### Phase 4：6 支代表影片的 mobile-first browser check

選取以下最小代表集合：

1. left side-backspin
2. right side-backspin
3. left sidespin
4. right sidespin
5. backspin
6. no-spin

每支影片至少各測一次 push/chop 與 attack 能力（若該影片的產品設計只允許特定技術，需在報告中明確標示原因）。在約 360 px 寬度檢查：

- 影片卡片、table、按鈕與 feedback 沒有互相遮擋。
- 影片播放結束後，影片淡出/移除與物理球接管的時間順序正確。
- `contact_time_sec` 對應的擊球時刻與畫面觀感沒有明顯漂移。
- 左右方向是以實際影片 camera view 判定，不以資料夾名稱或直覺猜測。
- player technique 與 direction 的輸入語義清楚；direction 是手勢，不被誤解為落點選擇。
- 結果頁分開呈現 technique reasonableness、direction reasonableness、physical result、learning explanation。
- side-spin 的回球曲線與 feedback 方向一致；若 attack 只是未校準 approximation，畫面不得給出過度確定的語氣。

建議使用下列表格保存人工證據：

| Video | Expected media direction | Observed media direction | Input | Handoff | Physics/result | Status | Notes |
|---|---|---|---|---|---|---|---|
| 6 representative clips | left/right/none | manual observation | push/attack + direction | pass/fail | pass/fail/warning | pass/fail | screenshot or note |

### Phase 5：只修正實際 MVP blocker

依 failure classification 分流：

- `metadata-error`：只修 `videos.json`，保留 before/after mapping 與影片證據。
- `game5-flow`、`direction-sign`、`timing`、`handoff`、`mobile-layout`：優先修 `game5.html`。
- `canonical-physics`、`finite-safety`、`scale`、`spin-coupling`：才考慮修 `shared-physics-core.js`，並立即重跑所有受影響頁面測試。
- `expected-model-change`：先確認新模型是否刻意改變了結果；不以更新 snapshot 取代原因分析。
- `uncertain-media-view`：標記為 manual-review，不自動翻轉 left/right。

每次修正只處理一個根因，然後依序重跑：Game 5 validator、既有 serve/3D tests、必要的 batch validation，以及 6 支代表影片的人工重測。

### Phase 6：Readiness gate 與下一個決策

Game 5 可標記為 MVP candidate 的必要條件：

- 47-serve calibration 已完成 baseline、coarse calibration 與 holdout/generalization 報告。
- 選定參數不是只在 6 支 calibration clips 上有效，而是在其餘 41 組或分層交叉檢查中仍沒有重大回歸。
- DATA-01、DATA-02、DIR-01、PHYS-01、TIME-01、HANDOFF-01、SAFETY-01 全部通過。
- PHYS-02 對 attack 的未校準範圍有明確 warning 或產品限制，沒有誤標為已校準。
- 6 支代表影片均完成人工 direction / handoff / mobile check，沒有未分類 blocker。
- 所有報告與 screenshots/notes 已寫入日期化 `AI_CONTEXT/`。
- `git diff --check` 通過，且沒有因本次修正造成既有 Game 4 / trainer contract regression。

若 gate 通過，下一步才建立獨立的 TODO-009 migration plan，評估 canonical `omega.y` / Magnus semantics 如何跨 shared core、Game 5、Game 4 與 match trainer 同步。

若 gate 不通過，保留 Game 5 為 prototype / controlled approximation，列出 blocker、風險與重測條件；不要擴大變更面，也不要把 incomplete result 宣稱為 MVP ready。

## 6. Rollback 與停止條件

### Rollback

- 只回退本次明確修改的檔案，保留診斷原始資料與 failure report。
- 不使用 destructive reset；以執行前 baseline、逐檔 diff 或專用 commit 回復。
- 若修改 `videos.json`，必須保留修正前後的 mapping，避免日後無法追溯左右語義。
- 若修改 shared core，至少確認 Game 5 與既有受影響頁面的測試均可回到 baseline 行為，否則停止擴散。

### 停止並另立 migration plan 的條件

- 修正需要同時改 `game4.html`、`match-trainer.html` 與 `physics-presets.json` 才能通過。
- 問題本質是 TODO-009 的 canonical 3D semantics，而非 Game 5 MVP blocker。
- 需要大量重寫既有 physics contract、刪除 legacy 欄位或更新多個 historical snapshots。
- 影片左右方向仍無法由人工證據判定。
- 任何修正只能靠放寬 threshold、覆蓋 failure 或更新 expected snapshot 才能通過。

## 7. 交付物

完成本計畫後，應產出：

- `prototypes/game5-47-serve-calibration/run-47-serve-sweep.js`
- `tools/game5-mvp-validation.test.js`
- `AI_CONTEXT/game5_47_serve_calibration_YYYY-MM-DD/` 下的 baseline、sweep、holdout 與敏感度報告
- `AI_CONTEXT/game5_mvp_validation_YYYY-MM-DD/` 下的 raw report、summary 與人工檢查矩陣
- 若有修正，附帶最小 diff、failure classification、測試結果與 rollback 說明
- 最終 decision note：`MVP candidate`、`prototype with blockers` 或 `blocked pending TODO-009 migration`

## 8. 執行順序摘要

```text
Baseline
  -> 固定 47 組 serve preset
  -> 47-serve baseline sweep
  -> 6 球 coarse parameter calibration
  -> 41 球 holdout/generalization check
  -> Game 5 automated readiness validator
  -> 6 representative clips on mobile browser
  -> classify failures
  -> minimal red-line fix only when necessary
  -> rerun automated + manual gates
  -> MVP candidate decision
  -> only then consider full TODO-009 migration
```

## 9. 2026-07-15 校準線執行結果

本計畫的 47-serve calibration line 已完成，執行工具與合併報告如下：

- `prototypes/game5-47-serve-calibration/run-47-serve-sweep.js`
- `prototypes/game5-47-serve-calibration/merge-calibration-reports.js`
- `AI_CONTEXT/game5_47_serve_calibration_2026-07-15/game5_47_serve_calibration_summary.md`

執行採四段分開跑完：47 球 baseline、6 球 coarse sweep、6 球 timing sweep，以及 41 球 holdout。總共產生 1,358 筆 calibration rows；輸入 preset 全程固定，沒有改寫任何紅線檔案，前後 SHA-256 沒有變化，所有輸出均為 finite。

主要觀察：

- 47/47 serve preset 通過本地 legal-serve geometric gate。
- push baseline 在 holdout 為 55/101；`SIDESPIN_COMPENSATION_C=2.9` 為 64/101，值得進入下一輪 trajectory/feel review，但尚未回寫 `game5.html`。
- attack baseline 為 0/101，全部是掛網；將 `techniqueVel.y` 改為 0.3 後為 32/101，顯示垂直揮拍是重要變因，但仍不足以直接升格為已校準攻球。
- 代表球 timing sweep 中，attack 在 60 ms 為 6/18，80–140 ms 為 0/18；push 在 60–140 ms 都是 6/18。
- 多數 attack rows 的 left/none/right 結果沒有差異，表示攻球方向耦合仍需獨立檢查。

目前決策：不重新生成 47 個發球、不自動採用任何新參數、不進行 TODO-009 全 repo 遷移。下一輪應聚焦 attack 的接觸時機、垂直揮拍與方向耦合；push 的 `C=2.9` 先做人工軌跡與手感確認，再交給 Game 5 readiness validator 重跑。

## 10. 2026-07-16 attack 窄範圍校準結果

已執行新增的「47 發球參數校準線」攻球窄範圍測試，報告位於：

- `AI_CONTEXT/game5_attack_narrow_calibration_2026-07-16/game5_47_serve_calibration_summary.md`
- `AI_CONTEXT/game5_attack_narrow_calibration_2026-07-16/game5_47_serve_calibration_raw.json`

本輪固定現有 47 個 serve presets，使用 6 顆代表球 × 6 組垂直揮拍速度 × 6 組接觸時機，再將代表球排名前 3 的組合帶入 41 顆 holdout。共產生 951 筆 rows；47/47 發球合法、951/951 finite、0 error，輸入前後 SHA-256 相同，沒有修改紅線檔案。

代表球較佳的三個候選為 `techniqueVel.y=0.15 @ 60 ms`、`techniqueVel.y=0 @ 40 ms`、`techniqueVel.y=0.45 @ 100 ms`；三者在 holdout 都是 32/101 落在對方桌面、39/101 掛網、30/101 出界或無落點。這代表目前模型對垂直揮拍與時機有敏感度，但三組候選的幾何成功率相同，尚不足以支持自動選參數。

在三個候選的 side-spin holdout 中，left/right/none 的 outcome、landing x/z 與 net clearance 對照沒有差異；因此方向輸入目前仍未形成可驗證的攻球方向耦合證據，必須進入獨立的方向語意與瀏覽器軌跡檢查。

目前決策：保留三組候選作為人工 trajectory/feel review，不回寫 `game5.html`。下一步先檢查攻球方向控制是否真的影響回球，再人工確認 push `SIDESPIN_COMPENSATION_C=2.9`；只有通過視覺、手感與 readiness gate，才提出最小紅線變更。

## 11. 2026-07-16 prototype browser review

The temporary browser variant loader was used to inspect the three attack candidates and the push `C=2.9` candidate without changing `game5.html`.

| Variant | Test mode | One random serve | Result | Observation |
|---|---|---|---|---|
| `techniqueVel.y=0.15`, delay 60 ms | auto best timing + forehand attack + trajectory | contact_sidespin_016 | success | descending contact; net clearance 0.001 m |
| `techniqueVel.y=0`, delay 40 ms | auto best timing + forehand attack | contact_sidespin_022 | net | first landing -0.54, 0.11; net clearance -0.004 m |
| `techniqueVel.y=0.45`, delay 100 ms | auto best timing + forehand attack + trajectory | contact_sidespin_014 | success | first landing 0.12, -0.78; net clearance 0.032 m |
| `SIDESPIN_COMPENSATION_C=2.9` | auto best timing + forehand push + trajectory | contact_sidebackspin_004 | success | first landing 0.55, -0.55; net clearance 0.118 m |

This is a UI/trajectory sanity check only: each row is one randomized serve, and auto timing bypasses human timing variance. It does not promote a parameter or satisfy the readiness gate. The attack direction comparison remains unresolved, and `C=2.9` still requires a direction-input review plus a rerun through the automated validator before any red-line change.

## 12. 2026-07-16 fixed-serve direction review

The prototype server now accepts `?fixed=serve_contact_sidebackspin_004`, allowing the same approved serve/preset/video pairing to be replayed while testing the real technique-button gesture path.

| Candidate | Gesture | UI direction cue | Result | Physics detail |
|---|---|---|---|---|
| `C=2.9` | left drag on push button | `向左修正` | out | no first landing; net clearance 0.144 m |
| `C=2.9` | right drag on push button | `向右修正` | success | first landing -0.13, -0.71; net clearance 0.159 m |

This confirms that the gesture reaches `selectedDirectionInput` and changes the return outcome for this fixed serve. It does not yet confirm that the left/right label matches the filmed player's camera view, and it is not a 47-serve generalization result. A production `C=3.4` comparison attempt was excluded because the return button did not unlock and the ball was recorded as a miss; it was not treated as a physics sample.

The readiness validator was rerun after the prototype work: automated gate **pass**; `DATA-01`, `DATA-02`, `DIR-01`, `PHYS-01`, `TIME-01`, `HANDOFF-01`, and `SAFETY-01` passed; `PHYS-02` passed with the existing non-blocking attack approximation warning. No red-line parameter was promoted.

## 13. 2026-07-16 minimal mainline integration

Based on the completed calibration line, fixed-serve direction review, and readiness gate, the minimum supported result was integrated into `game5.html`:

- `SIDESPIN_COMPENSATION_C`: `3.4` -> `2.9` for Game 5 push/chop direction compensation.
- The attack candidates were not integrated; attack remains a controlled approximation with no dedicated sidespin calibration.
- `game4.html`, `return-studio.html`, the shared physics core, video metadata, and serve presets were left unchanged.
- The change is scoped to the Game 5 mainline and does not claim completion of TODO-009 or true 3D Magnus sidespin.

The integrated value remains explicitly reversible because `2.9` is the lower edge of the measured push safety intersection. Validation is rerun after this edit; the resulting report is the authoritative post-integration evidence.
