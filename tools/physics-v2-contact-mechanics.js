// ── Phase 1：真實觸桌接觸力學模型（獨立驗證，不碰 game4.html）───────────────
// 對應 docs/physics-engine-v2-plan.md 的 Phase 1
//
// 物理設定：
//   球是薄殼球，I = (2/3) m R²
//   接觸點固定在球心正下方 r = (0, -R, 0)
//   垂直方向（法向）：用既有的 ITTF 反彈係數 ε=0.876（跟旋轉無關，先處理掉）
//   水平方向（切向）：拆成兩個獨立的一維「球拍/球桌 + 旋轉」問題（解耦近似，已在
//     docs/physics-engine-v2-plan.md Phase 0 記錄為刻意的簡化選擇）：
//       (vz, ωx) 這一對 ↔ 現有的 topspin：接觸點在 z 方向的滑動速度 = vz - ωx*R
//       (vx, ωz) 這一對 ↔ 現有的 sidespin：接觸點在 x 方向的滑動速度 = vx + ωz*R
//   每一對都用同一套「打滑 / 純滾動」判斷邏輯處理。
//
// 打滑 vs 純滾動判斷（Phys. Rev. E 107, 055007 (2023) synopsis 的結論）：
//   1. 先算「如果摩擦力足夠大，會不會在接觸時間內把滑動速度歸零（達到純滾動）」
//      這個解不需要知道 μ，只需要動量守恆 + 角動量守恆（對接觸點取角動量，因為
//      法向力跟摩擦力都作用在接觸點上，對接觸點本身不產生力矩）
//   2. 算出「歸零滑動速度所需要的摩擦衝量」，跟「摩擦力上限 μN 在接觸時間內能
//      提供的最大衝量」比較：
//        - 如果 μN 給的到，代表真的會在接觸內達到純滾動 → 用純滾動解
//        - 如果 μN 給不到，代表全程都在打滑 → 用「摩擦衝量 = μN」的打滑解
//
// 重要發現（Phase 1 驗證時浮現，跟舊的簡化模型不一樣）：
//   「上旋是否會在觸桌後加速球」不是只看 topspin 正負號，是看 ωR 有沒有超過 v
//   （接觸點滑動方向有沒有真的反轉）。ωR < v 時，上旋只是讓減速變少，還是會減速；
//   只有 ωR > v 時才會真的加速。這是做對接觸力學後才會出現的行為，舊模型
//   （topspin 線性加到 forwardSpeed）沒有這個門檻效應。

const R = 0.02;      // 球半徑 (m)，ITTF 40mm 直徑
const M = 0.0027;    // 球質量 (kg)，ITTF 2.7g
const ALPHA = 2 / 3;  // 薄殼球轉動慣量係數：I = ALPHA * M * R²
const I = ALPHA * M * R * R;
const EPSILON = 0.876; // 法向反彈係數（ITTF 球桌測試，30cm 落下彈回 23cm）
const EPSILON_OBLIQUE = 0.57; // 斜向撞擊約 83 度時的實測反彈係數
const EPSILON_MIN = 0.45; // 資料不足時先保守限制，避免劇烈滑動讓垂直反彈歸零
const OBLIQUE_ANGLE_DEG = 83;
const SPIN_EPSILON_REFERENCE = 6.0; // 球面旋轉速度達到此值時，套用完整額外反彈損失

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function contactSlipSpeed(vel, spin) {
  const slipZ = vel.z - (spin.topspin || 0) * R;
  const slipX = vel.x + (spin.sidespin || 0) * R;
  return Math.hypot(slipX, slipZ);
}

function horizontalImpactSpeed(vel) {
  return Math.hypot(vel.x || 0, vel.z || 0);
}

function spinSurfaceSpeed(spin) {
  return R * Math.hypot(spin?.topspin || 0, spin?.sidespin || 0);
}

