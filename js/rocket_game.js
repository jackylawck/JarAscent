/**
 * js/rocket_game.js - JarAscent 3D 任務主控 (鏡頭鎖定主航天器與動態尾焰)
 * @license MIT
 */

const THREE = window.THREE;

import { 
    RocketState, rk4Step, executeGuidance, getOrbitalElements,
    getMoonPosition, R_EARTH, WORLD_SCALE
} from './physics_core.js';

import { ROCKET_MODELS } from './rockets_data.js';

import { 
    initRocketScene, setEnvironmentMode, switchRocketMesh, updateEnvironmentVisuals,
    triggerCatastrophicExplosion, updateExplosion, spawnDebrisPiece, updateDebris,
    spawnExhaustParticles, updateExhaustParticles,
    scene, camera, controls, renderer, rocketGroup,
    activeRocketParts, earthMesh, moonMesh, rocketLight
} from './rocket_engine.js';

let rocket = null;
let currentLang = 'zh';
let isAdvancedMode = false;
let customRocketStats = null;

let isPaused = false;
let userInteractingWithCamera = false;
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

const CAM_MODE = { LAUNCH_PAD: 0, LIFTOFF: 1, ASCEND: 2, MAX_Q: 3, STAGE_SEP: 4, ORBIT: 5, FREE: 6 };
let currentCamMode = CAM_MODE.LAUNCH_PAD;
let targetCamPos = new THREE.Vector3();
let targetLookAt = new THREE.Vector3();

let milestoneShown = { escape: false, boosters: false, fairing: false, stage2: false, orbit: false };

// ==================== 🔊 雙層高臨場感航天音效 ====================
let audioCtx = null;
let rocketNoiseSource = null;
let rocketSubOsc = null;
let mainThrustGain = null;
let subThrustGain = null;

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playBeepSound(freq = 880, duration = 0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function startRocketRumble() {
    if (!audioCtx || rocketNoiseSource) return;

    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 4.0;
    }

    rocketNoiseSource = audioCtx.createBufferSource();
    rocketNoiseSource.buffer = noiseBuffer;
    rocketNoiseSource.loop = true;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(220, audioCtx.currentTime);

    mainThrustGain = audioCtx.createGain();
    mainThrustGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    mainThrustGain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 0.8);

    rocketNoiseSource.connect(noiseFilter);
    noiseFilter.connect(mainThrustGain);
    mainThrustGain.connect(audioCtx.destination);
    rocketNoiseSource.start();

    rocketSubOsc = audioCtx.createOscillator();
    rocketSubOsc.type = 'sawtooth';
    rocketSubOsc.frequency.setValueAtTime(55, audioCtx.currentTime);

    const subFilter = audioCtx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(100, audioCtx.currentTime);

    subThrustGain = audioCtx.createGain();
    subThrustGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    subThrustGain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 0.8);

    rocketSubOsc.connect(subFilter);
    subFilter.connect(subThrustGain);
    subThrustGain.connect(audioCtx.destination);
    rocketSubOsc.start();
}

function updateRocketRumble(alt, thrustRatio) {
    if (!mainThrustGain || !audioCtx) return;
    const atmoRatio = Math.max(0, 1.0 - (alt / 80000));
    const targetGain = thrustRatio * atmoRatio * 0.65;
    mainThrustGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.1);
    if (subThrustGain) {
        subThrustGain.gain.setTargetAtTime(targetGain * 0.5, audioCtx.currentTime, 0.1);
    }
}

function stopRocketRumble() {
    if (mainThrustGain && audioCtx) {
        mainThrustGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        if (subThrustGain) subThrustGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        setTimeout(() => {
            if (rocketNoiseSource) { try { rocketNoiseSource.stop(); } catch(e){} rocketNoiseSource = null; }
            if (rocketSubOsc) { try { rocketSubOsc.stop(); } catch(e){} rocketSubOsc = null; }
        }, 500);
    }
}

function playStagingSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(450, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
}

function playExplosionSound() {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 1.5;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.3));
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 1.2);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}

function speakMissionCallout(text, lang = currentLang) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    window.speechSynthesis.speak(utterance);
}

