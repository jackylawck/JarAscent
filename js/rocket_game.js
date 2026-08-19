/**
 * js/rocket_game.js - JarAscent 3D 任務主控 (高空對數視覺平滑優化版)
 * @license MIT
 */

const THREE = window.THREE;

import { 
    initRocketScene, RocketState, rk4Step, executeGuidance, getOrbitalElements,
    getMoonPosition, scene, camera, controls, renderer, rocketGroup, flameMesh,
    activeRocketParts, machConeMesh, spawnDebrisPiece, updateDebris, setEnvironmentMode, switchRocketMesh,
    triggerCatastrophicExplosion, updateExplosion,
    earthMesh, moonMesh, rocketLight, velArrow, thrustArrow, spawnExhaustParticles, updateExhaustParticles,
    ROCKET_MODELS, R_EARTH, WORLD_SCALE
} from './rocket_engine.js';

let rocket = null;
let currentLang = 'zh';
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

export const CAM_MODE = {
    LAUNCH_PAD: 0,
    LIFTOFF: 1,
    ASCEND: 2,
    MAX_Q: 3,
    STAGE_SEP: 4,
    ORBIT: 5
};
let currentCamMode = CAM_MODE.LAUNCH_PAD;
let targetCamPos = new THREE.Vector3();
let targetLookAt = new THREE.Vector3();

let milestoneShown = { escape: false, boosters: false, fairing: false, stage2: false, orbit: false };

