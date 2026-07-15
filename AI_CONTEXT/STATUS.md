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
| `videos.json` | 題庫影片/圖片資料 | 54 筆(2026-07-15 移除 2 筆已刪除檔案的殘留項目),46 筆 `reviewStatus: approved`;`contact_sidebackspin`/`contact_sidespin` 已依左右側旋拆成 `_left`/`_right` 四個分類(見下方「影片庫左右分類重整」);沒有「允許的長短/落點/速度變體」欄位 |
| `physics-presets.json` | 發球 preset 資料 | 近期未調整 |
| `return-studio.html` / `physics-studio.html` | 研究/調參工具頁 | 有 blend、substepped push 等研究機制,不等於 `game4.html` 已部署行為;`return-studio.html` 2026-07-14 同步修復尺度 bug,`physics-studio.html` 尚未修復（無 SIM_TIME_DILATION 定義,優先級低） |

## 已修正的過時資訊

舊文件(`docs/PROJECT_OVERVIEW.md`、`CODEX_CONTEXT_SUMMARY.md`、`CHECKPOINT_2026-07-10.md`)都寫「shared-physics-core Phase 2 尚未開始」「HTML 遷移尚未 commit」——這是文件寫成當下(2026-07-10 稍早)的真實狀態,但當天稍後就完成並 commit 了,文件沒有回頭更新。實際 git 記錄:

- `733d5ce` shared-physics-core Phase 1:5 常數 + 2 函式
- `273a254` shared-physics-core Phase 2:8 常數 + 4 函式(含 `bounceWithSpinPhysical`)+ VAL-003 發球批次驗證(16/16 通過)
- `b870d53` Add isolated video timeline prototype and WebM tooling
- `23fdb86` video-physics-timeline 原型更新：shared-core bridge、direction-c 探索、投影輔助與配套工具

## 已完成的研究支線:手機版影片→物理切鏡(方向 C,prototype 限定)

> 2026-07-15 收尾:研究階段完成,Direction C 已驗證,標註器工具 Phase 1/2 完成。整合進正式 Trainer 為紅線另案,尚未開始。

### 問題與放棄的路線

手機直式畫面要接「真人發球影片 + 物理回合」,但人物特寫影片的鏡頭比例與接球桌面視角不相容。用 `real_backspin_001`(來源 `images/contact_backspin/contact_backspin_001.mp4`)探索時,觸球 anchor 與物理投影落差約 245–382px,無法誠實呈現成同一顆球在同一座標系連續。幾何連續路線(把 `initial_ball_state` 改到觸球點、拉長 handoff 用 crossfade 蓋落差)已決定不再投入;早期探索記錄見 `AI_CONTEXT/ARCHIVE/checkpoints/CHECKPOINT_REAL_VIDEO_HANDOFF_EXPERIMENT.md`,WebM 產生器/handoff-calibrator 等舊工具隨之封存。

### 採用的方向 C 與驗證結果

方向 C:影片與桌面分為兩個視覺空間,接球桌面從頭持續可見,觸球瞬間影片層明確退場,一顆固定「球路入口」訓練球在桌面出現。球路入口是介面語意,不是真人軌跡量測。視覺實驗(C1/C2/C3)已於 2026-07-12 執行,**C3 勝出**(影片淡出 + 訓練球同時入場),reviewer 評為可接受且有活力,短暫重疊的位置差未造成混亂 handoff。結果見 `prototypes/video-physics-timeline/direction-c/RESULT.md`——這是產品可讀性證據,不是物理連續性宣稱。

### 標註器工具

`prototypes/video-physics-timeline/tools/direction-c-annotator/` Phase 1、Phase 2 完成:離線瀏覽器工具標註每支影片的觸球時間/觀察結束時間/球路入口位置,含 C3 真實物理預覽、自由選片、幾何一致性測試全過。

### 計畫文件位置

方向 C 產品規格、視覺實驗計畫、標註器計畫、自動粗標腳本計畫已搬到 `AI_CONTEXT/MOBILE_VIDEO_RESEARCH/`(脫離 DRAFTS,因為研究已完成)。

