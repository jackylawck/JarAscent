/**
 * js/rocket_engine.js - JarAscent 3D 航太級動力學與高畫質渲染核心
 * @license MIT
 */

const THREE = window.THREE;

const MU = 3.986004418e14;
const MU_MOON = 4.9048695e12;
const R_EARTH = 6378137;
const R_MOON = 1737400;
const MOON_ORBIT_RADIUS = 384400000;
const ROTATION_SPEED = 7.292115e-5;
const J2 = 1.08262668e-3;

export let scene, camera, renderer, controls;
export let rocketGroup, exhaustParticles = [];
export let earthMesh, moonMesh, launchTowerGroup;
export let velArrow, thrustArrow;

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
        this.r = new THREE.Vector3(R_EARTH + 50, 0, 0); // 初始置於發射台上方
        this.v = new THREE.Vector3(0, 0, ROTATION_SPEED * R_EARTH);
        this.mass = 0;
        this.fuel1 = 0;
        this.fuel2 = 0;
        this.stage = 1;
        this.payloadMass = 0;
        this.engine = null;
        this.thrustDir = new THREE.Vector3(1, 0, 0); // 在 (R_EARTH,0,0) 時，徑向向上為 +X
        this.throttle = 1.0;
        this.flightTime = 0;
        this.isLaunched = false;
        
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
        this.thrustDir.set(1, 0, 0);
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
    if (state.flightTime < 3.0) {
        // 發射前3秒垂直爬升，之後給予東向微擾
        return;
    }
    if (state.flightTime >= 3.0 && state.flightTime < 3.5) {
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,1,0), -0.015).normalize();
        return;
    }
    // 零攻角重力轉向閉環控制
    const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
    const errorAngle = error.length();
    if (errorAngle > 0.0001) {
        state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.6 * dt * 3)).normalize();
    }
}

// 產生寫實動態地球紋理
function createEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // 深邃大洋
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    oceanGrad.addColorStop(0, '#0a2342');
    oceanGrad.addColorStop(0.5, '#00122e');
    oceanGrad.addColorStop(1, '#0a2342');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 2048, 1024);
    
    // 大陸板塊與綠洲
    ctx.fillStyle = '#1e3d2f';
    const landContours = [
        [400, 300, 250, 180], [600, 250, 180, 120], [1200, 350, 320, 200],
        [1500, 600, 220, 160], [500, 650, 200, 280], [1600, 300, 260, 180]
    ];
    landContours.forEach(([x, y, rx, ry]) => {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.PI/6, 0, Math.PI*2); ctx.fill();
    });
    
    // 科技經緯網格
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 360; i += 15) { ctx.beginPath(); ctx.moveTo((i/360)*2048, 0); ctx.lineTo((i/360)*2048, 1024); ctx.stroke(); }
    for (let i = 0; i <= 180; i += 15) { ctx.beginPath(); ctx.moveTo(0, (i/180)*1024); ctx.lineTo(2048, (i/180)*1024); ctx.stroke(); }
    
    return new THREE.CanvasTexture(canvas);
}

// 建立 3D 星空背景
function createStarField() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
        const rad = R_EARTH * 20 + Math.random() * R_EARTH * 10;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        starPos[i] = rad * Math.sin(phi) * Math.cos(theta);
        starPos[i+1] = rad * Math.sin(phi) * Math.sin(theta);
        starPos[i+2] = rad * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 20000, transparent: true, opacity: 0.8 });
    return new THREE.Points(starGeo, starMat);
}