const I18N = {
    zh: {
        title: "🚀 躍上穹蒼 3D",
        subtitle: "航太級天體動力學、真實多級分離與結構極限沙盒",
        langBtn: "English",
        toggleUi: "📋 任務控制面板", toggleUiHide: "📋 展開任務控制",
        toggleDetailShow: "📊 展開深度科研", toggleDetailHide: "📉 收起深度科研",
        configTitle: "🛠️ 任務與發射場設定",
        lblEnv: "發射場環境天色:", lblEngine: "運載火箭型號:", lblPayload: "任務載荷艙:",
        lblFuel: "一級燃料加注量 (%):", lblThrottle: "發動機節流閥 (%):", lblTurn: "重力轉向高度 (km):",
        launchBtn: "🔥 啟動 10 秒倒數發射 (Terminal T-10s)", resetBtn: "🔄 重設發射台 (Reset Pad)",
        telemetryTitle: "⚙️ 飛行遙測與結構載荷狀態",
        ready: "發射台準備就緒，請點擊發射...",
        counting: "⚠️ 終端倒數進行中 (Terminal Countdown Active)...",
        liftoff: "🔥 點火升空！火箭全力起飛",
        orbitSuccess: "🏆【入軌成功】航天器精確進入 300km 預定軌道 (SECO)！",
        hudTime: "飛行時間 T+", hudAlt: "海拔高度", hudVel: "即時地速",
        gaugeQ: "動態氣壓 (Max-Q 安全極限: 55 kPa)", gaugeFuel: "推進劑餘量",
        tConfig: "當前構型", tThrust: "即時推力", tOrbit: "軌道狀態",
        tGforce: "即時過載 G-Force", tGmax: "最大耐受: 5.5 G", tIsp: "瞬時比衝 Isp",
        tPeri: "預測近地點 Peri", tApo: "預測遠地點 Apo", tEcc: "軌道偏心率 Ecc (e)",
        tSma: "軌道半長軸 Semi-a", tMoon: "地月即時距離",
        onPad: "發射台地面 (On Pad)", ascending: "主動爬升段 (Ascending)", stableOrbit: "🟢 300km 圓軌道 (LEO Orbit)",
        abortTitle: "💥 任務異常中止 (RUD Failure)", abortRestart: "🔄 重新設定並再次發射",
        envOptions: {
            DAY: "☀️ 白天發射 (Day Launch)",
            NIGHT: "🌙 夜間發射 (Night Launch)"
        },
        payloadOptions: {
            "8000": "新一代載人飛船 (8,000 kg)",
            "15000": "空間站核心艙 (15,000 kg)",
            "35000": "重型貨運補給艙 (35,000 kg)",
            "60000": "極限超重載荷 (60,000 kg) ⚠️"
        },
        milestones: {
            escape: "🚀 T+120s 拋掉逃逸塔 (Tower Jettison)!",
            boosters: "⚡ T+160s 助推器與一級分離!",
            fairing: "✨ T+200s 拋整流罩 (Fairing Separation)!",
            stage2: "🛰️ T+580s 二級分離，航天器入軌!",
            orbit: "🏆 太陽翼展開，入軌圓滿成功!"
        }
    },
    en: {
        title: "🚀 JarAscent 3D",
        subtitle: "Aerospace Dynamics, Custom Staging & Structural Limits",
        langBtn: "中文 (繁體)",
        toggleUi: "📋 Mission Control Panel", toggleUiHide: "📋 Expand Panel",
        toggleDetailShow: "📊 Expand Diagnostics", toggleDetailHide: "📉 Collapse Diagnostics",
        configTitle: "🛠️ Mission & Engineering Configuration",
        lblEnv: "Launch Environment:", lblEngine: "Launch Vehicle:", lblPayload: "Payload Mass:",
        lblFuel: "Stage 1 Fuel Load (%):", lblThrottle: "Engine Throttle (%):", lblTurn: "Gravity Turn Alt (km):",
        launchBtn: "🔥 Initiate T-10s Terminal Countdown", resetBtn: "🔄 Reset Launch Pad",
        telemetryTitle: "⚙️ Flight Telemetry & Structural Stress",
        ready: "Pad ready. T-10 countdown armed...",
        counting: "⚠️ Terminal countdown sequence armed...",
        liftoff: "🔥 Main Engine Ignition! Liftoff!",
        orbitSuccess: "🏆【Orbit Inserted】Spacecraft safely in 300km Target Orbit!",
        hudTime: "TIME T+", hudAlt: "ALTITUDE", hudVel: "VELOCITY",
        gaugeQ: "Dynamic Pressure (Max-Q Limit: 55 kPa)", gaugeFuel: "Propellant Level",
        tConfig: "Configuration", tThrust: "Thrust", tOrbit: "Orbit Status",
        tGforce: "Acceleration G-Force", tGmax: "Max Safe: 5.5 G", tIsp: "Specific Impulse Isp",
        tPeri: "Predicted Periapsis", tApo: "Predicted Apoapsis", tEcc: "Orbital Eccentricity (e)",
        tSma: "Semi-major Axis", tMoon: "Lunar Distance",
        onPad: "Vehicle on Pad (Pre-Ignition)", ascending: "Active Ascent Phase", stableOrbit: "🟢 300km Stable Orbit",
        abortTitle: "💥 Catastrophic Mission Abort", abortRestart: "🔄 Re-Configure & Launch Again",
        envOptions: {
            DAY: "☀️ Day Launch (Sunny)",
            NIGHT: "🌙 Night Launch (Starfield)"
        },
        payloadOptions: {
            "8000": "Crewed Spacecraft (8,000 kg)",
            "15000": "Space Station Module (15,000 kg)",
            "35000": "Heavy Cargo Pod (35,000 kg)",
            "60000": "Extreme Overload Pod (60,000 kg) ⚠️"
        },
        milestones: {
            escape: "🚀 T+120s Launch Escape Tower Jettison!",
            boosters: "⚡ T+160s Boosters & Stage 1 Separation!",
            fairing: "✨ T+200s Fairing Separation!",
            stage2: "🛰️ T+580s Stage 2 Cutoff & Spacecraft Inserted!",
            orbit: "🏆 Solar Panels Deployed. Orbit Complete!"
        }
    }
};

function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function updateStatus(text, color="#38bdf8") { 
    const el = document.getElementById('flight-status'); 
    if (el) { el.innerText = text; el.style.color = color; } 
}

