/**
 * js/rocket_game.js - JarAscent 3D 任務主控與雙語切換
 * @license MIT
 */

const THREE = window.THREE;

import { 
    RocketState, rk4Step, executeGuidance, getOrbitalElements,
    getMoonPosition, R_EARTH, WORLD_SCALE
} from './physics_core.js';

import { ROCKET_MODELS } from './rockets_data.js';

import { 
    initRocketScene, switchRocketMesh, updateEnvironmentVisuals,
    triggerCatastrophicExplosion, updateExplosion, spawnDebrisPiece, updateDebris,
    spawnExhaustParticles, updateExhaustParticles,
    scene, camera, controls, renderer, rocketGroup, flameMesh,
    activeRocketParts, machConeMesh, earthMesh, moonMesh, rocketLight, velArrow, thrustArrow
} from './rocket_engine.js';

let rocket = null;
let currentLang = 'zh';
let isAdvancedMode = false;
let lastTime = performance.now();
let timeScale = 1.0;
let orbitLine = null;
const ORBIT_SEGMENTS = 128;

let countdownTime = 10;
let isCountingDown = false;
let cameraShake = 0;
let bulletTimeTimer = 0;
let isUIVisible = true;
let isDetailTelemetryVisible = false;

const CAM_MODE = { LAUNCH_PAD: 0, LIFTOFF: 1, ASCEND: 2, MAX_Q: 3, STAGE_SEP: 4, ORBIT: 5 };
let currentCamMode = CAM_MODE.LAUNCH_PAD;
let targetCamPos = new THREE.Vector3();
let targetLookAt = new THREE.Vector3();

let milestoneShown = { escape: false, boosters: false, fairing: false, stage2: false, orbit: false };

