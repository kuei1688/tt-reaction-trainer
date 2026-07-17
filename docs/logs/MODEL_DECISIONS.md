# 模型決策紀錄

> 本文件是模型決策台帳，用來區分「目前採用的工程決策」、「已否定或已取代的舊方向」、「研究中候選」與「待決策事項」。
>
> 整理基準：2026-07-06  
> 主要參考：`docs/PHYSICS_MODEL_SPEC.md`、`docs/CORE_FILE_SYNC_STATUS.md`、`docs/EXPERIMENT_LOG.md`、`docs/physics-engine-v2-plan.md`
>
> 重要警告：GLM 草稿可協助分類，但不可作為最終事實來源。本文件中任何「已決策」都仍需能回到 repo 檔案、原始長文或可重跑驗證。

## 使用規則

- 實驗成功率不自動等於模型決策。
- 研究工具頁結果不自動等於正式遊戲已部署。
- `return-studio.html` 與 `game4.html` 有不同物理路徑，決策必須標明適用範圍。
- `blend=0.9`、高 blend、單次參數搜尋結果，只能作為研究訊號，不可直接升格成最終物理解。
- 每條決策都必須保留風險或待驗證事項，不使用「風險：無」。

## 決策格式

### DEC-XXX：決策標題
### 狀態：已採用 / 已取代 / 研究中 / 待決策 / 不採用
### 適用範圍
### 背景
### 決策
### 理由
### 影響
### 風險與待驗證事項
### 來源

---

## 已採用的工程決策

### DEC-001：物理量改用真實單位

### 狀態：已採用

### 適用範圍

發球 preset、桌面反彈、球拍接觸模型的文件與程式參數。

### 背景

早期模型使用較像「感覺係數」的旋轉值。整理後，專案朝真實物理單位收斂。

### 決策

距離使用公尺，速度使用 m/s，角速度使用 rad/s。發球旋轉由 rps 換算為 rad/s：`ω = 2π × rps`。

### 理由

真實單位讓桌面反彈、球拍接觸、發球 preset 與後續校準能共享同一尺度，避免不同工具頁各自使用隱性倍率。

### 影響

新文件與新校準不得再引入未標明單位的旋轉係數。舊文件中疑似感覺係數的值需標成歷史內容。

### 風險與待驗證事項

部分舊工具或歷史段落可能仍包含舊尺度數字。引用前需要確認該段落是否已完成 rad/s 遷移。

### 來源

`docs/physics-engine-v2-plan.md` Phase 0 / Phase 3；`docs/PHYSICS_MODEL_SPEC.md`。

### DEC-002：桌面摩擦係數採用 μ = 0.13 作為工程校準值

### 狀態：已採用

### 適用範圍

桌面反彈 v2 的桌球球體與球桌表面接觸計算。

### 背景

既有紀錄指出缺少可直接套用的桌球球體 vs 球桌表面實測摩擦係數。

### 決策

目前使用 `CONTACT_FRICTION_MU = 0.13`。

### 理由

原始長文記錄它是以弧線球感與校準結果收斂出的工程值。現有核心檔案中也可見該常數。

### 影響

文件可把 `μ=0.13` 寫成目前採用的工程校準值，但不可寫成材料物理真值。

### 風險與待驗證事項

`EPSILON_MIN`、`SPIN_EPSILON_REFERENCE` 等相關常數仍是工程常數。若之後引入更完整的接觸模型，`μ` 可能需要重新校準。

### 來源

`docs/physics-engine-v2-plan.md` Phase 2；`docs/PHYSICS_MODEL_SPEC.md`；`docs/CORE_FILE_SYNC_STATUS.md`。

### DEC-003：正式文件必須區分正式遊戲頁與研究工具頁

### 狀態：已採用

### 適用範圍

所有 AI handoff、物理規格、實驗紀錄與後續文件整理。

### 背景

目前 `game4.html`、`return-studio.html`、`physics-studio.html` 角色不同，而且已核對出 push、loop、blend、substepped 等路徑差異。

### 決策

文件不得把 `return-studio.html` 的研究功能直接寫成 `game4.html` 正式遊戲已部署。描述模型時必須標明檔案範圍。

### 理由

