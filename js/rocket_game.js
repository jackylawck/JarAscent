/**
 * js/rocket_game.js - JarAscent 3D 任務主控與多維度參數故障模擬
 * @license MIT
 */

const THREE = window.THREE;

// ==================== 1. 物理常數 ====================
const MU = 3.986004418e14;
const MU_MOON = 4.9048695e12;
const R_EARTH = 6378137;
const R_MOON = 1737400;
const MOON_ORBIT_RADIUS = 384400000;
const ROTATION_SPEED = 7.292115e-5;
const J2 = 1.08262668e-3;
const WORLD_SCALE = 1000 / R_EARTH;

function getMoonPosition(time) {
    const angularSpeed = 2 * Math.PI / (27.322 * 86400);
    const angle = angularSpeed * time;
    return new THREE.Vector3(MOON_ORBIT_RADIUS * Math.cos(angle), 0, MOON_ORBIT_RADIUS * Math.sin(angle));
}

// ==================== 2. 火箭數據庫 ====================
const ROCKET_MODELS = Object.freeze({
    CZ10A: {
        name: "長征十號甲 (CZ-10A 登月載人)", nameEn: "Long March 10A (CZ-10A Lunar)",
        heightM: 67, stages: 2, hasTower: true, hasBoosters: false,
        thrustSea: 7500000, thrustVac: 8200000, ispSea: 288, ispVac: 315,
        dryMassStage1: 35000, fuelMassStage1: 420000, dryMassStage2: 6000, fuelMassStage2: 95000, thrustStage2: 1200000,
        colorTheme: { body: 0xf8fafc, accent: 0xdc2626, ring: 0x0f172a, payload: 0xfbbf24 }
    },
    CZ12B: {
        name: "長征十二號乙 (CZ-12B 4米級)", nameEn: "Long March 12B (CZ-12B 4m)",
        heightM: 62, stages: 2, hasTower: false, hasBoosters: false,
        thrustSea: 4800000, thrustVac: 5200000, ispSea: 295, ispVac: 320,
        dryMassStage1: 24000, fuelMassStage1: 380000, dryMassStage2: 4500, fuelMassStage2: 80000, thrustStage2: 850000,
        colorTheme: { body: 0xf8fafc, accent: 0x0284c7, ring: 0xdc2626, payload: 0xf8fafc }
    },
    TL3: {
        name: "天龍三號 (TL-3 大型液體)", nameEn: "Tianlong-3 (TL-3 Large Liquid)",
        heightM: 71, stages: 2, hasTower: false, hasBoosters: false,
        thrustSea: 7700000, thrustVac: 8400000, ispSea: 285, ispVac: 312,
        dryMassStage1: 36000, fuelMassStage1: 530000, dryMassStage2: 5000, fuelMassStage2: 90000, thrustStage2: 1100000,
        colorTheme: { body: 0xf8fafc, accent: 0x0f172a, ring: 0xdc2626, payload: 0xf8fafc }
    },
    LJ2: {
        name: "力箭二號 (LJ-2 捆綁液體)", nameEn: "Lijian-2 (LJ-2 Boosted)",
        heightM: 53, stages: 2, hasTower: false, hasBoosters: true, boosterCount: 2,
        thrustSea: 6600000, thrustVac: 7100000, ispSea: 280, ispVac: 308,
        dryMassStage1: 32000, fuelMassStage1: 420000, dryMassStage2: 4500, fuelMassStage2: 70000, thrustStage2: 800000,
        colorTheme: { body: 0xf8fafc, accent: 0x0284c7, ring: 0x0f172a, payload: 0xf8fafc }
    },
    YL1: {
        name: "引力一號 (Gravity-1 全固體)", nameEn: "Gravity-1 (YL-1 All-Solid)",
        heightM: 42, stages: 3, hasTower: false, hasBoosters: true, boosterCount: 4,
        thrustSea: 6000000, thrustVac: 6400000, ispSea: 245, ispVac: 275,
        dryMassStage1: 45000, fuelMassStage1: 360000, dryMassStage2: 8000, fuelMassStage2: 40000, thrustStage2: 1200000,
        colorTheme: { body: 0xf8fafc, accent: 0x1e3a8a, ring: 0xf59e0b, payload: 0xf8fafc }
    },
    SQX3: {
        name: "雙曲線三號 (Hyperbola-3)", nameEn: "Hyperbola-3 (SQX-3 Reusable)",
        heightM: 69, stages: 2, hasTower: false, hasBoosters: false,
        thrustSea: 7600000, thrustVac: 8300000, ispSea: 325, ispVac: 360,
        dryMassStage1: 34000, fuelMassStage1: 490000, dryMassStage2: 5000, fuelMassStage2: 85000, thrustStage2: 1000000,
        colorTheme: { body: 0x0f172a, accent: 0xdc2626, ring: 0xf8fafc, payload: 0xf8fafc }
    },
    STARSHIP: {
        name: "星艦全系統 (Starship 120m)", nameEn: "Starship Full Stack (120m)",
        heightM: 120, stages: 2, hasTower: false, hasBoosters: false,
        thrustSea: 75000000, thrustVac: 82000000, ispSea: 327, ispVac: 363,
        dryMassStage1: 200000, fuelMassStage1: 3400000, dryMassStage2: 100000, fuelMassStage2: 1200000, thrustStage2: 14700000,
        colorTheme: { body: 0xe2e8f0, accent: 0x0f172a, ring: 0x0f172a, payload: 0x0f172a }
    },
    SATURN_V: {
        name: "土星五號 (Saturn V 110m)", nameEn: "Saturn V (Apollo 110m)",
        heightM: 110, stages: 3, hasTower: true, hasBoosters: false,
        thrustSea: 34500000, thrustVac: 38700000, ispSea: 263, ispVac: 304,
        dryMassStage1: 130000, fuelMassStage1: 2160000, dryMassStage2: 40000, fuelMassStage2: 480000, thrustStage2: 5115000,
        colorTheme: { body: 0xf8fafc, accent: 0x0f172a, ring: 0x0f172a, payload: 0xf8fafc }
    },
    CZ2F: {
        name: "長征二號F (CZ-2F 載人型)", nameEn: "Long March 2F (CZ-2F Shenzhou)",
        heightM: 58, stages: 2, hasTower: true, hasBoosters: true, boosterCount: 4,
        thrustSea: 5920000, thrustVac: 6500000, ispSea: 289, ispVac: 315,
        dryMassStage1: 30000, fuelMassStage1: 450000, dryMassStage2: 5500, fuelMassStage2: 90000, thrustStage2: 742000,
        colorTheme: { body: 0xf8fafc, accent: 0xdc2626, ring: 0x0284c7, payload: 0xfbbf24 }
    }
});

