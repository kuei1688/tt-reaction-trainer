# 2017 外部資料：官方規格約束的接觸 profile screen

日期：2026-07-16

## 這次測什麼

前一輪任意材質代理 sweep 太寬，雖然能找到一些數值 joint match，卻也產生有效 restitution 大於 1 的非物理區域。因此這次先用官方器材規格做 acceptance gate，再測斜向帶旋轉撞擊。

這不是把 ITTF 規格直接當成楊氏模數，也不是材質校準；ITTF 主要規定的是球桌／球組合的可測表現。

## 官方約束

官方文件提供：

- 300 mm 無旋落球，反彈高度 230–260 mm。
- 球桌／球組合的參考 CoF 0.150–0.350，分成 I：0.150–0.210、II：0.211–0.270、III：0.271–0.350。
- 球直徑 40 mm、質量 2.7 g。

來源：

- [ITTF 2024 Council Decisions](https://db.ittf.com/sites/default/files/public/2024-03/2024_ITTF_Council_Decisions_Taken.pdf)
- [ITTF Handbook 2020](https://db.ittf.com/sites/default/files/public/2021-04/2020ITTFHandbook.pdf)

將反彈高度換成等效法向 restitution：

```text
e = sqrt(rebound_height / drop_height)
e = 0.875595–0.930949
```

這只是高度表現的等效 gate，不是唯一的材質接觸律。

## Profile search

共測 81 組：

| 代理量 | 值 |
|---|---|
| spring | 3000、6000、12000 N/m |
| damping | 2、4、8 N·s/m |
| contact duration | 2、3、4.5 ms |
| friction | ITTF group I/II/III 代表值 0.18、0.24、0.31 |

只有 3 組通過法向反彈與能量 gate：

```text
spring=6000, damping=2, duration=2 ms
friction=0.18 / 0.24 / 0.31
effective restitution=0.906688
predicted rebound height=246.625 mm
energy ratio=0.822084
```

目前 mainline policy 是：

```text
friction=0.13
effective restitution=0.863639
predicted rebound height=223.761 mm
```

因此它低於這個官方反彈 gate，且 `friction=0.13` 也低於 0.150–0.350 的官方 CoF 範圍。這是接觸 policy 的重要警示，但不代表可以直接把正式參數改成某個 group 值。

## 2017 斜向旋轉 screen

3 組通過 normal gate 的 profile，各自用 2017 before ranges 做 9×9×9 full-factorial grid，並掃描 ±omega sign，共 9,720 次。

| level | Group I | Group II | Group III |
|---:|---|---|---|
| 0 | 只有 rotation 交集；joint 0 | 只有 rotation 交集；joint 0 | 只有 rotation 交集；joint 0 |
| 2 | angle + speed 交集；joint 0 | 只有 angle 交集；joint 0 | 只有 angle 交集；joint 0 |
| 4 | 只有 rotation 交集；joint 0 | rotation + speed 交集；joint 0 | 三項 envelope 交集；joint 0 |
| 6 | 無交集；joint 0 | 只有 speed 交集；joint 0 | rotation + speed 交集；joint 0 |

因此：

> 即使先把材質／接觸 profile 限制在官方反彈與 CoF 表現範圍內，仍沒有任何 profile 同時命中角度、旋轉、速度三項。

Group III 在 level 4 能讓三個 scalar envelope 都碰到外部範圍，但沒有同一個 sampled input 同時命中；level 6 的 Group III 改善了旋轉與速度，角度仍偏低。

## 判定

這次結果比前一輪更接近「可審查的材質 profile」：

1. 官方規格應被轉成反彈／摩擦表現 gate，而不是直接猜楊氏模數。
2. 目前 `friction=0.13` 與官方 table-top CoF 範圍不一致；這值得另案檢查來源與語義。
3. 球的直徑與質量已經與官方規格一致；球的殼體材質與變形仍未被量測建模。
4. 受官方 gate 約束後，材質 profile 仍不能單獨解釋 2017 的完整 mismatch。
5. 外部 contact regime 仍是 `not_reported`；模型的 sliding／rolling 只是 solver diagnostic。
6. 不授權調參或正式 promotion。

下一個真正能縮小不確定性的實驗，是對實際球／實際桌面做 BBoT-like 測試：同時取得垂直 restitution、斜向 friction、旋轉傳遞與接觸時間，再把這些量測輸入下一個 isolated profile。

## 產物

- 工具：[benchmark-external-bounce-spin-standard-contact-profile-screen.js](/C:/Users/Kevin/Documents/Codex/2026-06-16/files-mentioned-by-the-user-tt/outputs/tt-reaction-trainer-pages/tools/benchmark-external-bounce-spin-standard-contact-profile-screen.js)
- JSON：[external_bounce_spin_2017_standard_contact_profile_screen.json](/C:/Users/Kevin/Documents/Codex/2026-06-16/files-mentioned-by-the-user-tt/outputs/tt-reaction-trainer-pages/AI_CONTEXT/external_bounce_spin_2017_standard_contact_profile_screen.json)
