# 專案現況

> 唯一的「現在狀態」入口。取代 `docs/PROJECT_OVERVIEW.md`、`CODEX_CONTEXT_SUMMARY.md`、舊 checkpoint 系列的即時資訊角色——那些文件已移入 `AI_CONTEXT/ARCHIVE/`,僅供追溯原始脈絡用,不再是必讀。
>
> 更新日期:2026-07-16

## 專案是什麼

桌球接發球反應訓練工具,使用者自己在學桌球過程中發想,逐步加入簡化物理模擬讓體感更直覺。目前是個人練習/驗證階段,尚未有外部使用者依賴正式頁面。已有教練對前一版(偏文字遊戲)給過真實回饋。

## 核心檔案角色(紅線,改前需先討論)

| 檔案 | 角色 | 現況 |
|---|---|---|
| `game4.html` | 正式遊戲頁 | attack / push 走球拍接觸路徑;loop 仍是舊 direct model;已改用 `shared-physics-core.js`(已 commit);2026-07-14 修復桌面接觸尺度一致性 bug（見下方「2026-07-14 尺度一致性修復」） |
| `game5.html` | MVP 主線遊戲頁 | BUILD v9k02（未 commit）:起拍延遲模型 + 球拍 mesh/擊球演出 + 手勢化技術鍵 + 鏡頭動態收回;影片↔發球已改成 videoId 1:1 配對（commit `90b6cba`） |
| `match-trainer.html` | 正式訓練頁 | 未在本輪改動範圍內 |
| `shared-physics-core.js` | 共用物理核心 | **Phase 1、Phase 2 皆已完成並 commit**(見下方「已修正的過時資訊」) |
| `videos.json` | 題庫影片/圖片資料 | 55 筆、48 筆 `kind: video`、47 筆 approved video；`contact_sidebackspin`/`contact_sidespin` 已依左右側旋拆成 `_left`/`_right` 四個分類(見下方「影片庫左右分類重整」);沒有「允許的長短/落點/速度變體」欄位 |
| `physics-presets.json` | 發球 preset 資料 | 目前是 47 個 per-video generated preset；每筆帶 `videoId`、`sideName`、`curveDirection`，由 `serve-generator.html` 產生 |
| `serve-generator.html` | 發球產生器工具 | 2026-07-15 新增（commit `90b6cba`），後續已修正左右側旋語意：旋轉名稱與球路方向分離、不再依 sign 鏡像路徑；讀 `videos.json` 每支 approved video 產生一個 preset |
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

建立了完整的實驗計畫書（`AI_CONTEXT/adhoc-experiments/EXPERIMENT_PLAN.md`），涵蓋 7 個群組、20 個實驗、約 1500 格數據，回答五個核心問題（拍面角度/力道、下旋穩定連續、彈跳後旋轉衰減、側旋抵銷）。可在獨立對話視窗中由 subagent 並行執行，計算在 Node.js 本地完成。


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

## 2026-07-15 側旋語意契約調查與發球產生器修正

這次調查確認：問題不是單一 sign typo，而是早期同一個 `sidespin` 數值同時承擔了「左／右側旋名稱」、「球路往哪邊彎」與「是否鏡像 x 路徑」三種語意。案例少時，這個資料契約缺口沒有被批次驗證暴露。

- 正式語意入口：`docs/specs/SPIN_DIRECTION_CONTRACT.md`。
- 左側旋在目前 legacy x-kick 引擎中使用負 `sidespin`，球路方向為 `right`。
- 右側旋使用正 `sidespin`，球路方向為 `left`。
- `serve-generator.html` 已移除依 sign 鏡像整條路徑的邏輯，並將 `sideName` / `curveDirection` 寫入 preset tags。
- `physics-presets.json` 已重新同步 47 筆 approved video preset；`tools/serve-generator-contract.test.js` 檢查一對一配對、label、sign 與方向欄位。
- 已建立 `tools/serve-success-gate.js` 作為共用成功條件：無網碰、第一跳在發球方桌內、第二跳在接球方桌內。重新產生共用幾何模板後，`game4.html` 與 `physics-studio.html` 均為 47/47 通過，cross-check 也為 47/47；目標落點誤差仍單獨列為 solver 診斷，不能把批次通過直接解讀成物理真實性。
- 共用模板修正：`long_backhand` 使用安全長球幾何；`short_backhand` 第一跳由 z=-0.60 移至 z=-0.45，避免右側下旋短球碰網。這是產生器層的全域修正，不是逐球手調。