// ==================== 3. 推進動力與多維度參數飛行狀態 ====================
class RocketState {
    constructor() {
        this.r = new THREE.Vector3(0, R_EARTH, 0);
        this.v = new THREE.Vector3(0, 0, 0);
        this.mass = 0;
        this.fuel1 = 0;
        this.fuel2 = 0;
        this.stage = 1;
        this.payloadMass = 0;
        this.engine = null;
        this.thrustDir = new THREE.Vector3(0, 1, 0);
        this.throttle = 1.0;
        this.gravityTurnAlt = 8000;
        this.flightTime = 0;
        this.isLaunched = false;
        this.isDestroyed = false;
        this.failureReason = null;
        
        // 進階工程維度參數
        this.ofRatio = 1.0; // 混合比 (1.0 = 最佳)
        this.tvcGain = 1.0;  // TVC 響應倍率
        this.windShear = 15; // 切變風 (m/s)
        this.driftNoise = 0.1; // IMU 漂移

        this.escapeTowerSeparated = false;
        this.boostersSeparated = false;
        this.fairingSeparated = false;
        this.stage2Separated = false;

        this.guidanceActive = false;
        this.targetPeriapsis = 300000;
        this.targetApoapsis = 300000;
        this.missionAccomplished = false;
        
        this.maxVelocity = 0;
        this.maxQ = 0;
        this.currentGForce = 1.0;
        this.relativeAirSpeed = 0;
    }

    initEngine(engineKey, payloadMass, fuelFactor = 1.0, turnAltKm = 8, ofRatio = 1.0, tvcGain = 1.0, windShear = 15, driftNoise = 0.1) {
        const DB = ROCKET_MODELS[engineKey] || ROCKET_MODELS.CZ10A;
        this.engine = DB;
        this.payloadMass = payloadMass;
        this.fuel1 = DB.fuelMassStage1 * fuelFactor;
        this.fuel2 = DB.fuelMassStage2;
        this.thrustDir.set(0, 1, 0);
        this.gravityTurnAlt = turnAltKm * 1000;
        this.ofRatio = ofRatio;
        this.tvcGain = tvcGain;
        this.windShear = windShear;
        this.driftNoise = driftNoise;
    }

    getCurrentMass() {
        return (this.stage === 1) 
            ? this.engine.dryMassStage1 + this.engine.dryMassStage2 + this.payloadMass + this.fuel1 + this.fuel2
            : this.engine.dryMassStage2 + this.payloadMass + this.fuel2;
    }