const I18N = {
    zh: {
        title: "🚀 躍上穹蒼 3D", subtitle: "航太動力學、真實多級分離與結構極限沙盒", langBtn: "English",
        toggleUi: "📋 任務控制面板", toggleUiHide: "📋 展開任務控制",
        toggleDetailShow: "📊 展開深度科研", toggleDetailHide: "📉 收起深度科研",
        modeSimple: "🟢 簡易模式 (必定成功)", modeAdvanced: "🔴 進階模式 (硬核物理)",
        configTitle: "🛠️ 基礎發射設定", lblEnv: "發射場天色:", lblEngine: "火箭型號:",
        subProp: "🚀 推進與動力系統", lblPayload: "任務載荷艙:", lblFuel: "一級燃料加注 (%):", lblThrottle: "節流閥推力 (%):", lblOfRatio: "氧化劑/燃料混合比:",
        subGnc: "🧭 導航制導與控制 (GNC)", lblTurn: "轉向起始高度 (km):", lblTvc: "TVC 噴嘴響應靈敏度:",
        subEnv: "🌪️ 外部環境與電氣感測", lblWind: "高空切變風強度 (m/s):", lblDrift: "IMU 陀螺儀雜訊漂移:",
        launchBtn: "🔥 啟動 10 秒倒數發射 (Terminal T-10s)", resetBtn: "🔄 重設發射台 (Reset Pad)",
        btnSlower: "⏪ 減速", btnFaster: "加速 ⏩", timeScalePrefix: "倍速: ",
        telemetryTitle: "⚙️ 飛行遙測狀態", ready: "發射台準備就緒，請點擊發射...",
        counting: "⚠️ 終端倒數進行中 (Terminal Countdown Active)...", liftoff: "🔥 點火升空！火箭全力起飛",
        orbitSuccess: "🏆【入軌成功】航天器精確進入預定軌道！",
        hudTime: "飛行時間 T+", hudAlt: "海拔高度", hudVel: "即時地速",
        gaugeQ: "動態氣壓 (Max-Q 極限: 55 kPa)",
        tConfig: "當前構型", tThrust: "即時推力", tOrbit: "軌道狀態",
        tGforce: "即時過載 G-Force", tIsp: "瞬時比衝 Isp",
        tPeri: "預測近地點", tApo: "預測遠地點", tEcc: "軌道偏心率",
        onPad: "發射台地面 (On Pad)", ascending: "主動爬升段 (Ascending)", stableOrbit: "🟢 圓軌道巡航 (Orbit)",
        abortTitle: "💥 任務異常中止 (RUD Failure)", abortRestart: "🔄 重新設定並再次發射",
        lblStatStatus: "任務狀態", lblStatMaxvel: "最高速度", lblStatMaxq: "最大動態氣壓", lblStatPeri: "近地點誤差", lblStatOrbit: "最終軌道", lblStatFuel: "剩餘燃料裕度",
        envOptions: { DAY: "☀️ 白天發射 (Day Launch)", NIGHT: "🌙 夜間發射 (Night Launch)" },
        payloadOptions: { "8000": "新一代載人飛船 (8,000 kg)", "15000": "空間站核心艙 (15,000 kg)", "35000": "重型補給艙 (35,000 kg)", "60000": "極限超重載荷 (60,000 kg) ⚠️" },
        milestones: { escape: "🚀 T+120s 拋掉逃逸塔!", boosters: "⚡ T+160s 助推器與一級分離!", fairing: "✨ T+200s 拋整流罩!", stage2: "🛰️ T+580s 二級分離入軌!", orbit: "🏆 太陽翼展開，入軌圓滿成功!" }
    },
    en: {
        title: "🚀 JarAscent 3D", subtitle: "Aerospace Dynamics & Custom Staging Sandbox", langBtn: "中文 (繁體)",
        toggleUi: "📋 Mission Control Panel", toggleUiHide: "📋 Expand Panel",
        toggleDetailShow: "📊 Expand Diagnostics", toggleDetailHide: "📉 Collapse Diagnostics",
        modeSimple: "🟢 Simple Mode (Safe)", modeAdvanced: "🔴 Advanced Mode (Hardcore)",
        configTitle: "🛠️ Basic Launch Setup", lblEnv: "Launch Lighting:", lblEngine: "Launch Vehicle:",
        subProp: "🚀 Propulsion & Powertrain", lblPayload: "Payload Compartment:", lblFuel: "Stage 1 Fuel Load (%):", lblThrottle: "Engine Throttle (%):", lblOfRatio: "Oxidizer/Fuel Ratio (O/F):",
        subGnc: "🧭 Guidance, Navigation & Control (GNC)", lblTurn: "Pitch-over Altitude (km):", lblTvc: "TVC Gimbal Response Gain:",
        subEnv: "🌪️ Environment & Avionics", lblWind: "High-Alt Wind Shear (m/s):", lblDrift: "IMU Gyro Noise Drift:",
        launchBtn: "🔥 Initiate T-10s Terminal Countdown", resetBtn: "🔄 Reset Launch Pad",
        btnSlower: "⏪ Slower", btnFaster: "Faster ⏩", timeScalePrefix: "Warp: ",
        telemetryTitle: "⚙️ Flight Telemetry", ready: "Pad ready. Awaiting countdown sequence...",
        counting: "⚠️ Terminal countdown sequence armed...", liftoff: "🔥 Main Engine Ignition! Liftoff!",
        orbitSuccess: "🏆【Orbit Inserted】Spacecraft safely in Target Orbit!",
        hudTime: "TIME T+", hudAlt: "ALTITUDE", hudVel: "VELOCITY",
        gaugeQ: "Dynamic Pressure (Limit: 55 kPa)",
        tConfig: "Configuration", tThrust: "Thrust", tOrbit: "Orbit Status",
        tGforce: "Acceleration G-Force", tIsp: "Specific Impulse",
        tPeri: "Predicted Periapsis", tApo: "Predicted Apoapsis", tEcc: "Eccentricity (e)",
        onPad: "Vehicle on Pad (Pre-Ignition)", ascending: "Active Ascent Phase", stableOrbit: "🟢 Stable Orbit Cruise",
        abortTitle: "💥 Catastrophic Mission Abort", abortRestart: "🔄 Re-Configure & Launch Again",
        lblStatStatus: "Mission Status", lblStatMaxvel: "Max Velocity", lblStatMaxq: "Max Dyn Pressure (Max-Q)", lblStatPeri: "Periapsis Deviation", lblStatOrbit: "Final Orbit", lblStatFuel: "Propellant Margin",
        envOptions: { DAY: "☀️ Day Launch (Sunny)", NIGHT: "🌙 Night Launch (Starfield)" },
        payloadOptions: { "8000": "Crewed Spacecraft (8,000 kg)", "15000": "Space Station Module (15,000 kg)", "35000": "Heavy Cargo Pod (35,000 kg)", "60000": "Extreme Overload Pod (60,000 kg) ⚠️" },
        milestones: { escape: "🚀 T+120s Launch Escape Tower Jettison!", boosters: "⚡ T+160s Boosters & Core Sep!", fairing: "✨ T+200s Fairing Separation!", stage2: "🛰️ T+580s Stage 2 Cutoff & Insertion!", orbit: "🏆 Solar Panels Deployed. Orbit Complete!" }
    }
};

