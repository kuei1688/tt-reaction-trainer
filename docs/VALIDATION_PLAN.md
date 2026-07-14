# 驗證計畫

> 本文件整理目前 repo 中可作為驗證入口的檔案、候選命令與尚未補齊的驗證工具。
>
> 整理基準：2026-07-10  
> 本輪狀態：shared-physics-core Phase 1 遷移、批次驗證工具化、MVP 主線規格、交接文件更新；未修改物理模型參數。
>
> 重要警告：本文中的「候選命令」代表可作為下一步驗證入口，不代表本輪已成功執行。正式引用數字前，必須重跑或回查原始紀錄。

## 驗證原則

- 驗證結果必須標明對應檔案版本。
- `game4.html` 與 `return-studio.html` 不可混用結果。
- 實驗數字不得自動升格成模型決策。
- 視覺檢查可以發現異常，但不能單獨作為物理定論。
- 修改任何會影響碰撞、旋轉、瞄準或縮放的公式後，都需要重新跑聯合驗證。
- 高 blend 或 `blend=0.9` 結果必須標成研究訊號。

## 目前可見的驗證入口

| ID | 驗證項目 | 入口檔案 | 目前 repo 狀態 | 本輪是否執行 | 注意事項 |
|---|---|---|---|---|---|
| VAL-001 | 桌面接觸力學單元驗證 | `tools/physics-v2-contact-mechanics.js` | 檔案存在 | 2026-07-06 已執行，13 通過 / 0 失敗 | 可作為桌面反彈 v2 的第一層驗證；輸出見 `AI_CONTEXT/test_output.txt` |
| VAL-002 | 球拍接觸力學對照驗證 | `tools/racket-contact-mechanics.js` | 檔案存在 | 2026-07-06 已執行，單軸對照全部通過 | 可檢查球拍平面碰撞與桌面退化案例；移動拍面段落仍標示為人工檢查輸出 |
| VAL-003 | 發球 preset / 軌跡檢查 | `physics-studio.html`, `game4.html`, `tools/serve-batch-validation.test.js` | 已工具化 | 2026-07-10 已執行，cross-check 16/16 全過 | 同時驗證兩份 solver，cross-check 為主要通過條件；個別 solver 門檻較寬（過網 >=0.001m、第一跳 <=0.08m、第二跳 <=0.20m），可後續調整 | `physics-studio.html`, `game4.html`, `physics-presets.json` | 檔案存在 | 否 | 需要瀏覽器或抽取函式工具 |
| VAL-004 | 正式遊戲回擊檢查 | `game4.html`, `tools/batch-validation.test.js` | 已工具化 | 2026-07-10 已執行，14 通過 / 0 失敗 | 需區分 attack / push / loop；loop 仍是舊模型 |
| VAL-005 | 回擊研究頁檢查 | `return-studio.html`, `physics-presets.json`, `tools/return-studio-batch-validation.test.js` | 已工具化 | 2026-07-12 已執行，64 組合（16 preset × 4 技術/side 組合）全部產生結果、0 例外；判定 ok 30/64（push 兩側各 14/16、attack 各 1/16） | 結果只是 `return-studio.html` 研究頁自身行為快照，非 game4.html 驗收、不與 game4.html cross-check；報告在 `AI_CONTEXT/val005_return_studio_test_output.txt`；有 blend / substepped push 研究機制；Phase 2（CMD-005 切球時機窗口取樣）未做，需另開任務包 |
| VAL-006 | 核心檔案同步差異檢查 | `tools/cross-file-consistency-check.js` | 已建立 | 2026-07-10 已執行，6 constants + 2 functions 全部通過 | 自動比對常數與函式指紋；白名單在 `tools/consistency-whitelist.json` |
| VAL-007 | 參數搜尋 / optimizer 重跑 | `push-optimizer.js` | 本輪未在 repo 檔案清單中找到 | 否 | 不可依賴為目前可重跑命令 |
| VAL-008 | 視覺軌跡檢查 | `return-studio.html`, `physics-studio.html` | 檔案存在 | 否 | 主觀但重要，需搭配數值輸出 |
| VAL-009 | TODO-006：`scale` / `outputRescale` 一致性檢查 | `game4.html`, `return-studio.html`, `physics-presets.json` | 待建立 | 否 | 驗證縮放與輸出縮放是否共用同一套邏輯；結果需回寫 `MODEL_DECISIONS.md` / `PHYSICS_MODEL_SPEC.md` |
| VAL-010 | TODO-008：部署前確認清單 | `game4.html`, `return-studio.html`, `physics-presets.json` | 待建立 | 否 | 至少包含 `PADDLE_BLEND=0` 一致性驗證，避免研究機制未通過檢查就寫成正式行為 |
| VAL-011 | 跨檔案常數與函式一致性檢查 | `tools/cross-file-consistency-check.js`, `tools/consistency-whitelist.json` | 已建立 | 2026-07-10 已執行，6 constants + 2 functions 全部通過 | Phase 1 shared-physics-core 遷移後的核心同步驗證入口 |

## 候選命令

以下命令是下一輪可以嘗試建立或執行的驗證入口。若命令失敗，應把失敗輸出寫回 `AI_CONTEXT/test_output.txt` 或新的驗證紀錄。

