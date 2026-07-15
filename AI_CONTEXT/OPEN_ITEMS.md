# 待決定事項清單

> 這份清單只負責「不要讓舊 TODO 隨著文件瘦身消失」,不評判優先度、不預設答案、不擅自關閉任何一項。逐項看完覺得不重要了,直接刪掉該條即可——不需要走任何審批流程。
>
> 更新日期:2026-07-15

## 物理模型相關(來源:`docs/MODEL_DECISIONS.md`)

- **TODO-001**:`return-studio.html` 的研究機制(blend、substepped push 等)要不要有部分回寫 `game4.html`?目前只能描述兩者差異,不能替任一方背書。
- **TODO-002**:`game4.html` 仍保留 loop/拉球舊 direct model,`return-studio.html` 已移除——loop 要不要重新設計、要不要納入球拍接觸力學?
- **TODO-003**:切球是否有「子彈感/碰撞感」,是否跟法向反彈係數過高有關?尚未驗證。
- **TODO-004**:`blend` 的替代物理機制——tangential compliance、contact-point velocity、finite racket mass、膠皮/海綿模型等方向,要不要取代或限制 blend?
- **TODO-005**:目前沒有標準 `npm test` 或同等驗證入口,要不要建立?
- **TODO-006**:`scale` / `outputRescale` 一致性檢查,狀態為「待驗證」。
- **TODO-007**:重新推導 `tiltX` / `tiltY` 範圍,狀態為「待驗證」。
- **TODO-008**:部署前確認清單,狀態為「待驗證」。

## 2026-07-15 TODO-001~007 逐項覆核(使用者要求核對後決定是否結案)

> 每項都實際比對過 game4.html/return-studio.html/physics-studio.html 程式碼跟 docs/ 現有文件,不是憑印象打勾。

- **TODO-001：不結案**。`PADDLE_BLEND`、Stage 4a 彈簧-阻尼常數、`computeAdaptivePush*`、`applyPushContact`、`solveRacketVelXForTargetLandingX`(含側旋補償 fallback)在兩個檔案裡數值/邏輯一致。但還有兩處結構性差異：(1) `bounceOffPlane()` 的函式簽名不同——`return-studio.html` 多一個 `blend` 參數並會呼叫 `computeBlendedNormal`,`game4.html` 完全沒有這個能力(目前所有呼叫點都用 `blend=0` 所以行為一樣,但不是同一份程式碼);(2) `game4.html` 留了一個沒有呼叫點的死函式 `solveRacketVelXForTargetOutX`,`return-studio.html` 沒有。核心邏輯確實同步了,但「完全同步」這句話還不精確,先照實記錄,要不要花時間把這兩處也對齊是另一個判斷。
- **TODO-002：維持 Pending**,使用者確認還沒做到這裡。
- **TODO-003：不結案**。`docs/MODEL_DECISIONS.md`、`docs/PHYSICS_MODEL_SPEC.md` 現在都還寫「這仍是待驗證,不是已決策」。「負向求解」bug(EXP-042,`solveRacketVelXForTargetLandingX` 找不到有效落點時舊版靜默回傳 `-incomingVel.x`)已確認修復,但文件上這是跟「子彈感/碰撞感」完全分開的兩件事——子彈感的根源假說是法向反彈係數(epsilon)過高,EXP-042 修的是側旋瞄準的 fallback 值,兩者目前沒有文件把它們接在一起。如果使用者是透過實際試玩覺得手感已經改善,這是合理的收斂依據,但建議明確記成「試玩確認,非數據驗證」,跟原本「待驗證」的量化要求分開,避免以後有人以為是量出來的。
- **TODO-004：不結案,但更新現況**。Stage 4a 的彈簧-阻尼模型(海綿+木板串聯)已經實作,是`PADDLE_BLEND` 的**互補**機制,不是取代：`PADDLE_BLEND` 決定接觸法向量(要不要偏向球實際接近方向),彈簧-阻尼模型決定「決定好法向量之後」壓縮/釋放的接觸動態——`applyPushContact()` 裡是先算 `computeBlendedNormal()` 再把結果餵給 `bounceOffPlaneSubstepped()`,兩層前後接續,不是二選一。TODO-004 原本問的「要不要用 tangential compliance/contact-point velocity 等機制取代 blend」這個問題仍然開放,海綿模型沒有回答到這一題。
- **TODO-005：維持 Pending**,使用者要求先解釋,見下方說明,還沒有要建立的決定。
- **TODO-006：可結案(game4.html + return-studio.html 範圍)**。兩個檔案都定義 `SIM_TIME_DILATION` 並在同樣三個轉換點套用(`simulatePath`/`simulateServe`/`serveBounceScore`),跟 STATUS.md「2026-07-14 尺度一致性修復」的記錄一致。`physics-studio.html` 完全沒有 `SIM_TIME_DILATION`,line 990 的桌面接觸呼叫沒有做尺度轉換——這部分維持原本標記的「優先級低,待需要時再修」,不算在這次結案範圍內。
- **TODO-007：可結案(切球/push 範圍)**。`PUSH_TILT_Y=1.0` 有完整 sweep 校準紀錄(`tools/push-tilty-*-sweep-calibration.js`,11 顆校準發球全過網),`computeAdaptivePushTiltX()` 固定回傳 0 是 EXP-037 的既定架構決策,不是遺漏。`docs/MODEL_DECISIONS.md` 對 TODO-007 本來寫的適用範圍就是「`return-studio.html` 研究版、切球/push 聯合校準流程」,不含攻球。攻球(`forehand_attack`/`backhand_attack`)的 `racketNormalTiltY:0.1`/`racketNormalTiltX:0` 目前還是最初的固定值,沒有找到任何專屬校準紀錄——如果之後要校準攻球的拍面角度,這仍是全新的工作,不是這次結案範圍。