function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function updateStatus(text, color="#38bdf8") { const el = document.getElementById('flight-status'); if (el) { el.innerText = text; el.style.color = color; } }

function showMilestone(text, color) {
    const el = document.createElement('div');
    el.style.cssText = `position: fixed; top: 35%; left: 50%; transform: translate(-50%, -50%); font-size: 2.0rem; font-weight: 900; color: ${color}; text-shadow: 0 0 25px ${color}, 0 0 50px rgba(0,0,0,0.8); pointer-events: none; z-index: 300; letter-spacing: 2px; animation: milestonePop 2.5s ease-out forwards; font-family: 'Courier New', monospace; text-align: center; width: 90vw;`;
    el.innerText = text; document.body.appendChild(el); setTimeout(() => el.remove(), 2500);
}

function applyLanguageUI() {
    const t = I18N[currentLang];
    setText('ui-title', t.title); setText('ui-subtitle', t.subtitle); setText('btn-lang', t.langBtn);
    setText('btn-toggle-ui', isUIVisible ? t.toggleUi : t.toggleUiHide);
    setText('btn-toggle-details', isDetailTelemetryVisible ? t.toggleDetailHide : t.toggleDetailShow);
    setText('lbl-mode', isAdvancedMode ? t.modeAdvanced : t.modeSimple);
    document.getElementById('lbl-mode').style.color = isAdvancedMode ? '#ef4444' : '#10b981';
    
    setText('ui-config-title', t.configTitle); setText('lbl-env', t.lblEnv); setText('lbl-engine', t.lblEngine);
    setText('sub-prop', t.subProp); setText('lbl-payload', t.lblPayload); setText('lbl-fuel', t.lblFuel);
    setText('lbl-throttle', t.lblThrottle); setText('lbl-ofratio', t.lblOfRatio);
    setText('sub-gnc', t.subGnc); setText('lbl-turn', t.lblTurn); setText('lbl-tvc', t.lblTvc);
    setText('sub-env', t.subEnv); setText('lbl-wind', t.lblWind); setText('lbl-drift', t.lblDrift);
    
    setText('btn-launch', t.launchBtn); setText('btn-reset', t.resetBtn); setText('ui-telemetry-title', t.telemetryTitle);
    setText('btn-time-slower', t.btnSlower); setText('btn-time-faster', t.btnFaster);
    setText('time-scale-display', `${t.timeScalePrefix}${timeScale.toFixed(1)}x`);
    
    setText('hud-lbl-time', t.hudTime); setText('hud-lbl-alt', t.hudAlt); setText('hud-lbl-vel', t.hudVel);
    setText('lbl-gauge-q', t.gaugeQ); setText('lbl-t-config', t.tConfig); setText('lbl-t-thrust', t.tThrust);
    setText('lbl-t-orbit', t.tOrbit); setText('lbl-t-gforce', t.tGforce); setText('lbl-t-isp', t.tIsp);
    setText('lbl-t-peri', t.tPeri); setText('lbl-t-apo', t.tApo); setText('lbl-t-ecc', t.tEcc);

    setText('lbl-stat-status', t.lblStatStatus); setText('lbl-stat-maxvel', t.lblStatMaxvel);
    setText('lbl-stat-maxq', t.lblStatMaxq); setText('lbl-stat-peri', t.lblStatPeri);
    setText('lbl-stat-orbit', t.lblStatOrbit); setText('lbl-stat-fuel', t.lblStatFuel);
    setText('btn-debrief-restart', t.abortRestart);

    const selEnv = document.getElementById('sel-env');
    if (selEnv) Array.from(selEnv.options).forEach(opt => { if (t.envOptions[opt.value]) opt.text = t.envOptions[opt.value]; });
    const selPayload = document.getElementById('sel-payload');
    if (selPayload) Array.from(selPayload.options).forEach(opt => { if (t.payloadOptions[opt.value]) opt.text = t.payloadOptions[opt.value]; });
    const selEngine = document.getElementById('sel-engine');
    if (selEngine) Array.from(selEngine.options).forEach(opt => { const m = ROCKET_MODELS[opt.value]; if (m) opt.text = currentLang === 'zh' ? m.name : m.nameEn; });

    if (!rocket || !rocket.isLaunched) {
        updateStatus(t.ready);
        setText('t-stage-name', t.onPad);
        setText('t-orbit', t.onPad);
    }
}

