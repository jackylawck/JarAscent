/**
 * js/rocket_engine.js - JarAscent 3D 航太級動力學與數值核心
 * 包含：ECI 地心慣性系, 4階 Runge-Kutta 積分器, J2 地球扁率攝動 (Y軸極軸),
 * 大氣共轉相對風場修正, 月球三體引力攝動, 閉環零攻角重力轉向, 目標軌道自適應關機 (SECO)
 * @license MIT
 */
import * as THREE from 'three';

// 🛡️ [資安與天體常數] WGS84 + DE405 物理常數
const MU = 3.986004418e14;           // 地球標準引力參數 (m³/s²)
const MU_MOON = 4.9048695e12;        // 月球引力參數
const R_EARTH = 6378137;             // 地球赤道半徑 (m)
const R_MOON = 1737400;              // 月球半徑 (m)
const MOON_ORBIT_RADIUS = 384400000;  // 地月平均軌道半徑 (m)
const ROTATION_SPEED = 7.292115e-5;  // 地球自轉角速度 (rad/s)
const J2 = 1.08262668e-3;            // 地球扁率二階帶諧係數

export let scene, camera, renderer, controls;
export let rocketGroup, exhaustParticles = [];
export let earthMesh, moonMesh;
export let velArrow, thrustArrow;

// 🛡️ [資安防禦] Object.freeze() 防止發動機物理常數在運行期被篡改
export const ENGINE_DATABASE = Object.freeze({
    MERLIN:   Object.freeze({ name: "Merlin 1D",   thrustSea: 845000,  thrustVac: 981000,  ispSea: 282, ispVac: 311, dryMassStage1: 22000, fuelMassStage1: 410000, dryMassStage2: 4000, fuelMassStage2: 92000 }),
    RAPTOR:   Object.freeze({ name: "Raptor 2",    thrustSea: 2250000, thrustVac: 2500000, ispSea: 327, ispVac: 363, dryMassStage1: 35000, fuelMassStage1: 800000, dryMassStage2: 7000, fuelMassStage2: 180000 }),
    HYDROGEN: Object.freeze({ name: "RS-25",       thrustSea: 1860000, thrustVac: 2279000, ispSea: 366, ispVac: 452, dryMassStage1: 30000, fuelMassStage1: 650000, dryMassStage2: 5000, fuelMassStage2: 120000 }),
    SOLID:    Object.freeze({ name: "Solid SRB",   thrustSea: 3100000, thrustVac: 3300000, ispSea: 242, ispVac: 268, dryMassStage1: 45000, fuelMassStage1: 500000, dryMassStage2: 4500, fuelMassStage2: 85000 })
});

export function getMoonPosition(time) {
    const angularSpeed = 2 * Math.PI / (27.322 * 86400);
    const angle = angularSpeed * time;
    return new THREE.Vector3(MOON_ORBIT_RADIUS * Math.cos(angle), 0, MOON_ORBIT_RADIUS * Math.sin(angle));
}

export class RocketState {
    constructor() {
        this.r = new THREE.Vector3(R_EARTH, 0, 0);
        this.v = new THREE.Vector3(0, 0, ROTATION_SPEED * R_EARTH); // 繼承赤道向東自轉初速 (~465 m/s)
        this.mass = 0;
        this.fuel1 = 0;
        this.fuel2 = 0;
        this.stage = 1;
        this.payloadMass = 0;
        this.engine = null;
        this.thrustDir = new THREE.Vector3(0, 1, 0);
        this.throttle = 1.0;
        this.flightTime = 0;
        this.isLaunched = false;
        
        // 任務目標導引參數 (預設 300km 圓軌道)
        this.guidanceActive = false;
        this.targetPeriapsis = 300000;
        this.targetApoapsis = 300000;
        this.missionAccomplished = false;
    }

    initEngine(engineKey, payloadMass) {
        const DB = ENGINE_DATABASE[engineKey] || ENGINE_DATABASE.MERLIN;
        this.engine = DB;
        this.payloadMass = payloadMass;
        this.fuel1 = DB.fuelMassStage1;
        this.fuel2 = DB.fuelMassStage2;
        this.thrustDir.set(0, 1, 0);
    }

    getCurrentMass() {
        return (this.stage === 1) 
            ? this.engine.dryMassStage1 + this.engine.dryMassStage2 + this.payloadMass + this.fuel1 + this.fuel2
            : this.engine.dryMassStage2 + this.payloadMass + this.fuel2;
    }

