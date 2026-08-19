/**
 * js/rocket_engine.js - JarAscent 3D 長征載人多級分離與晝夜環境核心
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

export const WORLD_SCALE = 1000 / R_EARTH; 

export let scene, camera, renderer, controls;
export let rocketGroup, flameMesh, machConeMesh, exhaustParticles = [];
export let escapeTowerMesh, boostersGroup, stage1Mesh, fairingLeftMesh, fairingRightMesh, stage2Mesh, spacecraftMesh;
export let earthMesh, moonMesh, launchTowerGroup, rocketLight, sunLight, hemiLight;
export let velArrow, thrustArrow;
export let debrisList = [];

// 🚀 支援長征二號F載人火箭參數
export const ENGINE_DATABASE = Object.freeze({
    CZ2F:     Object.freeze({ name: "CZ-2F",       thrustSea: 5920000, thrustVac: 6500000, ispSea: 289, ispVac: 315, dryMassStage1: 30000, fuelMassStage1: 450000, dryMassStage2: 5500, fuelMassStage2: 90000, thrustStage2: 742000 }),
    MERLIN:   Object.freeze({ name: "Falcon 9",    thrustSea: 7605000, thrustVac: 8227000, ispSea: 282, ispVac: 311, dryMassStage1: 22000, fuelMassStage1: 410000, dryMassStage2: 4000, fuelMassStage2: 92000, thrustStage2: 981000 }),
    RAPTOR:   Object.freeze({ name: "Starship",    thrustSea: 6750000, thrustVac: 7500000, ispSea: 327, ispVac: 363, dryMassStage1: 35000, fuelMassStage1: 600000, dryMassStage2: 7000, fuelMassStage2: 120000, thrustStage2: 2500000 }),
    SLS:      Object.freeze({ name: "SLS Core",    thrustSea: 7440000, thrustVac: 9116000, ispSea: 366, ispVac: 452, dryMassStage1: 32000, fuelMassStage1: 520000, dryMassStage2: 5000, fuelMassStage2: 100000, thrustStage2: 1860000 })
});

export function getMoonPosition(time) {
    const angularSpeed = 2 * Math.PI / (27.322 * 86400);
    const angle = angularSpeed * time;
    return new THREE.Vector3(MOON_ORBIT_RADIUS * Math.cos(angle), 0, MOON_ORBIT_RADIUS * Math.sin(angle));
}

export class RocketState {
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
        this.flightTime = 0;
        this.isLaunched = false;
        
        // 5 段式分離狀態標記
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
    }

    initEngine(engineKey, payloadMass) {
        const DB = ENGINE_DATABASE[engineKey] || ENGINE_DATABASE.CZ2F;
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
        const altRatio = Math.min(1, Math.max(0, alt / 80000));
        let baseThrust = (this.stage === 1) 
            ? this.engine.thrustSea + (this.engine.thrustVac - this.engine.thrustSea) * altRatio
            : this.engine.thrustStage2;

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

    state.currentGForce = (thrustAcc.length() / 9.80665) + (state.isLaunched ? 0 : 1.0);

    let dragAcc = new THREE.Vector3(0,0,0);
    const alt = rMag - R_EARTH;
    if (alt < 100000 && state.isLaunched && mass > 0) {
        const speed = v.length();
        if (speed > 0.1) {
            const rho = 1.225 * Math.exp(-alt / 8500);
            const Cd = (speed > 300 && speed < 600) ? 0.45 : 0.28;
            const dynQ = 0.5 * rho * speed * speed;
            if (dynQ > state.maxQ) state.maxQ = dynQ;
            dragAcc = v.clone().normalize().multiplyScalar(-dynQ * Cd * 10.5 / mass);
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

    if (state.v.length() > state.maxVelocity) state.maxVelocity = state.v.length();

    const thrustMag = state.getThrustVector().length();
    const consumed = (thrustMag > 0 ? thrustMag / (state.getIsp() * 9.80665) : 0) * dt;
    if (state.stage === 1) state.fuel1 = Math.max(0, state.fuel1 - consumed);
    else state.fuel2 = Math.max(0, state.fuel2 - consumed);
    
    state.flightTime += dt;
}

export function executeGuidance(state, dt) {
    if (!state.isLaunched || state.missionAccomplished) return;
    
    // T+0 ~ T+8s：絕對垂直發射
    if (state.flightTime < 8.0) {
        state.thrustDir.set(0, 1, 0);
        return;
    }
    // T+8s ~ T+12s：重力轉向初始傾角
    if (state.flightTime >= 8.0 && state.flightTime < 12.0) {
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,0,1), -0.008).normalize();
        return;
    }
    // 零攻角重力轉向閉環
    if (state.v.length() > 50) {
        const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
        const errorAngle = error.length();
        if (errorAngle > 0.0001) {
            state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.6 * dt * 2)).normalize();
        }
    }
}

// 📦 生成分離碎片物理模型
export function spawnDebrisPiece(state, mesh, relVel) {
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

export function updateDebris(dt) {
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

function createEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    oceanGrad.addColorStop(0, '#0a2342');
    oceanGrad.addColorStop(0.5, '#00122e');
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
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 16, transparent: true, opacity: 0.9 });
    return new THREE.Points(starGeo, starMat);
}

// ☀️/🌙 應用晝夜環境光源與天空
export function setEnvironmentMode(mode) {
    if (!scene) return;
    if (mode === 'DAY') {
        scene.background = new THREE.Color(0x38bdf8); // 白天蔚藍天空
        scene.fog.color = new THREE.Color(0xbae6fd);
        scene.fog.density = 0.0003;
        if (sunLight) { sunLight.color.setHex(0xffffff); sunLight.intensity = 2.8; }
        if (hemiLight) { hemiLight.color.setHex(0xe0f2fe); hemiLight.groundColor.setHex(0x334155); hemiLight.intensity = 1.2; }
    } else {
        scene.background = new THREE.Color(0x020617); // 深邃星空之夜
        scene.fog.color = new THREE.Color(0x020617);
        scene.fog.density = 0.0001;
        if (sunLight) { sunLight.color.setHex(0xffedd5); sunLight.intensity = 1.8; }
        if (hemiLight) { hemiLight.color.setHex(0x1e293b); hemiLight.groundColor.setHex(0x020617); hemiLight.intensity = 0.6; }
    }
}

export function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.0003);

    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 30000);
    camera.position.set(0, 1008, 30);

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
    controls.target.set(0, 1005, 0);

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

    // 🚀 建立長征二號F全流程可分離火箭模型
    rocketGroup = new THREE.Group();
    buildCZ2FRocket(rocketGroup);
    rocketGroup.position.set(0, 1000.8, 0);
    scene.add(rocketGroup);

    velArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 10, 0x00ff00);
    thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 8, 0xff5500);
    scene.add(velArrow); scene.add(thrustArrow);
}

function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.2 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 1.6, 32), padMat);
    pad.position.set(0, 1000, 0);
    launchTowerGroup.add(pad);

    const trenchMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d });
    const trench = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1.8, 24), trenchMat);
    trench.position.set(0, 1000, 0);
    launchTowerGroup.add(trench);

    const towerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.4 });
    const tower = new THREE.Group();
    
    const colGeo = new THREE.CylinderGeometry(0.12, 0.12, 14, 8);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([cx, cz]) => {
        const col = new THREE.Mesh(colGeo, towerMat);
        col.position.set(cx, 7, cz);
        tower.add(col);
    });

    for (let y = 1; y <= 13; y += 1.5) {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.08), towerMat); b1.position.set(0, y, 1.0); tower.add(b1);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.08), towerMat); b2.position.set(0, y, -1.0); tower.add(b2);
        const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.0), towerMat); b3.position.set(1.0, y, 0); tower.add(b3);
        const b4 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.0), towerMat); b4.position.set(-1.0, y, 0); tower.add(b4);
    }

    const armMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.8 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 0.25), armMat);
    arm.position.set(-1.1, 10.5, 0);
    tower.add(arm);

    tower.position.set(3.2, 1000.8, 0);
    launchTowerGroup.add(tower);

    [-5, 5].forEach(x => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.15, 15, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        pole.position.set(x, 1007, -3);
        launchTowerGroup.add(pole);
    });

    scene.add(launchTowerGroup);
}

// 🚀 建立長征二號F（CZ-2F）全模組火箭
function buildCZ2FRocket(group) {
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.5, roughness: 0.2 });
    const matRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 });
    const matGold = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    // 1. 白熱電漿主火焰 (Flame Column)
    const flameGeo = new THREE.ConeGeometry(0.5, 5.0, 24);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.95 });
    flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.y = -2.5;
    flameMesh.rotation.x = Math.PI;
    flameMesh.visible = false;
    group.add(flameMesh);

    // 2. 4枚側邊液體助推器 (Boosters Group)
    boostersGroup = new THREE.Group();
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const bGroup = new THREE.Group();
        const bBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.8, 16), matWhite);
        const bNose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 16), matWhite);
        bNose.position.y = 2.3;
        bGroup.add(bBody); bGroup.add(bNose);
        bGroup.position.set(Math.cos(angle) * 0.58, 2.0, Math.sin(angle) * 0.58);
        boostersGroup.add(bGroup);
    }
    group.add(boostersGroup);

    // 3. 芯一級火箭 (Stage 1)
    stage1Mesh = new THREE.Group();
    const s1Body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 5.0, 32), matWhite);
    s1Body.position.y = 2.6;
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 24), matEngine);
    nozzle.position.y = 0.2;
    stage1Mesh.add(s1Body); stage1Mesh.add(nozzle);
    group.add(stage1Mesh);

    // 4. 芯二級火箭 (Stage 2)
    stage2Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 2.6, 32), matWhite);
    stage2Mesh.position.y = 6.4;
    group.add(stage2Mesh);

    // 5. 神舟飛船本體 (Spacecraft - 包含返回艙與推進艙)
    spacecraftMesh = new THREE.Group();
    const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.34, 1.2, 24), matGold);
    capsule.position.y = 8.1;
    // 太陽能翼板
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.4), panelMat); p1.position.set(1.0, 8.1, 0);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.4), panelMat); p2.position.set(-1.0, 8.1, 0);
    spacecraftMesh.add(capsule); spacecraftMesh.add(p1); spacecraftMesh.add(p2);
    group.add(spacecraftMesh);

    // 6. 整流罩左右兩半 (Fairings)
    const fairingMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.6, roughness: 0.2 });
    fairingLeftMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.8, 16, 1, false, 0, Math.PI), fairingMat);
    fairingLeftMesh.position.y = 8.1;
    fairingRightMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.8, 16, 1, false, Math.PI, Math.PI), fairingMat);
    fairingRightMesh.position.y = 8.1;
    group.add(fairingLeftMesh); group.add(fairingRightMesh);

    // 7. 頂部逃逸塔 (Launch Escape Tower)
    escapeTowerMesh = new THREE.Group();
    const towerPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 2.2, 12), matRed);
    towerPole.position.y = 10.1;
    const towerNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 12), matEngine);
    towerNozzle.position.y = 11.2;
    escapeTowerMesh.add(towerPole); escapeTowerMesh.add(towerNozzle);
    group.add(escapeTowerMesh);

    // 音障馬赫錐
    const coneGeo = new THREE.ConeGeometry(1.4, 2.0, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide });
    machConeMesh = new THREE.Mesh(coneGeo, coneMat);
    machConeMesh.position.y = 7.0;
    group.add(machConeMesh);
}

export function spawnExhaustParticles(pos, power, isLowAltitude = true) {
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
            new THREE.MeshBasicMaterial({
                color: isFire ? (Math.random() > 0.5 ? 0xff5500 : 0xffbb00) : 0xe2e8f0,
                transparent: true,
                opacity: 0.9
            })
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

export function updateExhaustParticles(dt) {
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