function showMilestone(text, color) {
    const el = document.createElement('div');
    el.style.cssText = `
        position: fixed; top: 35%; left: 50%; transform: translate(-50%, -50%);
        font-size: 2.0rem; font-weight: 900; color: ${color};
        text-shadow: 0 0 25px ${color}, 0 0 50px rgba(0,0,0,0.8);
        pointer-events: none; z-index: 300; letter-spacing: 2px;
        animation: milestonePop 2.5s ease-out forwards;
        font-family: 'Courier New', monospace; text-align: center; width: 90vw;
    `;
    el.innerText = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

function applyLanguageUI() {
    const t = I18N[currentLang];
    setText('ui-title', t.title);
    setText('ui-subtitle', t.subtitle);
    setText('btn-lang', t.langBtn);
    setText('btn-toggle-ui', isUIVisible ? t.toggleUi : t.toggleUiHide);
    setText('btn-toggle-details', isDetailTelemetryVisible ? t.toggleDetailHide : t.toggleDetailShow);
    setText('ui-config-title', t.configTitle);
    setText('lbl-env', t.lblEnv);
    setText('lbl-engine', t.lblEngine);
    setText('lbl-payload', t.lblPayload);
    setText('lbl-fuel', t.lblFuel);
    setText('lbl-throttle', t.lblThrottle);
    setText('lbl-turn', t.lblTurn);
    setText('btn-launch', t.launchBtn);
    setText('btn-reset', t.resetBtn);
    setText('ui-telemetry-title', t.telemetryTitle);
    
    setText('hud-lbl-time', t.hudTime);
    setText('hud-lbl-alt', t.hudAlt);
    setText('hud-lbl-vel', t.hudVel);
    setText('lbl-gauge-q', t.gaugeQ);
    setText('lbl-gauge-fuel', t.gaugeFuel);
    setText('lbl-t-config', t.tConfig);
    setText('lbl-t-thrust', t.tThrust);
    setText('lbl-t-orbit', t.tOrbit);
    setText('lbl-t-gforce', t.tGforce);
    setText('lbl-t-gmax', t.tGmax);
    setText('lbl-t-isp', t.tIsp);
    setText('lbl-t-peri', t.tPeri);
    setText('lbl-t-apo', t.tApo);
    setText('lbl-t-ecc', t.tEcc);
    setText('lbl-t-sma', t.tSma);
    setText('lbl-t-moon', t.tMoon);

    const selEnv = document.getElementById('sel-env');
    if (selEnv) {
        Array.from(selEnv.options).forEach(opt => {
            if (t.envOptions[opt.value]) opt.text = t.envOptions[opt.value];
        });
    }

    const selPayload = document.getElementById('sel-payload');
    if (selPayload) {
        Array.from(selPayload.options).forEach(opt => {
            if (t.payloadOptions[opt.value]) opt.text = t.payloadOptions[opt.value];
        });
    }

    const selEngine = document.getElementById('sel-engine');
    if (selEngine) {
        Array.from(selEngine.options).forEach(opt => {
            const m = ROCKET_MODELS[opt.value];
            if (m) opt.text = currentLang === 'zh' ? m.name : m.nameEn;
        });
    }
    const grpCn = document.getElementById('grp-cn');
    if (grpCn) grpCn.label = currentLang === 'zh' ? "🇨🇳 中國新一代主力火箭" : "🇨🇳 Heavy & Commercial Fleet";
    const grpUs = document.getElementById('grp-us');
    if (grpUs) grpUs.label = currentLang === 'zh' ? "🇺🇸 全球重型航天標竿" : "🇺🇸 Super Heavy Standards";
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
    if (rocket.isDestroyed) return;

    const alt = rocket.r.length() - R_EARTH;
    const speed = rocket.relativeAirSpeed || rocket.v.length();
    const rho = 1.225 * Math.exp(-alt / 8500);
    const dynQkPa = (0.5 * rho * speed * speed) / 1000;
    const visualPos = rocket.r.clone().multiplyScalar(WORLD_SCALE);

    const twr = rocket.getThrustVector().length() / (rocket.getCurrentMass() * 9.80665);
    if (rocket.flightTime > 3.0 && alt < 20 && twr < 1.05) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "發射台推重比不足 (TWR < 1.05)，引擎過熱引爆" : "PAD TWR OVERLOAD: Insufficient thrust to clear pad. Overheated.";
        triggerCatastrophicExplosion(visualPos);
        cameraShake = 4.0;
        showMissionDebrief(getOrbitalElements(rocket));
        return;
    }

    if (dynQkPa > 55.0 && alt < 20000) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? `相對動壓突破 55 kPa 極限 (${dynQkPa.toFixed(1)} kPa)，箭體氣動解體` : `MAX-Q SHEAR FAILURE: Exceeded 55 kPa relative pressure (${dynQkPa.toFixed(1)} kPa). Hull shredded.`;
        triggerCatastrophicExplosion(visualPos);
        cameraShake = 3.5;
        showMissionDebrief(getOrbitalElements(rocket));
        return;
    }

    if (rocket.currentGForce > 5.5 && rocket.flightTime > 10) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? `加速度過載超過 5.5 G 極限 (${rocket.currentGForce.toFixed(2)} G)，結構被擠壓破壞` : `G-FORCE OVERLOAD: Exceeded 5.5 G (${rocket.currentGForce.toFixed(2)} G). Hull crushed.`;
        triggerCatastrophicExplosion(visualPos);
        cameraShake = 3.0;
        showMissionDebrief(getOrbitalElements(rocket));
        return;
    }
}

