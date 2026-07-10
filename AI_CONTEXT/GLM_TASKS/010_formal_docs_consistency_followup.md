# GLM 任務 010：正式 docs 一致性再收斂

你是本專案的文件整理助理。這次請在已落版內容之上，做一次更大的正式 docs 一致性回看。重點是保守語氣、交叉引用完整、不要把研究結果寫成定案。請一次處理整包，不要碎片化成單一文件小任務。

## 讀取資料

請先讀：

- `AI_CONTEXT/00_READ_ME_FIRST.md`
- `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md`
- `docs/MODEL_DECISIONS.md`
- `docs/EXPERIMENT_LOG.md`
- `docs/CORE_FILE_SYNC_STATUS.md`
- `docs/DEVELOPMENT_MATRIX.md`
- `docs/VALIDATION_PLAN.md`
- `AI_CONTEXT/GLM_TASKS/009_big_batch_docs_alignment.md`

## 本次目標

請檢查這一輪正式 docs 是否已經把 `DEC-102`、`RES-004`、`TODO-006`、`TODO-007`、`TODO-008`、`EXP-019`、`EXP-035`、`EXP-037`、`EXP-038`、`VAL-009`、`VAL-010` 串成保守、可追蹤的文件鏈。若還有句子看起來像已定案、已部署或過度肯定，請縮回。

## 預期輸出主題

1. `MODEL_DECISIONS.md` 的語氣一致性與風險收斂
2. `EXPERIMENT_LOG.md` 的交叉引用完整性
3. `CORE_FILE_SYNC_STATUS.md` 的狀態敘述是否過於前推
4. `DEVELOPMENT_MATRIX.md` 的 GLM / Codex / 人類分工是否還能再收斂
5. `AI_CONTEXT/CODEX_CONTEXT_SUMMARY.md` 與 `changed_files_manifest.md` 的快照同步

## 限制

- 不要改 `.html` / `.js`
- 不要改核心物理
- 不要新增決策、實驗或驗證入口
- 不要把研究結果寫成最終結論
- 若某檔案不需要改，請直接寫 `不改`

## 驗收重點

- 研究中 / 已取代 / 待驗證 / 待決策 的語氣彼此一致
- `TODO-006` / `TODO-007` / `TODO-008` 與 `VAL-009` / `VAL-010` 的鏈條仍然能互相追到
- `EXP-019` / `EXP-035` / `EXP-037` / `EXP-038` 不會被寫成已部署結論
- `MODEL_DECISIONS.md` / `EXPERIMENT_LOG.md` / `CORE_FILE_SYNC_STATUS.md` 都維持保守措辭
