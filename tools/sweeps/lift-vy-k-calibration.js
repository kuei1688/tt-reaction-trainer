#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { loadGame4Physics } = require("../load-game4-physics.js");
const ROOT_DIR = path.resolve(__dirname, "../..");
const PRESETS_FILE = path.join(ROOT_DIR, "physics-presets.json");
const RAW_DUMP_FILE = path.join(ROOT_DIR, "AI_CONTEXT", "lift_vy_k_calibration_2026-07-14_raw.json");
const SIM_D = Math.sqrt(9.8 / 4.2);
const MAX_ROUNDS = 50;
const SYMBOL_NAMES = [
  "simulateServe","simulatePath","solveBaseVelocity","solveServeBounceVelocity",
  "solveVelocity","makeServeAimCandidate","getServeLengthProfile","findServeBounceTime",
  "getServeBounces","serveBounceScore","clone","findPushHitIndex","findHitIndex",
  "TECHNIQUES","computeAdaptivePushLift","computeAdaptivePushDrive","computeAdaptivePushTiltX",
  "computeAdaptivePushTiltY","PADDLE_FRICTION","computeRacketNormal","dynamicPaddleEpsilon",
  "applyPushContact","PADDLE_BLEND","makeRacketReturnVelocity","solveRacketVelXForTargetLandingX",
  "speedScaledTechniqueVel","applyExecutionVariance","sampleReturnCorrectionFraction",
  "RETURN_TARGET_X","RETURN_SKILL_LEVEL","estimateFlightTimeToTable",
  "PUSH_TILT_Y","PUSH_LIFT_BASE","PUSH_LIFT_K","PUSH_LIFT_FLOOR","PUSH_LIFT_NEUTRAL","PUSH_LIFT_MAX",
  "PUSH_DRIVE_BASE","PUSH_DRIVE_K","PUSH_DRIVE_FLOOR","PUSH_DRIVE_NEUTRAL","PUSH_DRIVE_MAX",
  "PUSH_WRIST_BRAKE_RATE","PADDLE_SPRING_K","PADDLE_DAMPING_RATIO","TANGENT_KP",
  "BLADE_NODE_MASS","BLADE_SPRING_K","BLADE_DAMPING_RATIO",
  "PADDLE_RESTITUTION_LOW","PADDLE_RESTITUTION_HIGH","PADDLE_SPEED_LOW","PADDLE_SPEED_HIGH",
  "RANGE_SOLUTION_MODE",
];
function round2(v, d=4){if(v==null||isNaN(v))return null;const f=Math.pow(10,d);return Math.round(v*f)/f;}
function mirrorVec(v){return{x:v.x,y:v.y,z:-v.z};}
function mirrorSpin(s){return{topspin:-(s.topspin||0),sidespin:s.sidespin||0};}
function mirrorPath(p){return{points:p.points.map(pt=>({x:pt.x,y:pt.y,z:-pt.z})),velocities:p.velocities.map(v=>mirrorVec(v)),spins:p.spins.map(s=>mirrorSpin(s)),bounces:p.bounces.map(b=>({...b,z:-b.z}))};}
function runRally(loader,vyK,preset,TABLE){
  const extra={RETURN_SKILL_LEVEL:"advanced",RANGE_SOLUTION_MODE:false,PUSH_LIFT_VY_K:vyK};
  const ext=loader.instantiateGame4Symbols(SYMBOL_NAMES,extra);
  const gravity=preset.solve?.gravity??-4.2;
  const tech={...ext.TECHNIQUES.push};
  const serve=ext.simulateServe(preset);
  const fi=ext.findPushHitIndex(serve);
  let hp=serve.points[fi],hv=serve.velocities[fi],hs=serve.spins[fi],flip=false,rounds=0,fr=null;
  const ncs=[];
  for(let rn=1;rn<=MAX_ROUNDS;rn++){
    const chp=flip?mirrorVec(hp):hp,chv=flip?mirrorVec(hv):hv,chs=flip?mirrorSpin(hs):hs;
    const rr=ext.makeRacketReturnVelocity(chv,chs,tech,chp,gravity);
    const rv=flip?mirrorVec(rr.vel):rr.vel,rs=flip?mirrorSpin(rr.spin):rr.spin;
    const op=ext.simulatePath({...hp},rv,{gravity,spin:rs,bounceBoost:tech.bounceBoost||0});
    const nc=op.netY==null?null:op.netY-(TABLE.height+TABLE.net);
    const fb=op.bounces[0],es=flip?1:-1;
    const no=nc!=null&&nc>=0,ib=fb&&Math.abs(fb.x)<=TABLE.width/2&&Math.abs(fb.z)<=TABLE.length/2&&Math.sign(fb.z)===es;
    if(nc!=null)ncs.push(round2(nc*100,1));
    if(!no){fr="net";break;}
    if(!ib){fr="out";break;}
    rounds=rn;
    const dp=flip?op:mirrorPath(op);
    const ni=ext.findPushHitIndex(dp);
    if(ni==null||ni>=op.points.length||!op.velocities[ni]){fr="no_hit";break;}
    hp=op.points[ni];hv=op.velocities[ni];hs=op.spins[ni];flip=!flip;
  }
  const st=ncs.slice(10);
  const oa=st.length>=2?round2(Math.max(...st)-Math.min(...st),1):null;
  const mn=st.length>0?round2(Math.min(...st),1):null;
  const mx=st.length>0?round2(Math.max(...st),1):null;
  const av=st.length>0?round2(st.reduce((s,v)=>s+v,0)/st.length,1):null;
  return{rounds,fr,oscAmp:oa,minClr:mn,maxClr:mx,avgClr:av,ncs};
}
function main(){
  const ap=JSON.parse(fs.readFileSync(PRESETS_FILE,"utf8")).serves||[];
  const ps=ap.filter(p=>!p.id.includes("no_spin"));
  process.stderr.write("[load]\n");
  const ld=loadGame4Physics({}),T=ld.runtimeExternals.TABLE;
  const VK=[];for(let v=0;v<=0.30;v+=0.03)VK.push(round2(v));
  const res={};
  for(const vk of VK){
    process.stderr.write("[vyK="+vk+"]\n");
    const pr={};let sc=0;const oa=[],mc=[];
    for(const p of ps){
      const r=runRally(ld,vk,p,T);pr[p.id]=r;
      if(r.rounds>=MAX_ROUNDS)sc++;
      if(r.oscAmp!=null)oa.push(r.oscAmp);
      if(r.minClr!=null)mc.push(r.minClr);
    }
    const ao=oa.length?round2(oa.reduce((s,v)=>s+v,0)/oa.length,1):null;
    const gm=mc.length?round2(Math.min(...mc),1):null;
    res[vk]={vyK:vk,stableCount:sc,total:ps.length,avgOscAmp:ao,globalMinClr:gm,presets:pr};
    console.log("vyK="+vk+" | stable="+sc+"/"+ps.length+" | avgOsc="+(ao??'null')+"cm | minClr="+(gm??'null')+"cm");
  }
  fs.writeFileSync(RAW_DUMP_FILE,JSON.stringify(res,null,2)+"\n","utf8");
  console.log("\n=== Summary ===");
  console.log("vyK | stable | avgOsc(cm) | minClr(cm)");
  for(const vk of VK){const r=res[vk];console.log(vk+" | "+r.stableCount+"/"+r.total+" | "+(r.avgOscAmp??'null')+" | "+(r.globalMinClr??'null'));}
  const cand=VK.filter(v=>{const r=res[v];return r.stableCount===r.total&&r.globalMinClr!=null&&r.globalMinClr>3;}).sort((a,b)=>res[a].avgOscAmp-res[b].avgOscAmp);
  if(cand.length>0)console.log("\nBest: vyK="+cand[0]+" (osc="+res[cand[0]].avgOscAmp+"cm, minClr="+res[cand[0]].globalMinClr+"cm)");
  else console.log("\nNo candidate satisfies all constraints");
  console.log("\nJSON: "+RAW_DUMP_FILE);
}
try{main();}catch(e){console.error(e.stack||e.message);process.exit(1);}
