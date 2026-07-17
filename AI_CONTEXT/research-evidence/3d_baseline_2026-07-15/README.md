# 3D physics baseline evidence（2026-07-15）

## 狀態

`EVIDENCE RETAINED / REVIEW`。這是目前 3D prototype 的工程 baseline，不是物理校準、影片量測或 Trainer readiness。

## 結果

- E-01、E-02、E-04、E-05、E-07 通過基本 prototype checks。
- E-03 為 REVIEW：軸向案例在桌面接觸後的水平差異尚需診斷分類。
- E-06 是代表性 contact／flight sweep，保留作分析資料。
- E-08 為 REVIEW：5 個代表 rally 中 3 個達到 12 回合，另有 out-of-bounds 失敗。
- 360×800 與桌面瀏覽器 visual check 未完成，`visual-check.md` 已保留限制說明。

## 檔案

- `3d_physics_test_plan_raw.json`：raw experiment output。
- `3d_physics_test_plan_summary.md`：gate summary。
- `representative-curves.svg`：代表曲線。
- `visual-check.md`：人工檢查狀態與未完成項。

後續診斷結果見 `../3d_diagnostic_2026-07-15/`；不要把本 baseline 的 PASS 直接升格成 physical truth。
