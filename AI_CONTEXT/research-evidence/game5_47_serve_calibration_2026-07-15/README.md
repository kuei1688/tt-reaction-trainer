# Game 5 47-serve calibration line

## 狀態

`CANDIDATE / NOT PROMOTED`。本資料夾是四段 calibration run 的 consolidated report 入口；同日期的 `_baseline`、`_coarse`、`_timing`、`_holdout_top`、`_smoke` 資料夾是同一條研究線的子輸出。

## 結果

- 固定 47 個 serve preset，local legal-serve gate 為 47/47。
- baseline、coarse、timing、holdout 合計 1,358 rows。
- push baseline holdout 為 55/101；`SIDESPIN_COMPENSATION_C=2.9` 為 64/101，保留為 Game 5 工程候選。
- attack baseline 為 0/101；垂直揮拍候選改善，但仍有大量掛網／出界，沒有升格成攻球校準。
- 沒有修改紅線檔案，也沒有自動升格參數。

## 子輸出

- `../game5_47_serve_calibration_2026-07-15_baseline/`
- `../game5_47_serve_calibration_2026-07-15_coarse/`
- `../game5_47_serve_calibration_2026-07-15_timing/`
- `../game5_47_serve_calibration_2026-07-15_holdout_top/`
- `../game5_47_serve_calibration_2026-07-15_smoke/`

後續 readiness 文件記錄了 Game 5 push/chop 的最小範圍整合；這不代表 `C=2.9` 是全域 3D 物理真值，也不取代 2026-07-16 side-spin G6 的 evidence-insufficient 結論。
