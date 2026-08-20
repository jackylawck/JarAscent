/**
 * js/physics_core.js - 航太天體力學與飛行控制核心 v3.5 Master Edition
 * (顯式RK4質量守恆、NASA CEA熱化學混合比、三維月球軌道攝動、風梯度力矩與PD-TVC控制律)
 * @license MIT
 */

const THREE = window.THREE;
import { ROCKET_MODELS } from './rockets_data.js';

// ==================== 1. 物理與天文天體常數 (SI 單位) ====================
export const G = 6.67430e-11;             // 萬有引力常數 (m^3 kg^-1 s^-2)
export const M_EARTH = 5.972e24;          // 地球質量 (kg)
export const R_EARTH = 6378137.0;         // 地球赤道半徑 (WGS-84, m)
export const R_EARTH_POLAR = 6356752.3;   // 地球極半徑 (WGS-84, m)
export const MU = 3.986004418e14;         // 地球標準引力常數 G*M (m^3/s^2)
export const J2 = 1.08263e-3;             // 地球二階帶諧係數 (扁率攝動)
export const OMEGA_EARTH = 7.292115e-5;   // 地球自轉角速度 (rad/s)
export const G0 = 9.80665;                // 標準重力加速度 (m/s^2)

// 月球天體參數 (包含軌道傾角與離心率)
export const M_MOON = 7.342e22;           // 月球質量 (kg)
export const R_MOON = 1737400.0;          // 月球半徑 (m)
export const MU_MOON = G * M_MOON;        // 月球標準引力常數
export const D_MOON_SEMI_MAJOR = 384400000.0; // 月球半長軸 (m)
export const MOON_ECCENTRICITY = 0.0549;  // 月球軌道偏心率
export const MOON_INCLINATION = 0.0897;   // 月球軌道傾角 (~5.14度, rad)
export const MOON_ORBITAL_PERIOD = 27.321661 * 86400; // 恆星月週期 (s)

export const WORLD_SCALE = 0.0001;        // 3D 空間縮放 (1000 單位 = 10,000,000 m)

// ==================== 2. 三維月球軌道精確星曆計算 ====================
export function getMoonPosition(timeSec) {
    const n = (2 * Math.PI) / MOON_ORBITAL_PERIOD; // 平均運動角速度
    const M = n * timeSec;                         // 平近點角
    // 開普勒方程一階偏心率修正 (真近點角近似)
    const nu = M + 2 * MOON_ECCENTRICITY * Math.sin(M);
    const r = D_MOON_SEMI_MAJOR * (1 - MOON_ECCENTRICITY * MOON_ECCENTRICITY) / (1 + MOON_ECCENTRICITY * Math.cos(nu));
    
    // 三維軌道投影 (包含 5.14° 軌道傾角)
    const x = r * Math.cos(nu);
    const z = r * Math.sin(nu) * Math.cos(MOON_INCLINATION);
    const y = r * Math.sin(nu) * Math.sin(MOON_INCLINATION);
    return new THREE.Vector3(x, y, z);
}

// ==================== 3. 火箭狀態類別 (Rocket State Vector) ====================
export class RocketState {
    constructor() {
        // 核心運動學與動力學狀態量 (ECI 座標系)
        this.r = new THREE.Vector3(0, R_EARTH, 0); // 位置 (m)
        this.v = new THREE.Vector3(0, 0, 0);       // 速度 (m/s)
        this.thrustDir = new THREE.Vector3(0, 1, 0); // 當前推力方向 (單位向量)
        this.angularVel = new THREE.Vector3(0, 0, 0); // 角速度 (rad/s)
        
        // 推進與質量狀態
        this.engine = null;
        this.payloadMass = 8000;
        this.fuel1 = 400000;
        this.fuel2 = 90000;
        this.stage = 1;
        this.throttle = 1.0;
        this.isLaunched = false;
        this.isDestroyed = false;
        this.missionAccomplished = false;
        this.flightTime = 0;
        this.guidanceActive = true;

        // 航太控制與環境參數
        this.gravityTurnAlt = 8000;
        this.ofRatio = 1.0;          // 混合比 (1.0 = 最佳標稱比)
        this.tvcGain = 1.0;          // TVC 響應靈敏度 (Kp)
        this.windShear = 15.0;       // 高空切變風強度 (m/s)
        this.driftNoise = 0.10;      // 陀螺儀雜訊漂移

        // 多級分離標誌
        this.escapeTowerSeparated = false;
        this.boostersSeparated = false;
        this.fairingSeparated = false;
        this.stage2Separated = false;

        // 遙測與事故診斷指標
        this.currentGForce = 1.0;
        this.maxQ = 0;
        this.maxVelocity = 0;
        this.relativeAirSpeed = 0;
        this.failureReason = "";
        this.recommendation = "";
    }