### 尚未做

- 標註器 Phase 3(變體草稿欄 + 匯入匯出)——視需要再排。
- 自動粗標觸球時間腳本(vision API):計畫已寫,當時卡在找不到合適視覺模型;2026-07-15 已確認可呼叫 Ollama cloud 的 Kimi-k2.7-code,待實作。
- 整合進正式 Trainer:碰紅線檔案(`game4.html`/`match-trainer.html`/`videos.json`/`physics-presets.json`),另案討論,未開始。

### 備忘

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

## 2026-07-15 影片庫左右側旋分類重整

`images/contact_sidebackspin/`、`images/contact_sidespin/` 依球實際側旋方向拆成 `_left`/`_right` 四個資料夾(`contact_sidebackspin_left`(7)/`_right`(6)、`contact_sidespin_left`(19)/`_right`(5))。`videos.json`(重新推導 `src`/`spinType`,順便修掉幾筆既有的 spinType 跟實際檔案不符的錯誤)、`index.html`/`match-trainer.html` 的 deprecated fallback 陣列、`admin.html`/`review.html` 的分類標籤、`README.md` 分類表格都已同步更新(commit `fb30481`)。`contact_sidebackspin_013.mp4`/`_014.mp4` 已確認為使用者主動刪除,`videos.json` 對應兩筆項目移除,不再指向不存在的檔案。

當天稍早跑的 `auto-contact-tagger` 50 支批次(`prototypes/video-physics-timeline/tools/auto-contact-tagger/batch-out/`)因為資料夾中途被重新分類而在 `contact_sidebackspin_014.mp4` 之後全部失敗(ffmpeg 讀不到舊路徑)。這批輸出沒有修,保留原樣當作歷史紀錄;要重新產生標註要對著新的 `_left`/`_right` 資料夾重跑,不是修這批。

## 2026-07-15 新增 game5.html:技術＋方向判斷重製版(prototype)

> 從 `game4.html` 分叉出來的新互動模型探索,**不是取代 `game4.html`**,紅線檔案本身沒有被動過。目的是重現使用者更早、偏文字化的訓練遊戲第一階段(判斷發球):看影片→看球飛出來→選技術。

### 跟 game4.html 的主要差異