### TODO-005 是在做什麼(說明,非結案)

現在 repo 沒有 `package.json`,也沒有任何「一個指令跑全部驗證」的入口。`tools/` 底下有兩種完全不同性質的檔案，肉眼看檔名分不出來：

1. **真的有 pass/fail 判定的**：`batch-validation.test.js`、`return-studio-batch-validation.test.js`、`serve-batch-validation.test.js` 這 3 支——內部真的算「幾個過、幾個沒過」，失敗時會 `process.exit(1)`。但沒有共用測試框架(不是 Jest、不是 Node 內建 `node:test`)，是自己寫的判定邏輯，而且要一支一支手動 `node tools/xxx.test.js` 執行，沒有一個指令能全部跑完再彙總結果。
2. **沒有 pass/fail 概念的**：其餘約 20 支校準/掃描工具(像 `push-tilty-sweep-calibration.js`)——只是印一張數值表、寫一份報告給人看，本身不會因為「結果變差」就失敗，永遠 exit 0，除非腳本本身當機。

TODO-005 問的是：要不要花時間補一個 `package.json` + 一個 `npm test` 指令，把上面第 1 類的 3 支串起來一次跑完、彙總結果，並且讓「這是真測試」跟「這是校準工具」的區分不用靠記檔名——目前答案還是看你要不要投資這件事，沒有預設。

## 2026-07-14 新增

- **SCALE-FIX-001**：桌面接觸尺度一致性 bug 已在 `game4.html` 和 `return-studio.html` 修復。`physics-studio.html`（line 990）有同樣問題但無 `SIM_TIME_DILATION` 定義，是純研究工具，優先級低，待需要時再修。
- **EXPERIMENT-PLAN**：✅ 已完成。全部 20 個實驗、約 1746 格數據點在 2026-07-14 執行完畢。結果記錄在 AI_CONTEXT/push_clean_reference_library.md。
- **TODO-006 更新**：`scale` / `outputRescale` 一致性問題的具體表現已找到並修復——桌面接觸用模擬尺度、球拍接觸用真實尺度，`spins` 輸出現為模擬尺度（需乘 D=1.528 轉真實）。


## 2026-07-14~15 新增/解決