    getThrustVector() {
        if (this.isDestroyed) return new THREE.Vector3(0,0,0);
        if (this.stage === 1 && this.fuel1 <= 0) return new THREE.Vector3(0,0,0);
        if (this.stage === 2 && this.fuel2 <= 0) return new THREE.Vector3(0,0,0);
        if (this.missionAccomplished) return new THREE.Vector3(0,0,0);

        const alt = this.r.length() - R_EARTH;
        const altRatio = Math.min(1, Math.max(0, alt / 80000));
        let baseThrust = (this.stage === 1) 
            ? this.engine.thrustSea + (this.engine.thrustVac - this.engine.thrustSea) * altRatio
            : this.engine.thrustStage2;

        // 混合比失調導致推力下降
        const ofPenalty = Math.max(0.6, 1.0 - Math.abs(this.ofRatio - 1.0) * 1.5);
        baseThrust *= ofPenalty;

        if (this.guidanceActive && this.stage === 2) {
            const orbit = getOrbitalElements(this);
            const periError = (orbit.periapsis - this.targetPeriapsis) / this.targetPeriapsis;
            const apoError = (orbit.apoapsis - this.targetApoapsis) / this.targetApoapsis;
            if (periError > -0.02 && apoError > -0.02) {
                const taper = Math.max(0.1, 1.0 - (periError + apoError) * 2);
                baseThrust *= taper;
                if (periError > 0.01 && apoError > 0.01) {
                    this.missionAccomplished = true;
                    this.throttle = 0;
                }
            }
        }
        return this.thrustDir.clone().multiplyScalar(baseThrust * this.throttle);
    }

    getIsp() {
        const alt = this.r.length() - R_EARTH;
        const altRatio = Math.min(1, Math.max(0, alt / 80000));
        const baseIsp = this.engine.ispSea + (this.engine.ispVac - this.engine.ispSea) * altRatio;
        return baseIsp * (1.0 - Math.abs(this.ofRatio - 1.0) * 0.4);
    }
}

function getOrbitalElements(state) {
    const r = state.r, v = state.v;
    const rMag = r.length(), vMag = v.length();
    const h = new THREE.Vector3().crossVectors(r, v);
    const hMag = h.length();
    if (hMag < 1e-6) return { semiMajorAxis: 0, eccentricity: 1, periapsis: 0, apoapsis: 0, isOrbital: false };
    
    const vCrossH = new THREE.Vector3().crossVectors(v, h);
    const eVec = vCrossH.multiplyScalar(1/MU).sub(r.clone().divideScalar(rMag));
    const e = eVec.length();
    const eps = (vMag * vMag) / 2 - MU / rMag;
    const a = (Math.abs(eps) > 1e-10) ? -MU / (2 * eps) : Infinity;
    
    return {
        semiMajorAxis: a,
        eccentricity: e,
        periapsis: (e < 1) ? a * (1 - e) - R_EARTH : 0,
        apoapsis: (e < 1) ? a * (1 + e) - R_EARTH : 0,
        isOrbital: (e < 1 && a > 0 && (a * (1 - e)) > R_EARTH)
    };
}

function computeDerivatives(state) {
    const { r, v } = state;
    const rMag = r.length();
    const mass = state.getCurrentMass();

    const gravity = r.clone().multiplyScalar(-MU / Math.pow(rMag, 3));

    const x = r.x, y = r.y, z = r.z;
    const rMag2 = rMag * rMag;
    const coeff = 1.5 * J2 * MU * Math.pow(R_EARTH, 2) / (rMag2 * rMag2 * rMag);
    const yRatio = (y * y) / rMag2;
    const j2Acc = new THREE.Vector3(
        coeff * x * (5 * yRatio - 1),
        coeff * y * (5 * yRatio - 3),
        coeff * z * (5 * yRatio - 1)
    );

    const moonPos = getMoonPosition(state.flightTime);
    const rToMoon = moonPos.clone().sub(r);
    const moonAcc = rToMoon.clone().multiplyScalar(MU_MOON / Math.pow(rToMoon.length(), 3))
                    .sub(moonPos.clone().multiplyScalar(MU_MOON / Math.pow(moonPos.length(), 3)));

    const thrustVec = state.getThrustVector();
    const thrustAcc = thrustVec.clone().divideScalar(mass);

    state.currentGForce = (thrustAcc.length() / 9.80665) + (state.isLaunched ? 0 : 1.0);

    let dragAcc = new THREE.Vector3(0,0,0);
    const alt = rMag - R_EARTH;
    if (alt < 100000 && state.isLaunched && mass > 0) {
        const omegaVec = new THREE.Vector3(0, ROTATION_SPEED, 0);
        const atmosVel = new THREE.Vector3().crossVectors(omegaVec, r);
        
        // 疊加高空切變風
        if (alt > 8000 && alt < 18000) {
            atmosVel.add(new THREE.Vector3(state.windShear * 2.0, 0, 0));
        }

        const relV = v.clone().sub(atmosVel);
        const speed = relV.length();
        state.relativeAirSpeed = speed;

        if (speed > 0.1) {
            const rho = 1.225 * Math.exp(-alt / 8500);
            const Cd = (speed > 300 && speed < 600) ? 0.45 : 0.28;
            const dynQ = 0.5 * rho * speed * speed;
            if (dynQ > state.maxQ) state.maxQ = dynQ;
            dragAcc = relV.normalize().multiplyScalar(-dynQ * Cd * 10.5 / mass);
        }
    }

    return { dr: v.clone(), dv: gravity.add(j2Acc).add(moonAcc).add(thrustAcc).add(dragAcc) };
}