function initOrbitLine() {
    const positions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    orbitLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, linewidth: 2 }));
    orbitLine.visible = false;
    scene.add(orbitLine);
}

function updatePredictedOrbit(state) {
    if (!orbitLine) initOrbitLine();
    const orbit = getOrbitalElements(state);
    if (!orbit.isOrbital || orbit.semiMajorAxis < 6378137 * 1.02) { orbitLine.visible = false; return; }
    
    const h = new THREE.Vector3().crossVectors(state.r, state.v);
    if (h.lengthSq() < 1e-12) { orbitLine.visible = false; return; }
    const hUnit = h.normalize();
    
    let refVec = new THREE.Vector3(0,0,1);
    if (Math.abs(hUnit.dot(refVec)) > 0.99) refVec.set(1,0,0);
    const pUnit = new THREE.Vector3().crossVectors(hUnit, refVec).normalize();
    const qUnit = new THREE.Vector3().crossVectors(hUnit, pUnit).normalize();
    
    const p = orbit.semiMajorAxis * (1 - orbit.eccentricity * orbit.eccentricity) * WORLD_SCALE;
    const positions = orbitLine.geometry.attributes.position.array;
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
        const theta = (i / ORBIT_SEGMENTS) * Math.PI * 2;
        const radius = p / (1 + orbit.eccentricity * Math.cos(theta));
        const pt = new THREE.Vector3().addScaledVector(pUnit, radius * Math.cos(theta)).addScaledVector(qUnit, radius * Math.sin(theta));
        positions[i*3] = pt.x; positions[i*3+1] = pt.y; positions[i*3+2] = pt.z;
    }
    orbitLine.geometry.attributes.position.needsUpdate = true;
    orbitLine.visible = true;
}

function evaluateStructuralLimits(rocket) {
    if (rocket.isDestroyed || !isAdvancedMode) return;

    const alt = rocket.r.length() - R_EARTH;
    const speed = rocket.relativeAirSpeed || rocket.v.length();
    const rho = 1.225 * Math.exp(-alt / 8500);
    const dynQkPa = (0.5 * rho * speed * speed) / 1000;
    const visualPos = rocket.r.clone().multiplyScalar(WORLD_SCALE);

    const twr = rocket.getThrustVector().length() / (rocket.getCurrentMass() * 9.80665);
    if (rocket.flightTime > 3.0 && alt < 20 && twr < 1.05) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "推重比不足 (TWR < 1.05)，無法離地並在發射台過熱引爆" : "PAD TWR OVERLOAD: Insufficient thrust to lift mass (TWR < 1.05).";
        triggerCatastrophicExplosion(visualPos); cameraShake = 4.0; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
    if (Math.abs(rocket.ofRatio - 1.0) > 0.16) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "氧化劑/燃料混合比嚴重失調，燃燒室壓力劇烈震盪引爆" : "O/F RATIO ANOMALY: Severe mixture imbalance triggered combustion chamber blowout.";
        triggerCatastrophicExplosion(visualPos); cameraShake = 4.0; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
    const windStress = (rocket.windShear / 15.0);
    if (dynQkPa * windStress > 55.0 && alt < 20000) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? `動態氣壓與切變風疊加突破極限 (${(dynQkPa*windStress).toFixed(1)} kPa)，箭體空中氣動剪切斷裂` : `AERODYNAMIC SHEAR FAILURE: Combined Max-Q & Wind Shear exceeded 55 kPa envelope.`;
        triggerCatastrophicExplosion(visualPos); cameraShake = 3.5; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
    if (rocket.tvcGain > 1.35 && speed > 200 && alt < 25000) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "TVC 噴嘴靈敏度過高引發高頻震顫，箭體結構共振空中解體" : "CONTROL RESONANCE: Excessive TVC gain induced fatal structural flutter.";
        triggerCatastrophicExplosion(visualPos); cameraShake = 3.5; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
    if (rocket.currentGForce > 5.5 && rocket.flightTime > 10) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? `加速度過載超過 5.5 G (${rocket.currentGForce.toFixed(2)} G)，內部精密儀器與乘員艙被擠壓破壞` : `G-FORCE OVERLOAD: Structural envelope exceeded 5.5 G rating.`;
        triggerCatastrophicExplosion(visualPos); cameraShake = 3.0; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
}