    initEngine(type, payload = 8000, fuelFactor = 1.0, turnAltKm = 8, ofRatio = 1.0, tvc = 1.0, wind = 15, drift = 0.1) {
        this.engine = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
        this.payloadMass = payload;
        this.fuel1 = this.engine.fuelMassStage1 * fuelFactor;
        this.fuel2 = this.engine.fuelMassStage2;
        this.gravityTurnAlt = turnAltKm * 1000;
        this.ofRatio = ofRatio;
        this.tvcGain = tvc;
        this.windShear = wind;
        this.driftNoise = drift;
        this.stage = 1;
    }

    getCurrentMass() {
        const dry1 = (this.stage === 1 && !this.boostersSeparated) ? this.engine.dryMassStage1 : 0;
        const dry2 = this.engine.dryMassStage2;
        const fuel = (this.stage === 1) ? (this.fuel1 + this.fuel2) : this.fuel2;
        return dry1 + dry2 + fuel + this.payloadMass;
    }

    /**
     * 🔬 NASA CEA 非線性熱化學比衝效率模型
     * 區分富氧（燃溫劇增、氧化腐蝕）與富燃料（分子量下降、燃溫微降）的非對稱性
     */
    getIsp() {
        if (!this.engine) return 300;
        const alt = Math.max(0, this.r.length() - R_EARTH);
        const altRatio = Math.min(1.0, alt / 80000);
        const baseIsp = this.engine.ispSea + (this.engine.ispVac - this.engine.ispSea) * altRatio;
        
        // 非線性混合比效率多項式
        const dev = this.ofRatio - 1.0;
        let ofPenalty = 1.0;
        if (dev >= 0) {
            // 富氧工況：燃溫急升但比衝受氧化劑分子量拖累
            ofPenalty = 1.0 - (1.6 * dev * dev + 0.3 * dev);
        } else {
            // 富燃料工況：未充分燃燒
            ofPenalty = 1.0 - (1.2 * dev * dev - 0.15 * dev);
        }
        return Math.max(120, baseIsp * Math.max(0.2, ofPenalty));
    }

    getThrustVector() {
        if (!this.isLaunched || this.isDestroyed) return new THREE.Vector3(0, 0, 0);
        let thrustMag = 0;
        const alt = Math.max(0, this.r.length() - R_EARTH);
        const altRatio = Math.min(1.0, alt / 80000);

        if (this.stage === 1 && this.fuel1 > 0) {
            const sea = this.engine.thrustSea;
            const vac = this.engine.thrustVac;
            thrustMag = (sea + (vac - sea) * altRatio) * this.throttle;
        } else if (this.stage === 2 && this.fuel2 > 0) {
            thrustMag = this.engine.thrustStage2 * this.throttle;
        }
        return this.thrustDir.clone().normalize().multiplyScalar(thrustMag);
    }
}

// ==================== 4. 運動與動力學微分方程 (包含大氣共轉衰減、J2與三體) ====================