const I18N = {
    zh: {
        title: "🚀 躍上穹蒼 3D", subtitle: "航太動力學、多級分離與 3D 打印沙盒", langBtn: "English",
        toggleUi: "📋 任務控制面板", toggleUiHide: "📋 展開任務控制",
        toggleDetailShow: "📊 展開深度科研", toggleDetailHide: "📉 收起深度科研",
        modeSimple: "🟢 簡易模式 (必定成功)", modeAdvanced: "🔴 進階模式 (硬核物理)",
        stlDrop: "🖨️ 拖曳或點擊上傳自製火箭 3D 打印檔 (.stl)",
        configTitle: "🛠️ 基礎發射設定", lblEnv: "發射場天色:", lblEngine: "火箭型號:",
        subProp: "🚀 推進與動力系統", lblPayload: "任務載荷艙:", lblFuel: "一級燃料加注 (%):", lblThrottle: "節流閥推力 (%):", lblOfRatio: "氧化劑/燃料混合比:",
        subGnc: "🧭 導航制導與控制 (GNC)", lblTurn: "轉向起始高度 (km):", lblTvc: "TVC 噴嘴響應靈敏度:",
        subEnv: "🌪️ 外部環境與電氣感測", lblWind: "高空切變風強度 (m/s):", lblDrift: "IMU 陀螺儀雜訊漂移:",
        launchBtn: "🔥 啟動 10 秒倒數發射 (Terminal T-10s)", resetBtn: "🔄 重設發射台 (Reset Pad)",
        btnPause: "⏸️ 暫停 (3D 檢視)", btnResume: "▶️ 繼續飛行",
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
        milestones: { 
            escape: "🚀 T+20s 拋掉逃逸塔 (Tower Jettison)!", 
            boosters: "⚡ T+45s 一級/助推器分離，二級點火 (Stage 1 Sep)!", 
            fairing: "✨ T+60s 拋整流罩 (Fairing Sep)!", 
            stage2: "🛰️ T+110s 二級熄火，入軌成功 (SECO)!", 
            orbit: "🏆 太陽翼展開，入軌圓滿成功!" 
        },
        speech: {
            numbers: ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"],
            ignition: "點火，起飛！",
            escape: "逃逸塔分離！",
            boosters: "一級分離！二級點火！",
            fairing: "整流罩分離！",
            orbit: "入軌圓滿成功！太陽翼展開！",
            abort: "警告，結構異常，任務中止！"
        }
    },
    en: {
        title: "🚀 JarAscent 3D", subtitle: "Aerospace Dynamics & 3D Print STL Sandbox", langBtn: "中文 (繁體)",
        toggleUi: "📋 Mission Control Panel", toggleUiHide: "📋 Expand Panel",
        toggleDetailShow: "📊 Expand Diagnostics", toggleDetailHide: "📉 Collapse Diagnostics",
        modeSimple: "🟢 Simple Mode (Safe)", modeAdvanced: "🔴 Advanced Mode (Hardcore)",
        stlDrop: "🖨️ Drag & Drop or Click to Upload 3D Print Rocket (.stl)",
        configTitle: "🛠️ Basic Launch Setup", lblEnv: "Launch Lighting:", lblEngine: "Launch Vehicle:",
        subProp: "🚀 Propulsion & Powertrain", lblPayload: "Payload Compartment:", lblFuel: "Stage 1 Fuel Load (%):", lblThrottle: "Engine Throttle (%):", lblOfRatio: "Oxidizer/Fuel Ratio (O/F):",
        subGnc: "🧭 Guidance, Navigation & Control (GNC)", lblTurn: "Pitch-over Altitude (km):", lblTvc: "TVC Gimbal Response Gain:",
        subEnv: "🌪️ Environment & Avionics", lblWind: "High-Alt Wind Shear (m/s):", lblDrift: "IMU Gyro Noise Drift:",
        launchBtn: "🔥 Initiate T-10s Terminal Countdown", resetBtn: "🔄 Reset Launch Pad",
        btnPause: "⏸️ Pause (3D Orbit)", btnResume: "▶️ Resume Flight",
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
        milestones: { 
            escape: "🚀 T+20s Tower Jettison!", 
            boosters: "⚡ T+45s Stage 1 Separation & S2 Ignition!", 
            fairing: "✨ T+60s Fairing Separation!", 
            stage2: "🛰️ T+110s Stage 2 Cutoff & Inserted!", 
            orbit: "🏆 Solar Panels Deployed. Orbit Complete!" 
        },
        speech: {
            numbers: ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"],
            ignition: "Main engine ignition... Liftoff!",
            escape: "Launch escape tower jettison confirmed.",
            boosters: "Stage one separation confirmed. Stage two ignition.",
            fairing: "Fairing separation confirmed.",
            orbit: "Orbital insertion nominal! Mission successful!",
            abort: "Warning! Structural failure. Mission abort!"
        }
    }
};

function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function updateStatus(text, color="#38bdf8") { const el = document.getElementById('flight-status'); if (el) { el.innerText = text; el.style.color = color; } }