目前仍未完成真正的 3D 側旋遷移：核心把 `sidespin` 當作沿 `z` 軸／x-kick 的工程代理，尚未使用垂直軸 `omega.y` 與 Magnus 飛行力。這是下一個紅線核心工作，不在本次產生器修正中假裝完成。

## 2026-07-15 新增 game5.html:技術＋方向判斷重製版(prototype → MVP 主線)

> 從 `game4.html` 分叉出來的新互動模型探索,**不是取代 `game4.html`**,紅線檔案本身沒有被動過。目的是重現使用者更早、偏文字化的訓練遊戲第一階段(判斷發球):看影片→看球飛出來→選技術。
>
> **2026-07-15 定調**:使用者已確認 `game5.html` 就是 `docs/specs/MVP_MAINLINE_SPEC.md` 窄版可玩迴圈的實作方向(決策記錄見 `AI_CONTEXT/OPEN_ITEMS.md`「產品方向決策」)。這是使用者決策,不是本節下方代碼證據能單獨推出的結論;已知物理/資料缺口(見下方「尚未做/需要人工確認」)仍然開放,定調不代表這些缺口已解決。

### 跟 game4.html 的主要差異

- **按鈕解耦**:原本「反手/正手區 × 3 技術(拉球/攻球/切球)」的分區按鈕,改成兩個完全獨立的維度——技術(切球/平推攻球,即時判定)+ 方向(左/右)。拉球(loop)先拿掉,對應 `OPEN_ITEMS.md` TODO-002,之後要重做。正手/反手改成依球實際落點自動判斷,純鏡頭用(已確認兩者物理完全相同,不是玩家判斷題)。
- **側旋補償改成固定量模型**:原本 `game4.html` 的 `RETURN_SKILL_LEVEL`(初階/中階/熟練)隨機抽樣補償比例,改成玩家每球主動判斷方向。按對方向 = 固定補償、按錯 = 反向補償、不按 = 不補償。`game5.html` 已整合 `SIDESPIN_COMPENSATION_C = 2.9`：47-serve holdout 為 64/101（baseline 55/101）,固定發球左右手勢檢查可分出向左出界/向右落桌。這是 Game 5 mainline 的候選整合,不是 3D 側旋或全域物理校準；`game4.html`/`return-studio.html` 仍保留各自研究基準值。**平推/攻球技術的接觸模型不同(非 substepped),仍沒有專屬 sweep。**
- **接上方向 C 的影片交接**:重用 `prototypes/video-physics-timeline/direction-c/direction-c-engine.js` 的狀態機跟「影片浮在桌面上方一塊固定區域」的版面慣例。拋球演出動畫拿掉,改成直接播發球影片,播到觸球那一刻淡出、物理發球同時進場——複刻 C3(驗證過的最佳手感)的做法。**2026-07-15 更新**:觸球時間點已不再是猜的——`auto-contact-tagger` 重跑全庫 48 支 mp4(commit `f94d50d`),粗標結果併入 `videos.json` 的 `contact_time_sec`(commit `b384bb5`,47 個 `kind=video` entry 全數補齊),`game5.html` 的 `playServeVideo` 已改成優先讀這個欄位,`VIDEO_CONTACT_FRACTION_GUESS=0.7` 只在欄位缺漏時當備援。粗標仍有約 3 frame 誤差,教練複核後可直接覆寫 `videos.json` 同欄位。
- **發球↔影片配對**(2026-07-15 三次演化,現為 videoId 1:1):最早用求解器算側旋方向 sign,第二版改成分類隨機配,第三版（commit `90b6cba`）改成**每支影片一個專屬發球 preset**——目前 `serve-generator.html` 讀 `videos.json` 的 47 支 approved 影片，依 `docs/specs/SPIN_DIRECTION_CONTRACT.md` 分開處理旋轉名稱、球路方向與位置模板，產生 47 個 preset，每個帶 `tags.videoId`、`sideName`、`curveDirection`。`game5.html` 的 `pickRoundForNextServe` 改成先掃 `videoId` 做 1:1 配對,舊 preset（沒有 `videoId`）走分類隨機 fallback。`presetsForVideoCategory` 同時改成泛型（`tags.videoCategory` 直接配,舊 preset 走 id 前綴 fallback）。**使用者要先用 serve-generator.html 下載新的 physics-presets.json 覆蓋舊的,Game 5 才會吃到新發球**——工具預設「只保留新發球（清掉舊 preset）」,打勾下載即是。
- **發球選單拿掉**:原本手動選 preset 的下拉選單移除(使用者要求「先把選單拿掉,之後會重新設計」),改成每次「開始發球/下一球」由系統隨機配對。側邊欄(桌面版才顯示)留了「這一球」除錯資訊顯示目前配對結果。
- **手機優先版面**:預設/開始/下一球一開始放在頂部窄 bar,後來使用者反映伸手不順,改成浮動在畫面下方中央(`serve-controls`,`action-pad` 正上方)。側邊欄(軌跡顯示、速度、難度、自動最佳時機、範圍解模式等校準用控制)手機版整個隱藏,桌面版維持可見。確認過手機視窗高度下不需要捲動即可完整遊玩。
- **操作按鈕常駐 + 不鎖時間**:按鈕(技術/方向)一開始就常駐畫面,不能按時用灰階呈現(不是消失再彈出);且從發球準備好那一刻就能按,不用等球飛到特定時機點——這是使用者明確要求的簡化(先不鎖時間),不是計時器 bug。過程中修過兩輪回歸:一次是 `playServe()` 自己把 `inputWindowOpen` 重設回 false 把鎖鎖回去,一次是「開始發球」重播同一球時漏了重置按鈕 disabled/highlight 狀態(跟 `prepareServe()` 的重置邏輯沒有共用到)。
- **影片區塊放大 + 鏡頭上抬**:影片區塊放大約 33%(面積),放大後球桌遠端會被蓋到一截,用 `THREE.Vector3.project()` 實際算過投影位置(不是用眼睛看猜的),加了 `GAME5_LOOKAT_Y_BOOST` 疊加在 game5 自己讀到的 `camera-config.json` lookAt 值上面——只影響這個檔案,`camera-config.json` 本身沒有動,`game4.html` 不受影響。

