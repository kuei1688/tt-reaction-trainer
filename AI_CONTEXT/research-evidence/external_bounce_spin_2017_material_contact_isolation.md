# 2017 外部資料：球／球桌材質與接觸律隔離實驗

日期：2026-07-16

## 實驗目的

這次不是把材質參數調到吻合，而是隔離測試：如果只改變球桌接觸的有效 stiffness、damping、friction 與 contact duration，目前模型的角度、速度、旋轉傳遞能移動多少。

這些是接觸律代理，不是已查證的球桌或球材質常數。

## 實驗設定

掃描 81 組組合：

| 代理量 | 掃描值 |
|---|---|
| spring | 3000、6000、12000 N/m |
| damping | 2、4、8 N·s/m |
| friction | 0.08、0.13、0.25 |
| contact duration | 2、3、4.5 ms |

固定條件：球半徑 20 mm、質量 2.7 g、薄殼轉動慣量、桌面法線 `+Y`、實尺度速度、omega X 軸正負兩種候選。

做了兩個隔離實驗：

1. 純法向落球：4、6、8、10 m/s，旋轉為 0。
2. 斜向帶旋轉撞擊：使用 2017 每個 level 的 before range 做 9×9×9 full-factorial grid，掃描 ±omega sign，共 262,440 次接觸。

## 法向落球結果

目前 policy（spring 6000、damping 4、friction 0.13、duration 3 ms）在 4–10 m/s 都得到：

```text
effective restitution ≈ 0.863639
energy ratio         ≈ 0.745872
```

整個 81 組代理掃描的 envelope 是：

```text
effective restitution: 0.339754–2.196858
energy ratio:          0.115433–4.826186
```

其中 324 次法向樣本有 108 次能量增加，且最高 restitution 大於 1。這些區域必須被視為接觸律的非物理警告，不能視為「可能的真實材質」。

## 斜向旋轉結果

`Y` 表示整個材質／輸入 envelope 與外部 after range 有交集；`joint` 表示同一個 sampled input 同時命中角度、旋轉、速度三項。

| level | 全材質 envelope angle / rotation / speed | 外部三項是否都有交集 | joint samples | 可用判讀 |
|---:|---|---|---:|---|
| 0 | Y / Y / Y | 是 | 0 | 沒有單一材質組合同時覆蓋三項 |
| 2 | Y / N / Y | 否 | 0 | rotation 仍無法到達 65.1 rps |
| 4 | Y / Y / Y | 是 | 0 | 1 組材質代理有三個 scalar envelope 交集，但沒有同一 input joint 命中 |
| 6 | Y / Y / Y | 是 | 54 | 2 組材質代理出現 joint samples，但輸入仍是獨立 range 組合 |

level 6 出現 joint 的兩組是：

```text
spring=3000,  damping=2, friction=0.25, duration=4.5 ms  -> 23 joint samples
spring=12000, damping=4, friction=0.25, duration=2.0 ms  -> 31 joint samples
```

這兩組在自己的樣本中沒有 energy increase，但它們不是由真實材質規格推導出的數值，因此只能說：

> 接觸律確實有能力改變 level 6 的 mismatch；目前不能說已找到真實球桌材質參數。

## 目前 policy 與材質代理的差異

目前 policy 在 level 4 與 level 6 都沒有 joint match：

- level 4：只有 rotation envelope 交集。
- level 6：角度、旋轉、速度三項都沒有交集。

提高 friction 到 0.25、同時改變接觸時間與 stiffness/damping，才讓 level 6 出現 joint samples。這使摩擦與接觸期間的切向旋轉傳遞成為值得量測的候選機制。

但 level 0、level 2 仍沒有 joint match；因此「材質接觸律」不能單獨被宣布為所有 mismatch 的解釋。

## 接觸 regime 與能量檢查

外部論文仍然是：

```text
external contact regime = not_reported
```

模型的 regime 只是 solver diagnostic。寬掃描中，level 0/2/4 同時出現 sliding 與 rolling；level 6 全部被判為 sliding。這不是外部 regime 的測量結果。

此外，寬掃描出現 108 次法向 energy increase，以及斜向各 level 的 energy increase。這是重要的 rejection gate：若某組代理不能保持合理能量行為，就不能拿它解釋實驗，即使它的數值 envelope 看起來吻合。

## 判定

本次隔離實驗支持：

1. 球／球桌接觸律與材質效果確實可能是 mismatch 的重要來源。
2. 特別是 friction、接觸 duration 與 tangential spin transfer 可能影響 level 6。
3. 目前的 spring/damping/friction bracket 太寬，會產生非物理能量增加，不能直接當成材質校準。
4. 2017 紙本資料沒有提供足夠的 contact force、dwell、slip 或 per-ball pairing，無法從它反推出唯一材質模型。
5. 本次沒有調整正式參數，也沒有修改 mainline-v2、shared core、legacy pages 或正式 presets。

下一個必要 gate 是取得或建立獨立接觸量測：法向落球的反彈係數與接觸時間，以及斜向帶旋轉撞擊的速度／旋轉傳遞。只有這些量測能把「有效接觸代理」收斂到可審查的範圍。

## 產物

- 工具：[benchmark-external-bounce-spin-material-contact-isolation.js](/C:/Users/Kevin/Documents/Codex/2026-06-16/files-mentioned-by-the-user-tt/outputs/tt-reaction-trainer-pages/tools/benchmark-external-bounce-spin-material-contact-isolation.js)
- JSON：[external_bounce_spin_2017_material_contact_isolation.json](/C:/Users/Kevin/Documents/Codex/2026-06-16/files-mentioned-by-the-user-tt/outputs/tt-reaction-trainer-pages/AI_CONTEXT/external_bounce_spin_2017_material_contact_isolation.json)
