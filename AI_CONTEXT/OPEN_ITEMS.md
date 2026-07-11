# 待決定事項清單

> 這份清單只負責「不要讓舊 TODO 隨著文件瘦身消失」,不評判優先度、不預設答案、不擅自關閉任何一項。逐項看完覺得不重要了,直接刪掉該條即可——不需要走任何審批流程。
>
> 更新日期:2026-07-11

## 物理模型相關(來源:`docs/MODEL_DECISIONS.md`)

- **TODO-001**:`return-studio.html` 的研究機制(blend、substepped push 等)要不要有部分回寫 `game4.html`?目前只能描述兩者差異,不能替任一方背書。
- **TODO-002**:`game4.html` 仍保留 loop/拉球舊 direct model,`return-studio.html` 已移除——loop 要不要重新設計、要不要納入球拍接觸力學?
- **TODO-003**:切球是否有「子彈感/碰撞感」,是否跟法向反彈係數過高有關?尚未驗證。
- **TODO-004**:`blend` 的替代物理機制——tangential compliance、contact-point velocity、finite racket mass、膠皮/海綿模型等方向,要不要取代或限制 blend?
- **TODO-005**:目前沒有標準 `npm test` 或同等驗證入口,要不要建立?
- **TODO-006**:`scale` / `outputRescale` 一致性檢查,狀態為「待驗證」。
- **TODO-007**:重新推導 `tiltX` / `tiltY` 範圍,狀態為「待驗證」。
- **TODO-008**:部署前確認清單,狀態為「待驗證」。

## 工具化缺口

- **READ_ONLY_PHYSICS_EXTRACTOR**:規格寫過兩輪(`docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md`、GLM 任務包 017/018),但工具本身沒有真的做出來。還要不要做?
- **VAL-005**:`return-studio.html` 回擊批次驗證尚未工具化(VAL-003 發球批次已工具化並通過 16/16)。

## 產品方向決策

- **MVP 主線是否開始實作**:`docs/MVP_MAINLINE_SPEC.md` 已定義窄版可玩迴圈,但每一份舊 checkpoint 都寫「決定是否進入 MVP 主線實作」,目前仍未拍板。
- **`return-studio.html` 定位**:是否永遠只是研究工具,或哪些機制未來要走正式審查流程進 `game4.html`?

## 手機版影片→物理支線(現況見 `STATUS.md`)

- **real_backspin_001 的 handoff 落差**(約 245–382px,不同工具量測數字不完全一致)尚未修正;下一步建議是把 `initial_ball_state.position_m` 改到觸球點附近,而不是拉長 `handoff.duration_sec` 用視覺模糊蓋掉落差。
- **`AI_CONTEXT/DRAFTS/mobile-video-to-physics-c-direction.md` 與 `mobile-video-to-physics-c-claude-review-plan.md`**:今天(2026-07-11)才討論過,停在 Gate 0。要不要跟著這次的規則簡化(拿掉 Gate 0/1/2 表格措辭,只留「紅線 vs 自由測試」兩層),還是保留原樣單獨處理?這兩份文件這次沒有動,故意留給你另外決定。
- **`docs/physics-engine-v2-plan.md` 後段研究拆解**:原本有 `PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md` / `PHYSICS_RESEARCH_TAIL_INDEX.md` 計畫要把這份 214KB 長文拆成一條條 EXP/DEC/RES/TODO,這次瘦身把整份文件連同拆解計畫一起移進 `docs/ARCHIVE/`,拆解工作等於暫停——如果之後真的要查歷史細節,去 `docs/ARCHIVE/physics-engine-v2-plan.md` 找,還要不要繼續拆分是開放問題。