function rk4Step(state, dt) {
    const s1 = computeDerivatives(state);
    const s2 = computeDerivatives(state);
    const s3 = computeDerivatives(state);
    const s4 = computeDerivatives(state);

    state.r.add( s1.dr.clone().multiplyScalar(dt/6).add(s2.dr.clone().multiplyScalar(dt/3)).add(s3.dr.clone().multiplyScalar(dt/3)).add(s4.dr.clone().multiplyScalar(dt/6)) );
    state.v.add( s1.dv.clone().multiplyScalar(dt/6).add(s2.dv.clone().multiplyScalar(dt/3)).add(s3.dv.clone().multiplyScalar(dt/3)).add(s4.dv.clone().multiplyScalar(dt/6)) );

    if (state.v.length() > state.maxVelocity) state.maxVelocity = state.v.length();

    const thrustMag = state.getThrustVector().length();
    const consumed = (thrustMag > 0 ? thrustMag / (state.getIsp() * 9.80665) : 0) * dt;
    if (state.stage === 1) state.fuel1 = Math.max(0, state.fuel1 - consumed);
    else state.fuel2 = Math.max(0, state.fuel2 - consumed);
    
    state.flightTime += dt;
}

function executeGuidance(state, dt) {
    if (!state.isLaunched || state.missionAccomplished || state.isDestroyed) return;
    const alt = state.r.length() - R_EARTH;
    
    if (alt < state.gravityTurnAlt) {
        state.thrustDir.set(0, 1, 0);
        return;
    }

    // TVC 響應與陀螺儀雜訊
    const pitchRate = -0.015 * state.tvcGain;
    const noise = (Math.random() - 0.5) * state.driftNoise * 0.01;

    if (alt >= state.gravityTurnAlt && alt < state.gravityTurnAlt + 8000) {
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,0,1), pitchRate + noise).normalize();
        return;
    }
    if (state.v.length() > 300) {
        const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
        const errorAngle = error.length();
        if (errorAngle > 0.0001) {
            state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.8 * dt * 2 * state.tvcGain) + noise).normalize();
        }
    }
}

// ==================== 4. 3D 幾何模型工廠 ====================
function createRocketMesh(type) {
    const config = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
    const group = new THREE.Group();

    const matBody = new THREE.MeshStandardMaterial({ color: config.colorTheme.body, metalness: type === 'STARSHIP' ? 0.9 : 0.5, roughness: 0.2 });
    const matAccent = new THREE.MeshStandardMaterial({ color: config.colorTheme.accent, metalness: 0.6, roughness: 0.3 });
    const matPayload = new THREE.MeshStandardMaterial({ color: config.colorTheme.payload, metalness: 0.8, roughness: 0.2 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    const scaleH = config.heightM / 60.0;
    const coreRadius = (type === 'STARSHIP' || type === 'SATURN_V') ? 0.55 : 0.38;

    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(coreRadius * 0.9, 0.6, 24), matEngine);
    nozzle.position.y = 0.3;
    group.add(nozzle);

    const s1Height = 4.8 * scaleH;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius, coreRadius, s1Height, 32), matBody);
    s1.position.y = 0.6 + s1Height / 2;
    group.add(s1);

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 1.01, coreRadius * 1.01, s1Height * 0.18, 32), matAccent);
    ring.position.y = 0.6 + s1Height * 0.7;
    group.add(ring);

    const boostersGroup = new THREE.Group();
    if (config.hasBoosters) {
        const bCount = config.boosterCount || 4;
        const bRadius = coreRadius * 0.5;
        const bHeight = s1Height * 0.8;
        for (let i = 0; i < bCount; i++) {
            const angle = (i / bCount) * Math.PI * 2;
            const b = new THREE.Group();
            const bBody = new THREE.Mesh(new THREE.CylinderGeometry(bRadius, bRadius, bHeight, 16), matBody);
            const bNose = new THREE.Mesh(new THREE.ConeGeometry(bRadius, bHeight * 0.2, 16), matAccent);
            bNose.position.y = bHeight / 2 + (bHeight * 0.1);
            b.add(bBody); b.add(bNose);
            b.position.set(Math.cos(angle) * (coreRadius + bRadius * 1.05), 0.6 + bHeight / 2, Math.sin(angle) * (coreRadius + bRadius * 1.05));
            boostersGroup.add(b);
        }
    }
    group.add(boostersGroup);

    const s2Height = 2.4 * scaleH;
    const s2PosY = 0.6 + s1Height + s2Height / 2;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.95, coreRadius, s2Height, 32), matBody);
    s2.position.y = s2PosY;
    group.add(s2);

    const fairingHeight = 1.8 * scaleH;
    const fairingPosY = 0.6 + s1Height + s2Height + fairingHeight / 2;
    const fairing = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.75, coreRadius * 0.95, fairingHeight, 24), matPayload);
    fairing.position.y = fairingPosY;
    const noseHeight = 1.4 * scaleH;
    const nosePosY = fairingPosY + fairingHeight / 2 + noseHeight / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(coreRadius * 0.75, noseHeight, 24), matBody);
    nose.position.y = nosePosY;
    group.add(fairing);
    group.add(nose);

    const escapeTower = new THREE.Group();
    if (config.hasTower) {
        const topY = nosePosY + noseHeight / 2;
        const towerHeight = 2.0 * scaleH;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, towerHeight, 12), matAccent);
        pole.position.y = topY + towerHeight / 2;
        const tNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4 * scaleH, 12), matEngine);
        tNozzle.position.y = topY + towerHeight + (0.2 * scaleH);
        escapeTower.add(pole); escapeTower.add(tNozzle);
    }
    group.add(escapeTower);

    if (type === 'STARSHIP') {
        const flapGeo = new THREE.BoxGeometry(0.05, 1.2, 0.8);
        const f1 = new THREE.Mesh(flapGeo, matAccent); f1.position.set(coreRadius * 1.1, fairingPosY, 0);
        const f2 = new THREE.Mesh(flapGeo, matAccent); f2.position.set(-coreRadius * 1.1, fairingPosY, 0);
        group.add(f1); group.add(f2);
    }

    return { root: group, boosters: boostersGroup, escapeTower: escapeTower };
}

