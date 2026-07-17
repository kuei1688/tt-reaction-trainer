# 2017 外部彈跳／旋轉：state-dependent contact-law audit

Date: 2026-07-16
Status: `PASS / ISOLATED REPRESENTABILITY AUDIT / NOT CALIBRATED`

## 結論

本審計只把報告中的球拍 COR 關係當作隔離的法向速度 overlay；沒有修改 mainline-v2 或宣稱它是球桌參數。它用來檢查：若加入速度依賴的法向回彈，2017 的 angle／rotation／speed 是否可能被代表。

- 報告公式：COR = -0.019u + 0.87。來源情境是靜止球拍，不是球桌。
- `total-relative` 將 `u` 解讀成入射相對速度大小，貼近報告文字。
- `normal-approach` 將 `u` 解讀成桌面法向接近速度，是接觸模型的敏感度情境，不是報告的直接校準。
- 切向衝量、omega 與 solver 回報的 sliding／rolling regime 都固定沿用現有接觸結果；因此此結果不能被解讀為完整 state-dependent friction model。

## 代表性結果

| variant | working-sign scalar envelope intersections | working-sign joint hits | energy increases |
|---|---:|---:|---:|
| current-policy-fixed | angle 1/4; rotation 2/4; speed 1/4 | 0 | 0 |
| official-group-I-fixed | angle 1/4; rotation 2/4; speed 1/4 | 0 | 0 |
| official-group-II-fixed | angle 1/4; rotation 2/4; speed 2/4 | 0 | 0 |
| official-group-III-fixed | angle 1/4; rotation 3/4; speed 2/4 | 0 | 0 |
| current-policy-report-cor-total-relative | angle 1/4; rotation 2/4; speed 1/4 | 0 | 0 |
| official-group-I-report-cor-total-relative | angle 2/4; rotation 2/4; speed 3/4 | 0 | 0 |
| official-group-II-report-cor-total-relative | angle 2/4; rotation 2/4; speed 2/4 | 0 | 0 |
| official-group-III-report-cor-total-relative | angle 1/4; rotation 3/4; speed 2/4 | 0 | 0 |
| current-policy-report-cor-normal-approach | angle 1/4; rotation 2/4; speed 1/4 | 0 | 0 |
| official-group-I-report-cor-normal-approach | angle 1/4; rotation 2/4; speed 2/4 | 0 | 0 |
| official-group-II-report-cor-normal-approach | angle 1/4; rotation 2/4; speed 2/4 | 0 | 0 |
| official-group-III-report-cor-normal-approach | angle 2/4; rotation 3/4; speed 2/4 | 0 | 0 |

## 逐 level 的 joint 結果

| variant | level 0 | level 2 | level 4 | level 6 |
|---|---:|---:|---:|---:|
| current-policy-fixed | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-I-fixed | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-II-fixed | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-III-fixed | 0/81 | 0/81 | 0/729 | 0/729 |
| current-policy-report-cor-total-relative | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-I-report-cor-total-relative | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-II-report-cor-total-relative | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-III-report-cor-total-relative | 0/81 | 0/81 | 0/729 | 0/729 |
| current-policy-report-cor-normal-approach | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-I-report-cor-normal-approach | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-II-report-cor-normal-approach | 0/81 | 0/81 | 0/729 | 0/729 |
| official-group-III-report-cor-normal-approach | 0/81 | 0/81 | 0/729 | 0/729 |

## 判定

這是一個機制敏感度與語義審計，不是參數調整授權。若 overlay 仍無 joint match，不能據此說明材質一定錯；它只表示「單獨加入報告式速度依賴 COR」不足以解釋全部外部結果。若某情境出現 joint match，也只能表示該輸入／輸出語義與接觸律組合值得後續量測驗證，不能直接升格為正式模型。

## 限制

1. 2017 資料來自圖表 digitization，且 before 的角度、旋轉、速度被做成獨立範圍；沒有恢復同一顆球的配對資料。
2. 報告中的 COR 公式是球拍接觸關係；球桌接觸的法向／切向材料資料仍缺少直接量測。
3. overlay 只重設法向輸出速度，沒有讓更新後的 normal impulse 重新限制切向摩擦；這是刻意的隔離設計。
4. output 是 raw table contact，不包含接觸後飛行中的阻力與 Magnus 力。

## Reproduction

```text
node tools/benchmark-external-bounce-spin-state-dependent-contact-law-audit.js
```

Machine-readable output: `AI_CONTEXT/external_bounce_spin_2017_state_dependent_contact_law_audit.json`
