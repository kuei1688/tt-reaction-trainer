# 專案現況

> 唯一的「現在狀態」入口。取代 `docs/PROJECT_OVERVIEW.md`、`CODEX_CONTEXT_SUMMARY.md`、舊 checkpoint 系列的即時資訊角色——那些文件已移入 `AI_CONTEXT/ARCHIVE/`,僅供追溯原始脈絡用,不再是必讀。
>
> 更新日期:2026-07-15

## 專案是什麼

桌球接發球反應訓練工具,使用者自己在學桌球過程中發想,逐步加入簡化物理模擬讓體感更直覺。目前是個人練習/驗證階段,尚未有外部使用者依賴正式頁面。已有教練對前一版(偏文字遊戲)給過真實回饋。

## 核心檔案角色(紅線,改前需先討論)

| 檔案 | 角色 | 現況 |
|---|---|---|
| `game4.html` | 正式遊戲頁 | attack / push 走球拍接觸路徑;loop 仍是舊 direct model;已改用 `shared-physics-core.js`(已 commit);2026-07-14 修復桌面接觸尺度一致性 bug（見下方「2026-07-14 尺度一致性修復」） |
| `match-trainer.html` | 正式訓練頁 | 未在本輪改動範圍內 |
| `shared-physics-core.js` | 共用物理核心 | **Phase 1、Phase 2 皆已完成並 commit**(見下方「已修正的過時資訊」) |
| `videos.json` | 題庫影片/圖片資料 | 56 筆,46 筆 `reviewStatus: approved`;沒有「允許的長短/落點/速度變體」欄位 |
| `physics-presets.json` | 發球 preset 資料 | 近期未調整 |
| `return-studio.html` / `physics-studio.html` | 研究/調參工具頁 | 有 blend、substepped push 等研究機制,不等於 `game4.html` 已部署行為;`return-studio.html` 2026-07-14 同步修復尺度 bug,`physics-studio.html` 尚未修復（無 SIM_TIME_DILATION 定義,優先級低） |

## 已修正的過時資訊

舊文件(`docs/PROJECT_OVERVIEW.md`、`CODEX_CONTEXT_SUMMARY.md`、`CHECKPOINT_2026-07-10.md`)都寫「shared-physics-core Phase 2 尚未開始」「HTML 遷移尚未 commit」——這是文件寫成當下(2026-07-10 稍早)的真實狀態,但當天稍後就完成並 commit 了,文件沒有回頭更新。實際 git 記錄:

- `733d5ce` shared-physics-core Phase 1:5 常數 + 2 函式
- `273a254` shared-physics-core Phase 2:8 常數 + 4 函式(含 `bounceWithSpinPhysical`)+ VAL-003 發球批次驗證(16/16 通過)
- `b870d53` Add isolated video timeline prototype and WebM tooling
- `23fdb86` video-physics-timeline 原型更新：shared-core bridge、direction-c 探索、投影輔助與配套工具

## 目前活躍的工作支線:手機版影片→物理切鏡(prototype 限定)

在 `prototypes/video-physics-timeline/` 隔離原型中探索「真人發球影片 + 物理模擬回合」如何在手機直式畫面呈現,**完全未接入正式 Trainer**。目前狀態:

- 已建立時間軸引擎、WebM 產生器、投影/校準輔助工具、handoff-calibrator(見 `AI_CONTEXT/ARCHIVE/checkpoints/CHECKPOINT_WEBM_GENERATOR.md`、`CHECKPOINT_VIDEO_PHYSICS_BRIDGE.md`、`CHECKPOINT_WEBM_PREVIEWER.md`、`CHECKPOINT_HANDOFF_CALIBRATOR_PHASE1.md`)。
- 已用單支真人影片 `real_backspin_001`(來源 `images/contact_backspin/contact_backspin_001.mp4`)做探索性 handoff 實驗:觸球 anchor 與物理投影落差約 245–382px(不同工具測得數值略有差異),**尚未修正**,`generation_status: "ready"` 只是實驗操作性設定,不是正式驗收。
- 產品方向草案(方向 C:桌面持續可見、影片層明確切換退場)與 Claude 邊界審理仍在 `AI_CONTEXT/DRAFTS/mobile-video-to-physics-c-*.md`,停在 Gate 0(尚未獲使用者確認要不要進入視覺實驗)。
- `prototypes/` 底下的檔案已於 `23fdb86` commit（shared-core bridge、direction-c 探索、投影輔助、anchor 選點器、影片庫介面等）。
- 2026-07-13 修掉 `tools/video-library-shell/library-app.js` 的黑屏 bug:`annEls`(以及類似的 `libEls`)是靠 `Object.fromEntries(idList.map(id => [id, $(id)]))` 從一份 id 字串陣列產生的,陣列漏列一個 HTML 裡實際存在的 id(這次是 `sourceName`)時,該屬性變成 `undefined`,之後任何 `annEls.xxx.value = ...` 會丟出 `TypeError`——而且是在 DOM event listener 內部丟的,不會被外層 try/catch 接住,主控台也不一定顯眼,容易被誤判成影片載入失敗。`direction-c-annotator`、`physics-studio` 等其他工具頁如果用同樣的 id-list 模式,改 HTML 時要記得同步改 JS 那份陣列。