function handleMultiStageSeparation(rocket) {
    if (rocket.isDestroyed) return;
    const t = rocket.flightTime;
    const ms = I18N[currentLang].milestones;

    if (t >= 120 && !rocket.escapeTowerSeparated) {
        rocket.escapeTowerSeparated = true;
        if (activeRocketParts && activeRocketParts.escapeTower) { spawnDebrisPiece(rocket, activeRocketParts.escapeTower, new THREE.Vector3(0, 30, 0)); activeRocketParts.escapeTower.visible = false; }
        showMilestone(ms.escape, "#ef4444");
    }
    if (t >= 160 && !rocket.boostersSeparated) {
        rocket.boostersSeparated = true; rocket.stage = 2;
        if (activeRocketParts && activeRocketParts.boosters) { spawnDebrisPiece(rocket, activeRocketParts.boosters, new THREE.Vector3(20, -40, 20)); activeRocketParts.boosters.visible = false; }
        bulletTimeTimer = 3.0; currentCamMode = CAM_MODE.STAGE_SEP; showMilestone(ms.boosters, "#f59e0b");
    }
    if (t >= 200 && !rocket.fairingSeparated) { rocket.fairingSeparated = true; showMilestone(ms.fairing, "#38bdf8"); }
    if (t >= 580 && !rocket.stage2Separated) {
        rocket.stage2Separated = true; rocket.missionAccomplished = true; rocket.throttle = 0;
        showMilestone(ms.stage2, "#10b981"); updateStatus(I18N[currentLang].orbitSuccess, "#10b981");
    }
}

function updateTelemetryValues() {
    const t = I18N[currentLang];
    if (!rocket) return;

    const alt = Math.max(0, rocket.r.length() - R_EARTH);
    const speed = rocket.v.length();
    const airSpeed = rocket.relativeAirSpeed || speed;
    const mach = (airSpeed / 340).toFixed(1);
    const orbit = getOrbitalElements(rocket);

    setText('hud-time', `${rocket.flightTime.toFixed(1)}s`);
    setText('hud-alt', `${(alt / 1000).toFixed(1)} km`);
    setText('hud-vel', `${speed.toFixed(0)} m/s (M${mach})`);
    
    const dynQkPa = (0.5 * 1.225 * Math.exp(-alt/8500) * airSpeed * airSpeed / 1000);
    document.getElementById('gauge-q-bar').style.width = `${Math.min(100, (dynQkPa / 55) * 100)}%`;
    setText('gauge-q-txt', `${dynQkPa.toFixed(1)} kPa`);
    
    if (machConeMesh) {
        const isTransonic = (airSpeed > 320 && airSpeed < 430 && alt < 25000);
        machConeMesh.material.opacity = isTransonic ? Math.min(0.15, machConeMesh.material.opacity + 0.02) : Math.max(0, machConeMesh.material.opacity - 0.05);
    }

    const currentTwr = rocket.getThrustVector().length() / (rocket.getCurrentMass() * 9.80665);
    setText('t-twr', currentTwr.toFixed(2));
    setText('t-thrust', `${(rocket.getThrustVector().length()/1000).toFixed(0)} kN`);

    let stageName = `${currentLang==='zh'?rocket.engine.name:rocket.engine.nameEn} (${t.ascending})`;
    if (rocket.isDestroyed) stageName = "💥 CATASTROPHIC FAILURE";
    else if (rocket.stage2Separated) stageName = "🛰️ 300km Orbit Cruise";
    setText('t-stage-name', stageName);
    setText('t-orbit', orbit.isOrbital ? t.stableOrbit : t.ascending);

    if (isDetailTelemetryVisible) {
        setText('t-gforce', `${rocket.currentGForce.toFixed(2)} G`);
        setText('t-isp', rocket.flightTime > 0 ? `${Math.round(rocket.getIsp())} s` : '—');
        setText('t-peri', (orbit.periapsis > 0) ? `${(orbit.periapsis/1000).toFixed(1)} km` : '0.0 km');
        setText('t-apo', (orbit.apoapsis > 0) ? `${(orbit.apoapsis/1000).toFixed(1)} km` : '0.0 km');
        setText('t-ecc', orbit.isOrbital ? orbit.eccentricity.toFixed(4) : '—');
    }

    if (rocket.missionAccomplished && !milestoneShown.orbit) { milestoneShown.orbit = true; showMissionDebrief(orbit); }
}