// ==================== 5. 3D 場景與特效管理 ====================
let scene, camera, renderer, controls;
let rocketGroup, flameMesh, machConeMesh, exhaustParticles = [];
let activeRocketParts = null;
let earthMesh, moonMesh, launchTowerGroup, rocketLight, sunLight, hemiLight;
let velArrow, thrustArrow;
let debrisList = [];
let explosionParticles = [];

function createEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    oceanGrad.addColorStop(0, '#0a2342');
    oceanGrad.addColorStop(0.5, '#021024');
    oceanGrad.addColorStop(1, '#0a2342');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 2048, 1024);
    
    ctx.fillStyle = '#1e3d2f';
    const landContours = [[400, 300, 240, 180], [700, 250, 180, 120], [1300, 400, 320, 220], [1600, 650, 220, 160], [500, 700, 200, 280], [1700, 300, 260, 180]];
    landContours.forEach(([x, y, rx, ry]) => {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.PI/6, 0, Math.PI*2); ctx.fill();
    });
    
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 360; i += 30) { ctx.beginPath(); ctx.moveTo((i/360)*2048, 0); ctx.lineTo((i/360)*2048, 1024); ctx.stroke(); }
    for (let i = 0; i <= 180; i += 30) { ctx.beginPath(); ctx.moveTo(0, (i/180)*1024); ctx.lineTo(2048, (i/180)*1024); ctx.stroke(); }
    
    return new THREE.CanvasTexture(canvas);
}

function createStarField() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
        const rad = 8000 + Math.random() * 4000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        starPos[i] = rad * Math.sin(phi) * Math.cos(theta);
        starPos[i+1] = rad * Math.sin(phi) * Math.sin(theta);
        starPos[i+2] = rad * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    return new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 16, transparent: true, opacity: 0.9 }));
}

function setEnvironmentMode(mode) {
    if (!scene) return;
    if (mode === 'DAY') {
        scene.background = new THREE.Color(0x38bdf8);
        scene.fog.color = new THREE.Color(0xbae6fd);
        scene.fog.density = 0.0003;
        if (sunLight) { sunLight.color.setHex(0xffffff); sunLight.intensity = 2.8; }
        if (hemiLight) { hemiLight.color.setHex(0xe0f2fe); hemiLight.groundColor.setHex(0x334155); hemiLight.intensity = 1.2; }
    } else {
        scene.background = new THREE.Color(0x020617);
        scene.fog.color = new THREE.Color(0x020617);
        scene.fog.density = 0.0001;
        if (sunLight) { sunLight.color.setHex(0xffedd5); sunLight.intensity = 1.8; }
        if (hemiLight) { hemiLight.color.setHex(0x1e293b); hemiLight.groundColor.setHex(0x020617); hemiLight.intensity = 0.6; }
    }
}