function dynamicEpsilon(vel, spin) {
  const normalSpeed = Math.abs(vel.y);
  if (normalSpeed < 1e-9) return EPSILON_MIN;

  const obliqueHorizontalSpeed = normalSpeed * Math.tan(OBLIQUE_ANGLE_DEG * Math.PI / 180);
  const baselineT = clamp(horizontalImpactSpeed(vel) / obliqueHorizontalSpeed, 0, 1);
  const baselineEpsilon = EPSILON + (EPSILON_OBLIQUE - EPSILON) * baselineT;
  const spinT = clamp(spinSurfaceSpeed(spin || {topspin: 0, sidespin: 0}) / SPIN_EPSILON_REFERENCE, 0, 1);
  const spinPenalty = (EPSILON_OBLIQUE - EPSILON_MIN) * spinT;
  return clamp(baselineEpsilon - spinPenalty, EPSILON_MIN, EPSILON);
}

// 一維「球撞桌 + 旋轉」問題的通用解
// v: 觸桌前的切向速度（沿某個水平軸）
// omega: 觸桌前的角速度（對應軸）
// normalImpulse: 這次觸桌的法向衝量大小 J_n = m(1+ε)|vy_in|（兩個切向軸共用同一個法向事件）
// mu: 摩擦係數
// 回傳 {v2, omega2, regime}，regime 是 'rolling' 或 'sliding'，方便單元測試檢查
function bounceTangentialAxis(v, omega, normalImpulse, mu) {
  const slip = v - omega * R; // 接觸點的滑動速度（沿這個切向軸）
  if (Math.abs(slip) < 1e-9) {
    // 已經是純滾動，沒有滑動，摩擦力不需要做功
    return { v2: v, omega2: omega, regime: 'rolling' };
  }

  // 純滾動解（不需要 μ）：對接觸點的角動量守恆
  //   L_contact = m*v*R + I*omega  (對接觸點；v>0/omega>0 的貢獻方向要跟 slip 定義一致)
  //   純滾動條件：v2 = omega2 * R
  //   解出：omega2 = (m*v*R + I*omega) / (m*R^2 + I)
  const omega2Roll = (M * v * R + I * omega) / (M * R * R + I);
  const v2Roll = omega2Roll * R;

  // 純滾動解需要的摩擦衝量大小（沿切向軸；正負號取決於 slip 方向）
  // 用線動量變化反推：J_friction = m*(v2Roll - v)
  const jNeededForRoll = M * (v2Roll - v);
  const jAvailable = mu * normalImpulse; // 摩擦力上限能提供的最大衝量（同方向，opposing slip）

  // 摩擦衝量方向必須跟 slip 方向相反（阻止滑動）
  // slip>0 時，jNeededForRoll 應該 <=0（減少 v，增加 omega 讓兩者趨同）
  if (Math.abs(jNeededForRoll) <= jAvailable) {
    // 摩擦力足夠在接觸時間內讓球達到純滾動
    return { v2: v2Roll, omega2: omega2Roll, regime: 'rolling' };
  }

  // 摩擦力不夠，全程打滑：用摩擦力上限 μN，方向跟 slip 相反
  const jFriction = -Math.sign(slip) * jAvailable;
  const v2 = v + jFriction / M;
  // 力矩 = R x F_friction，Δω = (R * jFriction) / I （沿旋轉軸的正確方向，跟我們
  // slip = v - omega*R 的定義一致：摩擦阻止滑動，同時增加 omega 讓 slip 趨向 0）
  const omega2 = omega - jFriction / (I / R);
  return { v2, omega2, regime: 'sliding' };
}

// 完整一次觸桌反彈（同時處理法向 + 兩個切向軸）
// vel = {x, y, z}, spin = {topspin, sidespin} 皆為 rad/s（Phase 0 規格）
function bounceWithSpinPhysical(vel, spin, mu) {
  if (vel.y >= 0) throw new Error('bounceWithSpinPhysical 只處理下墜中的球 (vy<0)');
  const epsilon = dynamicEpsilon(vel, spin);
  const normalImpulse = M * (1 + epsilon) * Math.abs(vel.y);
  const vyAfter = -epsilon * vel.y;

  // z 軸切向：對應 topspin（ωx）。slip_z = vz - ωx*R
  const zResult = bounceTangentialAxis(vel.z, spin.topspin, normalImpulse, mu);
  // x 軸切向：對應 sidespin（ωz）。slip_x = vx + ωz*R，用「有效角速度 = -sidespin」
  // 代入同一個 bounceTangentialAxis(v, omega) 讓公式維持 slip = v - omega*R 的形式
  const xResult = bounceTangentialAxis(vel.x, -spin.sidespin, normalImpulse, mu);

  return {
    vel: { x: xResult.v2, y: vyAfter, z: zResult.v2 },
    spin: { topspin: zResult.omega2, sidespin: -xResult.omega2 },
    epsilon,
    regime: { topspin: zResult.regime, sidespin: xResult.regime },
  };
}