export function computeDerivatives(state, rVec, vVec, massVal) {
    const rMag = rVec.length();
    const alt = Math.max(0, rMag - R_EARTH);

    // 1. 地心引力與 J2 扁率攝動 (帶諧展開)
    const invR = 1.0 / rMag;
    const invR2 = invR * invR;
    const invR3 = invR2 * invR;
    const z = rVec.y; // 旋轉對稱軸設為 Y
    const z2_r2 = (z * z) * invR2;
    
    const j2Factor = 1.5 * J2 * MU * Math.pow(R_EARTH, 2) * (invR3 * invR2);
    const gravX = -MU * rVec.x * invR3 + j2Factor * rVec.x * (5.0 * z2_r2 - 1.0);
    const gravY = -MU * rVec.y * invR3 + j2Factor * rVec.y * (5.0 * z2_r2 - 3.0);
    const gravZ = -MU * rVec.z * invR3 + j2Factor * rVec.z * (5.0 * z2_r2 - 1.0);
    const gravAcc = new THREE.Vector3(gravX, gravY, gravZ);

    // 2. 月球三體引力攝動
    const moonPos = getMoonPosition(state.flightTime);
    const dMoonVec = new THREE.Vector3().subVectors(moonPos, rVec);
    const dMoonMag = dMoonVec.length();
    const moonAcc = dMoonVec.multiplyScalar(MU_MOON / Math.pow(dMoonMag, 3))
        .sub(moonPos.clone().multiplyScalar(MU_MOON / Math.pow(moonPos.length(), 3)));
    gravAcc.add(moonAcc);

    // 3. 大氣黏性共轉與高空衰減模型 (Atmospheric Co-rotation with Viscous Decay)
    let dragAcc = new THREE.Vector3(0, 0, 0);
    let airSpeed = vVec.length();

    if (alt < 100000 && alt > 0) {
        const rho = 1.225 * Math.exp(-alt / 8500.0);
        
        // 🔬 高層大氣黏性共轉衰減因子 (50km 以上逐漸脫離固體自轉)
        const atmoCoRotationDecay = Math.exp(-alt / 30000.0);
        const atmoVel = new THREE.Vector3(-OMEGA_EARTH * rVec.z * atmoCoRotationDecay, 0, OMEGA_EARTH * rVec.x * atmoCoRotationDecay);
        
        const relAirVel = new THREE.Vector3().subVectors(vVec, atmoVel);
        airSpeed = relAirVel.length();
        state.relativeAirSpeed = airSpeed;

        // 跨音速波阻模型 (Transonic Wave Drag)
        const mach = airSpeed / 340.0;
        let cd = 0.30;
        if (mach >= 0.8 && mach <= 1.25) {
            cd = 0.30 + 0.45 * Math.sin(((mach - 0.8) / 0.45) * Math.PI);
        } else if (mach > 1.25) {
            cd = 0.30 + 0.25 / Math.sqrt(mach * mach - 1.0);
        }

        const area = (state.engine && state.engine.frontalArea) ? parseFloat(state.engine.frontalArea) : 12.5;
        const dragForceMag = 0.5 * rho * airSpeed * airSpeed * cd * area;
        dragAcc = relAirVel.clone().normalize().multiplyScalar(-dragForceMag / massVal);

        const dynQ = 0.5 * rho * airSpeed * airSpeed;
        if (dynQ > state.maxQ) state.maxQ = dynQ;
    }

    // 4. 發動機推力加速度
    const thrustVec = state.getThrustVector();
    const thrustAcc = thrustVec.clone().multiplyScalar(1.0 / massVal);

    // 總加速度
    const aVec = new THREE.Vector3().addVectors(gravAcc, thrustAcc).add(dragAcc);
    state.currentGForce = aVec.length() / G0;

    // 5. 質量消耗率 (kg/s)
    const isp = state.getIsp();
    const massFlowRate = thrustVec.length() / (isp * G0);

    return { dr: vVec.clone(), dv: aVec, dm: massFlowRate };
}

// ==================== 5. 顯式質量守恆 RK4 數值積分 (Explicit Mass RK4 Step) ====================

export function rk4Step(state, dt) {
    if (!state.isLaunched || state.isDestroyed) return;

    let currentFuel = (state.stage === 1) ? state.fuel1 : state.fuel2;
    if (currentFuel <= 0 && state.stage === 1 && !state.boostersSeparated) {
        state.throttle = 0; // 燃料耗盡
    }

    const m0 = state.getCurrentMass();
    const r0 = state.r.clone();
    const v0 = state.v.clone();

    // k1 評估
    const k1 = computeDerivatives(state, r0, v0, m0);

    // k2 評估 (t + dt/2, m - dm*dt/2)
    const r1 = r0.clone().addScaledVector(k1.dr, dt * 0.5);
    const v1 = v0.clone().addScaledVector(k1.dv, dt * 0.5);
    const m1 = Math.max(100, m0 - k1.dm * dt * 0.5);
    const k2 = computeDerivatives(state, r1, v1, m1);

    // k3 評估 (t + dt/2, m - dm*dt/2)
    const r2 = r0.clone().addScaledVector(k2.dr, dt * 0.5);
    const v2 = v0.clone().addScaledVector(k2.dv, dt * 0.5);
    const m2 = Math.max(100, m0 - k2.dm * dt * 0.5);
    const k3 = computeDerivatives(state, r2, v2, m2);

    // k4 評估 (t + dt, m - dm*dt)
    const r3 = r0.clone().addScaledVector(k3.dr, dt);
    const v3 = v0.clone().addScaledVector(k3.dv, dt);
    const m3 = Math.max(100, m0 - k3.dm * dt);
    const k4 = computeDerivatives(state, r3, v3, m3);

    // 加權綜合更新狀態量
    state.r.addScaledVector(k1.dr.addScaledVector(k2.dr, 2.0).addScaledVector(k3.dr, 2.0).add(k4.dr), dt / 6.0);
    state.v.addScaledVector(k1.dv.addScaledVector(k2.dv, 2.0).addScaledVector(k3.dv, 2.0).add(k4.dv), dt / 6.0);

    // 顯式扣減燃料質量
    const consumedFuel = ((k1.dm + 2.0 * k2.dm + 2.0 * k3.dm + k4.dm) / 6.0) * dt;
    if (state.stage === 1) {
        state.fuel1 = Math.max(0, state.fuel1 - consumedFuel);
    } else {
        state.fuel2 = Math.max(0, state.fuel2 - consumedFuel);
    }

    state.flightTime += dt;
    const currentSpeed = state.v.length();
    if (currentSpeed > state.maxVelocity) state.maxVelocity = currentSpeed;
}