| ID | 候選命令 | 目的 | 預期輸出 |
|---|---|---|---|
| CMD-001 | `node tools/physics-v2-contact-mechanics.js` | 執行桌面接觸力學內建驗證 | 通過 / 失敗統計 |
| CMD-002 | `node tools/racket-contact-mechanics.js` | 執行球拍接觸力學內建驗證 | 通過 / 失敗統計 |
| CMD-003 | 待建立 `run-serve-batch` | 對 16 顆 preset 跑發球軌跡批次檢查 | 每顆第一跳、第二跳、過網高度、失敗原因 |
| CMD-004 | 待建立 `run-return-batch` | 對 16 顆 preset × 技術跑回擊檢查 | 每顆回擊落點、過網高度、成功與否 |
| CMD-005 | 待建立 `run-push-window-scan` | 沿彈跳後下降窗口取樣切球成功率 | 每個 hit index 的成功率與失敗原因 |
| CMD-006 | 待建立 `run-spin-direction-check` | 檢查切球回擊後旋轉方向 | topspin 正負號、correctSpinFrac 或同等指標 |
| CMD-007 | 待建立 `diff-physics-logic` | 比對核心檔案物理函式與常數 | Markdown 差異報告；規格見 `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` 與 `docs/BATCH_VALIDATION_SPEC.md` |
| CMD-008 | 待建立 `extract-research-constants` | 抽取 `return-studio.html` 研究常數並與正式頁比對 | 常數表與一致性標記 |
| CMD-009 | `node tools/cross-file-consistency-check.js` | 跨檔案常數與函式指紋一致性檢查 | 通過 / 失敗統計 |
| CMD-010 | `node tools/batch-validation.test.js` | VAL-004 正式遊戲回擊批次驗證 | 14 項 Pass/Fail 統計 |

## 驗證層級

### L1：檔案與常數存在性

目標是確認入口檔案存在、核心常數可被找到、文件引用的函式名稱沒有明顯失真。這一層不能證明物理正確，只能防止文件引用不存在的東西。

### L2：獨立 Node 驗證

目標是重跑桌面接觸、球拍接觸等不依賴瀏覽器 UI 的腳本。這是目前最容易自動化的驗證層。

### L3：瀏覽器內函式批次驗證

目標是抽取或驅動 `game4.html`、`return-studio.html`、`physics-studio.html` 中的模擬函式，產生 JSON 結果。這一層需要額外工具化，避免手動在 console 操作。

### L4：視覺與互動檢查

目標是觀察 3D 軌跡、弧線高度、落點與明顯不合理狀態。視覺檢查必須搭配數值紀錄，不可單獨作為模型決策。

### L5：高階模型 / 人類審查

目標是判斷物理機制是否合理，例如 blend 的地位、切球法向反彈、膠皮 / 海綿模型、finite racket mass / passive giving 等。

## 每次驗證後需要記錄的欄位

| 欄位 | 說明 |
|---|---|
| 日期 | 使用絕對日期 |
| repo 狀態 | commit、branch、或 git status 摘要 |
| 驗證入口 | 命令、HTML 頁面、或手動步驟 |
| 涉及檔案 | 明確列出 `game4.html` / `return-studio.html` 等 |
| 測試集 | preset ID、技術、hit window、參數範圍 |
| 輸出指標 | okCount、correctCount、落點、過網高度、旋轉方向等 |
| 失敗案例 | 不可只記成功率，必須列出失敗原因 |
| 是否可重跑 | 是 / 否 / 需要工具化 |
| 是否升格決策 | 預設否；若是，需連到 `MODEL_DECISIONS.md` |

## 最高優先驗證缺口

1. ~~已部分完成~~：`tools/cross-file-consistency-check.js` 已建立，可自動比對常數與函式指紋。完整只讀抽取工具仍需依 `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` 補齊。
2. 將 `tools/physics-v2-contact-mechanics.js` 與 `tools/racket-contact-mechanics.js` 納入固定驗證流程；本輪已手動執行並寫入 `AI_CONTEXT/test_output.txt`。
3. ~~回擊已工具化~~：`tools/batch-validation.test.js` 已完成 VAL-004（14 通過 / 0 失敗）。發球批次（VAL-003）仍需工具化。
4. 為 push/chop 建立同時檢查「過網、落點、旋轉方向、弧線高度」的聯合指標。
5. 為 `return-studio.html` 研究機制建立「是否回寫正式遊戲」的審查門檻。

## 不可接受的驗證捷徑

- 只看某組參數成功率，卻不檢查旋轉方向。
- 只看 `return-studio.html` 成功，就宣稱 `game4.html` 已部署。
- 只看視覺軌跡漂亮，就宣稱物理正確。
- 只改單一常數，沒有重跑聯合驗證。
- 把 GLM 草稿的「可重跑」或「已完成」當成已由本輪驗證。

## 關聯文件

- `docs/EXPERIMENT_LOG.md`
- `docs/MODEL_DECISIONS.md`
- `docs/PHYSICS_MODEL_SPEC.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/SHARED_PHYSICS_CORE_PHASE1_APPROVAL.md`
- `docs/SHARED_PHYSICS_CORE_PHASE2_TASKPACK.md`
- `docs/BATCH_VALIDATION_TOOLING_TASKPACK.md`
- `docs/PHYSICS_RESEARCH_TAIL_INDEX.md`
- `AI_CONTEXT/DRAFTS/validation_plan_draft.md`