function handleMultiStageSeparation(rocket) {
    if (rocket.isDestroyed) return;
    const t = rocket.flightTime;
    const ms = I18N[currentLang].milestones;

    if (t >= 120 && !rocket.escapeTowerSeparated) {
        rocket.escapeTowerSeparated = true;
        if (activeRocketParts && activeRocketParts.escapeTower) {
            spawnDebrisPiece(rocket, activeRocketParts.escapeTower, new THREE.Vector3(0, 30, 0));
            activeRocketParts.escapeTower.visible = false;
        }
        showMilestone(ms.escape, "#ef4444");
    }

    if (t >= 160 && !rocket.boostersSeparated) {
        rocket.boostersSeparated = true;
        rocket.stage = 2;
        if (activeRocketParts && activeRocketParts.boosters) {
            spawnDebrisPiece(rocket, activeRocketParts.boosters, new THREE.Vector3(20, -40, 20));
            activeRocketParts.boosters.visible = false;
        }
        bulletTimeTimer = 3.0;
        currentCamMode = CAM_MODE.STAGE_SEP;
        showMilestone(ms.boosters, "#f59e0b");
    }

    if (t >= 200 && !rocket.fairingSeparated) {
        rocket.fairingSeparated = true;
        showMilestone(ms.fairing, "#38bdf8");
    }

    if (t >= 580 && !rocket.stage2Separated) {
        rocket.stage2Separated = true;
        rocket.missionAccomplished = true;
        rocket.throttle = 0;
        showMilestone(ms.stage2, "#10b981");
        updateStatus(I18N[currentLang].orbitSuccess, "#10b981");
    }
}

