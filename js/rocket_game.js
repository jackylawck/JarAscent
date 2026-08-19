/**
 * js/rocket_game.js - JarAscent 3D 任務主控、倒數儀式與動態視角調度
 * @license MIT
 */

const THREE = window.THREE;

import { 
    initRocketScene, RocketState, rk4Step, executeGuidance, getOrbitalElements,
    getMoonPosition, scene, camera, controls, renderer, rocketGroup, 
    earthMesh, moonMesh, velArrow, thrustArrow, spawnExhaustParticles, updateExhaustParticles,
    ENGINE_DATABASE, R_EARTH
} from './rocket_engine.js';

let rocket = null;
let currentLang = 'zh';
let lastTime = performance.now();
let timeScale = 1.0;
let orbitLine = null;
const ORBIT_SEGMENTS = 128;

// 倒數與發射狀態機
let countdownTime = 10;
let isCountingDown = false;
let cameraShake = 0;

const I18N = {
    zh: {
        title: "🚀 躍上天穹 3D",
        subtitle: "科研級天體動力學與任務制導沙盒",
        langBtn: "English",
        toggleUi: "👁️ 隱藏/顯示控制台",
        configTitle: "🛠️ 任務與火箭構型",
        lblEngine: "火箭發動機型號:",
        lblPayload: "載荷艙重量 (kg):",
        lblThrottle: "節流閥推力 (%):",
        launchBtn: "🔥 啟動 10 秒倒數發射 (Terminal T-10s)",
        stageBtn: "⚡ 手動一級分離 (Stage Separation)",
        resetBtn: "🔄 重設發射台 (Reset Pad)",
        telemetryTitle: "⚙️ 實時遙測數據 (240Hz RK4 航天算力)",
        ready: "發射台準備就緒，請開始發射程序...",
        counting: "⚠️ 終端倒數進行中 (Terminal Countdown Active)...",
        liftoff: "🔥 點火升空！Liftoff！Gravity Turn 閉環啟動",
        meco: "⚠️ 一級主發動機關機 (MECO)，請手動分離！",
        orbitSuccess: "🏆【軌道達成】成功注入 300km 近地軌道 (SECO)！",
        engines: {
            MERLIN: "梅林發動機 (Merlin 1D)",
            RAPTOR: "猛禽發動機 (Raptor 2)",
            HYDROGEN: "氫氧發動機 (RS-25)",
            SOLID: "固體助推器 (Solid SRB)"
        },
        payloads: {
            "500": "輕型科學衛星 (500 kg)",
            "2000": "標準通訊衛星 (2,000 kg)",
            "8000": "載人飛船乘組艙 (8,000 kg)"
        }
    },
    en: {
        title: "🚀 JarAscent 3D",
        subtitle: "Aerospace Dynamics & Orbital Sandbox",
        langBtn: "中文 (繁體)",
        toggleUi: "👁️ Toggle Flight Panel",
        configTitle: "🛠️ Mission & Configuration",
        lblEngine: "Rocket Engine Model:",
        lblPayload: "Payload Mass (kg):",
        lblThrottle: "Engine Throttle (%):",
        launchBtn: "🔥 Initiate T-10s Terminal Countdown",
        stageBtn: "⚡ Stage Separation",
        resetBtn: "🔄 Reset Launch Pad",
        telemetryTitle: "⚙️ Live Telemetry (240Hz RK4 Precision)",
        ready: "Pad ready. Awaiting launch sequence...",
        counting: "⚠️ Terminal countdown sequence in progress...",
        liftoff: "🔥 Main Engine Ignition! Liftoff! Gravity Turn active.",
        meco: "⚠️ Main Engine Cutoff (MECO). Ready for separation!",
        orbitSuccess: "🏆【Orbit Inserted】300km Target Orbit Achieved (SECO)!",
        engines: {
            MERLIN: "Merlin 1D (RP-1 / LOX)",
            RAPTOR: "Raptor 2 (Full-Flow Methalox)",
            HYDROGEN: "RS-25 Hydrolox (High Isp)",
            SOLID: "Solid Rocket Booster (High Thrust SRB)"
        },
        payloads: {
            "500": "Light Research Satellite (500 kg)",
            "2000": "Standard Telecom Satellite (2,000 kg)",
            "8000": "Crewed Orbital Capsule (8,000 kg)"
        }
    }
};