function showMissionDebrief(orbit) {
    const modal = document.getElementById('debrief-modal'); if (modal.style.display === 'flex') return; modal.style.display = 'flex';
    const periErr = Math.abs(orbit.periapsis - 300000) / 1000;
    setText('stat-maxvel', `${rocket.maxVelocity.toFixed(1)} m/s`);
    setText('stat-maxq', `${(rocket.maxQ / 1000).toFixed(1)} kPa`);
    setText('stat-peri-err', `${periErr.toFixed(1)} km`);
    setText('stat-orbit-alt', `${(orbit.periapsis/1000).toFixed(1)} km x ${(orbit.apoapsis/1000).toFixed(1)} km`);
    const fuelLeft = Math.round((rocket.fuel2 / rocket.engine.fuelMassStage2) * 100);
    setText('stat-fuel-left', `${fuelLeft}%`);
    
    if (rocket.isDestroyed) {
        document.getElementById('debrief-rank').innerText = "FAIL"; document.getElementById('debrief-rank').style.color = "#ef4444";
        setText('debrief-title', I18N[currentLang].abortTitle); setText('stat-status', rocket.failureReason);
    } else if (orbit.isOrbital) {
        document.getElementById('debrief-rank').innerText = "S"; document.getElementById('debrief-rank').style.color = "#fbbf24";
        setText('debrief-title', currentLang === 'zh' ? "🏆 完美入軌" : "🏆 Nominal Insertion");
        setText('stat-status', currentLang === 'zh' ? "入軌成功" : "Inserted successfully");
    } else {
        document.getElementById('debrief-rank').innerText = "B"; document.getElementById('debrief-rank').style.color = "#94a3b8";
        setText('debrief-title', currentLang === 'zh' ? "🚀 次軌道試射完成" : "🚀 Suborbital Completed");
        setText('stat-status', currentLang === 'zh' ? "入軌前燃料耗盡" : "Propellant depleted");
    }
}

function startCountdownSequence() {
    if (isCountingDown) return;
    isCountingDown = true; countdownTime = 10;
    document.getElementById('countdown-hud').style.display = 'flex';
    document.getElementById('btn-launch').style.display = 'none';
    
    const timerInterval = setInterval(() => {
        countdownTime--;
        document.getElementById('countdown-timer').innerText = `T-${countdownTime}`;
        if (countdownTime <= 0) { clearInterval(timerInterval); document.getElementById('countdown-hud').style.display = 'none'; executeLiftoff(); }
    }, 1000);
}

