DRAFT: Core physics symbol inventory
#
# Status: draft only.
# This file is a read-only inventory and must not be treated as a behavioral diff.
# Last touched: 2026-07-06

# Core Physics Symbol Inventory Draft

> This is a read-only symbol inventory generated from current repo files. It is not a behavioral diff and does not prove functions are equivalent.

## game4.html

- L239: `const EPSILON_VERTICAL = 0.876;   // ITTF 球桌反彈測試（30cm 落下彈回 23cm）`
- L240: `const EPSILON_OBLIQUE = 0.57;     // 斜向撞擊（入射角 ~83°）實測反彈係數`
- L241: `const EPSILON_MIN = 0.45;         // 旋轉/斜向撞擊劇烈時的保守下限`
- L243: `const SPIN_EPSILON_REFERENCE = 6.0; // 球面旋轉速度達到此值時，套用完整額外反彈損失`
- L244: `const CONTACT_FRICTION_MU = 0.13;   // Phase 2 校準定案值`
- L250: `// PADDLE_RESTITUTION_LOW/HIGH / PADDLE_FRICTION 這幾個常數，不用動接觸力學本身。`
- L253: `const PADDLE_RESTITUTION_LOW = 0.9;   // 低速（~2m/s）反彈係數上限`
- L254: `const PADDLE_RESTITUTION_HIGH = 0.75; // 高速（~12m/s）反彈係數下限`
- L255: `const PADDLE_SPEED_LOW = 2.0;`
- L256: `const PADDLE_SPEED_HIGH = 12.0;`
- L257: `const PADDLE_FRICTION = 0.4;        // 拍面切向摩擦係數，工程估計值（無精確文獻，之後可依膠皮種類覆寫）`
- L258: `const PADDLE_RESTITUTION = -0.9;    // 舊模型殘留常數，目前只有 loop（拉球）還在用，尚未套用球拍接觸力學`
- L280: `loop: {label:'拉球', model:'direct', techniqueVel:{x:-0.6, y:1.0, z:-1.65}, spin:{topspin:0.9,sidespin:0}, bounceBoost:0.3}`
- L506: `function dynamicEpsilon(vel, spin){`
- L508: `if(normalSpeed < 1e-9) return EPSILON_MIN;`
- L511: `const baselineEpsilon = EPSILON_VERTICAL + (EPSILON_OBLIQUE - EPSILON_VERTICAL) * baselineT;`
- L512: `const spinT = clamp(spinSurfaceSpeed(spin || {topspin:0,sidespin:0}) / SPIN_EPSILON_REFERENCE, 0, 1);`
- L513: `const spinPenalty = (EPSILON_OBLIQUE - EPSILON_MIN) * spinT;`
- L514: `return clamp(baselineEpsilon - spinPenalty, EPSILON_MIN, EPSILON_VERTICAL);`
- L531: `function bounceWithSpinPhysical(vel, spin, mu){`
- L574: `function bounceOffPlane(vel, spin, planeNormal, planeVel, restitution, friction){`
- L676: `const bounced = bounceWithSpinPhysical(vel, spin, CONTACT_FRICTION_MU);`
- L868: `function simulateServe(preset){`
- L1070: `const serve = simulateServe(preset);`
- L1306: `x: incomingVel.x * PADDLE_RESTITUTION + techniqueVel.x,`
- L1307: `y: incomingVel.y * PADDLE_RESTITUTION + techniqueVel.y,`
- L1308: `z: incomingVel.z * PADDLE_RESTITUTION + techniqueVel.z`
- L1347: `function solveRacketVelXForTargetLandingX(incomingVel, incomingSpin, racketNormal, techVel, restitution, friction, hitPoint, gravity, targetLandingX){`
- L1370: `const t = clamp((normalSpeed - PADDLE_SPEED_LOW) / (PADDLE_SPEED_HIGH - PADDLE_SPEED_LOW), 0, 1);`
- L1371: `return PADDLE_RESTITUTION_LOW + (PADDLE_RESTITUTION_HIGH - PADDLE_RESTITUTION_LOW) * t;`
- L1441: `function computeAdaptivePushMagnitude(incomingVel, contactZ, topspin){`
- L1453: `function computeAdaptivePushTiltX(incomingVel){`
- L1467: `function computeAdaptivePushTiltY(topspin){`
- L1470: `function makeRacketReturnVelocity(incomingVel, incomingSpin, tech, hitPoint, gravity){`
- L1488: `const aimedX = solveRacketVelXForTargetLandingX(incomingVel, spin, racketNormal, techVel, epsilon, PADDLE_FRICTION, hitPoint, gravity, RETURN_TARGET_X);`
- L1491: `return bounceOffPlane(incomingVel, spin, racketNormal, planeVel, epsilon, PADDLE_FRICTION);`
- L1495: `// loop（拉球，model:'direct'）尚未套用球拍接觸力學，維持舊公式（Phase 6 待辦）`