- **FALLBACK-FIX**：✅ solveRacketVelXForTargetLandingX 靜默 fallback bug 已修復。舊版回傳 -incomingVel.x，新版改用側旋補償公式 + console.warn。
- **SIDESPIN-COMP**：✅ 側旋補償公式 planeVel.x = -0.062 × sidespin_real + incomingVel.x 已推導並跨 preset 驗證。
- **BLEND-CAL**：✅ PADDLE_BLEND 從 0.65 校準為 0.605，安全交集 [0.55, 0.66]。
- **VY-ADAPT**：✅ PUSH_LIFT_VY_K 架構已加入，搜描顯示最佳值為 0。架構保留，非線性方案待未來探索。
- **RALLY-TEST**：✅ 14/16 preset 達成 50 回合穩定循環。過網振繚 60 cm 是擊球點 Z 位置不同造成的幾何現象，非參數問題。
- **SPIN-ANNOTATION**：✅ canonical topspin 符號方向註記已加入 push_clean_reference_library.md、rally 工具程式碼。isBackspin 檢查從 <= 0 修正為 > 0。
## 工具化缺口

- **READ_ONLY_PHYSICS_EXTRACTOR**:規格寫過兩輪(`docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md`、GLM 任務包 017/018),但工具本身沒有真的做出來。還要不要做?
- **VAL-005 Phase 2(CMD-005)**:VAL-005 回擊批次驗證已於 2026-07-12 工具化(`tools/return-studio-batch-validation.test.js`,64 組合全數產生結果,報告在 `AI_CONTEXT/val005_return_studio_test_output.txt`);但 Phase 2 切球時機窗口取樣(CMD-005 run-push-window-scan)未做,需另開任務包。另外工具化時發現 `simulateReturnForPreset()` 的 `side` 參數在函式體內未被使用(push 雙側結果相同),是否為預期行為待釐清。

## 產品方向決策

- **MVP 主線是否開始實作**:`docs/MVP_MAINLINE_SPEC.md` 已定義窄版可玩迴圈,但每一份舊 checkpoint 都寫「決定是否進入 MVP 主線實作」,目前仍未拍板。
- **`return-studio.html` 定位**:是否永遠只是研究工具,或哪些機制未來要走正式審查流程進 `game4.html`?

## 2026-07-15 新增(game5.html,現況見 `STATUS.md`)

- **平推/攻球側旋補償常數未校準**:`game5.html` 的 `SIDESPIN_COMPENSATION_C=3.4` 只針對切球技術用 fixed-C-sweep 校準過,平推/攻球技術的接觸模型不同(非 substepped),暫時共用同一個值,還沒有專屬 sweep 驗證是否合適。
- **側旋影片左右分類的鏡頭方向未經人工驗證**:`contact_sidebackspin_left`/`_right` 影片配對用的是「跟按鍵判定內部一致」的求解器 sign,不是真人影片鏡頭方向的量測——需要使用者實機看過影片確認方向對不對,不對的話是改一個常數的事,不是重新設計。
- **auto-contact-tagger 需要重跑 + 擴大覆蓋**:2026-07-15 影片庫重新分類後,舊的 `batch-out` 標註結果路徑全部失效;而且現有標註本來就只覆蓋一小部分影片庫。`game5.html` 的影片交接時機點(`VIDEO_CONTACT_FRACTION_GUESS=0.7`)是粗估值,等標註補齊後要換成每支影片的真實觸球時間。
- **`contact_sidespin_left`/`_right`(純側旋影片,24 支)沒有對應 preset**:`physics-presets.json` 目前只有 `sidebackspin_*`(側下旋),沒有純側旋的 preset,這個影片分類目前排除在 `game5.html` 的隨機配對池之外。

## 手機版影片→物理支線(現況見 `STATUS.md`)

- **real_backspin_001 的 handoff 落差**:已由 Direction C 重新定框解決——不假造幾何連續,改用「影片層明確退場 + 固定球路入口訓練球」的切鏡語意(見 STATUS.md「已完成的研究支線」)。早期「把 initial_ball_state 改到觸球點」的修正方向已隨幾何連續路線一起放棄。
- **`docs/physics-engine-v2-plan.md` 後段研究拆解**:原本有 `PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md` / `PHYSICS_RESEARCH_TAIL_INDEX.md` 計畫要把這份 214KB 長文拆成一條條 EXP/DEC/RES/TODO,這次瘦身把整份文件連同拆解計畫一起移進 `docs/ARCHIVE/`,拆解工作等於暫停——如果之後真的要查歷史細節,去 `docs/ARCHIVE/physics-engine-v2-plan.md` 找,還要不要繼續拆分是開放問題。
