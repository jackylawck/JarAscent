/**
 * js/rocket_engine.js - JarAscent 3D 航太動力學與高擬真排焰煙浪
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
export let rocketGroup, stage1Mesh, stage2Mesh, machConeMesh, exhaustParticles = [];
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
        this.r = new THREE.Vector3(0, R_EARTH, 0);
        this.v = new THREE.Vector3(ROTATION_SPEED * R_EARTH, 0, 0);
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

    // 計算當前感應加速度過載 (G-Force)
    state.currentGForce = (thrustAcc.length() / 9.80665) + (state.isLaunched ? 0 : 1.0);

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
            const dynQ = 0.5 * rho * speed * speed;
            if (dynQ > state.maxQ) state.maxQ = dynQ;
            dragAcc = relV.normalize().multiplyScalar(-dynQ * Cd * 10.5 / mass);
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
    if (state.flightTime < 4.0) return;
    if (state.flightTime >= 4.0 && state.flightTime < 4.5) {
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,0,1), -0.02).normalize();
        return;
    }
    const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
    const errorAngle = error.length();
    if (errorAngle > 0.0001) {
        state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.8 * dt * 3)).normalize();
    }
}

export function spawnDebris(state) {
    const debrisGroup = new THREE.Group();
    const s1Geo = new THREE.CylinderGeometry(0.3, 0.3, 4.2, 16);
    const s1Mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    debrisGroup.add(new THREE.Mesh(s1Geo, s1Mat));
    
    debrisGroup.position.copy(state.r.clone().multiplyScalar(WORLD_SCALE));
    scene.add(debrisGroup);

    debrisList.push({
        r: state.r.clone(),
        v: state.v.clone().add(new THREE.Vector3((Math.random()-0.5)*100, -80, (Math.random()-0.5)*100)),
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
        d.mesh.rotation.x += dt * 0.5;
        d.mesh.rotation.z += dt * 0.3;

        if (d.life <= 0 || d.r.length() < R_EARTH) {
            scene.remove(d.mesh);
            debrisList.splice(i, 1);
        }
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
    const starCount = 2500;
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
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 18, transparent: true, opacity: 0.85 });
    return new THREE.Points(starGeo, starMat);
}

export function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x020617, 0.0001);

    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 1, 30000);
    camera.position.set(0, 1008, 25);

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
    controls.target.set(0, 1002, 0);

    scene.add(createStarField());

    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(3000, 5000, 4000);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x1e293b, 0.9));

    rocketLight = new THREE.PointLight(0xff7700, 0, 150);
    scene.add(rocketLight);

    earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1000, 64, 64),
        new THREE.MeshPhongMaterial({ map: createEarthTexture(), specular: 0x112244, shininess: 15 })
    );
    scene.add(earthMesh);

    const atmoMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1015, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.15, side: THREE.BackSide })
    );
    scene.add(atmoMesh);

    moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R_MOON * WORLD_SCALE, 32, 32),
        new THREE.MeshPhongMaterial({ color: 0xcccccc, emissive: 0x111111 })
    );
    scene.add(moonMesh);

    buildLaunchPadAndTower();

    rocketGroup = new THREE.Group();
    build3DRocket(rocketGroup);
    rocketGroup.position.set(0, 1000, 0);
    scene.add(rocketGroup);

    velArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 10, 0x00ff00);
    thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 8, 0xff5500);
    scene.add(velArrow); scene.add(thrustArrow);
}

function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    
    const padGeo = new THREE.CylinderGeometry(8, 10, 4, 32);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 998, 0);
    launchTowerGroup.add(pad);

    const towerGroup = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.4 });
    
    const colGeo = new THREE.CylinderGeometry(0.12, 0.12, 12, 8);
    [[-1,-1], [1,-1], [-1,1], [1,1]].forEach(([cx, cz]) => {
        const col = new THREE.Mesh(colGeo, towerMat);
        col.position.set(cx * 1.2, 6, cz * 1.2);
        towerGroup.add(col);
    });

    for (let h = 1; h <= 11; h += 1.5) {
        const beamGeo = new THREE.BoxGeometry(2.4, 0.08, 0.08);
        const b1 = new THREE.Mesh(beamGeo, towerMat); b1.position.set(0, h, 1.2); towerGroup.add(b1);
        const b2 = new THREE.Mesh(beamGeo, towerMat); b2.position.set(0, h, -1.2); towerGroup.add(b2);
    }
    
    const armGeo = new THREE.BoxGeometry(2.5, 0.3, 0.4);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.8 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(-1.2, 8.5, 0);
    towerGroup.add(arm);

    towerGroup.position.set(3.5, 1000, 0);
    launchTowerGroup.add(towerGroup);

    [-6, 6].forEach(x => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 14, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
        pole.position.set(x, 1005, -3);
        launchTowerGroup.add(pole);
    });

    scene.add(launchTowerGroup);
}

function build3DRocket(group) {
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.8, roughness: 0.2 });
    const matBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    stage1Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.8, 32), matWhite);
    stage1Mesh.position.y = 2.4;
    group.add(stage1Mesh);

    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 32), matEngine);
    nozzle.position.y = -0.2; stage1Mesh.add(nozzle);

    stage2Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.35, 1.8, 32), matBlue);
    stage2Mesh.position.y = 5.7; group.add(stage2Mesh);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.33, 1.5, 32), matWhite);
    nose.position.y = 7.35; group.add(nose);

    const coneGeo = new THREE.ConeGeometry(1.5, 2.2, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide });
    machConeMesh = new THREE.Mesh(coneGeo, coneMat);
    machConeMesh.position.y = 5.2;
    group.add(machConeMesh);

    for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.6), matEngine);
        const angle = (i / 4) * Math.PI * 2;
        fin.position.set(Math.cos(angle) * 0.42, 0.8, Math.sin(angle) * 0.42);
        fin.rotation.y = -angle;
        stage1Mesh.add(fin);
    }
}

export function spawnExhaustParticles(pos, power, isLowAltitude = true) {
    if (exhaustParticles.length > 250) return;
    
    const count = isLowAltitude ? 6 : 3;
    const spread = isLowAltitude ? 4.0 : 1.2;
    const upwardBias = isLowAltitude ? 0.6 : 2.0;
    const windDir = new THREE.Vector3(0.4, 0, -0.2).normalize();

    for (let i = 0; i < count; i++) {
        const isFire = Math.random() < 0.4;
        const size = isLowAltitude ? (0.35 + Math.random() * 0.5) : (0.18 + Math.random() * 0.25);
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(size, 6, 6),
            new THREE.MeshBasicMaterial({
                color: isFire ? (Math.random() > 0.5 ? 0xff4400 : 0xffaa00) : 0xe2e8f0,
                transparent: true,
                opacity: 0.9
            })
        );

        p.position.set(
            pos.x + (Math.random() - 0.5) * 0.6,
            pos.y - 0.3,
            pos.z + (Math.random() - 0.5) * 0.6
        );
        scene.add(p);

        exhaustParticles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * spread + windDir.x * 1.5,
            vy: -(5 + Math.random() * 7) * power * upwardBias,
            vz: (Math.random() - 0.5) * spread + windDir.z * 1.5,
            expansion: isLowAltitude ? 1.07 : 1.03,
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