export function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010409);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500000000);
    camera.position.set(R_EARTH + 300, 100, 400); // 初始置於發射台近距離特寫

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerEl.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 50;
    controls.maxDistance = 400000000;
    controls.target.set(R_EARTH, 0, 0);

    // 宇宙星空
    scene.add(createStarField());

    // 太陽強光與太空環境光
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(100000000, 50000000, 100000000);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x1a2639, 0.8));

    // 地球本體
    earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R_EARTH, 96, 96),
        new THREE.MeshPhongMaterial({ map: createEarthTexture(), specular: 0x112244, shininess: 15 })
    );
    scene.add(earthMesh);

    // 大氣層發光外殼 (Atmospheric Glow)
    const atmoMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide
    });
    const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * 1.015, 64, 64), atmoMat);
    scene.add(atmoMesh);

    // 月球本體
    moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R_MOON, 32, 32),
        new THREE.MeshPhongMaterial({ color: 0xcccccc, emissive: 0x111111, emissiveIntensity: 0.2 })
    );
    scene.add(moonMesh);

    // 發射台與發射塔架 (Launch Pad & Tower)
    buildLaunchPadAndTower();

    // 火箭本體 (具備動態發光漆與格柵舵)
    rocketGroup = new THREE.Group();
    build3DRocket(rocketGroup);
    rocketGroup.position.set(R_EARTH, 0, 0);
    scene.add(rocketGroup);

    // 向量箭頭 (動態調整長度)
    velArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 100, 0x00ff00);
    thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 80, 0xff5500);
    scene.add(velArrow); scene.add(thrustArrow);
}

function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    
    // 主發射台底盤
    const padMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(40, 100, 100), padMat);
    pad.position.set(R_EARTH - 20, 0, 0);
    launchTowerGroup.add(pad);

    // 鋼結構發射塔架 (Umbilical Tower)
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.5, roughness: 0.5 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(100, 12, 12), towerMat);
    tower.position.set(R_EARTH + 30, 20, -15);
    launchTowerGroup.add(tower);

    // 塔架連接臂 (Service Arm)
    const armMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 25, 4), armMat);
    arm.position.set(R_EARTH + 50, 10, -10);
    launchTowerGroup.add(arm);

    scene.add(launchTowerGroup);
}

function build3DRocket(group) {
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.8, roughness: 0.2 });
    const matCarbon = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.1 });

    // 一級助推火箭 (直徑 3.7m, 長度 42m)
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 42, 32), matWhite);
    s1.position.y = 21; group.add(s1);

    // 發動機噴嘴
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 32), matEngine);
    nozzle.position.y = -1; group.add(nozzle);

    // 二級火箭
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 16, 32), matCarbon);
    s2.position.y = 50; group.add(s2);

    // 整流罩鼻錐
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.4, 12, 32), matWhite);
    nose.position.y = 64; group.add(nose);

    // 4 個黑色鈦合金格柵舵
    for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 4), matEngine);
        const angle = (i / 4) * Math.PI * 2;
        fin.position.set(Math.cos(angle) * 2.8, 8, Math.sin(angle) * 2.8);
        fin.rotation.y = -angle;
        group.add(fin);
    }
}

export function spawnExhaustParticles(pos, power) {
    if (exhaustParticles.length > 150) return;
    for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(1.2 + Math.random() * 1.5, 6, 6),
            new THREE.MeshBasicMaterial({
                color: Math.random() > 0.3 ? 0xff6600 : 0xffdd00,
                transparent: true,
                opacity: 0.95
            })
        );
        p.position.set(pos.x + (Math.random() - 0.5) * 4, pos.y - 2, pos.z + (Math.random() - 0.5) * 4);
        scene.add(p);
        exhaustParticles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * 10,
            vy: -(30 + Math.random() * 50) * power,
            vz: (Math.random() - 0.5) * 10,
            life: 1.0
        });
    }
}

export function updateExhaustParticles(dt) {
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
        const p = exhaustParticles[i];
        p.mesh.position.add(new THREE.Vector3(p.vx, p.vy, p.vz).multiplyScalar(dt));
        p.mesh.scale.multiplyScalar(1.04);
        p.life -= dt * 2.2;
        p.mesh.material.opacity = Math.max(0, p.life);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            exhaustParticles.splice(i, 1);
        }
    }
}