### 2026-07-15 起拍延遲模型 + 擊球演出 + 手勢化 + 鏡頭收回（BUILD v9k01→v9k02，未 commit）

> 四個概念問題的第一版實作,程式碼在 `game5.html`（已修改但尚未 commit,工作區差異 +330/-83 行）。狀態機和手勢路徑用無頭方式驗證通過,但瀏覽器面板背景時 rAF 凍結,完整視覺動畫未親眼確認——**實機試玩是下一步必要驗證**。

**起拍延遲模型(v9k01)**:
- 按技術鍵＝**起拍**,觸擊在 `SWING_DELAY_MS=100ms` 後（慢動作隨 `GAME_SPEED` 等比放慢）發生,接觸點就是那一刻球沿發球軌跡飛到的位置——球全程照軌跡播,不再瞬移。
- 延遲到點時球還沒過我方第一跳（可擊區外）：practice/match 直接**揮空**（球繼續飛完,結案顯示「揮空（出手太早）」）；beginner 自動改等該技術的最佳擊球點,提早按不受罰。
- 起拍了但球已掉過桌面高度＝「出手太晚,沒接到球」；沒按＝漏球,維持原樣。
- 技術鍵改成物理球開始飛才解鎖（影片播放中按了沒有球可打）；方向鍵在影片期間照常可按。
- 順手修了一個潛在 bug：`animatePath` 加了世代編號（`animToken`）,修掉 onFrame 回呼裡啟動新動畫時舊 tick 繼續排入下一幀的重入問題——AUTO 模式其實一直踩在這個坑上。

**擊球演出(v9k02)**:
- 球拍 mesh：起拍時出現在球側後方、延遲期間追著球走,觸擊瞬間拍面貼上球。球閃白放大 150ms,播合成擊球聲（WebAudio 直接生成,不用音檔）＋手機短震動。揮空時拍子掃過淡出。
- 畫面中央成敗大字卡（之前結果只在側欄,手機版看不到）+ 回球第一落點桌面標記（成功綠圓/失敗紅圓）。

**手勢化技術鍵(v9k02)**:
- 方向獨立按鍵區移除,下方只剩兩顆大技術鍵。按下＝起拍,延遲窗內手指往左/右滑超過 24px＝該方向側旋修正,滑回中間＝取消。鍵面泛黃提示帶了修正,觸擊那一刻才鎖定方向。beginner 提早按的等待時間也算滑動窗。

**鏡頭收回(v9k02)**:
- `GAME5_LOOKAT_Y_BOOST` 改成動態值——影片觸球交接、淡出的同時,鏡頭每幀平滑把取景收回全螢幕。長球（`length=long`）在鏡頭跟球時多往後拉 0.55。無影片的球整場直接用完整取景。

### 尚未做 / 需要人工確認