`return-studio.html` 有 `PADDLE_BLEND`、`computeBlendedNormal()`、`bounceOffPlaneSubstepped()` 等研究機制；`game4.html` 未核對到同等機制。`game4.html` 仍保留 loop 舊 direct model，而 `return-studio.html` 已移除 loop。

### 影響

後續模型摘要與 AI 任務包要優先使用「已核對正式行為 / 研究工具頁行為 / 待驗證」三分類。

### 風險與待驗證事項

目前只做了關鍵字與局部人工核對。若要把研究機制回寫正式遊戲，需要另外建立差異抽取與回歸驗證流程。

### 來源

`docs/CORE_FILE_SYNC_STATUS.md`；`docs/PHYSICS_MODEL_SPEC.md`。

### DEC-004：blend 不可作為最終物理解

### 狀態：已採用

### 適用範圍

切球 / push 研究、`return-studio.html` 相關工具頁、任何提及 blend 的文件。

### 背景

高 blend 值可以改善某些切球結果，但物理意義仍不明確，且可能是在補償模型缺項。

### 決策

`blend` 可以被記錄為研究中工程補償或候選機制，但不可將 `blend=0.9` 或高 blend 結果寫成最終物理解。

### 理由

高 blend 可能補償 tangential compliance、contact-point velocity、有限球拍質量、passive giving、膠皮/海綿等尚未建模因素。它能改善結果，不代表它本身就是正確物理機制。

### 影響

實驗紀錄中與高 blend 有關的成功率都必須保留警告。後續搜尋不應只追求更高 blend 的結果，而應檢查更具物理可解釋性的替代模型。

### 風險與待驗證事項

低 blend 是否仍能作為小幅修正項，需要高階模型審查與可重跑驗證。`PADDLE_BLEND = 0.605`（2026-07-14 從 0.65 校準，安全交集 [0.55, 0.66]，中點 0.605 ± 0.055）。

### 來源

`docs/physics-engine-v2-plan.md` 後段 blend 相關研究；`docs/PHYSICS_MODEL_SPEC.md`；`docs/EXPERIMENT_LOG.md`。

---

## 已取代或不採用的方向

### DEC-101：舊 techniqueVel 重新校準不可作為目前公式依據

### 狀態：已取代

### 適用範圍

Phase 5 相關攻球 / 切球重新校準結果。

### 背景

Phase 5 曾在新桌面反彈物理下重新校準 `techniqueVel`，但後續被球拍接觸力學方向取代。

### 決策

Phase 5 的 `techniqueVel` 搜尋結果保留為歷史紀錄，不作為目前模型規格或新公式依據。

### 理由

該階段主要針對過網與落點，沒有充分處理旋轉方向與球拍接觸力學。

### 影響

文件若提及 Phase 5，必須標明「已取代」。不得把它當成最新切球或攻球參數來源。

### 風險與待驗證事項

仍可能有歷史數字散落在長文中。整理時需避免跨版本混用。

### 來源

`docs/EXPERIMENT_LOG.md` EXP-006；`AI_CONTEXT/DRAFTS/model_decisions_draft.md`。

### DEC-102：tiltX hack 不可作為最新切球模型依據

### 狀態：已取代

### 適用範圍

反手側旋方向修正、切球拍面角度搜尋相關內容。

### 背景

歷史研究曾用誇張 `tiltX` 或拍面旋轉修正反手側旋方向問題。

### 決策

`tiltX hack` 與後續移除的 `tiltX` 回歸公式只能作歷史紀錄；在 `TODO-007` 完成前，不可作為最新模型依據。

### 理由

後續記錄指出該方向有不合理的拍面幾何問題，並轉向其他機制與瞄準修正。

### 影響

任何提及 EXP-019、EXP-035、EXP-037 的文件，都需要明確標明其後續取代關係，不可寫成現行規格。

### 風險與待驗證事項

目前仍需確認 `game4.html` 與 `return-studio.html` 中現存 tilt 公式各自代表哪一代設計；在 `TODO-007` 完成前，任何舊範圍都只能作歷史參考。

### 來源

`docs/EXPERIMENT_LOG.md` EXP-019 / EXP-035 / EXP-037；`docs/CORE_FILE_SYNC_STATUS.md`。

---

## 研究中候選，不得升格為決策

### RES-001：return-studio.html 的 substepped push

