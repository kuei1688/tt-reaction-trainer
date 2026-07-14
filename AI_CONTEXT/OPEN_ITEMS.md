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

## 手機版影片→物理支線(現況見 `STATUS.md`)

- **real_backspin_001 的 handoff 落差**:已由 Direction C 重新定框解決——不假造幾何連續,改用「影片層明確退場 + 固定球路入口訓練球」的切鏡語意(見 STATUS.md「已完成的研究支線」)。早期「把 initial_ball_state 改到觸球點」的修正方向已隨幾何連續路線一起放棄。
- **`docs/physics-engine-v2-plan.md` 後段研究拆解**:原本有 `PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md` / `PHYSICS_RESEARCH_TAIL_INDEX.md` 計畫要把這份 214KB 長文拆成一條條 EXP/DEC/RES/TODO,這次瘦身把整份文件連同拆解計畫一起移進 `docs/ARCHIVE/`,拆解工作等於暫停——如果之後真的要查歷史細節,去 `docs/ARCHIVE/physics-engine-v2-plan.md` 找,還要不要繼續拆分是開放問題。