function updateTelemetryValues() {
    const t = I18N[currentLang];
    if (!rocket) {
        if (isDetailTelemetryVisible) {
            setText('t-gforce', '1.00 G');
            setText('t-isp', '—');
            setText('t-peri', '—');
            setText('t-apo', '—');
            setText('t-ecc', '—');
            setText('t-sma', '—');
            setText('t-deltav', '384,400 km');
        }
        return;
    }

    const alt = Math.max(0, rocket.r.length() - R_EARTH);
    const altKm = (alt / 1000).toFixed(1);
    const speed = rocket.v.length();
    const airSpeed = rocket.relativeAirSpeed || speed;
    const mach = (airSpeed / 340).toFixed(1);
    const orbit = getOrbitalElements(rocket);
    const fuelPct = (rocket.stage === 1) 
        ? Math.max(0, Math.round((rocket.fuel1 / (rocket.engine.fuelMassStage1 * (rocket.fuelFactor || 1.0))) * 100))
        : Math.max(0, Math.round((rocket.fuel2 / rocket.engine.fuelMassStage2) * 100));

    setText('hud-time', `${rocket.flightTime.toFixed(1)}s`);
    setText('hud-alt', `${altKm} km`);
    setText('hud-vel', `${speed.toFixed(0)} m/s (M${mach})`);
    
    const altEl = document.getElementById('hud-alt');
    if (alt < 30000) altEl.style.color = '#f97316';
    else if (alt < 100000) altEl.style.color = '#fbbf24';
    else altEl.style.color = '#38bdf8';

    const dynQkPa = (0.5 * 1.225 * Math.exp(-alt/8500) * airSpeed * airSpeed / 1000);
    const maxQRatio = Math.min(100, (dynQkPa / 55) * 100);
    setText('gauge-q-txt', `${dynQkPa.toFixed(1)} kPa`);
    document.getElementById('gauge-q-bar').style.width = `${maxQRatio}%`;
    setText('gauge-fuel-txt', `${fuelPct}%`);
    document.getElementById('gauge-fuel-bar').style.width = `${fuelPct}%`;

    if (machConeMesh) {
        const isTransonic = (airSpeed > 320 && airSpeed < 430 && alt < 25000);
        machConeMesh.material.opacity = isTransonic ? Math.min(0.8, machConeMesh.material.opacity + 0.1) : Math.max(0, machConeMesh.material.opacity - 0.05);
    }

    const currentTwr = rocket.getThrustVector().length() / (rocket.getCurrentMass() * 9.80665);
    setText('t-twr', currentTwr.toFixed(2));
    setText('t-thrust', `${(rocket.getThrustVector().length()/1000).toFixed(0)} kN`);

    let stageName = `${currentLang==='zh'?rocket.engine.name:rocket.engine.nameEn} ${t.ascending}`;
    if (rocket.isDestroyed) stageName = "💥 CATASTROPHIC FAILURE (RUD)";
    else if (rocket.stage2Separated) stageName = "🛰️ 300km Orbit Cruise";
    else if (rocket.boostersSeparated) stageName = "Stage 2 Burn";
    setText('t-stage-name', stageName);

    setText('t-orbit', orbit.isOrbital ? t.stableOrbit : t.ascending);

    if (isDetailTelemetryVisible) {
        setText('t-gforce', `${rocket.currentGForce.toFixed(2)} G`);
        setText('t-isp', rocket.flightTime > 0 ? `${Math.round(rocket.getIsp())} s` : '—');
        setText('t-peri', (orbit.periapsis > 0) ? `${(orbit.periapsis/1000).toFixed(1)} km` : '0.0 km');
        setText('t-apo', (orbit.apoapsis > 0) ? `${(orbit.apoapsis/1000).toFixed(1)} km` : '0.0 km');
        setText('t-ecc', orbit.isOrbital ? orbit.eccentricity.toFixed(4) : '—');
        setText('t-sma', (orbit.semiMajorAxis > 0 && orbit.isOrbital) ? `${(orbit.semiMajorAxis/1000).toFixed(1)} km` : '—');
        const distToMoon = rocket.r.distanceTo(getMoonPosition(rocket.flightTime)) / 1000;
        setText('t-deltav', `${distToMoon.toFixed(0)} km`);
    }

    if (rocket.missionAccomplished && !milestoneShown.orbit) {
        milestoneShown.orbit = true;
        showMissionDebrief(orbit);
    }
}