// ==================== 6. TVC 姿態動力學 PD 控制器與風梯度力矩擾動 ====================

export function executeGuidance(state, dt) {
    if (!state.guidanceActive || state.isDestroyed) return;

    const alt = Math.max(0, state.r.length() - R_EARTH);
    const radialDir = state.r.clone().normalize();
    
    // 東向切線向量 (90度順行發射方向)
    let eastTangent = new THREE.Vector3(0, 0, 1).cross(radialDir).normalize();
    if (eastTangent.lengthSq() < 0.1) eastTangent = new THREE.Vector3(1, 0, 0);

    // 1. 目標姿態規劃 (重力轉向程序角)
    let targetPitchRad = 0; // 0 = 垂直, PI/2 = 水平入軌
    if (alt >= state.gravityTurnAlt) {
        const turnProgress = Math.min(1.0, (alt - state.gravityTurnAlt) / 95000.0);
        targetPitchRad = Math.pow(turnProgress, 0.65) * (Math.PI * 0.485);
    }

    const desiredThrustDir = radialDir.clone().multiplyScalar(Math.cos(targetPitchRad))
        .add(eastTangent.clone().multiplyScalar(Math.sin(targetPitchRad))).normalize();

    // 2. 🔬 風切變高度梯度力矩擾動 (Wind Shear Gradient Aero Torques)
    if (alt > 7000 && alt < 22000 && state.windShear > 0) {
        const windGrad = (state.windShear / 15.0) * Math.sin(((alt - 7000) / 15000) * Math.PI);
        const windTorqueAxis = radialDir.clone().cross(eastTangent).normalize();
        const aeroDisturbQuat = new THREE.Quaternion().setFromAxisAngle(windTorqueAxis, windGrad * 0.003 * dt);
        desiredThrustDir.applyQuaternion(aeroDisturbQuat);
    }

    // 3. 🔬 TVC 姿態 PD 控制律 (比例-微分控制器，消除過衝振盪)
    const currentThrust = state.thrustDir.clone().normalize();
    const errorVec = new THREE.Vector3().crossVectors(currentThrust, desiredThrustDir);
    
    const Kp = 2.4 * state.tvcGain; // 比例增益
    const Kd = 1.6 * Math.sqrt(state.tvcGain); // 微分阻尼增益

    // 計算角加速度並積分角速度: alpha = Kp * error - Kd * angularVel
    const angularAcc = errorVec.clone().multiplyScalar(Kp).sub(state.angularVel.clone().multiplyScalar(Kd));
    state.angularVel.addScaledVector(angularAcc, dt);

    // 姿態旋轉積分
    const deltaAngle = state.angularVel.length() * dt;
    if (deltaAngle > 1e-6) {
        const rotAxis = state.angularVel.clone().normalize();
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(rotAxis, deltaAngle);
        state.thrustDir.applyQuaternion(rotQuat).normalize();
    }
}

// ==================== 7. 開普勒軌道根數計算 (Orbital Elements) ====================

export function getOrbitalElements(state) {
    const rMag = state.r.length();
    const vMag = state.v.length();
    const alt = rMag - R_EARTH;

    // 軌道能量與半長軸 a
    const energy = (vMag * vMag) / 2.0 - MU / rMag;
    let a = -MU / (2.0 * energy);

    // 角動量向量 h
    const h = new THREE.Vector3().crossVectors(state.r, state.v);
    const hMag = h.length();

    // 偏心率向量 e
    const eVec = new THREE.Vector3().crossVectors(state.v, h).multiplyScalar(1.0 / MU).sub(state.r.clone().normalize());
    const ecc = eVec.length();

    // 近地點與遠地點
    const periapsis = a * (1.0 - ecc) - R_EARTH;
    const apoapsis = a * (1.0 + ecc) - R_EARTH;

    // 判定是否入軌 (近地點 > 140km 且偏心率 < 1.0)
    const isOrbital = (periapsis > 140000 && ecc < 0.95 && a > 0);

    return {
        semiMajorAxis: a,
        eccentricity: ecc,
        periapsis: Math.max(0, periapsis),
        apoapsis: Math.max(0, apoapsis),
        energy: energy,
        isOrbital: isOrbital,
        currentAlt: alt
    };
}