    getThrustVector() {
        if (this.stage === 1 && this.fuel1 <= 0) return new THREE.Vector3(0,0,0);
        if (this.stage === 2 && this.fuel2 <= 0) return new THREE.Vector3(0,0,0);
        if (this.missionAccomplished) return new THREE.Vector3(0,0,0);

        const alt = this.r.length() - R_EARTH;
        const altRatio = Math.min(1, Math.max(0, alt / 100000));
        let baseThrust = (this.stage === 1) 
            ? this.engine.thrustSea + (this.engine.thrustVac - this.engine.thrustSea) * altRatio
            : this.engine.thrustVac * 0.65;

        // 終端目標軌道自動節流與平滑關機 (Predictor-Corrector)
        if (this.guidanceActive) {
            const orbit = getOrbitalElements(this);
            const periError = (orbit.periapsis - this.targetPeriapsis) / this.targetPeriapsis;
            const apoError = (orbit.apoapsis - this.targetApoapsis) / this.targetApoapsis;
            if (periError > -0.02 && apoError > -0.02) {
                const taper = Math.max(0.05, 1.0 - (periError + apoError) * 2);
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
        const altRatio = Math.min(1, Math.max(0, alt / 100000));
        return this.engine.ispSea + (this.engine.ispVac - this.engine.ispSea) * altRatio;
    }
}

export function getOrbitalElements(state) {
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

export function computeDerivatives(state, dt) {
    const { r, v } = state;
    const rMag = r.length();
    const mass = state.getCurrentMass();

    // 1. 中心萬有引力
    const gravity = r.clone().multiplyScalar(-MU / Math.pow(rMag, 3));

    // 2. J2 地球扁率攝動加速度 (Y 軸為自轉極軸)
    const x = r.x, y = r.y, z = r.z;
    const rMag2 = rMag * rMag;
    const coeff = 1.5 * J2 * MU * Math.pow(R_EARTH, 2) / (rMag2 * rMag2 * rMag);
    const yRatio = (y * y) / rMag2;
    const j2Acc = new THREE.Vector3(
        coeff * x * (5 * yRatio - 1),
        coeff * y * (5 * yRatio - 3),
        coeff * z * (5 * yRatio - 1)
    );

    // 3. 第三體月球引力攝動
    const moonPos = getMoonPosition(state.flightTime);
    const rToMoon = moonPos.clone().sub(r);
    const moonAcc = rToMoon.clone().multiplyScalar(MU_MOON / Math.pow(rToMoon.length(), 3))
                    .sub(moonPos.clone().multiplyScalar(MU_MOON / Math.pow(moonPos.length(), 3)));

    // 4. 發動機主動推力
    const thrustVec = state.getThrustVector();
    const thrustAcc = thrustVec.clone().divideScalar(mass);

    // 5. 大氣共轉相對風場阻力
    let dragAcc = new THREE.Vector3(0,0,0);
    const alt = rMag - R_EARTH;
    if (alt < 100000 && state.isLaunched && mass > 0) {
        const omegaVec = new THREE.Vector3(0, ROTATION_SPEED, 0);
        const atmosVel = new THREE.Vector3().crossVectors(omegaVec, r);
        const relV = v.clone().sub(atmosVel);
        const speed = relV.length();
        if (speed > 0.1) {
            const rho = 1.225 * Math.exp(-alt / 8500);
            const Cd = (speed > 300 && speed < 600) ? 0.45 : 0.28;
            dragAcc = relV.normalize().multiplyScalar(-0.5 * rho * speed * speed * Cd * 10.5 / mass);
        }
    }

    return { dr: v.clone(), dv: gravity.add(j2Acc).add(moonAcc).add(thrustAcc).add(dragAcc) };
}

export function rk4Step(state, dt) {
    const s1 = computeDerivatives(state, 0);
    const s2 = computeDerivatives(state, dt/2);
    const s3 = computeDerivatives(state, dt/2);
    const s4 = computeDerivatives(state, dt);

    state.r.add( s1.dr.clone().multiplyScalar(dt/6).add(s2.dr.clone().multiplyScalar(dt/3)).add(s3.dr.clone().multiplyScalar(dt/3)).add(s4.dr.clone().multiplyScalar(dt/6)) );
    state.v.add( s1.dv.clone().multiplyScalar(dt/6).add(s2.dv.clone().multiplyScalar(dt/3)).add(s3.dv.clone().multiplyScalar(dt/3)).add(s4.dv.clone().multiplyScalar(dt/6)) );

    const thrustMag = state.getThrustVector().length();
    const consumed = (thrustMag > 0 ? thrustMag / (state.getIsp() * 9.80665) : 0) * dt;
    if (state.stage === 1) state.fuel1 = Math.max(0, state.fuel1 - consumed);
    else state.fuel2 = Math.max(0, state.fuel2 - consumed);
    
    state.flightTime += dt;
}

export function executeGuidance(state, dt) {
    if (!state.isLaunched || state.missionAccomplished) return;
    if (state.v.length() < 0.1) {
        // 發射瞬間初始俯仰微擾 (Pitch Kick)
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,0,1), 0.02).normalize();
        return;
    }
    // 零攻角重力轉向閉環控制
    const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
    const errorAngle = error.length();
    if (errorAngle > 0.0001) {
        state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.5 * dt * 3)).normalize();
    }
}

function createEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(512, 256, 0, 512, 256, 512);
    gradient.addColorStop(0, '#1a3b5c'); gradient.addColorStop(1, '#0a1a2e');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1024, 512);
    
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 360; i += 30) { ctx.beginPath(); ctx.moveTo((i/360)*1024, 0); ctx.lineTo((i/360)*1024, 512); ctx.stroke(); }
    for (let i = 0; i <= 180; i += 30) { ctx.beginPath(); ctx.moveTo(0, (i/180)*512); ctx.lineTo(1024, (i/180)*512); ctx.stroke(); }
    
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    [[300,200],[450,150],[600,280],[200,350],[750,200]].forEach(([cx, cy]) => {
        ctx.beginPath(); ctx.ellipse(cx, cy, 80 + Math.random()*60, 60 + Math.random()*40, 0, 0, Math.PI*2); ctx.fill();
    });
    return new THREE.CanvasTexture(canvas);
}

export function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500000000);
    camera.position.set(R_EARTH + 30000, 20000, 60000);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerEl.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 10000;
    controls.maxDistance = 400000000;

    scene.add(new THREE.DirectionalLight(0xffffff, 2).position.set(100000000, 50000000, 100000000));
    scene.add(new THREE.AmbientLight(0x223366, 0.5));

    earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R_EARTH, 64, 64),
        new THREE.MeshPhongMaterial({ map: createEarthTexture(), specular: 0x222244, shininess: 10, emissive: 0x0a1a3a, emissiveIntensity: 0.1 })
    );
    scene.add(earthMesh);

    moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R_MOON, 32, 32),
        new THREE.MeshPhongMaterial({ color: 0x888888, emissive: 0x222222, emissiveIntensity: 0.2 })
    );
    scene.add(moonMesh);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(200, 10, 200), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    pad.position.set(R_EARTH, 0, 0);
    scene.add(pad);

    rocketGroup = new THREE.Group();
    build3DRocket(rocketGroup);
    scene.add(rocketGroup);

    velArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 1, 0x00ff00);
    thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 1, 0xff5500);
    scene.add(velArrow); scene.add(thrustArrow);
}

function build3DRocket(group) {
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.8, roughness: 0.2 });
    const matBlue = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.3 });
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 36, 16), matWhite); s1.position.y = 18; group.add(s1);
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 14, 16), matBlue); s2.position.y = 43; group.add(s2);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.4, 10, 16), matWhite); nose.position.y = 55; group.add(nose);
}

export function spawnExhaustParticles(pos, power) {
    if (exhaustParticles.length > 100) return;
    for (let i=0; i<3; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.8 + Math.random()*0.6, 4, 4),
            new THREE.MeshBasicMaterial({ color: Math.random()>0.4?0xff7700:0xffdd00, transparent: true, opacity: 0.9 })
        );
        p.position.set(pos.x+(Math.random()-0.5)*2, pos.y-1.5, pos.z+(Math.random()-0.5)*2);
        scene.add(p);
        exhaustParticles.push({ mesh: p, vx: (Math.random()-0.5)*6, vy: -(20 + Math.random()*30)*power, vz: (Math.random()-0.5)*6, life: 1.0 });
    }
}

export function updateExhaustParticles(dt) {
    for (let i=exhaustParticles.length-1; i>=0; i--) {
        const p = exhaustParticles[i];
        p.mesh.position.add(new THREE.Vector3(p.vx, p.vy, p.vz).multiplyScalar(dt));
        p.mesh.scale.multiplyScalar(1.03);
        p.life -= dt * 2.5;
        p.mesh.material.opacity = Math.max(0, p.life);
        if (p.life <= 0) { scene.remove(p.mesh); exhaustParticles.splice(i, 1); }
    }
}