function executeLiftoff() {
    let engKey = document.getElementById('sel-engine').value;
    
    // 🟢 簡易模式：強制覆蓋為 100% 安全成功參數，無視面板錯誤設定
    let payload = isAdvancedMode ? parseInt(document.getElementById('sel-payload').value, 10) : 8000;
    let fuelFactor = isAdvancedMode ? parseInt(document.getElementById('rng-fuel').value, 10) / 100 : 1.0;
    let throttle = isAdvancedMode ? parseInt(document.getElementById('rng-throttle').value, 10) : 100;
    let ofRatio = isAdvancedMode ? parseInt(document.getElementById('rng-ofratio').value, 10) / 100 : 1.0;
    let turnAltKm = isAdvancedMode ? parseInt(document.getElementById('rng-turn').value, 10) : 8;
    let tvcGain = isAdvancedMode ? parseInt(document.getElementById('rng-tvc').value, 10) / 100 : 1.0;
    let windShear = isAdvancedMode ? parseInt(document.getElementById('rng-wind').value, 10) : 0; // 無風
    let driftNoise = isAdvancedMode ? parseInt(document.getElementById('rng-drift').value, 10) / 100 : 0; // 無漂移

    rocket = new RocketState();
    rocket.initEngine(engKey, payload, fuelFactor, turnAltKm, ofRatio, tvcGain, windShear, driftNoise);
    rocket.throttle = throttle / 100;
    rocket.isLaunched = true;
    rocket.guidanceActive = true;
    cameraShake = 2.0;
    updateStatus(I18N[currentLang].liftoff, "#38bdf8");
}

function bindUI() {
    document.getElementById('btn-launch').onclick = startCountdownSequence;
    document.getElementById('btn-reset').onclick = () => location.reload();
    document.getElementById('sel-env').onchange = (e) => window.document.getElementById('sel-env').value; 
    document.getElementById('sel-engine').onchange = (e) => switchRocketMesh(e.target.value);
    document.getElementById('btn-lang').onclick = () => { currentLang = currentLang === 'zh' ? 'en' : 'zh'; applyLanguageUI(); };

    document.getElementById('chk-advanced-mode').onchange = (e) => {
        isAdvancedMode = e.target.checked;
        document.getElementById('advanced-config').style.display = isAdvancedMode ? 'block' : 'none';
        applyLanguageUI();
    };

    document.getElementById('btn-toggle-ui').onclick = () => {
        isUIVisible = !isUIVisible;
        document.getElementById('ui-overlay-box').classList.toggle('collapsed', !isUIVisible);
        setText('btn-toggle-ui', isUIVisible ? I18N[currentLang].toggleUi : I18N[currentLang].toggleUiHide);
    };

    document.getElementById('btn-toggle-details').onclick = () => {
        isDetailTelemetryVisible = !isDetailTelemetryVisible;
        document.getElementById('telemetry-detail-box').style.display = isDetailTelemetryVisible ? 'block' : 'none';
        document.getElementById('btn-toggle-details').innerText = isDetailTelemetryVisible ? I18N[currentLang].toggleDetailHide : I18N[currentLang].toggleDetailShow;
    };

    document.getElementById('btn-time-slower').onclick = () => { timeScale = Math.max(0.5, timeScale / 1.5); setText('time-scale-display', `${I18N[currentLang].timeScalePrefix}${timeScale.toFixed(1)}x`); };
    document.getElementById('btn-time-faster').onclick = () => { timeScale = Math.min(100, timeScale * 1.5); setText('time-scale-display', `${I18N[currentLang].timeScalePrefix}${timeScale.toFixed(1)}x`); };
}