- 平推/攻球技術的 `SIDESPIN_COMPENSATION_C` 沒有專屬校準,沿用切球的值。
- 側旋影片左右分類的鏡頭方向跟按鍵判定方向是否一致,需要使用者實機看影片確認；程式內部語意契約已固定，但資料的攝影機視角仍需人工複核。
- `auto-contact-tagger` 標註覆蓋率：全庫 47 支已標完 `contact_time_sec`（粗標約 3 frame 誤差）,教練複核後可直接覆寫 `videos.json`。
- `SWING_DELAY_MS=100ms` 的手感需要實機確認——太慢改小、還是像瞬發就加到 120–150,改一個常數。
- match 模式下 100ms 內完成滑動會不會太緊（可考慮觸擊後短暫寬限期或加大延遲）。
- 球拍目前只有「追球＋貼上」,還沒有真正的揮拍弧線動畫；音色和震動強度是第一版數值。
- `serve-generator.html` 產生的 47 個 preset 已通過兩份 solver 的共用 legal-serve gate；但尚未在 Game 5 實機逐一確認視覺軌跡、旋轉讀感與玩家左右輸入，仍不能稱為逐一實機校準。
- 真正的 3D 側旋尚未完成：目前 `sidespin` 仍是 legacy x-kick proxy；若要改成垂直軸 `omega.y` + Magnus，需另案修改紅線核心並重跑全套驗證。

## 2026-07-16 3D 側旋校準 prototype 結案

> 本輪研究已執行完畢並封存證據，但依計畫定義不宣稱「真人物理校準完成」。下一階段轉入全 3D 主線遷移，見 `docs/plans/3D_PHYSICS_MIGRATION_PLAN.md`。

執行計畫：`docs/plans/3D_SIDE_SPIN_CALIBRATION_EXECUTION_PLAN.md`。完整原始輸出保存在 `AI_CONTEXT/game5_side_spin_calibration_2026-07-16/`，包含固定 manifest、source hash、raw JSON、metrics、summary、decision 與 G10 人工檢查矩陣。

### 結果與邊界

- G0–G5 的座標、47 球 baseline、Magnus sensitivity、bounce transfer 與球拍耦合篩選均完成；G1 legal gate 為 47/47。
- G6 push 補償沒有得到 `correct > none > wrong` 的可辨識結果，因此目前 `SIDESPIN_COMPENSATION_C=2.9` 沒有被這輪 3D 研究重新驗證。
- G7 只成立為 controlled approximation；G8/G9 已產出 holdout 與 All-47 報告，不代表實機或真人物理通過。
- G10 瀏覽器頁面可載入並播放影片，但代表資料的 metadata ID 與實際 `src` 檔名出現 offset，導致視角、視覺彎曲方向與手勢一致性不能標為 confirmed。
- sweep 中的 `Magnus coefficient=0.002793690356025591` 只是目前候選基線，不是採用參數；本輪沒有修改 `shared-physics-core.js`、HTML 紅線檔或正式 preset。

### 研究支線結論

本支線到此告一段落，不再繼續在這份校準計畫內做參數 fitting。G10 的 ID/source contract 修正與重測，及後續 `omega.y`、Magnus、axial spin 的正式整合，改由全 3D 遷移計畫承接；在紅線審查前，不把 prototype 數值寫回正式核心或資料。

## 2026-07-16 同階段研究證據歸檔

本階段所有 3D／Game 5 研究輸出已保留原始路徑，並以 [`AI_CONTEXT/3D_RESEARCH_ARCHIVE_INDEX.md`](3D_RESEARCH_ARCHIVE_INDEX.md) 作為統一索引。索引區分物理 evidence、產品 readiness、歷史 duplicate 與下一階段 baseline，不把它們合併成單一「已完成」結論。

- `game5_side_spin_calibration_2026-07-16`：`CLOSED / PROTOTYPE WITH BLOCKERS`。
- `3d_baseline_2026-07-15`、`3d_diagnostic_2026-07-15`：`EVIDENCE RETAINED / REVIEW`。
- `game5_47_serve_calibration_*`、`game5_attack_narrow_calibration_2026-07-16`：`CANDIDATE / NOT PROMOTED`。
- `game5_mvp_validation_*`：`PRODUCT READINESS / PENDING`，與物理校準分開判讀。
- `3d_unified_physics_2026-07-16`：已由 baseline 進入 `FORMAL MIGRATION CHECKPOINT`；Phase 1／2／3 第一輪 shared-core 與頁面整合已完成，校準、preset re-solve、compliant-contact 完整共用化與視覺／手感驗證仍未完成。詳細結果見 `formal-migration-summary.md` 與 `formal-migration-failure-classification.md`。

## 2026-07-16 統一 3D 遷移第一輪正式整合