## return-studio.html

- L283: `const EPSILON_VERTICAL = 0.876;   // ITTF 球桌反彈測試（30cm 落下彈回 23cm）`
- L284: `const EPSILON_OBLIQUE = 0.57;     // 斜向撞擊（入射角 ~83°）實測反彈係數`
- L285: `const EPSILON_MIN = 0.45;         // 旋轉/斜向撞擊劇烈時的保守下限`
- L287: `const SPIN_EPSILON_REFERENCE = 6.0; // 球面旋轉速度達到此值時，套用完整額外反彈損失`
- L288: `const CONTACT_FRICTION_MU = 0.13;   // Phase 2 校準定案值`
- L296: `// PADDLE_RESTITUTION_LOW/HIGH / PADDLE_FRICTION 這幾個常數，不用動接觸力學本身。`
- L299: `const PADDLE_RESTITUTION_LOW = 0.9;   // 低速（~2m/s）反彈係數上限`
- L300: `const PADDLE_RESTITUTION_HIGH = 0.75; // 高速（~12m/s）反彈係數下限`
- L301: `const PADDLE_SPEED_LOW = 2.0;`
- L302: `const PADDLE_SPEED_HIGH = 12.0;`
- L303: `const PADDLE_FRICTION = 0.4;        // 拍面切向摩擦係數，膠皮/海綿工程估計值範圍內`
- L304: `// PADDLE_BLEND：反彈方向跟切向滑動方向的耦合比例（0=純剛體法向量，1=完全順著球`
- L309: `const PADDLE_BLEND = 0.65;`
- L314: `// （PADDLE_SPRING_K）對應~5ms的接觸半週期，阻尼比（PADDLE_DAMPING_RATIO）校準到`
- L317: `const PADDLE_SPRING_K = BALL_MASS * (Math.PI / 0.005) ** 2;`
- L318: `const PADDLE_DAMPING_RATIO = 0.0421;`
- L340: `// PADDLE_DAMPING_RATIO 對應固定的0.876。現在讓海綿那一級的阻尼比隨撞擊速度`
- L341: `// 換算，共用同一組 PADDLE_RESTITUTION_LOW/HIGH/PADDLE_SPEED_LOW/HIGH 錨點。`
- L347: `const t = clamp((impactSpeedReal - PADDLE_SPEED_LOW) / (PADDLE_SPEED_HIGH - PADDLE_SPEED_LOW), 0, 1);`
- L348: `const e = PADDLE_RESTITUTION_LOW + (PADDLE_RESTITUTION_HIGH - PADDLE_RESTITUTION_LOW) * t;`
- L365: `// PUSH_TILT_Y/PUSH_LIFT_BASE/PUSH_DRIVE_BASE 對齊，避免手動模式下數字對不上。`
- L405: `function dynamicEpsilon(vel, spin){`
- L407: `if(normalSpeed < 1e-9) return EPSILON_MIN;`
- L410: `const baselineEpsilon = EPSILON_VERTICAL + (EPSILON_OBLIQUE - EPSILON_VERTICAL) * baselineT;`
- L411: `const spinT = clamp(spinSurfaceSpeed(spin || {topspin:0,sidespin:0}) / SPIN_EPSILON_REFERENCE, 0, 1);`
- L412: `const spinPenalty = (EPSILON_OBLIQUE - EPSILON_MIN) * spinT;`
- L413: `return clamp(baselineEpsilon - spinPenalty, EPSILON_MIN, EPSILON_VERTICAL);`
- L428: `function bounceWithSpinPhysical(vel, spin, mu){`
- L476: `function computeBlendedNormal(vel, planeVel, planeNormal, blend){`
- L496: `function bounceOffPlane(vel, spin, planeNormal, planeVel, restitution, friction, blend){`
- L543: `function bounceOffPlaneSubstepped(vel, spin, planeNormal, planeVel, springK, dampingRatio, friction, opts){`
- L654: `function solveRacketVelXForTargetLandingX(incomingVel, incomingSpin, racketNormal, techVel, restitution, friction, hitPoint, gravity, targetLandingX, blend, tech){`
- L706: `const t = clamp((normalSpeed - PADDLE_SPEED_LOW) / (PADDLE_SPEED_HIGH - PADDLE_SPEED_LOW), 0, 1);`
- L707: `return PADDLE_RESTITUTION_LOW + (PADDLE_RESTITUTION_HIGH - PADDLE_RESTITUTION_LOW) * t;`
- L767: `// PUSH_LIFT：拖高分量，決定弧線高度/安全邊界（矯枉過正的話會變成很高的挑高球，`
- L769: `// PUSH_DRIVE：往前送分量，決定球往前的推進力，才用來球速度做負回饋微調。`
- L770: `const PUSH_LIFT_BASE = 0.35, PUSH_LIFT_K = 0, PUSH_LIFT_FLOOR = 0, PUSH_LIFT_NEUTRAL = 2, PUSH_LIFT_MAX = 3.0;`
- L771: `const PUSH_DRIVE_BASE = 0.7, PUSH_DRIVE_K = 0, PUSH_DRIVE_FLOOR = 0.1, PUSH_DRIVE_NEUTRAL = 2, PUSH_DRIVE_MAX = 3.0;`
- L772: `function computeAdaptivePushLift(incomingVel){`
- L774: `return clamp(PUSH_LIFT_BASE - PUSH_LIFT_K * (speed - PUSH_LIFT_NEUTRAL), PUSH_LIFT_FLOOR, PUSH_LIFT_MAX);`
- L776: `function computeAdaptivePushDrive(incomingVel){`
- L778: `return clamp(PUSH_DRIVE_BASE - PUSH_DRIVE_K * (speed - PUSH_DRIVE_NEUTRAL), PUSH_DRIVE_FLOOR, PUSH_DRIVE_MAX);`
- L782: `// 過量修正；拍面角度該固定。改用 PADDLE_BLEND 的 Y-Z-only 機制取代旋轉修正後，`
- L784: `function computeAdaptivePushTiltX(){`
- L791: `const PUSH_TILT_Y = 0.8;`
- L792: `function computeAdaptivePushTiltY(){`
- L793: `return PUSH_TILT_Y;`
- L795: `function makeRacketReturnVelocity(incomingVel, incomingSpin, tech, hitPoint, gravity){`
- L815: `const blend = tech.model === 'push' ? PADDLE_BLEND : 0;`
- L825: `const aimedX = solveRacketVelXForTargetLandingX(incomingVel, spin, racketNormal, techVel, epsilon, PADDLE_FRICTION, hitPoint, gravity, RETURN_TARGET_X, blend, tech);`
- L830: `// PUSH_WRIST_BRAKE_RATE：切球觸球瞬間手腕「自然減速」的速率（見`
- L835: `const PUSH_WRIST_BRAKE_RATE = 0;`
- L848: `return bounceOffPlaneSubstepped(incomingVel, spin, effNormal, planeVel, PADDLE_SPRING_K, PADDLE_DAMPING_RATIO, PADDLE_FRICTION, {wristBrakeRate: PUSH_WRIST_BRAKE_RATE});`
- L850: `return bounceOffPlane(incomingVel, spin, racketNormal, planeVel, epsilon, PADDLE_FRICTION, blend);`
- L903: `const bounced = bounceWithSpinPhysical(vel, spin, CONTACT_FRICTION_MU);`
- L1024: `function simulateServe(preset){`
- L1062: `function simulateReturnForPreset(preset, side, techniqueKey){`
- L1063: `const serve = simulateServe(preset);`
- L1185: `const sim = simulateReturnForPreset(preset, side, techniqueKey);`
- L1547: `const {servePathPoints, hitPoint, hitVel, result} = simulateReturnForPreset(preset, side, techniqueKey);`
- L1583: `const {result} = simulateReturnForPreset(preset, side, techniqueKey);`
- L1647: `const serve = simulateServe(preset);`

