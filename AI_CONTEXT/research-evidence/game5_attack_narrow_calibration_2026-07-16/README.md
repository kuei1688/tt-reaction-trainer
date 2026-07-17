# Game 5 attack narrow calibration（2026-07-16）

## 狀態

`CANDIDATE / NOT PROMOTED`。這是固定 47 serve presets 上的攻球敏感度實驗，不是正式參數建議、物理真值或 Trainer readiness。

## 結果

- 951 rows、47/47 legal、951/951 finite、0 error。
- 三個 holdout 候選：`techniqueVel.y=0.15 @ 60 ms`、`techniqueVel.y=0 @ 40 ms`、`techniqueVel.y=0.45 @ 100 ms`。
- 三者 holdout 都是 32/101 成功、39/101 掛網、30/101 出界或無落點，沒有足夠證據自動選參。
- left／right／none 的 side-spin outcome、landing 與 net clearance 沒有形成可驗證的方向耦合。
- 沒有修改紅線檔案，也沒有回寫 `game5.html`。

原始檔名仍沿用 calibration runner 的 `game5_47_serve_calibration_*` 命名；為避免破壞既有引用，本輪只用本 README 與總索引標明正確研究名稱。