function showMilestone(text, color) {
    const el = document.createElement('div');
    el.style.cssText = `position: fixed; top: 25%; left: 50%; transform: translate(-50%, -50%); font-size: 1.6rem; font-weight: 900; color: ${color}; text-shadow: 0 0 20px ${color}, 0 0 40px rgba(0,0,0,0.8); pointer-events: none; z-index: 300; letter-spacing: 1px; animation: milestonePop 2.5s ease-out forwards; font-family: 'Courier New', monospace; text-align: center; width: 90vw;`;
    el.innerText = text; document.body.appendChild(el); setTimeout(() => el.remove(), 2500);
}

function computeSTLProperties(geometry) {
    const pos = geometry.attributes.position.array;
    let volume = 0;
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();

    for (let i = 0; i < pos.length; i += 9) {
        p1.set(pos[i], pos[i+1], pos[i+2]);
        p2.set(pos[i+3], pos[i+4], pos[i+5]);
        p3.set(pos[i+6], pos[i+7], pos[i+8]);
        volume += p1.dot(p2.cross(p3)) / 6.0;
    }
    volume = Math.abs(volume);

    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const targetHeightM = 60.0;
    const currentHeight = size.y || 1.0;
    const scaleFactor = targetHeightM / currentHeight;

    const radiusEst = (size.x + size.z) / 4.0 * scaleFactor;
    const frontalArea = Math.PI * radiusEst * radiusEst;
    const estDryMass = Math.max(15000, Math.min(80000, volume * scaleFactor * 0.15));

    return {
        heightM: targetHeightM,
        dryMassStage1: Math.round(estDryMass * 0.8),
        fuelMassStage1: Math.round(estDryMass * 9.5),
        dryMassStage2: Math.round(estDryMass * 0.2),
        fuelMassStage2: Math.round(estDryMass * 2.2),
        thrustSea: Math.round(estDryMass * 180),
        thrustVac: Math.round(estDryMass * 200),
        ispSea: 290, ispVac: 318,
        thrustStage2: Math.round(estDryMass * 35),
        frontalArea: frontalArea.toFixed(2),
        scaleFactor: scaleFactor
    };
}

function handleSTLFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.stl')) {
        alert(currentLang === 'zh' ? '請上傳有效的 3D 打印 .stl 檔案！' : 'Please upload a valid .stl 3D print file!');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loader = new THREE.STLLoader();
            const geometry = loader.parse(e.target.result);
            geometry.center();

            const stats = computeSTLProperties(geometry);
            customRocketStats = stats;

            const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8, roughness: 0.2 });
            const mesh = new THREE.Mesh(geometry, mat);

            const visualScale = 0.1;
            mesh.scale.set(visualScale, visualScale, visualScale);
            geometry.computeBoundingBox();
            mesh.position.y = (geometry.boundingBox.max.y - geometry.boundingBox.min.y) * visualScale * 0.5 + 0.6;

            while (rocketGroup.children.length > 0) rocketGroup.remove(rocketGroup.children[0]);
            
            const customGroup = new THREE.Group();
            customGroup.add(mesh);
            rocketGroup.add(customGroup);

            const grpCustom = document.getElementById('grp-custom');
            if (grpCustom) grpCustom.style.display = 'block';
            document.getElementById('sel-engine').value = 'CUSTOM_STL';

            const infoBox = document.getElementById('stl-info');
            if (infoBox) {
                infoBox.style.display = 'block';
                infoBox.innerHTML = `✅ <b>${file.name}</b> 解析成功！<br>• 乾重: ${(stats.dryMassStage1+stats.dryMassStage2)/1000}t | 起飛推力: ${(stats.thrustSea/1000).toFixed(0)}kN<br>• 截面積: ${stats.frontalArea}m² | 氣動外形已載入`;
            }
            
            updateStatus(currentLang === 'zh' ? `✅ 自訂 3D 打印模型 [${file.name}] 裝載完成！` : `✅ Custom STL Model [${file.name}] Armed!`, "#10b981");

        } catch (err) {
            console.error(err);
            alert(currentLang === 'zh' ? '解析 STL 失敗，請確認檔案格式是否正確。' : 'Failed to parse STL file.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function applyLanguageUI() {
    const t = I18N[currentLang];
    setText('ui-title', t.title); setText('ui-subtitle', t.subtitle); setText('btn-lang', t.langBtn);
    setText('btn-toggle-ui', isUIVisible ? t.toggleUi : t.toggleUiHide);
    setText('btn-toggle-details', isDetailTelemetryVisible ? t.toggleDetailHide : t.toggleDetailShow);
    setText('lbl-mode', isAdvancedMode ? t.modeAdvanced : t.modeSimple);
    const modeEl = document.getElementById('lbl-mode');
    if (modeEl) modeEl.style.color = isAdvancedMode ? '#ef4444' : '#10b981';
    
    const pauseEl = document.getElementById('btn-pause');
    if (pauseEl) pauseEl.innerText = isPaused ? t.btnResume : t.btnPause;

    setText('lbl-stl-drop', t.stlDrop);
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
        rocket.failureReason = currentLang === 'zh' ? "推重比不足 (TWR < 1.05)，無法離地並在發射台過熱引爆" : "PAD TWR OVERLOAD: Insufficient thrust to lift mass.";
        playExplosionSound();
        stopRocketRumble();
        speakMissionCallout(I18N[currentLang].speech.abort);
        triggerCatastrophicExplosion(visualPos); cameraShake = 4.0; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
    if (Math.abs(rocket.ofRatio - 1.0) > 0.16) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "氧化劑/燃料混合比嚴重失調，燃燒室壓力劇烈震盪引爆" : "O/F RATIO ANOMALY: Severe mixture imbalance.";
        playExplosionSound();
        stopRocketRumble();
        speakMissionCallout(I18N[currentLang].speech.abort);
        triggerCatastrophicExplosion(visualPos); cameraShake = 4.0; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
    const windStress = (rocket.windShear / 15.0);
    if (dynQkPa * windStress > 55.0 && alt < 20000) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? `動態氣壓與切變風疊加突破極限 (${(dynQkPa*windStress).toFixed(1)} kPa)，箭體空中氣動剪切斷裂` : `AERODYNAMIC SHEAR FAILURE: Exceeded 55 kPa envelope.`;
        playExplosionSound();
        stopRocketRumble();
        speakMissionCallout(I18N[currentLang].speech.abort);
        triggerCatastrophicExplosion(visualPos); cameraShake = 3.5; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
    if (rocket.tvcGain > 1.35 && speed > 200 && alt < 25000) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "TVC 噴嘴靈敏度過高引發高頻震顫，箭體結構共振空中解體" : "CONTROL RESONANCE: Excessive TVC gain induced fatal flutter.";
        playExplosionSound();
        stopRocketRumble();
        speakMissionCallout(I18N[currentLang].speech.abort);
        triggerCatastrophicExplosion(visualPos); cameraShake = 3.5; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
    if (rocket.currentGForce > 5.5 && rocket.flightTime > 10) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? `加速度過載超過 5.5 G (${rocket.currentGForce.toFixed(2)} G)，結構被擠壓破壞` : `G-FORCE OVERLOAD: Structural envelope exceeded 5.5 G.`;
        playExplosionSound();
        stopRocketRumble();
        speakMissionCallout(I18N[currentLang].speech.abort);
        triggerCatastrophicExplosion(visualPos); cameraShake = 3.0; showMissionDebrief(getOrbitalElements(rocket)); return;
    }
}

