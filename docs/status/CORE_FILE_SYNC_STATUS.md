# Core File Sync Status

> 本文件只記錄 Codex 已用目前 repo 檔案快速核對過的核心差異。它不是物理模型結論，也不判斷哪一版正確。
>
> 核對日期：2026-07-15
> 核對方式：讀取 GLM 草稿後，用 `rg` 針對核心函式、常數與註解查證目前 repo 狀態。

## 摘要

目前 `game4.html`、`return-studio.html`、`physics-studio.html` 並不是同一種角色：

| 檔案 | 角色 | 核對狀態 |
|---|---|---|
| `game4.html` | 正式遊戲頁，包含回擊選擇與遊戲 UI | 已核對部分核心差異 |
| `return-studio.html` | 回擊研究 / 調參工具頁 | 已核對部分核心差異 |
| `physics-studio.html` | 發球 preset / 發球物理工具頁 | 已核對桌面反彈常數與 v2 引擎註解 |
| `physics-v2-calibration.html` | 桌面反彈校準頁 | 尚未完整人工核對 |
| `tools/physics-v2-contact-mechanics.js` | 桌面接觸力學 Node 驗證腳本 | 尚未完整人工核對 |
| `tools/racket-contact-mechanics.js` | 球拍接觸力學 Node 對拍腳本 | 尚未完整人工核對 |

## 已核對差異

### 1. Loop / 拉球狀態不同

- `game4.html` 仍保留 loop / 拉球 UI 與 `loop` 技術設定。
- `game4.html` 有舊模型殘留常數：`PADDLE_RESTITUTION = -0.9`，註解寫明目前只有 loop 還在用，尚未套用球拍接觸力學。
- `game4.html` 的 `loop` 技術仍是 `model:'direct'`，並有靜態 `spin` 欄位。
- `return-studio.html` 註解寫明：「拉球（loop）技術先整個移除」。

**狀態：** 已核對。  
**風險：** 若文件寫「回擊技術都已套用球拍接觸力學」，會誤導，因為 `game4.html` 的 loop 不是。

### 2. return-studio.html 有 blend / substepped push，game4.html 未見同等機制

- `return-studio.html` 有 `PADDLE_BLEND = 0.605`。fallback bug 已同步修復。PUSH_LIFT_VY_K = 0（架構保留）。
- `return-studio.html` 有 `computeBlendedNormal()`。
- `return-studio.html` 有 `bounceOffPlaneSubstepped()`。
- `return-studio.html` 有 `PUSH_WRIST_BRAKE_RATE = 0`。
- `game4.html` 現已有 `PADDLE_BLEND=0.605`、`computeBlendedNormal`、`bounceOffPlaneSubstepped`、`PUSH_WRIST_BRAKE_RATE`（2026-07-14 同步）。

**狀態：** 已核對。  
**風險：** `return-studio.html` 的研究機制不能直接寫成 `game4.html` 正式遊戲已部署。

### 3. Adaptive push 力道模型不同

- `game4.html` 的 adaptive push 使用 `computeAdaptivePushMagnitude(incomingVel, contactZ, topspin)`。
- `return-studio.html` 的 adaptive push 使用 `computeAdaptivePushLift(incomingVel)` 與 `computeAdaptivePushDrive(incomingVel)`。
- `return-studio.html` 已同步 `PUSH_LIFT_K = 0.04`、`PUSH_DRIVE_K = 0.19`（與 game4.html 一致），等於目前 lift / drive 對 incoming speed 的負回饋係數為 0。

**狀態：** 已核對。  
**風險：** 文件若整理「切球自適應力道公式」時，必須標明它指的是哪個檔案版本。

### 4. Adaptive push 拍面角度模型不同

- `game4.html` 使用 `computeAdaptivePushTiltX(incomingVel)` 與 `computeAdaptivePushTiltY(topspin)`。
- `return-studio.html` 使用 `computeAdaptivePushTiltX()` 與 `computeAdaptivePushTiltY()`，可見 `PUSH_TILT_Y = 0.8`。
- `return-studio.html` 註解指出過量修正與 `PADDLE_BLEND` Y-Z-only 機制相關。

**狀態：** 已核對。  
**風險：** 不能把 `game4.html` 的動態 tilt 公式與 `return-studio.html` 的固定/研究版公式混成同一套。

### 5. 桌面反彈 v2 常數在 game4.html 與 physics-studio.html 可見一致

`game4.html` 與 `physics-studio.html` 都可見下列常數或註解：