function showMissionDebrief(orbit) {
    const modal = document.getElementById('debrief-modal');
    if (modal.style.display === 'flex') return;
    modal.style.display = 'flex';

    const periErr = Math.abs(orbit.periapsis - 300000) / 1000;
    setText('stat-maxvel', `${rocket.maxVelocity.toFixed(1)} m/s`);
    setText('stat-maxq', `${(rocket.maxQ / 1000).toFixed(1)} kPa`);
    setText('stat-peri-err', `${periErr.toFixed(1)} km`);
    setText('stat-orbit-alt', `${(orbit.periapsis/1000).toFixed(1)} km x ${(orbit.apoapsis/1000).toFixed(1)} km`);
    const fuelLeft = Math.round((rocket.fuel2 / rocket.engine.fuelMassStage2) * 100);
    setText('stat-fuel-left', `${fuelLeft}%`);

    const rankEl = document.getElementById('debrief-rank');
    const titleEl = document.getElementById('debrief-title');
    const statusEl = document.getElementById('stat-status');
    
    if (rocket.isDestroyed) {
        rankEl.innerText = "FAIL"; rankEl.style.color = "#ef4444";
        titleEl.innerText = I18N[currentLang].abortTitle;
        statusEl.innerText = rocket.failureReason || "Structural Failure";
        statusEl.style.color = "#ef4444";
    } else if (orbit.isOrbital) {
        if (periErr < 3.0 && fuelLeft >= 8) {
            rankEl.innerText = "S+"; rankEl.style.color = "#f43f5e";
            titleEl.innerText = "🌟 Grandmaster Orbital Ace";
            statusEl.innerText = currentLang === 'zh' ? "完美入軌" : "Perfect Insertion";
        } else if (periErr < 10.0) {
            rankEl.innerText = "S"; rankEl.style.color = "#fbbf24";
            titleEl.innerText = "🏆 Precision Orbital Insertion";
            statusEl.innerText = currentLang === 'zh' ? "精確入軌" : "Nominal Insertion";
        } else {
            rankEl.innerText = "A"; rankEl.style.color = "#38bdf8";
            titleEl.innerText = "🛰️ Stable LEO Insertion";
            statusEl.innerText = currentLang === 'zh' ? "標準入軌" : "Inserted";
        }
    } else {
        rankEl.innerText = "B"; rankEl.style.color = "#94a3b8";
        titleEl.innerText = "🚀 Suborbital Test Completed";
        statusEl.innerText = currentLang === 'zh' ? "入軌前燃料耗盡" : "Fuel Depleted before Orbit";
    }
}

function startCountdownSequence() {
    if (isCountingDown) return;
    isCountingDown = true;
    countdownTime = 10;
    
    const hud = document.getElementById('countdown-hud');
    const timerText = document.getElementById('countdown-timer');
    const launchBtn = document.getElementById('btn-launch');
    if (hud) hud.style.display = 'flex';
    if (launchBtn) launchBtn.disabled = true;
    updateStatus(I18N[currentLang].counting, "#fbbf24");

    const timerInterval = setInterval(() => {
        countdownTime--;
        if (timerText) timerText.innerText = `T-${countdownTime}`;
        if (countdownTime <= 3 && timerText) timerText.style.color = '#ef4444';
        if (countdownTime <= 0) {
            clearInterval(timerInterval);
            if (hud) hud.style.display = 'none';
            if (launchBtn) launchBtn.style.display = 'none';
            executeLiftoff();
        }
    }, 1000);
}

function executeLiftoff() {
    const elEngine = document.getElementById('sel-engine');
    let engKey = elEngine ? elEngine.value : "CZ10A";
    if (!ROCKET_MODELS[engKey]) engKey = "CZ10A";
    
    const elPayload = document.getElementById('sel-payload');
    let payload = elPayload ? parseInt(elPayload.value, 10) : 8000;
    if (isNaN(payload)) payload = 8000;

    const elFuel = document.getElementById('rng-fuel');
    let fuelFactor = elFuel ? parseInt(elFuel.value, 10) / 100 : 1.0;
    if (isNaN(fuelFactor)) fuelFactor = 1.0;

    const elTurn = document.getElementById('rng-turn');
    let turnAltKm = elTurn ? parseInt(elTurn.value, 10) : 8;
    if (isNaN(turnAltKm)) turnAltKm = 8;

    const elThrottle = document.getElementById('rng-throttle');
    let throttle = elThrottle ? parseInt(elThrottle.value, 10) : 100;
    if (isNaN(throttle)) throttle = 100;

    rocket = new RocketState();
    rocket.fuelFactor = fuelFactor;
    rocket.initEngine(engKey, payload, fuelFactor, turnAltKm);
    rocket.throttle = throttle / 100;
    rocket.isLaunched = true;
    rocket.guidanceActive = true;
    
    cameraShake = 2.0;
    updateStatus(I18N[currentLang].liftoff, "#38bdf8");

    setTimeout(() => {
        if (isUIVisible) {
            isUIVisible = false;
            const box = document.getElementById('ui-overlay-box');
            if (box) box.classList.add('collapsed');
            setText('btn-toggle-ui', I18N[currentLang].toggleUiHide);
        }
    }, 3000);
}

