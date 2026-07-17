# 切球求解方案設計原則（輕量、持續更新）

> 這份文件只做兩件事：(1) 記錄目前的指導原則，(2) 累積「求解方案設計不合理」的案例清單。不是報告，保持輕量，原則變動時直接修改本體，案例清單只能新增不能刪除（舊案例過時了標記「已被 XXX 取代」，不刪除）。

## 目前指導原則（2026-07-14 起）

**暫停使用「精確求解」的架構，改用「測量物理曲線 + 逼近法收斂可行區間」。**

直接起因：`game4.html` 的 `solveRacketVelXForTargetLandingX`（瞄準求解器）想要精確算出「球拍要往左右多用力，才能讓球剛好落在桌面正中央」——當它找不到解（球連網子都過不了）時，會靜默回傳一個跟物理無關的猜測值，而不是老實回報「無解」。這個「找不到答案就亂猜」的行為，在 `AI_CONTEXT/push_clean_reference_library.md` 的乾淨曲線測試裡製造出劇烈的假懸崖——繞開這個求解器直接測物理之後，懸崖完全消失，證實接觸模型本身是平滑的，問題出在求解器的架構本身。

**具體做法**：
1. 任何新的校準/診斷工作，優先用「固定其他變數、單一變數掃描、老實記錄結果」的方式測量，不要一開始就寫一個「反推出精確答案」的 solver。
2. 掃出來的曲線，用來判斷「哪一段區間是安全/可行的」，而不是挑單一個最優點——區間本身比單一點更穩健，也更貼近真人打球「憑經驗抓一個大概範圍」的方式。
3. 如果某個任務真的需要一個具體數字（例如球拍要往哪個方向修正），優先用「在測量出的可行區間內用逼近法收斂」，而不是解析解/精確求解——逼近法失敗時的行為是「找不到就繼續縮小範圍或老實回報找不到」，不會像精確求解器那樣，在無解時默默塞一個假答案冒充有效結果。
4. 這個原則目前是「暫時」的（見上方標題）——不是永久否定所有精確求解的價值，是在目前對 Stage 4a 接觸模型的物理行為還不夠熟悉的階段，優先選風險較低、較不容易在看不見的地方製造假訊號的做法。

## 已發現的求解方案設計問題（只能新增，不能刪除）

### 2026-07-14：`solveRacketVelXForTargetLandingX` 無解時靜默回傳假答案

**位置**：`game4.html`（`return-studio.html` 有對應的 push 專用分支，邏輯相同）。

**問題**：粗網格搜尋 `rx∈[-8,8]`，找不到「真的有落在對方桌面」的候選解時，回傳 `-incomingVel.x`（跟真實物理無關的猜測值）而不是明確的「無解」訊號。找到解的那一刻，又會跳到貼近搜尋邊界（±8）的數值——本身也可能是搜尋範圍不夠寬、被截斷的解，不是真正的最佳解。

**證據**：`AI_CONTEXT/push_clean_reference_library.md` 的第一、二條目（含瞄準求解器）在 tiltY=1.0→1.1、speed scale=1.0→1.1 與 1.4→1.5 都出現劇烈跳動；第三、四條目（繞開求解器）同樣的範圍內完全平滑，零跳動——對照組證實問題在求解器，不在接觸模型。

**狀態**：已診斷，尚未修正（修正需要動 `game4.html`，紅線檔案，待決定優先順序）。

**教訓**：這類「精確求解 + 無解時靜默 fallback」的模式，是這個 codebase 裡容易藏假訊號的地方，之後新增任何 solver 時要優先檢查「找不到解的時候會發生什麼」，不能只驗證「有解時對不對」。

### 2026-07-14：`solveServeBounceVelocity` 找不到合格候選解時，fallback 不受同一組驗證約束

**位置**：`game4.html` 第803~854行（`return-studio.html` 未檢查是否有對應版本，此條目只確認 game4.html）。這是發球產生鏈路（`simulateServe → solveBaseVelocity → solveServeBounceVelocity`）的一部分，不是切球接觸模型本身，但屬於本次「乾淨基準線」任務實際呼叫、依賴其產出（`hitVel`/`hitSpin`）的上游環節，所以記錄在這裡。

**發現過程**：本次任務（零旋轉/零入射角純基準線，見 `push_clean_reference_library.md` 對應日期條目）在讀 `solveServeBounceVelocity` 原始碼確認其行為時，順手發現了這個模式，**不是本次任務實際觸發到這個 fallback**（`no_spin_long_forehand` 這顆代表案例的粗網格搜尋有找到合格候選解，`best` 不是 null）——這裡記錄的是程式碼本身的架構風險，不是本次任務量出來的一個實際 bug。

