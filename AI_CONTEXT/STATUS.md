# 專案現況

> 唯一的「現在狀態」入口。取代 `docs/PROJECT_OVERVIEW.md`、`CODEX_CONTEXT_SUMMARY.md`、舊 checkpoint 系列的即時資訊角色——那些文件已移入 `AI_CONTEXT/ARCHIVE/`,僅供追溯原始脈絡用,不再是必讀。
>
> 更新日期:2026-07-11

## 專案是什麼

桌球接發球反應訓練工具,使用者自己在學桌球過程中發想,逐步加入簡化物理模擬讓體感更直覺。目前是個人練習/驗證階段,尚未有外部使用者依賴正式頁面。已有教練對前一版(偏文字遊戲)給過真實回饋。

## 核心檔案角色(紅線,改前需先討論)

| 檔案 | 角色 | 現況 |
|---|---|---|
| `game4.html` | 正式遊戲頁 | attack / push 走球拍接觸路徑;loop 仍是舊 direct model;已改用 `shared-physics-core.js`(已 commit) |
| `match-trainer.html` | 正式訓練頁 | 未在本輪改動範圍內 |
| `shared-physics-core.js` | 共用物理核心 | **Phase 1、Phase 2 皆已完成並 commit**(見下方「已修正的過時資訊」) |
| `videos.json` | 題庫影片/圖片資料 | 56 筆,46 筆 `reviewStatus: approved`;沒有「允許的長短/落點/速度變體」欄位 |
| `physics-presets.json` | 發球 preset 資料 | 近期未調整 |
| `return-studio.html` / `physics-studio.html` | 研究/調參工具頁 | 有 blend、substepped push 等研究機制,不等於 `game4.html` 已部署行為 |

## 已修正的過時資訊

舊文件(`docs/PROJECT_OVERVIEW.md`、`CODEX_CONTEXT_SUMMARY.md`、`CHECKPOINT_2026-07-10.md`)都寫「shared-physics-core Phase 2 尚未開始」「HTML 遷移尚未 commit」——這是文件寫成當下(2026-07-10 稍早)的真實狀態,但當天稍後就完成並 commit 了,文件沒有回頭更新。實際 git 記錄:

- `733d5ce` shared-physics-core Phase 1:5 常數 + 2 函式
- `273a254` shared-physics-core Phase 2:8 常數 + 4 函式(含 `bounceWithSpinPhysical`)+ VAL-003 發球批次驗證(16/16 通過)
- `b870d53` Add isolated video timeline prototype and WebM tooling

## 目前活躍的工作支線:手機版影片→物理切鏡(prototype 限定)

在 `prototypes/video-physics-timeline/` 隔離原型中探索「真人發球影片 + 物理模擬回合」如何在手機直式畫面呈現,**完全未接入正式 Trainer**。目前狀態:

- 已建立時間軸引擎、WebM 產生器、投影/校準輔助工具、handoff-calibrator(見 `AI_CONTEXT/ARCHIVE/checkpoints/CHECKPOINT_WEBM_GENERATOR.md`、`CHECKPOINT_VIDEO_PHYSICS_BRIDGE.md`、`CHECKPOINT_WEBM_PREVIEWER.md`、`CHECKPOINT_HANDOFF_CALIBRATOR_PHASE1.md`)。
- 已用單支真人影片 `real_backspin_001`(來源 `images/contact_backspin/001.mp4`)做探索性 handoff 實驗:觸球 anchor 與物理投影落差約 245–382px(不同工具測得數值略有差異),**尚未修正**,`generation_status: "ready"` 只是實驗操作性設定,不是正式驗收。
- 產品方向草案(方向 C:桌面持續可見、影片層明確切換退場)與 Claude 邊界審理仍在 `AI_CONTEXT/DRAFTS/mobile-video-to-physics-c-*.md`,停在 Gate 0(尚未獲使用者確認要不要進入視覺實驗)。
- `prototypes/` 底下的檔案目前都還沒 commit(`b870d53` 之後的異動)。

## 兩層規則(取代舊的 Gate 0/1/2 審理流程)

見 `AI_CONTEXT/00_READ_ME_FIRST.md`。簡言之:紅線檔案改動前要先討論;`prototypes/` 資料夾內的複製測試、參數調整、影片試用一律自由,不需要審理表格。

## 還沒解決的事

見 `AI_CONTEXT/OPEN_ITEMS.md`,不在這裡重複列。