function bounceApexHeight(startY, vyAfter, gravity = -4.2) {
  return startY + (vyAfter * vyAfter) / (2 * Math.abs(gravity));
}

module.exports = {
  R,
  M,
  I,
  ALPHA,
  EPSILON,
  EPSILON_OBLIQUE,
  EPSILON_MIN,
  OBLIQUE_ANGLE_DEG,
  SPIN_EPSILON_REFERENCE,
  contactSlipSpeed,
  horizontalImpactSpeed,
  spinSurfaceSpeed,
  dynamicEpsilon,
  bounceApexHeight,
  bounceTangentialAxis,
  bounceWithSpinPhysical,
};

// ── 單元測試（依 docs/physics-engine-v2-plan.md Phase 1 checklist）─────────
if (require.main === module) {
  const MU_TEST = 0.25; // 尚未校準，Phase 2 才會定案，這裡只是拿來驗證邏輯用的暫定值
  let pass = 0, fail = 0;
  function check(label, cond, detail) {
    if (cond) { pass++; console.log('  [OK]', label); }
    else { fail++; console.log('  [FAIL]', label, detail !== undefined ? JSON.stringify(detail) : ''); }
  }

  console.log('=== 測試 1：零旋轉球（sanity check，應該接近簡單彈性反彈）===');
  {
    const vel = { x: 0, y: -3, z: 4 };
    const spin = { topspin: 0, sidespin: 0 };
    const result = bounceWithSpinPhysical(vel, spin, MU_TEST);
    console.log('  結果:', result);
    check('垂直反彈係數正確 (vy2 ≈ -ε*vy1)', Math.abs(result.vel.y - 3 * result.epsilon) < 1e-6, result.vel.y);
    check('零旋轉時水平方向應該只有摩擦造成的些微變化，不該爆衝', Math.abs(result.vel.z) < 4 * 1.2, result.vel.z);
    check('零旋轉球撞擊後應該會產生新的旋轉（角動量不再是 0）', Math.abs(result.spin.topspin) > 0, result.spin.topspin);
  }

  console.log('');
  console.log('=== 測試 2：純下旋球（topspin 大幅負值），水平速度應該被拉低甚至反向 ===');
  {
    const vel = { x: 0, y: -3, z: 4 };
    const spinWeak = { topspin: -125.66, sidespin: 0 }; // 20 rps 下旋
    const result = bounceWithSpinPhysical(vel, spinWeak, MU_TEST);
    console.log('  結果:', result);
    check('下旋球撞桌後前進速度應該比入射速度低（下旋抵消前進）', result.vel.z < vel.z, { before: vel.z, after: result.vel.z });
  }

  console.log('');
  console.log('=== 測試 2b：20rps 下旋會讓彈起弧線比不轉球更低 ===');
  {
    const vel = { x: 0, y: -3, z: 0.3 };
    const noSpin = bounceWithSpinPhysical(vel, { topspin: 0, sidespin: 0 }, MU_TEST);
    const backspin20 = bounceWithSpinPhysical(vel, { topspin: -125.66, sidespin: 0 }, MU_TEST);
    const noSpinApex = bounceApexHeight(0.781, noSpin.vel.y);
    const backspinApex = bounceApexHeight(0.781, backspin20.vel.y);
    console.log('  不轉:', {epsilon: noSpin.epsilon, apex: noSpinApex});
    console.log('  20rps 下旋:', {epsilon: backspin20.epsilon, apex: backspinApex});
    check('20rps 下旋的動態 ε 應低於不轉球', backspin20.epsilon < noSpin.epsilon, {noSpin: noSpin.epsilon, backspin20: backspin20.epsilon});
    check('20rps 下旋撞桌後最高點應明顯比不轉球低', backspinApex < noSpinApex - 0.02, {noSpinApex, backspinApex});
  }

  console.log('');
  console.log('=== 測試 2c：實戰 vz=1.5 時不轉球不應被誤壓到 EPSILON_MIN ===');
  {
    const vel = { x: 0, y: -3, z: 1.5 };
    const noSpin = bounceWithSpinPhysical(vel, { topspin: 0, sidespin: 0 }, MU_TEST);
    const backspin20 = bounceWithSpinPhysical(vel, { topspin: -125.66, sidespin: 0 }, MU_TEST);
    const backspin40 = bounceWithSpinPhysical(vel, { topspin: -251.33, sidespin: 0 }, MU_TEST);
    const noSpinApex = bounceApexHeight(0.781, noSpin.vel.y);
    const backspin20Apex = bounceApexHeight(0.781, backspin20.vel.y);
    const backspin40Apex = bounceApexHeight(0.781, backspin40.vel.y);
    console.log('  不轉:', {epsilon: noSpin.epsilon, apex: noSpinApex, vz: noSpin.vel.z});
    console.log('  20rps 下旋:', {epsilon: backspin20.epsilon, apex: backspin20Apex, vz: backspin20.vel.z});
    console.log('  40rps 下旋:', {epsilon: backspin40.epsilon, apex: backspin40Apex, vz: backspin40.vel.z});
    check('不轉球的 ε 不應直接掉到 EPSILON_MIN', noSpin.epsilon > EPSILON_MIN + 0.1, noSpin.epsilon);
    check('20rps 下旋最高點應低於不轉球', backspin20Apex < noSpinApex, {noSpinApex, backspin20Apex});
    check('40rps 下旋最高點應低於 20rps', backspin40Apex < backspin20Apex, {backspin20Apex, backspin40Apex});
    check('實戰 vz=1.5 的下旋第二跳不應常態回彈', backspin20.vel.z > 0 && backspin40.vel.z > 0, {backspin20: backspin20.vel.z, backspin40: backspin40.vel.z});
  }

  console.log('');
  console.log('=== 測試 3：強力上旋球，接觸點滑動方向要真的反過來，水平速度才會被推快 ===');
  console.log('（重要發現：ωR 必須超過 v，接觸點滑動方向才會反轉，摩擦力才會轉為加速；');
  console.log(' 這跟舊模型「topspin 值只要是正的就線性加速」不一樣，是這次做對物理後才浮現的細節）');
  {
    const vel = { x: 0, y: -3, z: 4 };
    const thresholdOmega = vel.z / R; // 200 rad/s，臨界值
    const spinTop = { topspin: thresholdOmega * 1.5, sidespin: 0 }; // 明顯超過臨界值
    const result = bounceWithSpinPhysical(vel, spinTop, MU_TEST);
    console.log('  臨界值 omega =', thresholdOmega.toFixed(1), 'rad/s，測試用 omega =', spinTop.topspin.toFixed(1), 'rad/s');
    console.log('  結果:', result);
    check('超過臨界值的上旋，撞桌後前進速度應該比入射速度高', result.vel.z > vel.z, { before: vel.z, after: result.vel.z });
  }

  console.log('');
  console.log('=== 測試 4：純滾動 vs 打滑分支都會被觸發到 ===');
  {
    // 弱旋轉案例：omega 已經很接近「零殘餘滑動」，摩擦力很容易補完最後一點，應該落在 rolling
    const nearRollOmega = (4 / R) * 0.98; // 已經有 98% 接近純滾動所需的角速度（正號，slip=v-omega*R 才會趨近 0）
    const weakSpin = bounceTangentialAxis(4, nearRollOmega, M * (1 + EPSILON) * 3, MU_TEST);
    const strongSpin = bounceTangentialAxis(4, -500, M * (1 + EPSILON) * 3, MU_TEST); // 極強旋轉，方向要花很大力氣才拉得動，應該打滑
    console.log('  weakSpin regime:', weakSpin.regime, weakSpin);
    console.log('  strongSpin regime:', strongSpin.regime, strongSpin);
    check('已經接近純滾動的球，摩擦力應該足夠補完，落在 rolling', weakSpin.regime === 'rolling');
    check('極強旋轉應該打滑（摩擦力不夠把它拉到純滾動）', strongSpin.regime === 'sliding');
  }

  console.log('');
  console.log(`總結：${pass} 通過 / ${fail} 失敗`);
}