function switchRocketMesh(type) {
    if (!rocketGroup) return;
    while (rocketGroup.children.length > 0) {
        rocketGroup.remove(rocketGroup.children[0]);
    }

    activeRocketParts = createRocketMesh(type);
    rocketGroup.add(activeRocketParts.root);

    const flameGeo = new THREE.ConeGeometry(0.5, 5.0, 24);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.95 });
    flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.y = -2.5;
    flameMesh.rotation.x = Math.PI;
    flameMesh.visible = false;
    rocketGroup.add(flameMesh);

    const coneGeo = new THREE.ConeGeometry(1.6, 2.2, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    machConeMesh = new THREE.Mesh(coneGeo, coneMat);
    machConeMesh.position.y = 7.0;
    rocketGroup.add(machConeMesh);

    rocketGroup.quaternion.set(0, 0, 0, 1);
    rocketGroup.visible = true;
}

function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.0003);

    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 30000);
    camera.position.set(0, 1012, 22);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    containerEl.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 15000;
    controls.target.set(0, 1004, 0);

    scene.add(createStarField());

    sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    sunLight.position.set(2000, 4000, 3000);
    scene.add(sunLight);

    hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.2);
    scene.add(hemiLight);

    rocketLight = new THREE.PointLight(0xff6600, 0, 250);
    scene.add(rocketLight);

    earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1000, 64, 64),
        new THREE.MeshStandardMaterial({ map: createEarthTexture(), roughness: 0.8, metalness: 0.1 })
    );
    scene.add(earthMesh);

    const atmoMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1012, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.15, side: THREE.BackSide })
    );
    scene.add(atmoMesh);

    moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R_MOON * WORLD_SCALE, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 })
    );
    scene.add(moonMesh);

    buildLaunchPadAndTower();

    rocketGroup = new THREE.Group();
    rocketGroup.position.set(0, 1000.4, 0);
    scene.add(rocketGroup);

    switchRocketMesh("CZ10A");

    velArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 10, 0x00ff00);
    thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 8, 0xff5500);
    scene.add(velArrow); scene.add(thrustArrow);
}

function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.2 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.8, 0.8, 32), padMat);
    pad.position.set(0, 999.6, 0);
    launchTowerGroup.add(pad);

    const trenchMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d });
    const trench = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.0, 24), trenchMat);
    trench.position.set(0, 999.6, 0);
    launchTowerGroup.add(trench);

    const towerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.4 });
    const tower = new THREE.Group();
    
    const colGeo = new THREE.CylinderGeometry(0.06, 0.06, 12, 8);
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([cx, cz]) => {
        const col = new THREE.Mesh(colGeo, towerMat);
        col.position.set(cx, 6, cz);
        tower.add(col);
    });

    for (let y = 1; y <= 11; y += 1.5) {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), towerMat); b1.position.set(0, y, 0.6); tower.add(b1);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), towerMat); b2.position.set(0, y, -0.6); tower.add(b2);
        const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.2), towerMat); b3.position.set(0.6, y, 0); tower.add(b3);
        const b4 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.2), towerMat); b4.position.set(-0.6, y, 0); tower.add(b4);
    }

    const armMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.8 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.2), armMat);
    arm.position.set(-0.7, 9.5, 0);
    tower.add(arm);

    tower.position.set(2.0, 1000.0, 0);
    launchTowerGroup.add(tower);

    [-3.5, 3.5].forEach(x => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, 13, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        pole.position.set(x, 1006.5, -2.5);
        launchTowerGroup.add(pole);
    });

    scene.add(launchTowerGroup);
}

function triggerCatastrophicExplosion(pos) {
    if (!rocketGroup) return;
    rocketGroup.visible = false;
    if (flameMesh) flameMesh.visible = false;

    for (let i = 0; i < 160; i++) {
        const size = 0.6 + Math.random() * 1.6;
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(size, 8, 8),
            new THREE.MeshBasicMaterial({ color: Math.random() > 0.3 ? 0xff2200 : 0xffdd00, transparent: true, opacity: 1.0 })
        );
        p.position.copy(pos);
        scene.add(p);

        const speed = 12 + Math.random() * 35;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        explosionParticles.push({
            mesh: p,
            vx: speed * Math.sin(phi) * Math.cos(theta),
            vy: speed * Math.cos(phi),
            vz: speed * Math.sin(phi) * Math.sin(theta),
            life: 2.5
        });
    }
}

function updateExplosion(dt) {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const ep = explosionParticles[i];
        ep.mesh.position.add(new THREE.Vector3(ep.vx, ep.vy, ep.vz).multiplyScalar(dt));
        ep.mesh.scale.multiplyScalar(1.03);
        ep.life -= dt;
        ep.mesh.material.opacity = Math.max(0, ep.life / 2.5);
        if (ep.life <= 0) {
            scene.remove(ep.mesh);
            explosionParticles.splice(i, 1);
        }
    }
}