## 2026-07-14 尺度一致性修復

模擬使用縮放重力 gravity = -4.2 m/s²（真實 -9.8），速度只有真實的 65.5%。`SIM_TIME_DILATION = √(9.8/4.2) = 1.528` 用於補償。

**問題**：桌面接觸（`bounceWithSpinPhysical`）用模擬尺度速度 + 真實尺度旋轉，兩者不一致。球拍接觸（`bounceOffPlaneSubstepped`）有做 D 轉換但旋轉被過度放大。結果：下旋保留率被高估 18%，不轉球上旋製造量被低估 53%。

**修復**：`game4.html` 和 `return-studio.html` 三處已修正——`simulatePath`（桌面彈跳呼叫前後加 D 轉換）、`simulateServe`（preset 旋轉除以 D）、`serveBounceScore`（同上）。`physics-studio.html` 尚未修復。

**語義變更**：`simulatePath` 輸出的 `spins` 陣列現在是模擬尺度，顯示真實 rad/s 需乘以 D=1.528。所有新工具應在輸出時自動轉換。

**驗證**：16/16 preset 正常，軌跡不變，下旋每次彈跳保留率從 75% 修正為 61%（更接近真實）。

## 2026-07-14 切球物理曲線實驗計畫

建立了完整的實驗計畫書（`AI_CONTEXT/EXPERIMENT_PLAN.md`），涵蓋 7 個群組、20 個實驗、約 1500 格數據，回答五個核心問題（拍面角度/力道、下旋穩定連續、彈跳後旋轉衰減、側旋抵銷）。可在獨立對話視窗中由 subagent 並行執行，計算在 Node.js 本地完成。


## 2026-07-14~15 切球物理實驗執行 + 參數校準 + fallback 修復

20 個實驗全部執行完成（7 個群組、約 1746 格數據點、6 個新工具）。原始 JSON 在 AI_CONTEXT/*_2026-07-14_raw.json。

### 主要改動

1. PADDLE_BLEND 從 0.65 校準為 0.605：三球過網安全交集 [0.55, 0.66]，中點 0.605 ± 0.055。瓶頸 preset 過網裕度從 1.9 cm 提升到 10.2 cm。已同步更新 game4.html、return-studio.html、全部 docs。
2. solveRacketVelXForTargetLandingX fallback bug 修復：舊版找不到有效著陸時靜默回傳 -incomingVel.x。新版改用側旋補償公式 rx = -0.062 × sidespin_real + incomingVel.x 作降級回傳值，加入 console.warn。game4.html 和 return-studio.html 已同步修復。
3. 側旋補償公式：從群組 4B 零穿越點萃取，planeVel.x = -0.062 × sidespin_real + incomingVel.x，跨三 preset 驗證殘差 < 0.25 rad/s。
4. PUSH_LIFT_VY_K 加入但校準為 0：給 computeAdaptivePushLift 加了 vy 適應性補正架構，但搜描顯示線性修正不能壓平振繚。已回退為 0，架構保留。

### 連續對打測試結果

14/16 preset 達成 50 回合穩定循環（失敗的 2 顆是不轉球，非切球目標）。backspin_long_backhand 在 5~6 回合收敛：速度 2.74 m/s、側旋衰減到 ±7 rad/s、每拍反轉旋轉方向（對方接到下旋）。

過網高度振繚 60 cm 是幾何現象：兩邊用相同參數打出完全相同的出球軌跠（vy=1.582、speed=2.74），但擊球點 Z 位置不同（一邊 2.06 m、一邊 1.13 m 離網），同一條拋物線從不同距離飛到網，高度自然不同。這是站位差異造成的穩定雙週期，不是參數問題。

### 旋轉方向註記

程式碼中的 topspin 是繞 X 軸角速度。出球方向與來球相反時，正號 canonical topspin = 對方接到的下旋（旋轉方向在絕對坐標上反轉）。切球把 canonical topspin 從負翻正是合格切球的定義行為，不是「產生上旋」。詳見 push_clean_reference_library.md 頂部註記。

## 兩層規則(取代舊的 Gate 0/1/2 審理流程)

見 `AI_CONTEXT/00_READ_ME_FIRST.md`。簡言之:紅線檔案改動前要先討論;`prototypes/` 資料夾內的複製測試、參數調整、影片試用一律自由,不需要審理表格。

## 還沒解決的事

見 `AI_CONTEXT/OPEN_ITEMS.md`,不在這裡重複列。
