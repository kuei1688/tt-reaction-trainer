# GLM 任務 011：規格與驗證入口再收斂

你是本專案的文件整理助理。這次請聚焦在 `docs/PHYSICS_MODEL_SPEC.md` 與 `docs/VALIDATION_PLAN.md` 的一致性回看，必要時再微調 `docs/CORE_FILE_SYNC_STATUS.md`、`docs/MODEL_DECISIONS.md`、`docs/EXPERIMENT_LOG.md`。請一次處理整包，不要碎片化成單一文件小任務。

## 讀取資料

請先讀：

- `AI_CONTEXT/00_READ_ME_FIRST.md`
- `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md`
- `docs/PHYSICS_MODEL_SPEC.md`
- `docs/VALIDATION_PLAN.md`
- `docs/MODEL_DECISIONS.md`
- `docs/EXPERIMENT_LOG.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `AI_CONTEXT/GLM_TASKS/010_formal_docs_consistency_followup.md`

## 本次目標

請確認 `TODO-007`、`VAL-009`、`VAL-010` 的語氣在 `PHYSICS_MODEL_SPEC.md` 與 `VALIDATION_PLAN.md` 之間一致，並確保它們只被描述為歷史參考、待驗證或固定門檻，不要像已定案或已部署。

## 預期輸出主題

1. `PHYSICS_MODEL_SPEC.md` 的規格語氣收斂
2. `VALIDATION_PLAN.md` 的固定驗證入口一致性
3. `CORE_FILE_SYNC_STATUS.md` 的局部同步訊號描述
4. `MODEL_DECISIONS.md` / `EXPERIMENT_LOG.md` 的引用微調
5. `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md` 與 `changed_files_manifest.md` 的快照同步

## 限制

- 不要改 `.html` / `.js`
- 不要改核心物理
- 不要新增決策、實驗或驗證入口
- 不要把研究結果寫成最終結論
- 若某檔案不需要改，請直接寫 `不改`

## 驗收重點

- `TODO-007` / `VAL-009` / `VAL-010` 的角色一致
- `PHYSICS_MODEL_SPEC.md` 不會把舊數字寫成目前常數
- `VALIDATION_PLAN.md` 不會把待建立的驗證入口寫成已完成
- `CORE_FILE_SYNC_STATUS.md` 仍維持「局部同步，不是定案」的保守語氣