function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function updateStatus(text, color="#38bdf8") { 
    const el = document.getElementById('flight-status'); 
    if (el) { el.innerText = text; el.style.color = color; } 
}

function applyLanguageUI() {
    const t = I18N[currentLang];
    setText('ui-title', t.title);
    setText('ui-subtitle', t.subtitle);
    setText('btn-lang', t.langBtn);
    setText('btn-toggle-ui', t.toggleUi);
    setText('ui-config-title', t.configTitle);
    setText('lbl-engine', t.lblEngine);
    setText('lbl-payload', t.lblPayload);
    setText('lbl-throttle', t.lblThrottle);
    setText('btn-launch', t.launchBtn);
    setText('btn-stage', t.stageBtn);
    setText('btn-reset', t.resetBtn);
    setText('ui-telemetry-title', t.telemetryTitle);
    
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
    orbitLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, linewidth: 2 }));
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
    
    let refVec = new THREE.Vector3(1,0,0);
    if (Math.abs(hUnit.dot(refVec)) > 0.99) refVec.set(0,1,0);
    const pUnit = new THREE.Vector3().crossVectors(hUnit, refVec).normalize();
    const qUnit = new THREE.Vector3().crossVectors(hUnit, pUnit).normalize();
    
    const p = orbit.semiMajorAxis * (1 - orbit.eccentricity * orbit.eccentricity);
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

function updateTelemetryValues() {
    if (!rocket) return;
    const alt = Math.max(0, rocket.r.length() - R_EARTH);
    const speed = rocket.v.length();
    const orbit = getOrbitalElements(rocket);
    const fuelPct = (rocket.stage === 1) 
        ? Math.max(0, Math.round((rocket.fuel1 / rocket.engine.fuelMassStage1) * 100))
        : Math.max(0, Math.round((rocket.fuel2 / rocket.engine.fuelMassStage2) * 100));

    setText('t-time', `${rocket.flightTime.toFixed(1)} s`);
    setText('t-alt', `${(alt/1000).toFixed(2)} km`);
    setText('t-vel', `${speed.toFixed(1)} m/s`);
    setText('t-q', `${(0.5 * 1.225 * Math.exp(-alt/8500) * speed * speed / 1000).toFixed(2)} kPa`);
    setText('t-fuel', `${fuelPct}% (Stage ${rocket.stage})`);
    setText('t-mass', `${Math.round(rocket.getCurrentMass()).toLocaleString()} kg`);
    setText('t-thrust', `${(rocket.getThrustVector().length()/1000).toFixed(1)} kN`);
    setText('t-isp', `${Math.round(rocket.getIsp())} s`);
    setText('t-peri', `${Math.max(0, (orbit.periapsis/1000).toFixed(1))} km`);
    setText('t-apo', `${Math.max(0, (orbit.apoapsis/1000).toFixed(1))} km`);
    setText('t-orbit', orbit.isOrbital ? "🟢 束縛軌道 (Bound Orbit)" : "🟡 次軌道拋物線 (Suborbital)");
    
    const distToMoon = rocket.r.distanceTo(getMoonPosition(rocket.flightTime)) / 1000;
    setText('t-deltav', `${distToMoon.toFixed(0)} km`);

    if (rocket.stage === 1 && rocket.fuel1 <= 0) {
        document.getElementById('btn-stage').style.display = 'block';
        updateStatus(I18N[currentLang].meco, "#f59e0b");
    }
    if (rocket.missionAccomplished) updateStatus(I18N[currentLang].orbitSuccess, "#10b981");
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
        if (countdownTime <= 3) {
            timerText.style.color = '#ef4444'; // 最後3秒點火警示紅
        }
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
    if (!ENGINE_DATABASE[engKey]) engKey = "MERLIN";
    
    let payload = parseInt(document.getElementById('sel-payload').value, 10);
    if (isNaN(payload) || payload < 0 || payload > 50000) payload = 2000;

    let throttle = parseInt(document.getElementById('rng-throttle').value, 10);
    if (isNaN(throttle) || throttle < 10 || throttle > 100) throttle = 100;

    rocket = new RocketState();
    rocket.initEngine(engKey, payload);
    rocket.throttle = throttle / 100;
    rocket.isLaunched = true;
    rocket.guidanceActive = true;
    
    cameraShake = 1.5; // 觸發起飛鏡頭震撼
    updateStatus(I18N[currentLang].liftoff, "#38bdf8");
}

