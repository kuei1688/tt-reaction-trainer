# 3D 物理遷移計畫與執行紀錄

日期：2026-07-16

這份文件把 `docs/SPIN_DIRECTION_CONTRACT.md` 的方向契約落成可驗證的遷移邊界。這一階段的結果是工程 prototype；它不宣稱已由影片反推或實驗校準出物理真值。

> 2026-07-16 交接狀態：`docs/3D_SIDE_SPIN_CALIBRATION_EXECUTION_PLAN.md` 的隔離校準研究已結案，決策為 **Prototype with blockers**。下一個工作面是本文件的全 3D 主線遷移；不要把校準資料夾內的 candidate 參數直接升格成正式常數。

## 目標

1. 讓真實左右側旋使用 world-space `omega.y`。
2. 在空中飛行加入 Magnus 加速度 `C * (omega × v)`。
3. 把 corkscrew / axial spin 保留為獨立的 `axialSpin`，不再把它叫作 sidespin。
4. 讓 `shared-physics-core.js`、Game 4、Game 5、Physics Studio、Return Studio 使用同一個 canonical schema。
5. 保留 legacy `variation.spin` 作為相容輸入，並用 contract test 防止左右符號回歸。

## Canonical schema

```js
variation.spin3d = {
  schema: 1,
  omega: { x: topspin, y: trueSidespin, z: 0 },
  axialSpin: 0
}
```

在目前座標契約中，`omega.y > 0` 是 left sidespin，Magnus 飛行造成 `+x`（向 receiver 視角的右側曲線）；`omega.y < 0` 是 right sidespin。舊的 `spin.sidespin` 只留作 compatibility proxy，不應再被新物理程式拿來判斷左右標籤。

## 已執行的遷移步驟

- 在 shared core 加入 canonical spin、axial resolution、Magnus flight、3D table-contact adapter。
- 將 47 顆 approved serve preset 加上 `variation.spin3d`；舊 `variation.spin` 保留。
- serve generator 以 metadata 的 `sideName` 產生 canonical sign，不從 legacy sign 反推左右。
- 同步 `game4.html`、`game5.html`、`physics-studio.html`、`return-studio.html` 的飛行、桌面反彈與球拍接觸資料流。
- 對 canonical spin 的桌面／球拍反彈保留 `axialSpin` 欄位，並將 `omega.y` 帶過桌面接觸。
- 新增 core test、preset contract test，並讓 loader 能解析新增 shared symbols。

## 驗證與解讀

- `node tools/physics-3d-spin.test.js`：通過。
- `node tools/serve-generator-contract.test.js`：47 顆 approved video 通過。
- 四個頁面的 inline JS：通過語法檢查。
- Game 4 / Physics Studio loader：readiness 通過，無 missing/unresolved dependency。
- `node tools/serve-batch-validation.test.js`：兩個 solver 的 common legal-serve gate 皆 47/47，cross-check 47/47。
- 個別 net-clearance / target-precision 仍是診斷資料，不代表真實物理；目前仍有失敗項，後續應以影片或量測資料做 preset fitting。

## 校準邊界

`MAGNUS_COEFFICIENT = 0.0028` 是依低旋轉線性化模型得到的初始工程候選值，不是最終真值。後續校準應以具名影片、速度／旋轉／落點量測和固定 replay seed 進行，並把結果另存為 calibration evidence；不要為了讓單一 batch snapshot 通過而移除 Magnus 或改回 legacy x-kick。

2026-07-16 的隔離 sweep 另記錄 `0.002793690356025591` 作為 current-baseline candidate；它沒有寫回核心，也沒有取代 `0.0028` 的文件基線。G6 的 push 補償辨識不足，G10 的 metadata ID／影片 `src` offset 仍是正式遷移前的資料契約阻塞。

## 下一階段：全 3D 主線執行入口

1. 先完成 metadata ID／`src` 對應的 migration audit，修正或明確化 contract，並以 6 支代表影片重跑 G10。
2. 以 canonical `variation.spin3d.omega.y` 為主線，完成飛行 Magnus、桌面接觸 transfer、球拍接觸與 `axialSpin` 分工的端到端驗證。
3. 用具名影片的速度／旋轉／落點量測校準 `MAGNUS_COEFFICIENT`、spin decay 與 contact transfer；隔離 sweep 僅提供候選範圍，不提供真值。
4. 補 Game 5 實機畫面與左右輸入 smoke test；確認後才提出紅線整合方案。
5. 若要淘汰 legacy fallback，先完成資料與 UI 的 migration audit，再升級 schema version，並保留 rollback。
