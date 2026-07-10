# GLM 任務 009：後段研究文件一致性大包

你是本專案的文件整理助理。這次請一次處理一整包互相關聯的正式 docs，不要碎片化成單一文件小任務。請保持繁中、保守語氣、只做文字整理與交叉引用補強，不要碰核心程式。

## 讀取資料

請先讀：

- `AI_CONTEXT/00_READ_ME_FIRST.md`
- `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md`
- `docs/VALIDATION_PLAN.md`
- `docs/MODEL_DECISIONS.md`
- `docs/EXPERIMENT_LOG.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/DEVELOPMENT_MATRIX.md`
- `docs/READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md`
- `docs/BATCH_VALIDATION_SPEC.md`
- `docs/PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md`
- `docs/PHYSICS_RESEARCH_TAIL_INDEX.md`
- `docs/AI_HANDOFF_TEMPLATE.md`

## 本次目標

請一次回傳 patch-ready Markdown 建議，重點是把 `TODO-006` / `TODO-007` / `TODO-008`、`VAL-009` / `VAL-010`、`EXP-019` / `EXP-035` / `EXP-037` / `EXP-038`、以及 `blend` / `tiltX` / `tiltY` / `scale` / `outputRescale` 的交叉引用串成同一條文件鏈。

## 預期輸出主題

1. `MODEL_DECISIONS.md` 的決策語氣與交叉引用補強
2. `EXPERIMENT_LOG.md` 的實驗索引對應補強
3. `PROJECT_OVERVIEW.md` 的入口說明補強
4. `CORE_FILE_SYNC_STATUS.md` 的同步狀態補強
5. `DEVELOPMENT_MATRIX.md` 的 GLM / Codex / 人類分工補強
6. `READ_ONLY_PHYSICS_EXTRACTOR_SPEC.md` 與 `BATCH_VALIDATION_SPEC.md` 的驗證鏈接補強
7. `PHYSICS_RESEARCH_TAIL_SPLIT_PLAN.md` 與 `PHYSICS_RESEARCH_TAIL_INDEX.md` 的尾段導讀補強
8. `AI_HANDOFF_TEMPLATE.md` 的大包任務範例補強

## 限制

- 不要改 `.html` / `.js`
- 不要改核心物理
- 不要把研究結果寫成最終結論
- 不要把文件拆成碎片化單點回覆
- 若某檔案不需要改，請直接寫 `不改`

## 驗收重點

- 交叉引用可以互相找到
- 文件語氣一致且保守
- `TODO-006` / `TODO-007` / `TODO-008` 都能對到明確文件
- `VAL-009` / `VAL-010` 都能對到明確驗證入口
- 保留研究中 / 待驗證 / 已取代狀態