function bindUI() {
    const btnLaunch = document.getElementById('btn-launch');
    if (btnLaunch) btnLaunch.onclick = startCountdownSequence;
    
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.onclick = () => location.reload();
    
    const selEnv = document.getElementById('sel-env');
    if (selEnv) {
        selEnv.onchange = (e) => {
            setEnvironmentMode(e.target.value);
        };
    }

    const selEngine = document.getElementById('sel-engine');
    if (selEngine) {
        selEngine.onchange = (e) => {
            switchRocketMesh(e.target.value);
        };
    }

    const rngThrottle = document.getElementById('rng-throttle');
    if (rngThrottle) {
        rngThrottle.oninput = (e) => { 
            let val = parseInt(e.target.value, 10);
            if (!isNaN(val) && rocket && !rocket.missionAccomplished && !rocket.isDestroyed) {
                rocket.throttle = Math.max(0.1, Math.min(1.0, val / 100));
            }
        };
    }

    const btnLang = document.getElementById('btn-lang');
    if (btnLang) {
        btnLang.onclick = () => { 
            currentLang = currentLang === 'zh' ? 'en' : 'zh'; 
            applyLanguageUI(); 
        };
    }

    const toggleBtn = document.getElementById('btn-toggle-ui');
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            isUIVisible = !isUIVisible;
            const box = document.getElementById('ui-overlay-box');
            if (box) box.classList.toggle('collapsed', !isUIVisible);
            setText('btn-toggle-ui', isUIVisible ? I18N[currentLang].toggleUi : I18N[currentLang].toggleUiHide);
        };
    }

    const detailBtn = document.getElementById('btn-toggle-details');
    if (detailBtn) {
        detailBtn.onclick = () => {
            isDetailTelemetryVisible = !isDetailTelemetryVisible;
            const detailBox = document.getElementById('telemetry-detail-box');
            if (detailBox) detailBox.style.display = isDetailTelemetryVisible ? 'block' : 'none';
            detailBtn.innerText = isDetailTelemetryVisible ? I18N[currentLang].toggleDetailHide : I18N[currentLang].toggleDetailShow;
            updateTelemetryValues();
        };
    }

    const updateTimeDisplay = () => setText('time-scale-display', `倍速/Warp: ${timeScale.toFixed(1)}x`);
    const btnSlower = document.getElementById('btn-time-slower');
    if (btnSlower) btnSlower.onclick = () => { timeScale = Math.max(0.5, timeScale / 1.5); updateTimeDisplay(); };
    const btnFaster = document.getElementById('btn-time-faster');
    if (btnFaster) btnFaster.onclick = () => { timeScale = Math.min(100, timeScale * 1.5); updateTimeDisplay(); };

    window.addEventListener('keydown', (e) => {
        if (e.key === '=' || e.key === '+') { timeScale = Math.min(100, timeScale * 1.5); updateTimeDisplay(); }
        if (e.key === '-') { timeScale = Math.max(0.5, timeScale / 1.5); updateTimeDisplay(); }
    });
}

