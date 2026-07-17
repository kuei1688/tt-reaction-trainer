# Phase 0 baseline

建立日期：2026-07-16

這份 baseline 針對執行 `docs/3D_PHYSICS_UNIFIED_MIGRATION_PLAN.md` 前的目前工作樹。工作樹本身已有使用者／前序工作留下的未提交變更，因此本階段只記錄，不重置、不覆寫、不把既有 prototype 當成新結果。

目前 47 顆 preset、47 顆 approved video 的資料契約測試通過，既有 3D spin prototype 測試通過，五個相關頁面的 inline JavaScript 語法檢查通過。這些結果只能作工程 baseline。

核心缺口已定位：目前 `SPIN3D_SCHEMA_VERSION` 為 1；`axialSpin` 仍在每次力／接觸評估時依 velocity 重新 resolve；`bounceWithSpinPhysical3D()` 仍把 `omega.x`／`omega.z` 映射回 legacy table x-kick；頁面仍各自持有 contact 與尺度轉換邏輯。這些是 Phase 1／2／3 prototype 的驗證目標。

物理校準狀態：目前沒有足以反推 world-space `omega` 或 Magnus 係數的獨立真實量測資料，故不進行參數調校，也不把 legal gate、成功率或 UI 表現升級成物理真值。