### 狀態：研究中

### 適用範圍

`return-studio.html`。

### 背景

`return-studio.html` 中存在 `bounceOffPlaneSubstepped()`、彈簧阻尼、wrist brake 等研究路徑。

### 目前判斷

這些是研究 / 工具頁行為，不是 `game4.html` 正式遊戲已核對部署內容。

### 風險與待驗證事項

需要決定它是否只是校準工具，或是否要經高階審查後回寫正式遊戲。若回寫，必須先建立可重跑驗證。

### 來源

`docs/CORE_FILE_SYNC_STATUS.md`；`docs/PHYSICS_MODEL_SPEC.md`。

### RES-002：Stage 1 / outputRescale 相關切球搜尋

### 狀態：研究中

### 適用範圍

切球 / push 研究結果，尤其 EXP-032 到 EXP-038。

### 背景

後段研究嘗試同時解決過網、落點與旋轉方向問題，並記錄目前最佳候選。

### 目前判斷

這些結果是重要研究訊號，但不可直接寫成最終公式或正式部署。

### 風險與待驗證事項

需要確認對應程式版本、測試集、是否已寫回核心檔案，以及是否能用標準命令重跑。

### 來源

`docs/EXPERIMENT_LOG.md` EXP-032 至 EXP-038；`docs/physics-engine-v2-plan.md` 後段。

### RES-003：blend 成為新的碰撞地基

### 狀態：研究中

### 適用範圍

`return-studio.html`、`game4.html` 的切球 / push 研究。

### 背景

後段研究顯示 `blend` 會同時影響旋轉方向與過網高度，且高 `blend` 會引入新的張力。

### 決策

`blend` 可以作為新物理地基的候選，但不可把高 `blend` 或 `blend=0.9` 寫成最終物理解。

### 理由

研究結果顯示它不是單純補償項，而是會改變球拍反彈路徑與瞄準一致性的核心因子。

### 影響

後續所有切球 / push 搜尋都要把 `blend` 視為主參數之一，而不是次要補丁。

### 風險與待驗證事項

高 `blend` 會同時拉高旋轉正確性與前進動能張力，需要和 `tiltY`、力道公式一起校準。

### 來源

`docs/physics-engine-v2-plan.md` 約 882-930、998-1037；`docs/PHYSICS_RESEARCH_TAIL_INDEX.md`。

### RES-004：移除 tiltX hack，改為 y-z 限制 blend 與獨立瞄準

### 狀態：研究中（對應舊機制已取代）

### 適用範圍

`return-studio.html` 研究版切球模型與瞄準機制。

### 背景

後段研究指出，為了修正反手側旋而讓拍面誇張旋轉的 `tiltX hack` 不合理；這裡僅保留為研究收斂紀錄。

### 決策

`tiltX hack` 應視為已取代；左右落點修正交給獨立瞄準機制，`blend` 只保留在 y-z 平面耦合。

### 理由

研究結果顯示，限制 `blend` 的作用平面後，不需要誇張拍面角度也能修正旋轉方向。

### 影響

後續文件不得把 `tiltX` hack 當成正式模型依據；若要引用此條，只能作為 `EXP-037` 對應的歷史收斂點。

### 風險與待驗證事項

雖然方向已清楚，但仍需確認正式頁與研究頁是否都已一致採用這個乾淨架構；這項確認應與 `VALIDATION_PLAN.md` 的 `VAL-009` / `VAL-010`、以及 `TODO-008` 一起看。

### 來源

`docs/physics-engine-v2-plan.md` 約 1184-1210；`docs/PHYSICS_RESEARCH_TAIL_INDEX.md`。

### TODO-006：`scale` / `outputRescale` 的一致性檢查

### 狀態：待驗證

### 適用範圍

`return-studio.html`、`push-optimizer.js` 相關研究路徑。

### 背景

後段研究多次抓到「瞄準求解」與「最終輸出」使用不同縮放物理的缺口。

### 決策

任何影響最終出球速度的機制新增後，都必須同步確認瞄準求解與實際碰撞是否仍使用同一套物理；這是一個檢查準則，不是已完成結論。

### 理由

`scale` 與 `outputRescale` 已顯示，如果內部求解和實際輸出不同步，就會出現落點偏移或視覺失真。

