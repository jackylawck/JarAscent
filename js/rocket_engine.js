/**
 * js/rocket_engine.js - JarAscent 3D 航太動力學與高畫質升空視覺引擎
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
export let rocketGroup, stage1Mesh, stage2Mesh, flameMesh, machConeMesh, exhaustParticles = [];
export let earthMesh, moonMesh, launchTowerGroup, rocketLight;
export let velArrow, thrustArrow;
export let debrisList = [];

export const ENGINE_DATABASE = Object.freeze({
    MERLIN:   Object.freeze({ name: "Merlin 9x",   thrustSea: 845000 * 9,   thrustVac: 981000 * 9,   ispSea: 282, ispVac: 311, dryMassStage1: 22000, fuelMassStage1: 410000, dryMassStage2: 4000, fuelMassStage2: 92000, thrustStage2: 981000 }),
    RAPTOR:   Object.freeze({ name: "Raptor 3x",   thrustSea: 2250000 * 3,  thrustVac: 2500000 * 3,  ispSea: 327, ispVac: 363, dryMassStage1: 35000, fuelMassStage1: 600000, dryMassStage2: 7000, fuelMassStage2: 120000, thrustStage2: 2500000 }),
    HYDROGEN: Object.freeze({ name: "RS-25 4x",    thrustSea: 1860000 * 4,  thrustVac: 2279000 * 4,  ispSea: 366, ispVac: 452, dryMassStage1: 30000, fuelMassStage1: 500000, dryMassStage2: 5000, fuelMassStage2: 100000, thrustStage2: 1860000 }),
    SOLID:    Object.freeze({ name: "Solid SRB 2x", thrustSea: 3500000 * 2, thrustVac: 3800000 * 2, ispSea: 242, ispVac: 268, dryMassStage1: 45000, fuelMassStage1: 400000, dryMassStage2: 4500, fuelMassStage2: 70000, thrustStage2: 1200000 })
});

export function getMoonPosition(time) {
    const angularSpeed = 2 * Math.PI / (27.322 * 86400);
    const angle = angularSpeed * time;
    return new THREE.Vector3(MOON_ORBIT_RADIUS * Math.cos(angle), 0, MOON_ORBIT_RADIUS * Math.sin(angle));
}

export class RocketState {
    constructor() {
        this.r = new THREE.Vector3(0, R_EARTH, 0); // 嚴格置於發射台垂直頂點
        this.v = new THREE.Vector3(0, 0, 0);       // 修正：地面相對初速為 0，防止橫向失控
        this.mass = 0;
        this.fuel1 = 0;
        this.fuel2 = 0;
        this.stage = 1;
        this.payloadMass = 0;
        this.engine = null;
        this.thrustDir = new THREE.Vector3(0, 1, 0); // 嚴格垂直向上
        this.throttle = 1.0;
        this.flightTime = 0;
        this.isLaunched = false;
        
        this.guidanceActive = false;
        this.targetPeriapsis = 300000;
        this.targetApoapsis = 300000;
        this.missionAccomplished = false;
        
        this.maxVelocity = 0;
        this.maxQ = 0;
        this.currentGForce = 1.0;
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

// 修正：發射前 10 秒純垂直爬升，之後才啟動平滑重力轉向
export function executeGuidance(state, dt) {
    if (!state.isLaunched || state.missionAccomplished) return;
    
    // T+0 ~ T+8s：絕對垂直發射
    if (state.flightTime < 8.0) {
        state.thrustDir.set(0, 1, 0);
        return;
    }
    // T+8s ~ T+12s：微幅初始俯仰傾斜 (Pitch-Over)
    if (state.flightTime >= 8.0 && state.flightTime < 12.0) {
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,0,1), -0.008).normalize();
        return;
    }
    // T+12s 後：零攻角閉環重力轉向
    if (state.v.length() > 50) {
        const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
        const errorAngle = error.length();
        if (errorAngle > 0.0001) {
            state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.6 * dt * 2)).normalize();
        }
    }
}

export function spawnDebris(state) {
    const debrisGroup = new THREE.Group();
    const s1Geo = new THREE.CylinderGeometry(0.38, 0.38, 6.0, 24);
    const s1Mat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    debrisGroup.add(new THREE.Mesh(s1Geo, s1Mat));
    
    debrisGroup.position.copy(state.r.clone().multiplyScalar(WORLD_SCALE));
    scene.add(debrisGroup);

    debrisList.push({
        r: state.r.clone(),
        v: state.v.clone().add(new THREE.Vector3((Math.random()-0.5)*80, -60, (Math.random()-0.5)*80)),
        mesh: debrisGroup,
        life: 120
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
        d.mesh.rotation.z += dt * 0.2;

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
    oceanGrad.addColorStop(0.5, '#021024');
    oceanGrad.addColorStop(1, '#0a2342');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 2048, 1024);
    
    ctx.fillStyle = '#14532d';
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

export function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x020617, 0.0001);

    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 30000);
    camera.position.set(0, 1008, 28); // 正面仰望垂直屹立的火箭

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

    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(2000, 4000, 3000);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x334155, 1.0));

    // 發動機高光火光
    rocketLight = new THREE.PointLight(0xff6600, 0, 200);
    scene.add(rocketLight);

    earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1000, 64, 64),
        new THREE.MeshStandardMaterial({ map: createEarthTexture(), roughness: 0.8, metalness: 0.1 })
    );
    scene.add(earthMesh);

    const atmoMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1012, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12, side: THREE.BackSide })
    );
    scene.add(atmoMesh);

    moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R_MOON * WORLD_SCALE, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 })
    );
    scene.add(moonMesh);

    buildLaunchPadAndTower();

    // 建造長征/獵鷹級比例火箭
    rocketGroup = new THREE.Group();
    build3DRocket(rocketGroup);
    rocketGroup.position.set(0, 1000.8, 0); // 垂直立於發射台之上
    scene.add(rocketGroup);

    velArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 10, 0x00ff00);
    thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 8, 0xff5500);
    scene.add(velArrow); scene.add(thrustArrow);
}

function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    
    // 混凝土台座
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.2 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 1.6, 32), padMat);
    pad.position.set(0, 1000, 0);
    launchTowerGroup.add(pad);

    // 排焰口
    const trenchMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d });
    const trench = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.8, 24), trenchMat);
    trench.position.set(0, 1000, 0);
    launchTowerGroup.add(trench);

    // 紅色主桁架發射塔 (立於火箭側邊)
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.4 });
    const tower = new THREE.Group();
    
    const colGeo = new THREE.CylinderGeometry(0.12, 0.12, 13, 8);
    [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([cx, cz]) => {
        const col = new THREE.Mesh(colGeo, towerMat);
        col.position.set(cx, 6.5, cz);
        tower.add(col);
    });

    for (let y = 1; y <= 12; y += 1.5) {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08), towerMat); b1.position.set(0, y, 0.9); tower.add(b1);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08), towerMat); b2.position.set(0, y, -0.9); tower.add(b2);
        const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.8), towerMat); b3.position.set(0.9, y, 0); tower.add(b3);
        const b4 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.8), towerMat); b4.position.set(-0.9, y, 0); tower.add(b4);
    }

    const armMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.8 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.25), armMat);
    arm.position.set(-1.0, 9.5, 0);
    tower.add(arm);

    tower.position.set(2.8, 1000.8, 0);
    launchTowerGroup.add(tower);

    [-4.5, 4.5].forEach(x => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.15, 14, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        pole.position.set(x, 1007, -2.5);
        launchTowerGroup.add(pole);
    });

    scene.add(launchTowerGroup);
}

// 建造長征級細長火箭與高亮白熱主火柱
function build3DRocket(group) {
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.6, roughness: 0.2 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    // 🔥 [央視升空圖同款] 實體白熱錐形電漿火焰 (Exhaust Flame Column)
    const flameGeo = new THREE.ConeGeometry(0.45, 4.5, 24);
    const flameMat = new THREE.MeshBasicMaterial({
        color: 0xffeedd,
        transparent: true,
        opacity: 0.95
    });
    flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.y = -2.25; // 噴嘴下方
    flameMesh.rotation.x = Math.PI; // 錐尖朝下
    flameMesh.visible = false; // 未點火前隱藏
    group.add(flameMesh);

    // 一級主發動機噴嘴
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 24), matEngine);
    nozzle.position.y = 0.3;
    group.add(nozzle);

    // 一級主火箭 (y=0.6 ~ y=5.6)
    stage1Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 5.0, 32), matWhite);
    stage1Mesh.position.y = 3.1;
    group.add(stage1Mesh);

    // 二級火箭 (y=5.6 ~ y=8.0)
    stage2Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 2.4, 32), matAccent);
    stage2Mesh.position.y = 6.8;
    group.add(stage2Mesh);

    // 空氣動力整流罩鼻錐 (y=8.0 ~ y=9.6)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.6, 32), matWhite);
    nose.position.y = 8.8;
    group.add(nose);

    // 音障馬赫錐
    const coneGeo = new THREE.ConeGeometry(1.4, 2.0, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide });
    machConeMesh = new THREE.Mesh(coneGeo, coneMat);
    machConeMesh.position.y = 6.5;
    group.add(machConeMesh);

    // 4 片格柵舵
    for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.6), matEngine);
        const angle = (i / 4) * Math.PI * 2;
        fin.position.set(Math.cos(angle) * 0.44, 1.2, Math.sin(angle) * 0.44);
        fin.rotation.y = -angle;
        stage1Mesh.add(fin);
    }
}

// 產生滾滾發射煙浪
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

        p.position.set(
            pos.x + (Math.random() - 0.5) * 0.4,
            pos.y - 0.5,
            pos.z + (Math.random() - 0.5) * 0.4
        );
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