function spawnDebrisPiece(state, mesh, relVel) {
    if (!mesh) return;
    const debrisGroup = new THREE.Group();
    debrisGroup.add(mesh.clone());
    debrisGroup.position.copy(state.r.clone().multiplyScalar(WORLD_SCALE));
    scene.add(debrisGroup);

    debrisList.push({
        r: state.r.clone(),
        v: state.v.clone().add(relVel),
        mesh: debrisGroup,
        life: 180
    });
}

function updateDebris(dt) {
    for (let i = debrisList.length - 1; i >= 0; i--) {
        const d = debrisList[i];
        d.life -= dt;
        const rMag = d.r.length();
        const grav = d.r.clone().multiplyScalar(-MU / Math.pow(rMag, 3));
        d.v.add(grav.multiplyScalar(dt));
        d.r.add(d.v.clone().multiplyScalar(dt));
        
        d.mesh.position.copy(d.r.clone().multiplyScalar(WORLD_SCALE));
        d.mesh.rotation.x += dt * 0.4;
        d.mesh.rotation.z += dt * 0.3;

        if (d.life <= 0 || d.r.length() < R_EARTH) {
            scene.remove(d.mesh);
            debrisList.splice(i, 1);
        }
    }
}

function spawnExhaustParticles(pos, power, isLowAltitude = true) {
    if (exhaustParticles.length > 250) return;
    
    const count = isLowAltitude ? 6 : 3;
    const spread = isLowAltitude ? 3.5 : 1.0;
    const upwardBias = isLowAltitude ? 0.5 : 1.8;
    const windDir = new THREE.Vector3(0.3, 0, -0.2).normalize();

    for (let i = 0; i < count; i++) {
        const isFire = Math.random() < 0.4;
        const size = isLowAltitude ? (0.3 + Math.random() * 0.45) : (0.15 + Math.random() * 0.2);
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(size, 6, 6),
            new THREE.MeshBasicMaterial({ color: isFire ? (Math.random() > 0.5 ? 0xff5500 : 0xffbb00) : 0xe2e8f0, transparent: true, opacity: 0.9 })
        );

        p.position.set(pos.x + (Math.random() - 0.5) * 0.4, pos.y - 0.5, pos.z + (Math.random() - 0.5) * 0.4);
        scene.add(p);

        exhaustParticles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * spread + windDir.x * 1.2,
            vy: -(5 + Math.random() * 6) * power * upwardBias,
            vz: (Math.random() - 0.5) * spread + windDir.z * 1.2,
            expansion: isLowAltitude ? 1.06 : 1.03,
            life: 1.0
        });
    }
}

function updateExhaustParticles(dt) {
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
        const p = exhaustParticles[i];
        p.mesh.position.add(new THREE.Vector3(p.vx, p.vy, p.vz).multiplyScalar(dt));
        p.mesh.scale.multiplyScalar(p.expansion);
        p.life -= dt * 1.8;
        p.mesh.material.opacity = Math.max(0, p.life * 0.8);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            exhaustParticles.splice(i, 1);
        }
    }
}

// ==================== 6. 主控邏輯與 100% 純淨雙語 ====================
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