- `EPSILON_VERTICAL = 0.876`
- `EPSILON_OBLIQUE = 0.57`
- `EPSILON_MIN = 0.45`
- `SPIN_EPSILON_REFERENCE = 6.0`
- `CONTACT_FRICTION_MU = 0.13`
- `physics-studio.html` 註解寫明逐字對齊 `game4.html` / `return-studio.html`，取代舊 `BOUNCE_PHYSICS/applyBounceSpin`。

**狀態：** 已核對關鍵字一致；尚未做逐字 diff。  
**風險：** 「逐字對齊」仍需工具化 diff 驗證，不能只靠註解。

### 6. scale / outputRescale、tiltX hack 與部署前門檻的同步狀態

| 項目 | 正式頁 / 研究頁狀態 | 目前同步判讀 | 仍需確認 |
|---|---|---|---|
| `tiltX` hack | `EXP-037` 已收斂到 `RES-004`，研究頁不應再把舊 hack 當現行依據 | 方向已知，但只屬文件層同步 | 正式頁與研究頁是否都已一致改成 y-z 平面限制與獨立瞄準 |
| `blend` 的 y-z 限制 | 研究頁已有對應描述，正式頁仍需逐檔核對 | 目前視為研究收斂方向，不可直接寫成正式部署 | 是否真的已回寫到正式頁，仍需只讀 diff 驗證 |
| `scale` / `outputRescale` | `EXP-038` 只證明曾有瞄準 bug 與修正脈絡 | 只能判讀為局部同步訊號，不能推成整套語義已定案 | `TODO-006` 是否已形成固定檢查，`VAL-009` 是否能重跑 |
| `PADDLE_BLEND=0` 部署前門檻 | 研究頁與正式頁都應先以 0 值做一致性確認 | 這是寫回正式頁前的門檻，不是已通過結論 | `TODO-008` / `VAL-010` 是否都已建立成固定流程 |

**狀態：** 部分已核對。  
**風險：** 不能把局部修正誤寫成整套語義都已定案，也不能把研究頁描述直接當成正式部署。 

### 7. 左右側旋語意與發球產生器

- `serve-generator.html` 已把 `sideName`（旋轉名稱）與 `curveDirection`（球路方向）分開。
- `physics-presets.json` 目前是 47 個 per-video generated preset，每筆有唯一 `tags.videoId`；重新套用共用幾何模板後，兩份 solver 的 legal-serve gate 均 47/47。
- 目前 compatibility mapping：左側旋 = 負 `sidespin` / 向右彎；右側旋 = 正 `sidespin` / 向左彎。
- 產生器已移除依 sign 鏡像整條 x 路徑的邏輯；位置由 `placement` / `length` 模板決定。

**狀態：** 文件與產生器層已同步；`tools/serve-generator-contract.test.js` 已建立。
**風險：** 核心仍將 `sidespin` 當作 legacy x-kick proxy，尚未完成真實垂直軸側旋與 Magnus 模型；47 個 preset 也尚未逐一做 Game 5 視覺／手感校準。legal-serve gate 通過不等於物理真實性通過。

## 不可直接下結論

1. 不可判斷 `return-studio.html` 的 substepped push 比 `game4.html` 的瞬時碰撞模型更正確。
2. 不可判斷 `PADDLE_BLEND = 0.605` 是合理或最終值。
3. 不可把高 blend 或 `blend=0.9` 當成最終物理解。
4. 不可把 `return-studio.html` 的研究工具功能寫成正式遊戲已部署。
5. 不可把 GLM 草稿中的「已部署」直接當真；必須逐檔核對。

## 建議下一步

1. 建立一個只讀 diff/抽取工具，對比 `game4.html`、`return-studio.html`、`physics-studio.html` 的核心函式與常數。
2. 將 `docs/PHYSICS_MODEL_SPEC.md` 分成「已核對正式行為」與「研究/待驗證行為」兩區。
3. 將 `docs/EXPERIMENT_LOG.md` 的數字全部標明來源階段，避免跨版本混用。
4. 將 `docs/MODEL_DECISIONS.md` 中所有「風險：無」重新審查。
5. 將 `TODO-006` / `TODO-007` / `TODO-008` 與 `VAL-009` / `VAL-010` 的交叉引用補齊成固定檢查鏈。
6. 依 `docs/SPIN_DIRECTION_CONTRACT.md` 完成影片視角人工複核，再決定是否需要修正 `videos.json` 分類。