## physics-studio.html

- L363: `const EPSILON_VERTICAL = 0.876;`
- L364: `const EPSILON_OBLIQUE = 0.57;`
- L365: `const EPSILON_MIN = 0.45;`
- L367: `const SPIN_EPSILON_REFERENCE = 6.0;`
- L368: `const CONTACT_FRICTION_MU = 0.13;`
- L685: `function dynamicEpsilon(vel, spin){`
- L687: `if(normalSpeed < 1e-9) return EPSILON_MIN;`
- L690: `const baselineEpsilon = EPSILON_VERTICAL + (EPSILON_OBLIQUE - EPSILON_VERTICAL) * baselineT;`
- L691: `const spinT = clamp(spinSurfaceSpeed(spin || {topspin:0,sidespin:0}) / SPIN_EPSILON_REFERENCE, 0, 1);`
- L692: `const spinPenalty = (EPSILON_OBLIQUE - EPSILON_MIN) * spinT;`
- L693: `return clamp(baselineEpsilon - spinPenalty, EPSILON_MIN, EPSILON_VERTICAL);`
- L708: `function bounceWithSpinPhysical(vel, spin, mu){`
- L1039: `const bounced = bounceWithSpinPhysical(vel, spin, CONTACT_FRICTION_MU);`
# DRAFT: Core physics symbol inventory
#
# Status: draft only.
# This file is a read-only inventory and must not be treated as a behavioral diff.
# Last touched: 2026-07-06