// 🛰️ 真實多級分離時序 + 鏡頭平滑跟隨主航天器
function handleMultiStageSeparation(rocket) {
    if (rocket.isDestroyed) return;
    const t = rocket.flightTime;
    const ms = I18N[currentLang].milestones;
    const sp = I18N[currentLang].speech;

    const forwardVec = rocket.thrustDir.clone().normalize();
    const upVec = rocket.r.clone().normalize();
    let lateralVec = new THREE.Vector3().crossVectors(forwardVec, upVec).normalize();
    if (lateralVec.lengthSq() < 0.1) lateralVec.set(1, 0, 0);

    // 1. T+20s: 拋逃逸塔
    if (t >= 20 && !rocket.escapeTowerSeparated) {
        rocket.escapeTowerSeparated = true;
        if (activeRocketParts && activeRocketParts.escapeTower) {
            const escapeImpulse = forwardVec.clone().multiplyScalar(40.0);
            spawnDebrisPiece(rocket, activeRocketParts.escapeTower, escapeImpulse);
            activeRocketParts.escapeTower.visible = false;
        }
        playStagingSound();
        showMilestone(ms.escape, "#ef4444");
        speakMissionCallout(sp.escape);
    }

    // 2. T+45s: 一級芯級與助推器脫落，二級接力
    if (t >= 45 && !rocket.boostersSeparated) {
        rocket.boostersSeparated = true;
        rocket.stage = 2;
        
        const retroImpulse = forwardVec.clone().multiplyScalar(-10.0);
        if (activeRocketParts && activeRocketParts.stage1) {
            spawnDebrisPiece(rocket, activeRocketParts.stage1, retroImpulse);
            activeRocketParts.stage1.visible = false;
        }
        if (activeRocketParts && activeRocketParts.boosters) {
            const outImpulse = retroImpulse.clone().add(lateralVec.clone().multiplyScalar(10.0));
            spawnDebrisPiece(rocket, activeRocketParts.boosters, outImpulse);
            activeRocketParts.boosters.visible = false;
        }

        playStagingSound();
        bulletTimeTimer = 2.0;
        showMilestone(ms.boosters, "#f59e0b");
        speakMissionCallout(sp.boosters);
    }

    // 3. T+60s: 蚌殼式整流罩分離
    if (t >= 60 && !rocket.fairingSeparated) {
        rocket.fairingSeparated = true;
        
        if (activeRocketParts && activeRocketParts.fairingL) {
            spawnDebrisPiece(rocket, activeRocketParts.fairingL, lateralVec.clone().multiplyScalar(-16.0));
            activeRocketParts.fairingL.visible = false;
        }
        if (activeRocketParts && activeRocketParts.fairingR) {
            spawnDebrisPiece(rocket, activeRocketParts.fairingR, lateralVec.clone().multiplyScalar(16.0));
            activeRocketParts.fairingR.visible = false;
        }

        playStagingSound();
        showMilestone(ms.fairing, "#38bdf8");
        speakMissionCallout(sp.fairing);
    }

    // 4. T+110s: 二級入軌
    if (t >= 110 && !rocket.stage2Separated) {
        rocket.stage2Separated = true;
        rocket.missionAccomplished = true;
        rocket.throttle = 0;
        stopRocketRumble();
        showMilestone(ms.stage2, "#10b981");
        updateStatus(I18N[currentLang].orbitSuccess, "#10b981");
        speakMissionCallout(sp.orbit);
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
    
    const altEl = document.getElementById('hud-alt');
    if (altEl) {
        if (alt < 30000) altEl.style.color = '#f97316';
        else if (alt < 100000) altEl.style.color = '#fbbf24';
        else altEl.style.color = '#38bdf8';
    }

    const dynQkPa = (0.5 * 1.225 * Math.exp(-alt/8500) * airSpeed * airSpeed / 1000);
    const qBar = document.getElementById('gauge-q-bar');
    if (qBar) qBar.style.width = `${Math.min(100, (dynQkPa / 55) * 100)}%`;
    setText('gauge-q-txt', `${dynQkPa.toFixed(1)} kPa`);

    const currentTwr = rocket.getThrustVector().length() / (rocket.getCurrentMass() * 9.80665);
    setText('t-twr', currentTwr.toFixed(2));
    setText('t-thrust', `${(rocket.getThrustVector().length()/1000).toFixed(0)} kN`);

    let stageName = `${rocket.engine ? (currentLang==='zh'?rocket.engine.name:rocket.engine.nameEn) : 'Custom STL'} (${t.ascending})`;
    if (rocket.isDestroyed) stageName = "💥 CATASTROPHIC FAILURE";
    else if (rocket.stage2Separated) stageName = "🛰️ 300km Orbit Cruise";
    else if (rocket.stage === 2) stageName = "Stage 2 Upper Stage";
    setText('t-stage-name', stageName);
    setText('t-orbit', orbit.isOrbital ? t.stableOrbit : t.ascending);

    if (isDetailTelemetryVisible) {
        setText('t-gforce', `${rocket.currentGForce.toFixed(2)} G`);
        setText('t-isp', rocket.flightTime > 0 ? `${Math.round(rocket.getIsp())} s` : '—');
        setText('t-peri', (orbit.periapsis > 0) ? `${(orbit.periapsis/1000).toFixed(1)} km` : '0.0 km');
        setText('t-apo', (orbit.apoapsis > 0) ? `${(orbit.apoapsis/1000).toFixed(1)} km` : '0.0 km');
        setText('t-ecc', orbit.isOrbital ? orbit.eccentricity.toFixed(4) : '—');
    }

    if (rocket.missionAccomplished && !milestoneShown.orbit) { 
        milestoneShown.orbit = true; 
        showMissionDebrief(orbit); 
    }
}

function showMissionDebrief(orbit) {
    const modal = document.getElementById('debrief-modal'); 
    if (!modal || modal.style.display === 'flex') return; 
    modal.style.display = 'flex';

    const periapsisVal = orbit && !isNaN(orbit.periapsis) ? orbit.periapsis : 300000;
    const apoapsisVal = orbit && !isNaN(orbit.apoapsis) ? orbit.apoapsis : 300000;
    const periErr = Math.abs(periapsisVal - 300000) / 1000;

    setText('stat-maxvel', `${rocket.maxVelocity.toFixed(1)} m/s`);
    setText('stat-maxq', `${(rocket.maxQ / 1000).toFixed(1)} kPa`);
    setText('stat-peri-err', `${periErr.toFixed(1)} km`);
    setText('stat-orbit-alt', `${(periapsisVal/1000).toFixed(1)} km x ${(apoapsisVal/1000).toFixed(1)} km`);
    const fuelLeft = Math.round((rocket.fuel2 / (rocket.engine ? rocket.engine.fuelMassStage2 : 90000)) * 100);
    setText('stat-fuel-left', `${fuelLeft}%`);
    
    const rankEl = document.getElementById('debrief-rank');
    if (rocket.isDestroyed) {
        if (rankEl) { rankEl.innerText = "FAIL"; rankEl.style.color = "#ef4444"; }
        setText('debrief-title', I18N[currentLang].abortTitle); 
        setText('stat-status', rocket.failureReason || "Structural RUD");
    } else if (orbit && orbit.isOrbital) {
        if (rankEl) { rankEl.innerText = "S"; rankEl.style.color = "#fbbf24"; }
        setText('debrief-title', currentLang === 'zh' ? "🏆 完美入軌" : "🏆 Nominal Insertion");
        setText('stat-status', currentLang === 'zh' ? "入軌成功" : "Inserted successfully");
    } else {
        if (rankEl) { rankEl.innerText = "B"; rankEl.style.color = "#94a3b8"; }
        setText('debrief-title', currentLang === 'zh' ? "🚀 次軌道試射完成" : "🚀 Suborbital Completed");
        setText('stat-status', currentLang === 'zh' ? "入軌前燃料耗盡" : "Propellant depleted");
    }
}

function startCountdownSequence() {
    if (isCountingDown) return;
    isCountingDown = true; countdownTime = 10;
    initAudioContext();
    const hud = document.getElementById('countdown-hud');
    if (hud) hud.style.display = 'flex';
    
    isUIVisible = false;
    const box = document.getElementById('ui-overlay-box');
    if (box) box.classList.add('collapsed');
    setText('btn-toggle-ui', I18N[currentLang].toggleUiHide);
    
    speakMissionCallout(I18N[currentLang].speech.numbers[10]);

    const timerInterval = setInterval(() => {
        countdownTime--;
        setText('countdown-timer', `T-${countdownTime}`);
        
        if (countdownTime <= 3 && countdownTime > 0) {
            playBeepSound(1200, 0.15);
        } else if (countdownTime > 3) {
            playBeepSound(700, 0.08);
        }

        if (countdownTime > 0) {
            speakMissionCallout(I18N[currentLang].speech.numbers[countdownTime]);
        }

        if (countdownTime <= 0) { 
            clearInterval(timerInterval); 
            if (hud) hud.style.display = 'none'; 
            speakMissionCallout(I18N[currentLang].speech.ignition);
            startRocketRumble();
            executeLiftoff(); 
        }
    }, 1000);
}

function executeLiftoff() {
    const selEngine = document.getElementById('sel-engine');
    let engKey = selEngine ? selEngine.value : "CZ10A";
    
    const elPayload = document.getElementById('sel-payload');
    const elFuel = document.getElementById('rng-fuel');
    const elThrottle = document.getElementById('rng-throttle');
    const elOfRatio = document.getElementById('rng-ofratio');
    const elTurn = document.getElementById('rng-turn');
    const elTvc = document.getElementById('rng-tvc');
    const elWind = document.getElementById('rng-wind');
    const elDrift = document.getElementById('rng-drift');

    let payload = isAdvancedMode ? (parseInt(elPayload ? elPayload.value : 8000, 10) || 8000) : 8000;
    let fuelFactor = isAdvancedMode ? ((parseInt(elFuel ? elFuel.value : 100, 10) || 100) / 100) : 1.0;
    let throttle = isAdvancedMode ? ((parseInt(elThrottle ? elThrottle.value : 100, 10) || 100) / 100) : 1.0;
    let ofRatio = isAdvancedMode ? ((parseInt(elOfRatio ? elOfRatio.value : 100, 10) || 100) / 100) : 1.0;
    let turnAltKm = isAdvancedMode ? (parseInt(elTurn ? elTurn.value : 8, 10) || 8) : 8;
    let tvcGain = isAdvancedMode ? ((parseInt(elTvc ? elTvc.value : 100, 10) || 100) / 100) : 1.0;
    let windShear = isAdvancedMode ? (parseInt(elWind ? elWind.value : 0, 10) || 0) : 0;
    let driftNoise = isAdvancedMode ? ((parseInt(elDrift ? elDrift.value : 0, 10) || 0) / 100) : 0;

    rocket = new RocketState();

    if (engKey === 'CUSTOM_STL' && customRocketStats) {
        rocket.engine = {
            name: "自訂 3D 打印火箭", nameEn: "Custom STL Rocket",
            ...customRocketStats
        };
        rocket.payloadMass = payload;
        rocket.fuel1 = customRocketStats.fuelMassStage1 * fuelFactor;
        rocket.fuel2 = customRocketStats.fuelMassStage2;
        rocket.gravityTurnAlt = turnAltKm * 1000;
    } else {
        rocket.initEngine(engKey, payload, fuelFactor, turnAltKm, ofRatio, tvcGain, windShear, driftNoise);
    }

    rocket.throttle = throttle;
    rocket.isLaunched = true;
    rocket.guidanceActive = true;
    cameraShake = 2.5;
    updateStatus(I18N[currentLang].liftoff, "#38bdf8");
}

function bindUI() {
    const btnLaunch = document.getElementById('btn-launch');
    if (btnLaunch) btnLaunch.onclick = startCountdownSequence;
    
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.onclick = () => location.reload();
    
    const selEnv = document.getElementById('sel-env');
    if (selEnv) selEnv.onchange = (e) => setEnvironmentMode(e.target.value);
    
    const selEngine = document.getElementById('sel-engine');
    if (selEngine) {
        selEngine.onchange = (e) => {
            if (e.target.value !== 'CUSTOM_STL') switchRocketMesh(e.target.value);
        };
    }

    const btnLang = document.getElementById('btn-lang');
    if (btnLang) {
        btnLang.onclick = () => { currentLang = currentLang === 'zh' ? 'en' : 'zh'; applyLanguageUI(); };
    }

    const chkAdv = document.getElementById('chk-advanced-mode');
    if (chkAdv) {
        chkAdv.onchange = (e) => {
            isAdvancedMode = e.target.checked;
            const advBox = document.getElementById('advanced-config');
            if (advBox) advBox.style.display = isAdvancedMode ? 'block' : 'none';
            applyLanguageUI();
        };
    }

    const btnPause = document.getElementById('btn-pause');
    const togglePause = () => {
        isPaused = !isPaused;
        if (btnPause) {
            btnPause.innerText = isPaused ? I18N[currentLang].btnResume : I18N[currentLang].btnPause;
            btnPause.style.background = isPaused ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.2)";
            btnPause.style.borderColor = isPaused ? "#10b981" : "#f59e0b";
            btnPause.style.color = isPaused ? "#34d399" : "#fbbf24";
        }
        if (isPaused) {
            stopRocketRumble();
            currentCamMode = CAM_MODE.FREE;
        } else {
            if (rocket && rocket.isLaunched && !rocket.isDestroyed) startRocketRumble();
        }
    };
    if (btnPause) btnPause.onclick = togglePause;
    window.addEventListener('keydown', (e) => { if (e.code === 'Space') togglePause(); });

    if (controls) {
        controls.addEventListener('start', () => { userInteractingWithCamera = true; });
        controls.addEventListener('end', () => { setTimeout(() => { userInteractingWithCamera = false; }, 2500); });
    }

    const dropZone = document.getElementById('stl-drop-zone');
    const fileInput = document.getElementById('stl-file-input');
    if (dropZone && fileInput) {
        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => { if (e.target.files.length > 0) handleSTLFile(e.target.files[0]); };

        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
        dropZone.ondragleave = () => dropZone.classList.remove('dragover');
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) handleSTLFile(e.dataTransfer.files[0]);
        };
    }

    const toggleUiBtn = document.getElementById('btn-toggle-ui');
    if (toggleUiBtn) {
        toggleUiBtn.onclick = () => {
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
        };
    }

    const updateTimeDisplay = () => setText('time-scale-display', `${I18N[currentLang].timeScalePrefix}${timeScale.toFixed(1)}x`);
    const btnSlower = document.getElementById('btn-time-slower');
    if (btnSlower) btnSlower.onclick = () => { timeScale = Math.max(0.5, timeScale / 1.5); updateTimeDisplay(); };
    const btnFaster = document.getElementById('btn-time-faster');
    if (btnFaster) btnFaster.onclick = () => { timeScale = Math.min(100, timeScale * 1.5); updateTimeDisplay(); };
}

