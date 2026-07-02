// 球拍接觸力學（通用版）：驗證用暫存腳本，跟 tools/physics-v2-contact-mechanics.js 對拍
const R = 0.02;
const M = 0.0027;
const ALPHA = 2 / 3;
const I = ALPHA * M * R * R;
const EPSILON = 0.876; // 桌面反彈係數，拿來當 sanity check 的對照值

function bounceTangentialAxis(v, omega, normalImpulse, mu) {
  const slip = v - omega * R;
  if (Math.abs(slip) < 1e-9) return { v2: v, omega2: omega, regime: 'rolling' };
  const omega2Roll = (M * v * R + I * omega) / (M * R * R + I);
  const v2Roll = omega2Roll * R;
  const jNeededForRoll = M * (v2Roll - v);
  const jAvailable = mu * normalImpulse;
  if (Math.abs(jNeededForRoll) <= jAvailable) return { v2: v2Roll, omega2: omega2Roll, regime: 'rolling' };
  const jFriction = -Math.sign(slip) * jAvailable;
  const v2 = v + jFriction / M;
  const omega2 = omega - jFriction / (I / R);
  return { v2, omega2, regime: 'sliding' };
}
// 對照組：已驗證過的桌面版本（法向永遠 +y、永遠靜止）
function bounceWithSpinPhysical(vel, spin, mu) {
  const normalImpulse = M * (1 + EPSILON) * Math.abs(vel.y);
  const vyAfter = -EPSILON * vel.y;
  const zResult = bounceTangentialAxis(vel.z, spin.topspin, normalImpulse, mu);
  const xResult = bounceTangentialAxis(vel.x, -spin.sidespin, normalImpulse, mu);
  return {
    vel: { x: xResult.v2, y: vyAfter, z: zResult.v2 },
    spin: { topspin: zResult.omega2, sidespin: -xResult.omega2 },
  };
}

