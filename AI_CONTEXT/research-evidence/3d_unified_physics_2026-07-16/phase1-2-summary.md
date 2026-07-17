# Phase 1/2 prototype result

日期：2026-07-16

在 `prototypes/3d-unified-physics/` 建立隔離 forward model：輸入邊界將 authoring metadata 或 legacy spin 一次轉成 `schema: 2` 的 world-space `omega`；飛行 kernel 以 real-scale gravity 與 `omega × velocity` 計算；桌面與球拍可共用同一個任意平面 contact kernel。

自動檢查全部通過：左右 Magnus 方向、axial conversion、legacy boundary、任意法向平面 impulse、完整 2D Coulomb friction、rolling 條件、固定面能量不增加、座標旋轉不變性、compliant substep 共用摩擦路徑，以及 real-scale flight step。

這只證明 prototype 的資料契約與數學實作在受控案例下可運作。尚未把它接入任何正式頁面或 preset，也沒有影片世界座標軌跡／旋轉量測，因此不能推出 Magnus 係數、桌面反彈參數或 Trainer readiness。