function bindUI() {
    document.getElementById('btn-launch').onclick = startCountdownSequence;
    
    document.getElementById('btn-stage').onclick = () => { 
        if (rocket && rocket.stage === 1) { 
            rocket.stage = 2; 
            document.getElementById('btn-stage').style.display = 'none'; 
        } 
    };

    document.getElementById('btn-reset').onclick = () => location.reload();
    
    document.getElementById('rng-throttle').oninput = (e) => { 
        let val = parseInt(e.target.value, 10);
        if (!isNaN(val) && rocket && !rocket.missionAccomplished) rocket.throttle = Math.max(0.1, Math.min(1.0, val / 100));
    };

    document.getElementById('btn-lang').onclick = () => { currentLang = currentLang==='zh'?'en':'zh'; applyLanguageUI(); };
    document.getElementById('btn-toggle-ui').onclick = () => {
        const box = document.getElementById('ui-overlay-box');
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
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
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (moonMesh) moonMesh.position.copy(getMoonPosition(performance.now() / 1000));
    if (earthMesh) earthMesh.rotation.y += dt * 0.02 * timeScale;

    if (rocket && rocket.isLaunched) {
        executeGuidance(rocket, dt);

        const maxSubDt = (rocket.r.length() - R_EARTH < 100000 && rocket.getThrustVector().length() > 0) ? 0.005 : 0.05;
        let remainingDt = dt * timeScale;
        while (remainingDt > 0) {
            const stepDt = Math.min(remainingDt, maxSubDt);
            rk4Step(rocket, stepDt);
            remainingDt -= stepDt;
        }

        // 🚀 動態視覺縮放 (Dynamic Scale)：在太空軌道中將火箭模型適度放大，確保清晰可見
        const alt = Math.max(0, rocket.r.length() - R_EARTH);
        const visualScale = (alt < 5000) ? 1.0 : Math.min(200.0, 1.0 + (alt / 10000) * 1.5);
        rocketGroup.scale.set(visualScale, visualScale, visualScale);

        rocketGroup.position.copy(rocket.r);
        
        // 火箭姿態朝向推力方向 (+X 為基準對齊)
        const thrustDir = rocket.thrustDir.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), thrustDir);
        rocketGroup.quaternion.copy(quat);

        // 動態智慧相機跟隨
        const orbit = getOrbitalElements(rocket);
        let camOffsetDist = (alt < 2000) 
            ? 180 + alt * 0.1 
            : Math.min(250000, Math.max(1000, alt * 0.6));
            
        if (orbit.isOrbital) {
            camOffsetDist = Math.max(camOffsetDist, orbit.semiMajorAxis * 0.008);
        }

        // 點火震顫效果
        const shakeX = (Math.random() - 0.5) * cameraShake * 10;
        const shakeY = (Math.random() - 0.5) * cameraShake * 10;
        if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 0.5);

        const idealCamPos = rocket.r.clone().add(new THREE.Vector3(camOffsetDist + shakeX, camOffsetDist * 0.4 + shakeY, camOffsetDist * 0.8));
        camera.position.lerp(idealCamPos, 0.08);
        controls.target.lerp(rocket.r, 0.1);

        const thrustMag = rocket.getThrustVector().length();
        if (thrustMag > 1000) {
            spawnExhaustParticles(rocketGroup.position, rocket.throttle * visualScale);
        }
        
        // 向量箭頭更新 (隨距離動態調整長度，避免遮擋全景)
        const arrowLen = Math.min(camOffsetDist * 0.4, Math.max(50, alt * 0.05));
        velArrow.position.copy(rocket.r); velArrow.setDirection(rocket.v.clone().normalize()); velArrow.setLength(arrowLen);
        thrustArrow.position.copy(rocket.r); thrustArrow.setDirection(thrustDir); thrustArrow.setLength(arrowLen * 0.7);
        velArrow.visible = (alt > 2000); thrustArrow.visible = (alt > 2000 && thrustMag > 0);

        updatePredictedOrbit(rocket);
        updateTelemetryValues();
    } else {
        if (velArrow) velArrow.visible = false;
        if (thrustArrow) thrustArrow.visible = false;
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
