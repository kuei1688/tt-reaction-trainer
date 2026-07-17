# Unified 3D physics baseline（2026-07-16）

## 狀態

`FORMAL MIGRATION CHECKPOINT`。本資料夾仍保留 unified physics migration 前的 immutable baseline 與隔離 Phase 1／2 prototype evidence；同時新增 2026-07-16 第一輪授權後的正式整合結果。正式校準、preset re-solve、compliant-contact 完整共用化與頁面視覺同步尚未完成。

## 已記錄

- 47 presets、47 approved videos 的 contract baseline。
- 既有 3D spin prototype 與相關頁面 inline JS 的工程檢查。
- schema 1、evaluation-time axial resolution、legacy table x-kick mapping 與頁面各自持有 contact／scale logic 等缺口。
- Phase 1／2 isolated forward model、failure classification 與 decision boundary。
- 第一輪正式整合的 shared-core、page-loader、inline-JS、legal-gate/cross-check 與 target-precision failure classification。

## 邊界

本輪未調整 `MAGNUS_COEFFICIENT`、`SIDESPIN_COMPENSATION_C`、preset geometry 或 legal-gate tolerance；紅線整合是在使用者明確授權下執行。後續依 `docs/3D_PHYSICS_UNIFIED_MIGRATION_PLAN.md` 完成 compliant-contact、校準與 holdout，再做 preset re-solve 與視覺同步。

入口檔案：`summary.md`、`phase1-2-summary.md`、`formal-migration-summary.md`、`formal-migration-failure-classification.md`、`formal-migration-2026-07-16.json`、`decision.md`、`source_hashes.json`。
