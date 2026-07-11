DRAFT: Physics research tail split plan
#
# Status: draft only.
# This file is a proposed split plan and must not be treated as committed documentation.
# Last touched: 2026-07-06

# docs/physics-engine-v2-plan.md 後段研究拆解整理方案

> 本方案僅根據目前提供的專案總覽、實驗紀錄、模型決策與驗證計畫進行結構化整理。不新增任何未提供的事實，不做最終物理判斷。

## 1. 後段研究拆解目標

- 將 `docs/physics-engine-v2-plan.md` 後段混雜的歷史長文，拆解為獨立、可追溯的條目，逐步補齊日期、來源與版本。
- 防止研究結果或 `return-studio.html` 的工具頁行為自動升格為正式遊戲已部署功能或最終模型決策。
- 明確區分 `game4.html`（正式遊戲頁）與 `return-studio.html`（研究/工具頁）的物理路徑差異。
- 為後續建立標準可重跑驗證命令與高階模型審查提供清晰的索引基礎。

## 2. 如何把研究內容拆成 Experiment Log、Model Decisions、Physics Spec、Validation Plan

根據目前正式 docs 的狀態與分工，後段研究內容應依以下原則分流：

| 目標文件 | 拆解原則 | 對應內容 |
|---|---|---|
| **Experiment Log** | 將長文中的測試、參數掃描、原型驗證提取為獨立 EXP 條目（接續 EXP-038）。 | blend 機制發現、Stage 1 核心假設驗證、聯合搜尋結果、彈簧-阻尼原型等。 |
| **Model Decisions** | 將長文中的架構方向、公式取捨提取為 DEC（已採用/已取代）、RES（研究中）或 TODO（待決策）。 | blend 不可作為最終物理解、tiltX hack 移除、substepped push 定位、loop 是否重設計等。 |
| **Physics Spec** | 將長文中的物理公式、常數、接觸力學模型，依「已核對正式行為」、「研究/工具頁行為」、「待驗證/待決策事項」三分類寫入。 | 桌面摩擦係數 μ=0.13、球拍接觸力學、outputRescale、blend 動態模型等。 |
| **Validation Plan** | 將長文中提及的驗證需求、批次檢查、聯合指標，對應至 VAL 與 CMD 條目，並標明目前 repo 狀態。 | 發球 preset 軌跡檢查、回擊批次檢查、旋轉方向檢查、核心檔案差異抽取工具等。 |

## 3. 每個拆解條目的必要欄位

為確保追溯性與防止誤導，每個拆解條目必須包含以下欄位：

### Experiment Log 條目
- **Experiment ID**：接續 EXP-038 編號。
- **日期**：若不確定必須保留「不確定」。
- **目的**：
- **模型版本 / 涉及檔案**：必須明確標示 `game4.html` 或 `return-studio.html`。
- **固定參數**：
- **搜尋參數**：
- **測試集**：
- **結果**：
- **失敗案例**：不可只記成功率。
- **狀態**：已套用 / 已取代 / 研究中 / 待驗證 / 不確定。
- **下一步**：

### Model Decisions 條目
- **DEC/RES/TODO 編號**：
- **狀態**：已採用 / 已取代 / 研究中 / 待決策 / 不採用。
- **適用範圍**：必須標明檔案範圍。
- **背景**：
- **決策 / 目前判斷**：
- **理由**：
- **影響**：
- **風險與待驗證事項**：必填，不可空白。
- **來源**：註明 `docs/physics-engine-v2-plan.md` 後段特定段落。

### Physics Spec 條目
- **分類**：已核對正式行為 / 研究工具頁行為 / 待驗證待決策。
- **涉及檔案**：
- **公式或常數**：
- **物理意義**：
- **適用範圍**：
- **風險與待驗證事項**：
- **來源**：

### Validation Plan 條目
- **VAL/CMD 編號**：
- **驗證項目 / 候選命令**：
- **入口檔案**：
- **目前 repo 狀態**：檔案存在 / 缺工具 / 本輪未找到。
- **本輪是否執行**：是 / 否。
- **測試集**：
- **輸出指標**：
- **失敗案例**：
- **是否可重跑**：是 / 否 / 需要工具化。
- **注意事項**：

## 4. 哪些內容必須保留為研究中或待驗證

以下項目在未經高階模型審查或建立可重跑驗證前，必須明確標示為「研究中」或「待驗證」：

- **研究中 (RES)**：
  - `return-studio.html` 的 `bounceOffPlaneSubstepped()`、彈簧阻尼、wrist brake 等研究路徑 (RES-001)。
  - Stage 1 / outputRescale 相關切球搜尋結果 (EXP-032 至 EXP-038, RES-002)。
  - blend 兩階段動態模型 (EXP-029)。
  - 時鐘接觸面幾何模型 (EXP-026)。