function gameLoop(now) {
    requestAnimationFrame(gameLoop);
    let dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    let currentEffectiveTimeScale = timeScale;
    if (bulletTimeTimer > 0) { bulletTimeTimer -= dt; currentEffectiveTimeScale = 0.25; }

    if (moonMesh) moonMesh.position.copy(getMoonPosition(performance.now() / 1000).multiplyScalar(WORLD_SCALE));
    if (earthMesh) earthMesh.rotation.y += dt * 0.02 * currentEffectiveTimeScale;
    updateExplosion(dt * currentEffectiveTimeScale);

    if (rocket && rocket.isLaunched && !rocket.isDestroyed) {
        executeGuidance(rocket, dt);

        let remainingDt = dt * currentEffectiveTimeScale;
        while (remainingDt > 0) {
            const stepDt = Math.min(remainingDt, 0.05);
            rk4Step(rocket, stepDt);
            remainingDt -= stepDt;
        }

        evaluateStructuralLimits(rocket);
        handleMultiStageSeparation(rocket);
        updateDebris(dt * currentEffectiveTimeScale);

        const alt = Math.max(0, rocket.r.length() - R_EARTH);
        const speed = rocket.v.length();
        
        // 🌌 動態更新太空黑漸變背景
        updateEnvironmentVisuals(alt);
        
        const visualAlt = (alt < 5000) ? 0.4 + (alt * 0.035) : 0.4 + (5000 * 0.035) + (alt - 5000) * WORLD_SCALE;
        const visualPos = rocket.r.clone().normalize().multiplyScalar(1000 + visualAlt);
        const visualScale = (alt < 5000) ? 1.0 : Math.min(10.0, 1.0 + Math.log10(1 + (alt - 5000) / 1000) * 3.5);
            
        rocketGroup.scale.set(visualScale, visualScale, visualScale);
        rocketGroup.position.copy(visualPos);
        rocketGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rocket.thrustDir.clone().normalize());

        if (bulletTimeTimer <= 0) {
            if (alt < 500) currentCamMode = CAM_MODE.LIFTOFF;
            else if (speed > 310 && speed < 440 && alt < 25000) currentCamMode = CAM_MODE.MAX_Q;
            else if (rocket.stage === 2 && alt > 150000) currentCamMode = CAM_MODE.ORBIT;
            else currentCamMode = CAM_MODE.ASCEND;
        }

        const orbit = getOrbitalElements(rocket);
        const shakeX = (Math.random() - 0.5) * cameraShake * 2;
        const shakeY = (Math.random() - 0.5) * cameraShake * 2;
        if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 0.8);

        switch (currentCamMode) {
            case CAM_MODE.LIFTOFF:
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(-14 + shakeX, 6 + shakeY, 14)));
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 4, 0))); break;
            case CAM_MODE.MAX_Q:
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(30 + shakeX, 5 + shakeY, 0)));
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 3, 0))); break;
            case CAM_MODE.STAGE_SEP:
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(12 * Math.cos(now * 0.002), 4, 12 * Math.sin(now * 0.002))));
                targetLookAt.copy(visualPos); break;
            case CAM_MODE.ORBIT:
                const orbitCamDist = Math.max(500, orbit.semiMajorAxis * WORLD_SCALE * 1.2);
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(0, orbitCamDist * 0.5, orbitCamDist)));
                targetLookAt.set(0, 0, 0); break;
            case CAM_MODE.ASCEND:
            default:
                let camDist = (alt < 2000) ? 25 + alt * 0.015 : Math.min(2500, Math.max(40, alt * WORLD_SCALE * 1.5));
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(camDist * 0.35 + shakeX, camDist * 0.25 + shakeY, camDist * 0.8)));
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 3, 0))); break;
        }

        camera.position.lerp(targetCamPos, 0.08); controls.target.lerp(targetLookAt, 0.09);

        if (rocket.getThrustVector().length() > 1000) {
            if (flameMesh) { flameMesh.visible = true; flameMesh.scale.set(1.0, rocket.throttle || 1.0, 1.0); }
            spawnExhaustParticles(visualPos, rocket.throttle * visualScale, alt < 3000);
            if (rocketLight) { rocketLight.position.copy(visualPos); rocketLight.intensity = 6.0; }
        } else {
            if (flameMesh) flameMesh.visible = false;
            if (rocketLight) rocketLight.intensity = 0.0;
        }
        
        velArrow.position.copy(visualPos); velArrow.setDirection(rocket.v.clone().normalize()); velArrow.setLength(15);
        thrustArrow.position.copy(visualPos); thrustArrow.setDirection(rocket.thrustDir.clone().normalize()); thrustArrow.setLength(10);
        velArrow.visible = (alt > 2000); thrustArrow.visible = (alt > 2000 && thrustMag > 0);

        updatePredictedOrbit(rocket);
        updateTelemetryValues();
    } else {
        if (rocketGroup && !rocket) { rocketGroup.quaternion.set(0, 0, 0, 1); rocketGroup.position.set(0, 1000.4, 0); }
        if (flameMesh) flameMesh.visible = false;
        if (velArrow) velArrow.visible = false;
        if (thrustArrow) thrustArrow.visible = false;
        if (rocketLight) rocketLight.intensity = 0.0;
    }

    controls.update(); renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
    initRocketScene(document.getElementById('canvas-container'));
    bindUI(); applyLanguageUI();
    window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
    gameLoop(performance.now());
});