// ⚠️ 多維度硬核物理極限故障檢查
function evaluateStructuralLimits(rocket) {
    if (rocket.isDestroyed || !isAdvancedMode) return;

    const alt = rocket.r.length() - R_EARTH;
    const speed = rocket.relativeAirSpeed || rocket.v.length();
    const rho = 1.225 * Math.exp(-alt / 8500);
    const dynQkPa = (0.5 * rho * speed * speed) / 1000;
    const visualPos = rocket.r.clone().multiplyScalar(WORLD_SCALE);

    // 💥 1. 推重比過低 (TWR < 1.05)
    const twr = rocket.getThrustVector().length() / (rocket.getCurrentMass() * 9.80665);
    if (rocket.flightTime > 3.0 && alt < 20 && twr < 1.05) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "推重比不足 (TWR < 1.05)，無法離地並在發射台過熱引爆" : "PAD TWR OVERLOAD: Insufficient thrust to lift mass (TWR < 1.05).";
        triggerCatastrophicExplosion(visualPos); cameraShake = 4.0; showMissionDebrief(getOrbitalElements(rocket)); return;
    }

    // 💥 2. 混合比極端失調 (燃燒室超溫自爆)
    if (Math.abs(rocket.ofRatio - 1.0) > 0.16) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "氧化劑/燃料混合比嚴重失調，燃燒室壓力劇烈震盪引爆" : "O/F RATIO ANOMALY: Severe mixture imbalance triggered combustion chamber blowout.";
        triggerCatastrophicExplosion(visualPos); cameraShake = 4.0; showMissionDebrief(getOrbitalElements(rocket)); return;
    }

    // 💥 3. Max-Q 疊加高空切變風氣動撕裂
    const windStress = (rocket.windShear / 15.0);
    if (dynQkPa * windStress > 55.0 && alt < 20000) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? `動態氣壓與切變風疊加突破極限 (${(dynQkPa*windStress).toFixed(1)} kPa)，箭體空中氣動剪切斷裂` : `AERODYNAMIC SHEAR FAILURE: Combined Max-Q & Wind Shear exceeded 55 kPa envelope.`;
        triggerCatastrophicExplosion(visualPos); cameraShake = 3.5; showMissionDebrief(getOrbitalElements(rocket)); return;
    }

    // 💥 4. TVC 靈敏度過高引發結構諧振
    if (rocket.tvcGain > 1.35 && speed > 200 && alt < 25000) {
        rocket.isDestroyed = true;
        rocket.failureReason = currentLang === 'zh' ? "TVC 噴嘴靈敏度過高引發高頻震顫，箭體結構共振空中解體" : "CONTROL RESONANCE: Excessive TVC gain induced fatal structural flutter.";
        triggerCatastrophicExplosion(visualPos); cameraShake = 3.5; showMissionDebrief(getOrbitalElements(rocket)); return;
    }

    // 💥 5. G-Force 超載 (> 5.5 G)
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
    const orbit = getOrbitalElements(rocket);

    setText('hud-time', `${rocket.flightTime.toFixed(1)}s`);
    setText('hud-alt', `${(alt / 1000).toFixed(1)} km`);
    setText('hud-vel', `${speed.toFixed(0)} m/s`);
    
    const dynQkPa = (0.5 * 1.225 * Math.exp(-alt/8500) * airSpeed * airSpeed / 1000);
    document.getElementById('gauge-q-bar').style.width = `${Math.min(100, (dynQkPa / 55) * 100)}%`;
    setText('gauge-q-txt', `${dynQkPa.toFixed(1)} kPa`);
    
    if (machConeMesh) {
        const isTransonic = (airSpeed > 320 && airSpeed < 430 && alt < 25000);
        machConeMesh.material.opacity = isTransonic ? Math.min(0.25, machConeMesh.material.opacity + 0.02) : Math.max(0, machConeMesh.material.opacity - 0.05);
    }

    const currentTwr = rocket.getThrustVector().length() / (rocket.getCurrentMass() * 9.80665);
    setText('t-twr', currentTwr.toFixed(2));
    setText('t-thrust', `${(rocket.getThrustVector().length()/1000).toFixed(0)} kN`);

    let stageName = `${currentLang==='zh'?rocket.engine.name:rocket.engine.nameEn} (${t.ascending})`;
    if (rocket.isDestroyed) stageName = "💥 CATASTROPHIC FAILURE";
    else if (rocket.stage2Separated) stageName = "🛰️ 300km Orbit";
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
    let payload = isAdvancedMode ? parseInt(document.getElementById('sel-payload').value, 10) : 8000;
    let fuelFactor = isAdvancedMode ? parseInt(document.getElementById('rng-fuel').value, 10) / 100 : 1.0;
    let throttle = isAdvancedMode ? parseInt(document.getElementById('rng-throttle').value, 10) : 100;
    let ofRatio = isAdvancedMode ? parseInt(document.getElementById('rng-ofratio').value, 10) / 100 : 1.0;
    let turnAltKm = isAdvancedMode ? parseInt(document.getElementById('rng-turn').value, 10) : 8;
    let tvcGain = isAdvancedMode ? parseInt(document.getElementById('rng-tvc').value, 10) / 100 : 1.0;
    let windShear = isAdvancedMode ? parseInt(document.getElementById('rng-wind').value, 10) : 15;
    let driftNoise = isAdvancedMode ? parseInt(document.getElementById('rng-drift').value, 10) / 100 : 0.1;

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
    document.getElementById('sel-env').onchange = (e) => setEnvironmentMode(e.target.value);
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
                targetCamPos.copy(visualPos.clone().add(new THREE.Vector3(0, 300, 300)));
                targetLookAt.set(0, 0, 0); break;
            case CAM_MODE.ASCEND:
            default:
                let camDist = (alt < 2000) ? 25 + alt * 0.015 : 60;
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
        updateTelemetryValues();
    } else {
        if (rocketGroup && !rocket) { rocketGroup.quaternion.set(0, 0, 0, 1); rocketGroup.position.set(0, 1000.4, 0); }
        if (flameMesh) flameMesh.visible = false;
    }

    controls.update(); renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
    initRocketScene(document.getElementById('canvas-container'));
    bindUI(); applyLanguageUI();
    window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
    gameLoop(performance.now());
});
