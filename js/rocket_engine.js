/**
 * js/rocket_engine.js - JarAscent 3D 物理與渲染引擎 (解耦視覺與物理尺度)
 * @license MIT
 */

const THREE = window.THREE;

export const MU = 3.986004418e14;
export const MU_MOON = 4.9048695e12;
export const R_EARTH = 6378137;
export const R_MOON = 1737400;
export const MOON_ORBIT_RADIUS = 384400000;
export const ROTATION_SPEED = 7.292115e-5;
export const J2 = 1.08262668e-3;

// 視覺渲染縮放常數：將 6378km 地球映射至 1000 Three.js 單位
export const WORLD_SCALE = 1000 / R_EARTH; 

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
        this.r = new THREE.Vector3(R_EARTH, 0, 0);
        this.v = new THREE.Vector3(0, 0, ROTATION_SPEED * R_EARTH);
        this.mass = 0;
        this.fuel1 = 0;
        this.fuel2 = 0;
        this.stage = 1;
        this.payloadMass = 0;
        this.engine = null;
        this.thrustDir = new THREE.Vector3(1, 0, 0);
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
    if (state.flightTime < 3.0) return;
    if (state.flightTime >= 3.0 && state.flightTime < 3.5) {
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,1,0), -0.015).normalize();
        return;
    }
    const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
    const errorAngle = error.length();
    if (errorAngle > 0.0001) {
        state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.6 * dt * 3)).normalize();
    }
}

function createEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0, '#0a2342');
    oceanGrad.addColorStop(0.5, '#00122e');
    oceanGrad.addColorStop(1, '#0a2342');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 1024, 512);
    
    ctx.fillStyle = '#1e3d2f';
    const landContours = [[200, 150, 120, 90], [300, 120, 90, 60], [600, 180, 160, 100], [750, 300, 110, 80], [250, 320, 100, 140], [800, 150, 130, 90]];
    landContours.forEach(([x, y, rx, ry]) => {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.PI/6, 0, Math.PI*2); ctx.fill();
    });
    
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 360; i += 30) { ctx.beginPath(); ctx.moveTo((i/360)*1024, 0); ctx.lineTo((i/360)*1024, 512); ctx.stroke(); }
    for (let i = 0; i <= 180; i += 30) { ctx.beginPath(); ctx.moveTo(0, (i/180)*512); ctx.lineTo(1024, (i/180)*512); ctx.stroke(); }
    
    return new THREE.CanvasTexture(canvas);
}

function createStarField() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
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
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 15, transparent: true, opacity: 0.8 });
    return new THREE.Points(starGeo, starMat);
}

export function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010409);

    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    // 穩健相機視錐（解耦後的世界坐標系：near=1, far=30000）
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 30000);
    camera.position.set(1005, 10, 30); // 正確近距離對準發射台

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerEl.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 15000;
    controls.target.set(1000, 0, 0);

    scene.add(createStarField());

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(5000, 3000, 5000);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x223366, 0.8));

    // 地球 (半徑 1000)
    earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1000, 64, 64),
        new THREE.MeshPhongMaterial({ map: createEarthTexture(), specular: 0x112244, shininess: 15 })
    );
    scene.add(earthMesh);

    // 大氣層光暈
    const atmoMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1015, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12, side: THREE.BackSide })
    );
    scene.add(atmoMesh);

    // 月球
    moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R_MOON * WORLD_SCALE, 32, 32),
        new THREE.MeshPhongMaterial({ color: 0xcccccc, emissive: 0x111111 })
    );
    scene.add(moonMesh);

    buildLaunchPadAndTower();

    rocketGroup = new THREE.Group();
    build3DRocket(rocketGroup);
    rocketGroup.position.set(1000, 0, 0);
    scene.add(rocketGroup);

    velArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 10, 0x00ff00);
    thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 8, 0xff5500);
    scene.add(velArrow); scene.add(thrustArrow);
}

function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    
    const pad = new THREE.Mesh(
        new THREE.BoxGeometry(4, 10, 10), 
        new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    pad.position.set(999, 0, 0);
    launchTowerGroup.add(pad);

    const tower = new THREE.Mesh(
        new THREE.BoxGeometry(10, 1.5, 1.5), 
        new THREE.MeshStandardMaterial({ color: 0xb91c1c })
    );
    tower.position.set(1003, 3, -1.5);
    launchTowerGroup.add(tower);

    scene.add(launchTowerGroup);
}

function build3DRocket(group) {
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.8, roughness: 0.2 });
    const matBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.1 });

    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.2, 16), matWhite);
    s1.position.y = 2.1; group.add(s1);

    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 16), matEngine);
    nozzle.position.y = -0.1; group.add(nozzle);

    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 1.6, 16), matBlue);
    s2.position.y = 5.0; group.add(s2);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 16), matWhite);
    nose.position.y = 6.4; group.add(nose);

    for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.5), matEngine);
        const angle = (i / 4) * Math.PI * 2;
        fin.position.set(Math.cos(angle) * 0.35, 0.6, Math.sin(angle) * 0.35);
        fin.rotation.y = -angle;
        group.add(fin);
    }
}

export function spawnExhaustParticles(pos, power) {
    if (exhaustParticles.length > 80) return;
    for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 4, 4),
            new THREE.MeshBasicMaterial({ color: Math.random() > 0.3 ? 0xff6600 : 0xffdd00, transparent: true, opacity: 0.95 })
        );
        p.position.set(pos.x + (Math.random() - 0.5) * 0.4, pos.y - 0.2, pos.z + (Math.random() - 0.5) * 0.4);
        scene.add(p);
        exhaustParticles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(4 + Math.random() * 6) * power,
            vz: (Math.random() - 0.5) * 1.5,
            life: 1.0
        });
    }
}

export function updateExhaustParticles(dt) {
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
        const p = exhaustParticles[i];
        p.mesh.position.add(new THREE.Vector3(p.vx, p.vy, p.vz).multiplyScalar(dt));
        p.mesh.scale.multiplyScalar(1.05);
        p.life -= dt * 2.5;
        p.mesh.material.opacity = Math.max(0, p.life);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            exhaustParticles.splice(i, 1);
        }
    }
}