使用者已明確授權執行 `docs/plans/3D_PHYSICS_UNIFIED_MIGRATION_PLAN.md`，本輪因此進入紅線檔案的正式整合。`shared-physics-core.js` 已加入 schema-2 world-space `omega`、real-scale flight bridge、任意平面 contact-point impulse solver 與 2D Coulomb friction；Game 4、Game 5、Return Studio、Physics Studio 的 spin3d flight/table path 與球拍瞬時接觸 adapter 已同步，`physics-presets.json` 與 generator contract 已改為 schema 2。

核心測試、頁面載入器、inline JavaScript 解析均通過；shared core 另已補上可供 synthetic/measured input 使用的 generic compliant contact mode。本輪 R1 後續已將 Game 4、Game 5、Return Studio 的 substepped tangential contact impulse 接到 shared compliant-contact helper，同時保留各頁兩級拍面 normal dwell-time、finite-racket-mass 與 wrist-brake adapter；normal-force evolution 的完整共用化仍未完成。Serve batch 的 common legal-serve gate 為 game4 47/47、physics-studio 47/47，cross-check 47/47；target-precision 診斷為 91 passed / 50 failed，列為 forward-model 變更後的校準差異，不宣稱物理真值。Return Studio research batch 產生 188/188 結果、Exception=0，觀察性成功指標為 88/188。完整 evidence 保存在 `AI_CONTEXT/3d_unified_physics_2026-07-16/`，原始輸出不刪除、不搬移。

## 紅線審查原則（2026-07-16 更新）

見 `AI_CONTEXT/00_READ_ME_FIRST.md`。目前採「原型自由、正式升格審查」：`prototypes/` 可自由探索，但不得自動寫回正式資料或核心；正式檔案的契約內修正採 R0 輕量說明，改變物理狀態、座標／符號、尺度、旋轉耦合、資料 schema 或跨頁語意的變更採 R1，必須先提出目的、風險、相容性、rollback 與驗證並取得明確授權。一次性範圍授權不會取消 R1 模型不變量審查，也不會把 prototype 結果升格成物理真值。

## 還沒解決的事

見 `AI_CONTEXT/OPEN_ITEMS.md`,不在這裡重複列。

## 2026-07-16 Canonical omega 跨頁契約驗證

新增 `tools/physics-3d-cross-page-e2e.test.js`，驗證 Game 4、Game 5、Return Studio 的 `serve → flight → table → racket → return` canonical `spin3d.omega` 資料流。測試要求回擊與 push landing solver 明確傳遞 `spin3d`，同時保留 legacy `spin` 相容欄位；Return Studio 的 z mirror 也固定為 axial-vector 的 `omega.x/y` 反號、`omega.z` 保持。測試已通過；這是工程資料流證據，不是校準或物理真值。Game 5 三軸 HUD debug 顯示尚未在本輪加入。

## 2026-07-16 Mainline-v2 重建提案

 [`docs/plans/MAINLINE_V2_REARCHITECTURE_PLAN.md`](../docs/plans/MAINLINE_V2_REARCHITECTURE_PLAN.md) 已建立，作為下一階段的 R1 重建提案。它以目前 `CROSS-PAGE-OMEGA-001` checkpoint 為基礎，規劃建立以 Game 5 為主線、只使用 canonical `spin3d.omega` 的 `mainline-v2`；Phase V0 checkpoint 與 Phase V1 skeleton 已完成，仍不代表 full 3D migration 已完成。

本輪只新增獨立的 `mainline-v2/` skeleton 與 V1 contract test；沒有加入三軸 HUD、沒有重新解 47 個 preset、沒有做 measured calibration，也沒有擴大修改 Game 4、Return Studio 或 Physics Studio 的正式物理行為。V1 的瀏覽器入口仍是 inspection/smoke surface，執行入口與 Phase V0／V1 範圍見上述計畫書及 `mainline-v2/README.md`。

## 2026-07-16 Mainline-v2 Phase V0/V1 checkpoint

V0 凍結目前 `CROSS-PAGE-OMEGA-001` 的資料契約證據；legacy pages、shared core、正式 preset 與既有 evidence 保持可回溯。V1 新增獨立 `mainline-v2/`，以 canonical-only loader 建立 schema-2 world-space `omega`、real/simulation scale adapter、contact boundary 與 `idle → serve → flight → contact → return → result` 最小狀態路徑。`tools/mainline-v2.test.js` 已覆蓋缺少 `spin3d` 時 fail closed、finite omega、pure/mixed/zero/sign-reversed case 與 state path。這是工程契約／邊界證據，不是完整 3D migration、校準或物理真值宣稱。