### 影響

後續驗證計畫要把這個一致性檢查變成固定項目，且應與 `VALIDATION_PLAN.md` 的 `VAL-009` 對應。

### 風險與待驗證事項

需要確定正式頁與研究頁的縮放路徑是否都已一致，否則不能把對單一候選的成功率當成定案。

### 來源

`docs/physics-engine-v2-plan.md` 約 1090-1224；`docs/PHYSICS_RESEARCH_TAIL_INDEX.md`。

### TODO-007：重新推導 tiltX / tiltY 範圍

### 狀態：待驗證

### 適用範圍

`return-studio.html` 研究版、切球 / push 聯合校準流程。

### 背景

舊物理下回歸出的 `tiltX` 與 `tiltY` 範圍，在 blend 改變物理地基後不應直接沿用。

### 決策

是否重新推導 `tiltX` / `tiltY`，必須先確認新的角色分工，而不是繼續沿用舊數值；在完成前，不能把舊範圍寫成現行常數。

### 理由

尾段研究已經顯示 `blend` 主導旋轉方向，`tiltY` 主導弧線與過網，兩者角色變了。

### 影響

後續文件不可再把舊校準範圍寫成已知常數；在重新推導完成前，應持續標為已取代 / 待重新推導。

### 風險與待驗證事項

這件事很可能需要新一輪的聯合搜尋，並配合新的驗證計畫重跑；與 `VAL-009` / `VAL-010` 的同步確認也要一併保留。

### 來源

`docs/physics-engine-v2-plan.md` 約 1256-1260；`docs/PHYSICS_RESEARCH_TAIL_INDEX.md`。

### TODO-008：部署前確認清單

### 狀態：待驗證

### 適用範圍

`return-studio.html` 研究版、`game4.html` 正式遊戲頁。

### 背景

尾段研究明確要求在把研究版機制寫回正式頁之前，先確認預設值、驗證分數與現有行為一致。

### 決策

`PADDLE_BLEND` 或兩階段版參數預設為 0 時，必須先驗證與既有行為完全一致，再談是否寫回正式頁；這裡只定義門檻，不代表已通過。

### 理由

如果預設值對不上，研究版與正式頁的比較就沒有基準。

### 影響

這個確認清單應該連到 `VALIDATION_PLAN.md`，成為正式的部署前門檻，並與 `VAL-010` 保持一致。

### 風險與待驗證事項

尚未完成完整回歸檢查，不能直接宣稱研究版機制已可部署。

### 來源

`docs/physics-engine-v2-plan.md` 約 1265-1268；`docs/PHYSICS_RESEARCH_TAIL_INDEX.md`。

---

## 待決策事項

### TODO-001：game4.html 與 return-studio.html 的同步策略

目前需要人類決定：`return-studio.html` 是否只是研究工具，或是否有一部分應回寫 `game4.html`。在決定前，文件只能描述差異，不能替任一方背書。

### TODO-002：loop / 拉球是否重設計

`game4.html` 仍保留 loop 舊 direct model，`return-studio.html` 已移除 loop。是否重新設計 loop、是否納入球拍接觸力學，需要另立決策。

### TODO-003：切球法向反彈係數是否需調整

既有文件提到切球可能有子彈感或碰撞感，可能和法向反彈係數過高有關。這仍是待驗證，不是已決策。

### TODO-004：blend 的替代物理機制

需要比較 tangential compliance、contact-point velocity、finite racket mass / passive giving、膠皮/海綿模型等方向，決定是否取代或限制 blend。

### TODO-005：正式驗證命令與通過門檻

目前 repo 沒有標準 `npm test` 或同等驗證入口。後續應建立可重跑命令、測試集與文件引用規則。

## 關聯文件

- `docs/PHYSICS_MODEL_SPEC.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/EXPERIMENT_LOG.md`
- `docs/DOCS_MAINTENANCE_PLAN.md`
- `AI_CONTEXT/DRAFTS/model_decisions_draft.md`

---

## 2026-07-14~15 新增決策

### DEC-103: PADDLE_BLEND = 0.605
- 依據：三球過網安全交集 [0.55, 0.66]（EXP-040）
- 效果：瓶頸 preset 過網裕度從 1.9 cm 提升到 10.2 cm
- 狀態：已套用，已同步至 game4.html + return-studio.html + 全部 docs