**問題**：`solveServeBounceVelocity` 用雙層搜尋（粗網格 `times × yNudges`，再加 28 輪爬山法微調）找一個讓發球落點分數最低的候選初速度。粗網格每個候選都要通過三道驗證才會被納入評分：`Number.isFinite(x/y/z)`、`candidate.y <= profile.vyHardMax`、`hypot(candidate.x,candidate.z) <= profile.speedReject`（第815~817行）。**但如果整個粗網格搜尋完全沒有任何候選通過這三道驗證**（`best` 仍是 `null`，第830行），fallback 邏輯是：
```js
if(!best){
  best = makeServeAimCandidate(preset, first, findServeBounceTime(preset), 0);
  bestScore = serveBounceScore(preset, best);
}
```
這個 fallback 候選**完全沒有經過 `vyHardMax`/`speedReject` 這兩道驗證**——`findServeBounceTime` 內部（第894~909行）自己的候選搜尋也沒有套用這兩個限制，純粹依落點分數（`serveBounceScore`）挑一個時間點。也就是說，正常路徑下每個候選都保證「垂直速度不過高、水平速度不過快」，但 fallback 路徑產出的候選完全不受這個保證約束，卻跟正常路徑產出的候選一樣，被當成同樣可信的 `best` 回傳——下游呼叫者（`solveBaseVelocity`/`simulateServe`）沒有任何欄位或訊號能區分這次的 `best` 是「通過驗證的正常解」還是「沒通過驗證、走 fallback 硬給的解」。

**跟已記錄的 `solveRacketVelXForTargetLandingX` 案例的相似之處**：同樣是「精確搜尋 + 找不到合格解時，靜默换一個不受同一套驗證約束的候選頂替，且沒有對外暴露『這是 fallback』的訊號」的架構模式。差異之處：`solveRacketVelXForTargetLandingX` 的 fallback（`-incomingVel.x`）是一個跟物理毫無關聯的猜測常數，比較容易在數值上一眼看出異常；這裡的 fallback（`makeServeAimCandidate` 用 `findServeBounceTime` 選的時間）至少還是一個「有算過落點分數」的合理彈道解，不是隨便的常數，所以更不容易在單點數值上被發現異常——但約束沒被強制執行這件事本身還是一樣的風險。

**狀態**：僅讀碼發現、尚未主動觸發驗證、尚未修正。是否有哪些 preset 或哪些參數組合會真的讓粗網格搜尋全軍覆沒（`best===null`），沒有實際測過，留給後續需要時再查。

**教訓（延續上一條目）**：這個 codebase 裡「精確求解 + 找不到解時 fallback」的模式不只出現在瞄準求解器一處，發球產生鏈路本身也有類似結構——之後如果校準工作牽涉到 `solveServeBounceVelocity`/`findServeBounceTime`（例如批次跑很多 preset、或大幅偏離 preset 原本設計範圍的參數掃描），要留意 fallback 有沒有可能被觸發，觸發時要單獨檢查那個候選是否合理，不能假設每次回傳的 `best` 都已經通過同一套驗證。

### 2026-07-14：桌面接觸與球拍接觸的尺度不一致（已在 game4.html + return-studio.html 修復）

**位置**：`game4.html` 和 `return-studio.html` 的 `simulatePath` 內部（桌面彈跳呼叫 `bounceWithSpinPhysical`）。

**問題**：模擬使用縮放重力 gravity = -4.2 m/s²（真實 -9.8），速度只有真實的 65.5%。球拍接觸（`bounceOffPlaneSubstepped`）有乘 `SIM_TIME_DILATION = 1.528` 轉真實尺度，但桌面接觸（`bounceWithSpinPhysical`）完全沒有轉換——用模擬尺度速度 + 真實尺度旋轉混在一起算。同時，preset 的旋轉是真實尺度（rad/s），球拍接觸把它乘 D 變成「超真實」尺度。結果：下旋每次彈跳保留率被高估 18%（模擬 75% vs 真實 61%），不轉球上旋製造量被低估 53%。

**證據**：用真實 preset 數據（backspin_long_backhand）對比模擬尺度 vs 真實尺度的 `bounceWithSpinPhysical` 結果，第一次彈跳後旋轉差 18%，第二次差 17%。不轉球案例差 53%。

**修復**：`simulatePath` 在呼叫 `bounceWithSpinPhysical` 前把速度和旋轉乘以 D，呼叫後除回去。`simulateServe` 和 `serveBounceScore` 把 preset 旋轉除以 D 轉模擬尺度。這樣桌面接觸和球拍接觸都在真實尺度運算，輸出回到模擬尺度，全鏈路一致。

**教訓**：縮放重力（4.2 vs 9.8）的設計本身是合理的（讓模擬在 1/120 timestep 下行為正確），但「速度有轉換、旋轉沒有轉換」的不一致是隱藏陷阱。任何接觸力學函式如果同時使用速度和旋轉，兩者必須在同一個尺度。這跟 `solveRacketVelXForTargetLandingX` 的「無解時靜默 fallback」是不同類型的陷阱——那個是反推求解的架構問題，這個是正向模擬的尺度一致性問題，但共同點是：都是「隱含假設被打破」造成的假訊號，都不是物理公式本身的錯。

**狀態**：已修復（game4.html + return-studio.html），physics-studio.html 待修。


## 條目索引

- [2026-07-14 solveRacketVelXForTargetLandingX 無解時靜默回傳假答案](#2026-07-14solveracketvelxfortargetlandingx-無解時靜默回傳假答案)
- [2026-07-14 桌面接觸與球拍接觸的尺度不一致](#2026-07-14桌面接觸與球拍接觸的尺度不一致已在-game4html--return-studiohtml-修復)
- [2026-07-14 solveServeBounceVelocity 找不到合格候選解時，fallback 不受同一組驗證約束](#2026-07-14solveservebouncevelocity-找不到合格候選解時fallback-不受同一組驗證約束)
