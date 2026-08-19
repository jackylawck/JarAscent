/**
 * js/rocket_game.js - JarAscent 3D 長征全時序自動分離與入軌
 * @license MIT
 */

const THREE = window.THREE;

import { 
    initRocketScene, RocketState, rk4Step, executeGuidance, getOrbitalElements,
    getMoonPosition, scene, camera, controls, renderer, rocketGroup, flameMesh,
    escapeTowerMesh, boostersGroup, stage1Mesh, fairingLeftMesh, fairingRightMesh, stage2Mesh, spacecraftMesh,
    machConeMesh, spawnDebrisPiece, updateDebris, setEnvironmentMode,
    earthMesh, moonMesh, rocketLight, velArrow, thrustArrow, spawnExhaustParticles, updateExhaustParticles,
    ENGINE_DATABASE, R_EARTH, WORLD_SCALE
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
        title: "🚀 躍上天穹 3D", subtitle: "科研級天體動力學與全流程分離沙盒",
        langBtn: "English", toggleUi: "📋 任務控制面板", toggleUiHide: "📋 展開任務控制",
        toggleDetailShow: "📊 展開深度科研", toggleDetailHide: "📉 收起深度科研",
        configTitle: "🛠️ 任務與發射場設定",
        lblEnv: "發射場天色時間:", lblEngine: "運載火箭型號:", lblPayload: "任務載荷艙:", lblThrottle: "節流閥推力 (%):",
        launchBtn: "🔥 啟動 10 秒倒數發射 (Terminal T-10s)", resetBtn: "🔄 重設發射台 (Reset Pad)",
        telemetryTitle: "⚙️ 即時飛行與分離狀態", ready: "發射台準備就緒，請點擊發射...",
        counting: "⚠️ 終端倒數進行中 (Terminal Countdown Active)...", liftoff: "🔥 點火升空！長征火箭全力起飛",
        orbitSuccess: "🏆【入軌成功】神舟飛船精確進入 300km 預定軌道 (SECO)！",
        milestones: {
            escape: "🚀 T+120s 拋掉逃逸塔 (Tower Jettison)!",
            boosters: "⚡ T+160s 4枚助推器與一級分離!",
            fairing: "✨ T+200s 拋整流罩 (Fairing Separation)!",
            stage2: "🛰️ T+580s 二級分離，飛船入軌!",
            orbit: "🏆 飛船太陽翼展開，入軌圓滿成功!"
        },
        engines: { CZ2F: "長征二號F (CZ-2F 載人型)", MERLIN: "獵鷹 9 號 (Falcon 9)", RAPTOR: "超重型星艦 (Super Heavy)", SLS: "太空發射系統 (SLS)" },
        payloads: { "8000": "神舟載人飛船 (8,000 kg)", "2000": "天舟空間站貨運艙 (2,000 kg)", "500": "微重力科學試驗艙 (500 kg)" }
    },
    en: {
        title: "🚀 JarAscent 3D", subtitle: "Aerospace Dynamics & Multi-Stage Staging Sandbox",
        langBtn: "中文 (繁體)", toggleUi: "📋 Mission Control", toggleUiHide: "📋 Expand Panel",
        toggleDetailShow: "📊 Expand Details", toggleDetailHide: "📉 Collapse Details",
        configTitle: "🛠️ Mission & Pad Setup",
        lblEnv: "Launch Lighting:", lblEngine: "Launch Vehicle:", lblPayload: "Payload Compartment:", lblThrottle: "Engine Throttle (%):",
        launchBtn: "🔥 Initiate T-10s Terminal Countdown", resetBtn: "🔄 Reset Launch Pad",
        telemetryTitle: "⚙️ Live Flight & Separation Telemetry", ready: "Pad ready. Awaiting launch sequence...",
        counting: "⚠️ Terminal countdown sequence in progress...", liftoff: "🔥 Ignition & Liftoff! Long March ascending.",
        orbitSuccess: "🏆【Orbit Inserted】Shenzhou Spacecraft safely in 300km Orbit!",
        milestones: {
            escape: "🚀 T+120s Launch Escape Tower Jettison!",
            boosters: "⚡ T+160s 4 Boosters & Stage 1 Separation!",
            fairing: "✨ T+200s Fairing Separation!",
            stage2: "🛰️ T+580s Stage 2 Cutoff & Spacecraft Inserted!",
            orbit: "🏆 Solar Panels Deployed. Orbit Complete!"
        },
        engines: { CZ2F: "Long March 2F (CZ-2F Crewed)", MERLIN: "Falcon 9 Cluster", RAPTOR: "Super Heavy Starship", SLS: "Space Launch System" },
        payloads: { "8000": "Shenzhou Crew Capsule (8,000 kg)", "2000": "Tianzhou Cargo Craft (2,000 kg)", "500": "Microgravity Module (500 kg)" }
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
        font-size: 2.2rem; font-weight: 900; color: ${color};
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
    setText('ui-title', t.title); setText('ui-subtitle', t.subtitle);
    setText('btn-lang', t.langBtn);
    setText('btn-toggle-ui', isUIVisible ? t.toggleUi : t.toggleUiHide);
    setText('btn-toggle-details', isDetailTelemetryVisible ? t.toggleDetailHide : t.toggleDetailShow);
    setText('ui-config-title', t.configTitle); setText('lbl-env', t.lblEnv);
    setText('lbl-engine', t.lblEngine); setText('lbl-payload', t.lblPayload);
    setText('lbl-throttle', t.lblThrottle); setText('btn-launch', t.launchBtn);
    setText('btn-reset', t.resetBtn); setText('ui-telemetry-title', t.telemetryTitle);
    
    ['sel-engine', 'sel-payload'].forEach(id => {
        const sel = document.getElementById(id);
        const dict = id === 'sel-engine' ? t.engines : t.payloads;
        if (sel) Array.from(sel.options).forEach(opt => { if (dict[opt.value]) opt.text = dict[opt.value]; });
    });
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

// 🚀 執行 5 段式長征時序分離邏輯
function handleMultiStageSeparation(rocket) {
    const t = rocket.flightTime;
    const ms = I18N[currentLang].milestones;

    // 1. T+120s 拋掉逃逸塔
    if (t >= 120 && !rocket.escapeTowerSeparated) {
        rocket.escapeTowerSeparated = true;
        spawnDebrisPiece(rocket, escapeTowerMesh, new THREE.Vector3(0, 30, 0));
        escapeTowerMesh.visible = false;
        showMilestone(ms.escape, "#ef4444");
    }

    // 2. T+160s 拋掉4個助推器與芯一級 (MECO)
    if (t >= 160 && !rocket.boostersSeparated) {
        rocket.boostersSeparated = true;
        rocket.stage = 2; // 切換至二級動力
        spawnDebrisPiece(rocket, boostersGroup, new THREE.Vector3(20, -40, 20));
        spawnDebrisPiece(rocket, stage1Mesh, new THREE.Vector3(0, -60, 0));
        boostersGroup.visible = false;
        stage1Mesh.visible = false;
        bulletTimeTimer = 3.0; // 觸發慢動作
        currentCamMode = CAM_MODE.STAGE_SEP;
        showMilestone(ms.boosters, "#f59e0b");
    }

    // 3. T+200s 出大氣層拋整流罩 (露出神舟飛船)
    if (t >= 200 && !rocket.fairingSeparated) {
        rocket.fairingSeparated = true;
        spawnDebrisPiece(rocket, fairingLeftMesh, new THREE.Vector3(-25, 0, 10));
        spawnDebrisPiece(rocket, fairingRightMesh, new THREE.Vector3(25, 0, -10));
        fairingLeftMesh.visible = false;
        fairingRightMesh.visible = false;
        showMilestone(ms.fairing, "#38bdf8");
    }

    // 4. T+580s 拋二級火箭，飛船入軌 (SECO)
    if (t >= 580 && !rocket.stage2Separated) {
        rocket.stage2Separated = true;
        rocket.missionAccomplished = true;
        rocket.throttle = 0;
        spawnDebrisPiece(rocket, stage2Mesh, new THREE.Vector3(0, -30, 0));
        stage2Mesh.visible = false;
        showMilestone(ms.stage2, "#10b981");
        updateStatus(I18N[currentLang].orbitSuccess, "#10b981");
    }
}

function updateTelemetryValues() {
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
    const mach = (speed / 340).toFixed(1);
    const orbit = getOrbitalElements(rocket);
    const fuelPct = (rocket.stage === 1) 
        ? Math.max(0, Math.round((rocket.fuel1 / rocket.engine.fuelMassStage1) * 100))
        : Math.max(0, Math.round((rocket.fuel2 / rocket.engine.fuelMassStage2) * 100));

    setText('hud-time', `${rocket.flightTime.toFixed(1)}s`);
    setText('hud-alt', `${altKm} km`);
    setText('hud-vel', `${speed.toFixed(0)} m/s (M${mach})`);
    
    const altEl = document.getElementById('hud-alt');
    if (alt < 30000) altEl.style.color = '#f97316';
    else if (alt < 100000) altEl.style.color = '#fbbf24';
    else altEl.style.color = '#38bdf8';

    const dynQkPa = (0.5 * 1.225 * Math.exp(-alt/8500) * speed * speed / 1000);
    const maxQRatio = Math.min(100, (dynQkPa / 60) * 100);
    setText('gauge-q-txt', `${dynQkPa.toFixed(1)} kPa`);
    document.getElementById('gauge-q-bar').style.width = `${maxQRatio}%`;
    setText('gauge-fuel-txt', `${fuelPct}%`);
    document.getElementById('gauge-fuel-bar').style.width = `${fuelPct}%`;

    if (machConeMesh) {
        const isTransonic = (speed > 320 && speed < 430 && alt < 25000);
        machConeMesh.material.opacity = isTransonic ? Math.min(0.8, machConeMesh.material.opacity + 0.1) : Math.max(0, machConeMesh.material.opacity - 0.05);
    }

    // 當前分離構型名稱
    let stageName = "芯一級 + 4助推器 + 逃逸塔";
    if (rocket.stage2Separated) stageName = "🛰️ 神舟飛船獨立軌道飛行 (Orbiting)";
    else if (rocket.fairingSeparated) stageName = "芯二級 + 神舟飛船 (無整流罩)";
    else if (rocket.boostersSeparated) stageName = "芯二級 + 飛船整流罩";
    else if (rocket.escapeTowerSeparated) stageName = "芯一級 + 4助推器 (已拋逃逸塔)";
    setText('t-stage-name', stageName);

    setText('t-thrust', `${(rocket.getThrustVector().length()/1000).toFixed(0)} kN`);
    setText('t-orbit', orbit.isOrbital ? "🟢 300km 圓軌道 (LEO Orbit)" : "🟡 主動爬升段 (Ascending)");

    if (isDetailTelemetryVisible) {
        setText('t-gforce', rocket.flightTime > 0 ? `${rocket.currentGForce.toFixed(2)} G` : '1.00 G');
        setText('t-isp', rocket.flightTime > 0 ? `${Math.round(rocket.getIsp())} s` : '—');
        setText('t-peri', (orbit.periapsis > 0) ? `${(orbit.periapsis/1000).toFixed(1)} km` : '0.0 km');
        setText('t-apo', (orbit.apoapsis > 0) ? `${(orbit.apoapsis/1000).toFixed(1)} km` : '0.0 km');
        setText('t-ecc', orbit.isOrbital ? orbit.eccentricity.toFixed(4) : '—');
        setText('t-sma', (orbit.semiMajorAxis > 0 && orbit.isOrbital) ? `${(orbit.semiMajorAxis/1000).toFixed(1)} km` : '—');
        const distToMoon = rocket.r.distanceTo(getMoonPosition(rocket.flightTime)) / 1000;
        setText('t-deltav', `${distToMoon.toFixed(0)} km`);
    }

    // 🏆 最終 300km 入軌結算
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
    
    if (orbit.isOrbital) {
        if (periErr < 3.0) {
            rankEl.innerText = "S+"; rankEl.style.color = "#f43f5e";
            titleEl.innerText = "🌟 傳奇神舟導航官 (Grandmaster Ace)";
        } else if (periErr < 10.0) {
            rankEl.innerText = "S"; rankEl.style.color = "#fbbf24";
            titleEl.innerText = "🏆 完美入軌指揮官 (Orbital Ace)";
        } else {
            rankEl.innerText = "A"; rankEl.style.color = "#38bdf8";
            titleEl.innerText = "🛰️ 標準入軌成功 (LEO Insertion)";
        }
    }
}

function startCountdownSequence() {
    if (isCountingDown) return;
    isCountingDown = true;
    countdownTime = 10;
    
    const hud = document.getElementById('countdown-hud');
    const timerText = document.getElementById('countdown-timer');
    const launchBtn = document.getElementById('btn-launch');
    hud.style.display = 'flex';
    launchBtn.disabled = true;
    updateStatus(I18N[currentLang].counting, "#fbbf24");

    const timerInterval = setInterval(() => {
        countdownTime--;
        timerText.innerText = `T-${countdownTime}`;
        if (countdownTime <= 3) timerText.style.color = '#ef4444';
        if (countdownTime <= 0) {
            clearInterval(timerInterval);
            hud.style.display = 'none';
            launchBtn.style.display = 'none';
            executeLiftoff();
        }
    }, 1000);
}

function executeLiftoff() {
    let engKey = document.getElementById('sel-engine').value;
    if (!ENGINE_DATABASE[engKey]) engKey = "CZ2F";
    
    let payload = parseInt(document.getElementById('sel-payload').value, 10);
    if (isNaN(payload)) payload = 8000;

    let throttle = parseInt(document.getElementById('rng-throttle').value, 10);
    if (isNaN(throttle)) throttle = 100;

    rocket = new RocketState();
    rocket.initEngine(engKey, payload);
    rocket.throttle = throttle / 100;
    rocket.isLaunched = true;
    rocket.guidanceActive = true;
    
    cameraShake = 2.0;
    updateStatus(I18N[currentLang].liftoff, "#38bdf8");

    setTimeout(() => {
        if (isUIVisible) {
            isUIVisible = false;
            document.getElementById('ui-overlay-box').classList.add('collapsed');
            setText('btn-toggle-ui', I18N[currentLang].toggleUiHide);
        }
    }, 3000);
}

function bindUI() {
    document.getElementById('btn-launch').onclick = startCountdownSequence;
    document.getElementById('btn-reset').onclick = () => location.reload();
    
    // ☀️/🌙 晝夜切換
    document.getElementById('sel-env').onchange = (e) => {
        setEnvironmentMode(e.target.value);
    };

    document.getElementById('rng-throttle').oninput = (e) => { 
        let val = parseInt(e.target.value, 10);
        if (!isNaN(val) && rocket && !rocket.missionAccomplished) rocket.throttle = Math.max(0.1, Math.min(1.0, val / 100));
    };

    document.getElementById('btn-lang').onclick = () => { currentLang = currentLang==='zh'?'en':'zh'; applyLanguageUI(); };

    const toggleBtn = document.getElementById('btn-toggle-ui');
    toggleBtn.onclick = () => {
        isUIVisible = !isUIVisible;
        const box = document.getElementById('ui-overlay-box');
        box.classList.toggle('collapsed', !isUIVisible);
        setText('btn-toggle-ui', isUIVisible ? I18N[currentLang].toggleUi : I18N[currentLang].toggleUiHide);
    };

    const detailBtn = document.getElementById('btn-toggle-details');
    detailBtn.onclick = () => {
        isDetailTelemetryVisible = !isDetailTelemetryVisible;
        const detailBox = document.getElementById('telemetry-detail-box');
        detailBox.style.display = isDetailTelemetryVisible ? 'block' : 'none';
        detailBtn.innerText = isDetailTelemetryVisible ? I18N[currentLang].toggleDetailHide : I18N[currentLang].toggleDetailShow;
        updateTelemetryValues();
    };

    const updateTimeDisplay = () => setText('time-scale-display', `倍速: ${timeScale.toFixed(1)}x`);
    document.getElementById('btn-time-slower').onclick = () => { timeScale = Math.max(0.5, timeScale / 1.5); updateTimeDisplay(); };
    document.getElementById('btn-time-faster').onclick = () => { timeScale = Math.min(100, timeScale * 1.5); updateTimeDisplay(); };
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

    if (rocket && rocket.isLaunched) {
        executeGuidance(rocket, dt);

        const maxSubDt = (rocket.r.length() - R_EARTH < 100000 && rocket.getThrustVector().length() > 0) ? 0.005 : 0.05;
        let remainingDt = dt * currentEffectiveTimeScale;
        while (remainingDt > 0) {
            const stepDt = Math.min(remainingDt, maxSubDt);
            rk4Step(rocket, stepDt);
            remainingDt -= stepDt;
        }

        // 🚀 執行 5 段式全流程分離檢查
        handleMultiStageSeparation(rocket);
        updateDebris(dt * currentEffectiveTimeScale);

        const alt = Math.max(0, rocket.r.length() - R_EARTH);
        const speed = rocket.v.length();
        const visualPos = rocket.r.clone().multiplyScalar(WORLD_SCALE);
        
        const visualScale = (alt < 5000) ? 1.0 : Math.min(25.0, 1.0 + (alt / 10000) * 0.5);
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
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(-18 + shakeX, 8 + shakeY, 18)));
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 5, 0)));
                break;
            case CAM_MODE.MAX_Q:
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(35 + shakeX, 5 + shakeY, 0)));
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 3, 0)));
                break;
            case CAM_MODE.STAGE_SEP:
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(14 * Math.cos(now * 0.002), 4, 14 * Math.sin(now * 0.002))));
                targetLookAt.copy(visualPos);
                break;
            case CAM_MODE.ORBIT:
                const orbitCamDist = Math.max(600, orbit.semiMajorAxis * WORLD_SCALE * 1.3);
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(0, orbitCamDist * 0.5, orbitCamDist)));
                targetLookAt.set(0, 0, 0);
                break;
            case CAM_MODE.ASCEND:
            default:
                let camDist = (alt < 2000) ? 25 + alt * 0.01 : Math.min(2500, Math.max(40, alt * WORLD_SCALE * 1.5));
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(camDist * 0.35 + shakeX, camDist * 0.25 + shakeY, camDist * 0.8)));
                targetLookAt.copy(visualPos.clone().add(new THREE.Vector3(0, 3, 0)));
                break;
        }

        camera.position.lerp(targetCamPos, 0.06);
        controls.target.lerp(targetLookAt, 0.07);

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