### DEC-104: solveRacketVelXForTargetLandingX fallback 使用側旋補償公式
- 依據：EXP-041 推導的 planeVel.x = -0.062 × sidespin_real + incomingVel.x
- 效果：取代舊的 -incomingVel.x（無意義），加入 console.warn
- 狀態：已套用，兩檔案同步修復

### DEC-105: PUSH_LIFT_VY_K = 0（架構保留）
- 依據：EXP-044 搜描顯示線性 vy 修正不能壓平振繚，最佳值為 0
- 狀態：已回退為 0，架構保留供非線性方案使用

### DEC-106: 左右側旋名稱與球路方向分離
- 背景：早期程式用 `sidespin` 正負號同時表示側旋名稱、球路彎曲方向與 x 路徑鏡像，案例少時未暴露語意衝突。
- 決策：`left/right` 是旋轉名稱；`curveDirection` 是球路方向；兩者必須分開儲存。依目前 legacy x-kick compatibility，左側旋使用負 `sidespin`、向右彎，右側旋使用正 `sidespin`、向左彎。
- 影響：`serve-generator.html` 不再依 sign 鏡像整條位置模板；`physics-presets.json` 的 per-video preset 必須帶 `sideName`、`curveDirection`、`videoCategory`、`videoId`。
- 狀態：已套用至產生器與 47 個 generated preset；由 `tools/serve-generator-contract.test.js` 守門。
- 限制：這只固定目前遊戲的 legacy x-kick 語意，不等於真實側旋物理。`omega.y` + Magnus 與 corkscrew 欄位另列為紅線遷移工作。
- 規格：`docs/SPIN_DIRECTION_CONTRACT.md`。

### DEC-107: 3D 側旋校準研究支線結案，轉入全 3D 遷移

### 狀態：已採用

### 適用範圍

`docs/3D_SIDE_SPIN_CALIBRATION_EXECUTION_PLAN.md`、Game 5 3D 側旋 prototype，以及後續 `omega.y` + Magnus 的正式遷移。

### 背景

2026-07-16 已用固定 47 球 manifest 執行 G0–G9，並嘗試 G10 瀏覽器／影片語意檢查。數值結果足以整理工程候選，但不具備影片量測或完整 push 分辨力，不能直接升格成物理真值。

### 決策

本輪研究以 **Prototype with blockers** 結案，不再在校準計畫內繼續 fitting。`Magnus coefficient=0.002793690356025591` 只保留為 evidence candidate；`SIDESPIN_COMPENSATION_C=2.9` 未被本輪 3D sweep 重新驗證。下一階段改由 `docs/3D_PHYSICS_MIGRATION_PLAN.md` 承接全 3D 主線。

### 理由

G0–G5 已完成基本數值篩選，G1 legal gate 為 47/47；但 G6 沒有得到 `correct > none > wrong`，G10 又發現 metadata ID 與實際影片 `src` 檔名 offset。把這些結果寫成「已校準」會超出證據。

### 影響

完整 raw evidence、summary、decision 與人工矩陣保留在 `AI_CONTEXT/game5_side_spin_calibration_2026-07-16/`。本輪不修改正式核心、HTML 或 preset；全 3D 遷移必須先處理 ID/source contract，再做紅線審查與重跑驗證。

### 風險與待驗證事項

G10 的視角、視覺曲線與手勢一致性仍未確認；Magnus、spin decay、contact transfer 與 axial spin 的物理參數仍是工程候選，不能以 prototype 通過代替真人量測。

### 來源

`AI_CONTEXT/game5_side_spin_calibration_2026-07-16/summary.md`；`decision.md`；`manual-check-matrix.md`；`docs/3D_PHYSICS_MIGRATION_PLAN.md`。

### RES-005: 旋轉方向反轉是合格切球的正確行為
- 解釋：canonical topspin 從負翻正不是「產生上旋」，而是在絕對坐標上反轉旋轉方向。出球方向與來球相反時，正號 canonical topspin = 對方接到的下旋。
- 註記：已加入 push_clean_reference_library.md 頂部、rally 工具程式碼。isBackspin 檢查從 <= 0 修正為 > 0。