function gameLoop(now) {
    requestAnimationFrame(gameLoop);
    let dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (isPaused) {
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
        return;
    }

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
        updateExhaustParticles(dt * currentEffectiveTimeScale);

        const alt = Math.max(0, rocket.r.length() - R_EARTH);
        const speed = rocket.v.length();
        
        const thrustMag = rocket.getThrustVector().length();
        updateRocketRumble(alt, thrustMag > 0 ? (rocket.throttle || 1.0) : 0.0);
        updateEnvironmentVisuals(alt);
        
        const visualAlt = (alt < 5000) ? 0.4 + (alt * 0.035) : 0.4 + (5000 * 0.035) + (alt - 5000) * WORLD_SCALE;
        const visualPos = rocket.r.clone().normalize().multiplyScalar(1000 + visualAlt);
        const visualScale = (alt < 5000) ? 1.0 : Math.min(10.0, 1.0 + Math.log10(1 + (alt - 5000) / 1000) * 3.5);
            
        rocketGroup.scale.set(visualScale, visualScale, visualScale);
        rocketGroup.position.copy(visualPos);
        
        const thrustDir = rocket.thrustDir.clone().normalize();
        rocketGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), thrustDir);

        // 🎯 計算當前點火發動機的真實世界坐標 (一級底部 vs 二級底部)
        const nozzleOffset = (rocket.stage === 2) ? 3.5 * visualScale : 0.2 * visualScale;
        const currentNozzlePos = visualPos.clone().add(thrustDir.clone().multiplyScalar(nozzleOffset));

        // 🎯 鏡頭永遠精確鎖定主飛行器（第二級/太空船中心）
        const craftFocusPos = visualPos.clone().add(thrustDir.clone().multiplyScalar(4.5 * visualScale));

        if (!userInteractingWithCamera) {
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
                    targetCamPos.copy(craftFocusPos.clone().add(new THREE.Vector3(-14 + shakeX, 4 + shakeY, 14)));
                    targetLookAt.copy(craftFocusPos); break;
                case CAM_MODE.MAX_Q:
                    targetCamPos.copy(craftFocusPos.clone().add(new THREE.Vector3(26 + shakeX, 3 + shakeY, 0)));
                    targetLookAt.copy(craftFocusPos); break;
                case CAM_MODE.STAGE_SEP:
                    targetCamPos.copy(craftFocusPos.clone().add(new THREE.Vector3(12 * Math.cos(now * 0.002), -2, 12 * Math.sin(now * 0.002))));
                    targetLookAt.copy(craftFocusPos); break;
                case CAM_MODE.ORBIT:
                    const safeA = (orbit && !isNaN(orbit.semiMajorAxis) && orbit.semiMajorAxis > 0) ? orbit.semiMajorAxis : 6678137;
                    const orbitCamDist = Math.max(400, safeA * WORLD_SCALE * 1.1);
                    targetCamPos.copy(craftFocusPos.clone().add(new THREE.Vector3(0, orbitCamDist * 0.4, orbitCamDist)));
                    targetLookAt.set(0, 0, 0); break;
                case CAM_MODE.ASCEND:
                default:
                    let camDist = (alt < 2000) ? 22 + alt * 0.012 : 50;
                    targetCamPos.copy(craftFocusPos.clone().add(new THREE.Vector3(camDist * 0.35 + shakeX, camDist * 0.15 + shakeY, camDist * 0.75)));
                    targetLookAt.copy(craftFocusPos); break;
            }

            camera.position.lerp(targetCamPos, 0.08); 
            controls.target.lerp(targetLookAt, 0.1);
        } else {
            controls.target.copy(craftFocusPos);
        }

        // 🔥 動態發射尾焰（一級橘紅大氣火焰 / 二級深藍真空羽流）
        if (thrustMag > 1000) {
            spawnExhaustParticles(currentNozzlePos, thrustDir, rocket.throttle || 1.0, rocket.stage === 2, alt > 35000);
            if (rocketLight) { rocketLight.position.copy(currentNozzlePos); rocketLight.intensity = 7.0; }
        } else {
            if (rocketLight) rocketLight.intensity = 0.0;
        }
        
        updatePredictedOrbit(rocket);
        updateTelemetryValues();
    } else {
        stopRocketRumble();
        if (rocketGroup && !rocket) { rocketGroup.quaternion.set(0, 0, 0, 1); rocketGroup.position.set(0, 1000.4, 0); }
        if (machConeMesh) machConeMesh.visible = false;
        if (rocketLight) rocketLight.intensity = 0.0;
    }

    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
    initRocketScene(document.getElementById('canvas-container'));
    bindUI(); 
    applyLanguageUI();
    window.addEventListener('resize', () => {
        if (camera && renderer) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    });
    gameLoop(performance.now());
});
