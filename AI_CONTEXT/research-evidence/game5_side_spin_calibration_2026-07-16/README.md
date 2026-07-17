# Game 5 3D 側旋校準 evidence

## 狀態

本資料夾是 2026-07-16 完成的隔離 prototype evidence。研究支線已結案，決策為 **Prototype with blockers**；內容不是物理真值、影片量測結果、視覺驗收或 Trainer readiness。

## 讀取順序

1. `summary.md`：各 group 結果與已知缺口。
2. `decision.md`：正式 gate 分類與參數解讀。
3. `manual-check-matrix.md`：G10 人工影片／瀏覽器檢查與阻塞原因。
4. `manifest.json`、`baseline_config.json`、`git_status.txt`：固定輸入、source hash 與執行環境。
5. `*_raw.json`、`metrics.csv`、`curve-data.json`：可追溯的原始輸出。

## 結論

- G0–G5 數值篩選完成；G1 47 球 legal gate 為 47/47。
- G6 push 補償沒有得到 `correct > none > wrong`，所以 `SIDESPIN_COMPENSATION_C=2.9` 沒有被本輪 3D 研究重新驗證。
- G7 是 controlled approximation；G8/G9 只代表報告完成。
- G10 頁面可載入播放，但 metadata ID 與實際影片 `src` 檔名 offset，視角、彎曲方向與手勢一致性不能確認。
- `Magnus coefficient=0.002793690356025591` 只保留為 candidate baseline；本輪沒有修改正式核心、HTML 或 preset。

## 下一步

後續工作轉至 `docs/3D_PHYSICS_MIGRATION_PLAN.md` 的全 3D 主線。先處理 ID/source contract，再做 `omega.y`、Magnus、桌面／球拍接觸 transfer 與 `axialSpin` 的正式遷移與紅線驗證；不要把本資料夾的候選數值直接部署。