- **按鈕解耦**:原本「反手/正手區 × 3 技術(拉球/攻球/切球)」的分區按鈕,改成兩個完全獨立的維度——技術(切球/平推攻球,即時判定)+ 方向(左/右)。拉球(loop)先拿掉,對應 `OPEN_ITEMS.md` TODO-002,之後要重做。正手/反手改成依球實際落點自動判斷,純鏡頭用(已確認兩者物理完全相同,不是玩家判斷題)。
- **側旋補償改成固定量模型**:原本 `game4.html` 的 `RETURN_SKILL_LEVEL`(初階/中階/熟練)隨機抽樣補償比例,改成玩家每球主動判斷方向。按對方向 = 固定補償、按錯 = 反向補償、不按 = 不補償。`SIDESPIN_COMPENSATION_C = 3.4`,取 6 顆 `sidebackspin_*` 代表球(`sidebackspin_half_long_backhand` 排除——命名雖是側旋,物理上更接近不夠乾淨的下旋球,已改配下旋類影片)安全交集 `[2.9, 3.8+]` 的中點,跟 `PADDLE_BLEND` 校準方法一致。**這個值只針對切球技術校準過,平推/攻球技術的接觸模型不同(非 substepped),暫時共用同一個常數,還沒有專屬驗證。**
- **接上方向 C 的影片交接**:重用 `prototypes/video-physics-timeline/direction-c/direction-c-engine.js` 的狀態機跟「影片浮在桌面上方一塊固定區域」的版面慣例。拋球演出動畫拿掉,改成直接播發球影片,播到約 70%(`VIDEO_CONTACT_FRACTION_GUESS`,沒有逐支標註觸球幀時的粗估值)淡出、物理發球同時進場——複刻 C3(驗證過的最佳手感)的做法,但**觸球時間點目前是猜的**,等 `auto-contact-tagger` 補齊全庫真實標註後要換成真值。
- **發球↔影片配對簡化**(2026-07-15 二次簡化,取代最早一版用求解器算側旋方向的做法):流程反過來,先隨機選影片分類(不轉/下旋/右側下旋,直接套 preset id 前綴,不計算),再從對應分類隨機挑一顆發球+一支影片。**「右側旋」(純側旋,非側下旋)分類目前排除在外**——`physics-presets.json` 完全沒有 `sidespin_*`(純側旋)的 preset,只有 `sidebackspin_*`,等真的有對應 preset 才加回來。**側下旋的左右分類(`sidebackspin_left`/`_right` 影片)是否跟真人影片的真實鏡頭方向一致,還沒有人工肉眼驗證過**——目前的分類邏輯只保證「配到的影片分類」跟「按鍵判定的對錯」內部一致,不保證跟影片實際拍到的方向一致(方向 C 本來的立場就是「介面語意,不是真人軌跡量測」)。
- **發球選單拿掉**:原本手動選 preset 的下拉選單移除(使用者要求「先把選單拿掉,之後會重新設計」),改成每次「開始發球/下一球」由系統隨機配對。側邊欄(桌面版才顯示)留了「這一球」除錯資訊顯示目前配對結果。
- **手機優先版面**:預設/開始/下一球一開始放在頂部窄 bar,後來使用者反映伸手不順,改成浮動在畫面下方中央(`serve-controls`,`action-pad` 正上方)。側邊欄(軌跡顯示、速度、難度、自動最佳時機、範圍解模式等校準用控制)手機版整個隱藏,桌面版維持可見。確認過手機視窗高度下不需要捲動即可完整遊玩。
- **操作按鈕常駐 + 不鎖時間**:按鈕(技術/方向)一開始就常駐畫面,不能按時用灰階呈現(不是消失再彈出);且從發球準備好那一刻就能按,不用等球飛到特定時機點——這是使用者明確要求的簡化(先不鎖時間),不是計時器 bug。過程中修過兩輪回歸:一次是 `playServe()` 自己把 `inputWindowOpen` 重設回 false 把鎖鎖回去,一次是「開始發球」重播同一球時漏了重置按鈕 disabled/highlight 狀態(跟 `prepareServe()` 的重置邏輯沒有共用到)。
- **影片區塊放大 + 鏡頭上抬**:影片區塊放大約 33%(面積),放大後球桌遠端會被蓋到一截,用 `THREE.Vector3.project()` 實際算過投影位置(不是用眼睛看猜的),加了 `GAME5_LOOKAT_Y_BOOST` 疊加在 game5 自己讀到的 `camera-config.json` lookAt 值上面——只影響這個檔案,`camera-config.json` 本身沒有動,`game4.html` 不受影響。

### 尚未做 / 需要人工確認

- 平推/攻球技術的 `SIDESPIN_COMPENSATION_C` 沒有專屬校準,沿用切球的值。
- 側旋影片左右分類的鏡頭方向跟按鍵判定方向是否一致,需要使用者實機看影片確認,不對的話是改一個 sign 的事。
- `auto-contact-tagger` 需要針對新的 `_left`/`_right` 資料夾重新跑批次,而且目前標註覆蓋率不到影片庫的 1/4,`VIDEO_CONTACT_FRACTION_GUESS=0.7` 這個粗估值要等標註補齊才能換真值。
- `contact_sidespin_left`/`_right`(純側旋影片,19+5 支)完全沒有對應的 preset,是已知缺口,不是這次要解決的範圍。

## 兩層規則(取代舊的 Gate 0/1/2 審理流程)

見 `AI_CONTEXT/00_READ_ME_FIRST.md`。簡言之:紅線檔案改動前要先討論;`prototypes/` 資料夾內的複製測試、參數調整、影片試用一律自由,不需要審理表格。

## 還沒解決的事

見 `AI_CONTEXT/OPEN_ITEMS.md`,不在這裡重複列。