// ── 向量工具 ──
function cross(a, b) { return { x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x }; }
function sub(a, b) { return { x: a.x-b.x, y: a.y-b.y, z: a.z-b.z }; }
function scale(v, s) { return { x: v.x*s, y: v.y*s, z: v.z*s }; }
function dot(a, b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
function norm(v) { const l = Math.hypot(v.x,v.y,v.z)||1; return scale(v, 1/l); }

// ── 通用版：任意法向 + 任意平面速度的接觸力學 ──
function bounceOffPlane(vel, spin, planeNormal, planeVel, restitution, friction) {
  const omega = { x: spin.topspin || 0, y: 0, z: spin.sidespin || 0 };
  const relVel = sub(vel, planeVel);
  const normalSpeed = dot(relVel, planeNormal); // 應該 < 0
  const normalImpulse = M * (1 + restitution) * Math.abs(normalSpeed);
  const normalRelAfter = -restitution * normalSpeed;

  const r = scale(planeNormal, -R);
  const rotContact = cross(omega, r);
  const contactRelVel = { x: relVel.x+rotContact.x, y: relVel.y+rotContact.y, z: relVel.z+rotContact.z };
  const normalComp = scale(planeNormal, dot(contactRelVel, planeNormal));
  const tangentSlip = sub(contactRelVel, normalComp);
  const slipMag = Math.hypot(tangentSlip.x, tangentSlip.y, tangentSlip.z);

  const comTangent = sub(relVel, scale(planeNormal, normalSpeed));
  let tangentRelAfter, omegaAfter;

  if (slipMag < 1e-9) {
    tangentRelAfter = comTangent;
    omegaAfter = omega;
  } else {
    const e1 = scale(tangentSlip, 1 / slipMag);
    const e2 = cross(planeNormal, e1); // 右手系：e1, e2, planeNormal
    const v1 = dot(comTangent, e1);
    const v2 = dot(comTangent, e2);
    // 推導（見 racket_contact.js 開發筆記）：slip_e1 = v1 - (ω·e2)*R，slip_e2 = v2 - (-ω·e1)*R
    const omega1 = dot(omega, e2);
    const omega2 = -dot(omega, e1);
    const r1 = bounceTangentialAxis(v1, omega1, normalImpulse, friction);
    const r2 = bounceTangentialAxis(v2, omega2, normalImpulse, friction);
    tangentRelAfter = {
      x: e1.x*r1.v2 + e2.x*r2.v2,
      y: e1.y*r1.v2 + e2.y*r2.v2,
      z: e1.z*r1.v2 + e2.z*r2.v2,
    };
    const normalSpinComp = scale(planeNormal, dot(omega, planeNormal));
    omegaAfter = {
      x: normalSpinComp.x + e2.x*r1.omega2 - e1.x*r2.omega2,
      y: normalSpinComp.y + e2.y*r1.omega2 - e1.y*r2.omega2,
      z: normalSpinComp.z + e2.z*r1.omega2 - e1.z*r2.omega2,
    };
  }
  const velAfterRel = {
    x: normalRelAfter*planeNormal.x + tangentRelAfter.x,
    y: normalRelAfter*planeNormal.y + tangentRelAfter.y,
    z: normalRelAfter*planeNormal.z + tangentRelAfter.z,
  };
  const velAfter = { x: velAfterRel.x+planeVel.x, y: velAfterRel.y+planeVel.y, z: velAfterRel.z+planeVel.z };
  return { vel: velAfter, spin: { topspin: omegaAfter.x, sidespin: omegaAfter.z } };
}

// ── 驗證：法向=(0,1,0)、平面速度=0，「單軸滑動」情境應該完全等於桌面版本 ──
// （混合滑動情境 (x,z 同時有滑動) 預期會有些微差異：通用版用真正的 2D 向量庫倫
// 摩擦（單一共用摩擦衝量預算），桌面版是刻意簡化的「x/z 各自獨立摩擦力預算」
// —— 這是已知、預期中的差異，不是 bug，只在單軸案例上要求精確相等。）
function checkEqual(label, a, b, tol) {
  const ok = Math.abs(a - b) < (tol || 1e-6);
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${label}: general=${a.toFixed(6)} table=${b.toFixed(6)}`);
  return ok;
}
console.log('=== 驗證 1：單軸滑動案例，通用版應與桌面版完全一致 ===');
const singleAxisCases = [
  { vel: {x:0,y:-3,z:4}, spin:{topspin:0,sidespin:0} },
  { vel: {x:0,y:-3,z:4}, spin:{topspin:-125.66,sidespin:0} },
  { vel: {x:0,y:-4,z:5}, spin:{topspin:400,sidespin:0} }, // 超過臨界值的強上旋
  { vel: {x:2,y:-3,z:0}, spin:{topspin:0,sidespin:60} },
];
let allPass = true;
for (const tc of singleAxisCases) {
  const g = bounceOffPlane(tc.vel, tc.spin, {x:0,y:1,z:0}, {x:0,y:0,z:0}, EPSILON, 0.13);
  const t = bounceWithSpinPhysical(tc.vel, tc.spin, 0.13);
  console.log(`測試案例 vel=${JSON.stringify(tc.vel)} spin=${JSON.stringify(tc.spin)}`);
  allPass = checkEqual('vel.x', g.vel.x, t.vel.x) && allPass;
  allPass = checkEqual('vel.y', g.vel.y, t.vel.y) && allPass;
  allPass = checkEqual('vel.z', g.vel.z, t.vel.z) && allPass;
  allPass = checkEqual('spin.topspin', g.spin.topspin, t.spin.topspin) && allPass;
  allPass = checkEqual('spin.sidespin', g.spin.sidespin, t.spin.sidespin) && allPass;
}
console.log('');
console.log(allPass ? '=== 全部通過，通用版公式在單軸案例跟桌面版一致 ===' : '=== 有失敗，公式有 bug ===');

console.log('');
console.log('=== 驗證 2：移動中的拍面（非零 planeVel），法向仍是 (0,1,0)，僅供人工檢查合理性 ===');
{
  const vel = {x:0, y:-3, z:3.5};
  const spin = {topspin:-125.66, sidespin:0};
  const racketVel = {x:0, y:0.3, z:-3.5};
  const r = bounceOffPlane(vel, spin, norm({x:0,y:0.1,z:-1}), racketVel, 0.85, 0.4);
  console.log('拍面法向傾斜 + 有揮拍速度的結果:', r);
}
if(!allPass) process.exitCode = 1;

module.exports = { bounceOffPlane, cross, sub, scale, dot, norm };