- **待驗證 / 待決策 (TODO)**：
  - `return-studio.html` 是否回寫 `game4.html` 的同步策略 (TODO-001)。
  - loop / 拉球舊模型是否重設計 (TODO-002)。
  - 切球法向反彈係數是否需調整 (TODO-003)。
  - blend 的替代物理機制 (tangential compliance、contact-point velocity 等) (TODO-004)。
  - 正式驗證命令與通過門檻的建立 (TODO-005)。
  - 任何高 blend 或 `blend=0.9` 的結果 (依 DEC-004)。
  - 任何僅以「上桌/過網」為目標而未檢查旋轉方向的搜尋結果。
- **已取代 (僅留歷史紀錄)**：
  - 舊 techniqueVel 重新校準 (EXP-006, DEC-101)。
  - tiltX hack 與相關回歸公式 (EXP-019, EXP-035, DEC-102)。
  - 被後續實驗取代的公式 (EXP-010, EXP-013, EXP-015, EXP-016)。

## 5. 哪些詞句容易誤導為已部署

在整理過程中，必須嚴格避免或加註警告以下詞句，以免將研究結果誤導為正式遊戲已部署：

- **「已完成」/「已套用」**：多數來自長文原文或 GLM 草稿，尚未逐一用目前 repo 重跑驗證。
- **「可重跑」**：GLM 草稿中的描述不代表本輪已成功執行或已工具化。
- **「風險：無」**：嚴禁使用。每條決策都必須保留風險或待驗證事項。
- **「正式遊戲已部署」**：不可用於描述 `return-studio.html` 的研究功能。
- **「最終物理解」/「最佳解」**：不可用於描述高 blend 或單次參數搜尋結果。
- **「物理真值」**：不可用於描述工程校準值（如 `μ=0.13`）。

## 6. 建議下一批 GLM 任務包

以下任務包適合交由 GLM 5.2 cloud（`reasoning_effort=max`）進行低成本整理與初稿產生：

| 任務包編號 | 任務名稱 | 產出目標 | 呼叫限制 |
|---|---|---|---|
| GLM-TASK-01 | 後段實驗條目抽取 | 掃描 `physics-engine-v2-plan.md` 後段，提取未編號的測試與原型，依 EXP 格式建立草稿至 `AI_CONTEXT/DRAFTS/`。 | 狀態必須預設為「研究中」或「待驗證」，涉及檔案必須標明。 |
| GLM-TASK-02 | 決策與待辦項目盤點 | 從後段研究提取架構方向，依 RES 或 TODO 格式建立草稿。 | 不可產生「風險：無」，適用範圍必須標明 `return-studio.html`。 |
| GLM-TASK-03 | Physics Spec 三分類草稿 | 將後段公式與常數依「已核對/研究頁/待驗證」分類，產生表格草稿。 | 不可將研究頁行為寫入「已核對正式行為」。 |
| GLM-TASK-04 | 驗證缺口對應 | 比對後段研究提及的驗證需求與現有 VAL/CMD，列出尚未工具化的缺口。 | 候選命令必須標明「待建立」，不可宣稱已執行。 |

## 7. Codex 審查清單

Codex 在接收 GLM 草稿並升級為正式 docs 前，必須逐項核對以下檢查清單：

- [ ] **狀態標記**：所有新增 EXP 條目狀態是否正確標示（研究中/待驗證/已取代），未自動升格為「已套用」。
- [ ] **檔案範圍**：所有涉及 `return-studio.html` 的條目是否明確標示適用範圍，未誤寫為 `game4.html` 已部署。
- [ ] **blend 警告**：高 blend 或 `blend=0.9` 相關條目是否保留警告，未寫成最終物理解。
- [ ] **歷史脈絡**：被取代的公式（如 tiltX hack、舊 techniqueVel）是否標示為「已取代」，並保留歷史紀錄。
- [ ] **風險欄位**：所有 Model Decisions 條目是否包含「風險與待驗證事項」，無「風險：無」字樣。
- [ ] **Spec 分類**：Physics Spec 是否正確分類，未將研究工具頁行為混入已核對正式行為。
- [ ] **驗證狀態**：Validation Plan 條目是否標明「本輪是否執行」，未將候選命令宣稱為已成功執行。
- [ ] **詞句過濾**：GLM 草稿中的「已完成」、「可重跑」等詞句是否已由 Codex 降級或加上警告標語。
# DRAFT: Physics research tail split plan
#
# Status: draft only.
# This file is a proposed split plan and must not be treated as committed documentation.
# Last touched: 2026-07-06