function gameLoop(now) {
    requestAnimationFrame(gameLoop);
    let dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    let currentEffectiveTimeScale = timeScale;
    if (bulletTimeTimer > 0) {
        bulletTimeTimer -= dt;
        currentEffectiveTimeScale = 0.25;
    }

    if (moonMesh) moonMesh.position.copy(getMoonPosition(performance.now() / 1000).multiplyScalar(WORLD_SCALE));
    if (earthMesh) earthMesh.rotation.y += dt * 0.02 * currentEffectiveTimeScale;

    updateExplosion(dt * currentEffectiveTimeScale);

    if (rocket && rocket.isLaunched && !rocket.isDestroyed) {
        executeGuidance(rocket, dt);

        const maxSubDt = (rocket.r.length() - R_EARTH < 100000 && rocket.getThrustVector().length() > 0) ? 0.005 : 0.05;
        let remainingDt = dt * currentEffectiveTimeScale;
        while (remainingDt > 0) {
            const stepDt = Math.min(remainingDt, maxSubDt);
            rk4Step(rocket, stepDt);
            remainingDt -= stepDt;
        }

        evaluateStructuralLimits(rocket);
        handleMultiStageSeparation(rocket);
        updateDebris(dt * currentEffectiveTimeScale);

        const alt = Math.max(0, rocket.r.length() - R_EARTH);
        const speed = rocket.v.length();
        
        // 🚀【雙尺度視覺映射】
        const visualAlt = (alt < 5000) 
            ? 0.4 + (alt * 0.035) 
            : 0.4 + (5000 * 0.035) + (alt - 5000) * WORLD_SCALE;

        const visualPos = rocket.r.clone().normalize().multiplyScalar(1000 + visualAlt);
        
        // 🌟【對數平滑高空縮放優化】低空等身，高空對數漸進，在 300km 軌道與地球比例達到最和諧狀態
        const visualScale = (alt < 5000) 
            ? 1.0 
            : Math.min(10.0, 1.0 + Math.log10(1 + (alt - 5000) / 1000) * 3.5);
            
        rocketGroup.scale.set(visualScale, visualScale, visualScale);
        rocketGroup.position.copy(visualPos);
        
        const thrustDir = rocket.thrustDir.clone().normalize();
        rocketGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), thrustDir);

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
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 4, 0)));
                break;
            case CAM_MODE.MAX_Q:
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(30 + shakeX, 5 + shakeY, 0)));
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 3, 0)));
                break;
            case CAM_MODE.STAGE_SEP:
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(12 * Math.cos(now * 0.002), 4, 12 * Math.sin(now * 0.002))));
                targetLookAt.copy(visualPos);
                break;
            case CAM_MODE.ORBIT:
                const orbitCamDist = Math.max(500, orbit.semiMajorAxis * WORLD_SCALE * 1.2);
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(0, orbitCamDist * 0.5, orbitCamDist)));
                targetLookAt.set(0, 0, 0);
                break;
            case CAM_MODE.ASCEND:
            default:
                let camDist = (alt < 2000) ? 25 + alt * 0.015 : Math.min(2500, Math.max(40, alt * WORLD_SCALE * 1.5));
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(camDist * 0.35 + shakeX, camDist * 0.25 + shakeY, camDist * 0.8)));
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 3, 0)));
                break;
        }

        camera.position.lerp(targetCamPos, 0.08);
        controls.target.lerp(targetLookAt, 0.09);

        const thrustMag = rocket.getThrustVector().length();
        if (thrustMag > 1000) {
            if (flameMesh) {
                flameMesh.visible = true;
                const pulse = 1.0 + (Math.random() - 0.5) * 0.2;
                flameMesh.scale.set(pulse, pulse * (rocket.throttle || 1.0), pulse);
            }
            spawnExhaustParticles(visualPos, rocket.throttle * visualScale, alt < 3000);
            if (rocketLight) {
                rocketLight.position.copy(visualPos);
                rocketLight.intensity = 6.0;
            }
        } else {
            if (flameMesh) flameMesh.visible = false;
            if (rocketLight) rocketLight.intensity = 0.0;
        }
        
        velArrow.position.copy(visualPos); velArrow.setDirection(rocket.v.clone().normalize()); velArrow.setLength(15);
        thrustArrow.position.copy(visualPos); thrustArrow.setDirection(thrustDir); thrustArrow.setLength(10);
        velArrow.visible = (alt > 2000); thrustArrow.visible = (alt > 2000 && thrustMag > 0);

        updatePredictedOrbit(rocket);
        updateTelemetryValues();
    } else {
        if (rocketGroup && !rocket) {
            rocketGroup.quaternion.set(0, 0, 0, 1);
            rocketGroup.position.set(0, 1000.4, 0);
        }
        if (flameMesh) flameMesh.visible = false;
        if (velArrow) velArrow.visible = false;
        if (thrustArrow) thrustArrow.visible = false;
        if (rocketLight) rocketLight.intensity = 0.0;
    }

    updateExhaustParticles(dt);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
    initRocketScene(document.getElementById('canvas-container'));
    bindUI();
    applyLanguageUI();
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    gameLoop(performance.now());
});
