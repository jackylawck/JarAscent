/**
 * js/rocket_engine.js - JarAscent 3D 物理引擎、等比例發射台與雙尺度視覺
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
export let activeRocketParts = null;
export let earthMesh, moonMesh, launchTowerGroup, rocketLight, sunLight, hemiLight;
export let velArrow, thrustArrow;
export let debrisList = [];
export let explosionParticles = [];

export const ROCKET_MODELS = Object.freeze({
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
        this.gravityTurnAlt = 8000;
        this.flightTime = 0;
        this.isLaunched = false;
        this.isDestroyed = false;
        this.failureReason = null;
        
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

    initEngine(engineKey, payloadMass, fuelFactor = 1.0, turnAltKm = 8) {
        const DB = ROCKET_MODELS[engineKey] || ROCKET_MODELS.CZ10A;
        this.engine = DB;
        this.payloadMass = payloadMass;
        this.fuel1 = DB.fuelMassStage1 * fuelFactor;
        this.fuel2 = DB.fuelMassStage2;
        this.thrustDir.set(0, 1, 0);
        this.gravityTurnAlt = turnAltKm * 1000;
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

export function computeDerivatives(state) {
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

    // 🛡️ WGS-84 大氣共轉相對風場計算
    let dragAcc = new THREE.Vector3(0,0,0);
    const alt = rMag - R_EARTH;
    if (alt < 100000 && state.isLaunched && mass > 0) {
        const omegaVec = new THREE.Vector3(0, ROTATION_SPEED, 0);
        const atmosVel = new THREE.Vector3().crossVectors(omegaVec, r);
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

export function rk4Step(state, dt) {
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

export function executeGuidance(state, dt) {
    if (!state.isLaunched || state.missionAccomplished || state.isDestroyed) return;
    const alt = state.r.length() - R_EARTH;
    
    if (alt < state.gravityTurnAlt) {
        state.thrustDir.set(0, 1, 0);
        return;
    }
    if (alt >= state.gravityTurnAlt && alt < state.gravityTurnAlt + 8000) {
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,0,1), -0.015).normalize();
        return;
    }
    if (state.v.length() > 300) {
        const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
        const errorAngle = error.length();
        if (errorAngle > 0.0001) {
            state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.8 * dt * 2)).normalize();
        }
    }
}

export function triggerCatastrophicExplosion(pos) {
    if (!rocketGroup) return;
    rocketGroup.visible = false;
    if (flameMesh) flameMesh.visible = false;

    for (let i = 0; i < 160; i++) {
        const size = 0.6 + Math.random() * 1.6;
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(size, 8, 8),
            new THREE.MeshBasicMaterial({
                color: Math.random() > 0.3 ? 0xff2200 : 0xffdd00,
                transparent: true,
                opacity: 1.0
            })
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

export function updateExplosion(dt) {
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

export function spawnDebrisPiece(state, mesh, relVel) {
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

// 🏭 3D 火箭生成工廠（精確貼合逃逸塔與整流罩）
function createRocketMeshGroup(type) {
    const config = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
    const group = new THREE.Group();

    const matBody = new THREE.MeshStandardMaterial({ color: config.colorTheme.body, metalness: type === 'STARSHIP' ? 0.9 : 0.5, roughness: 0.2 });
    const matAccent = new THREE.MeshStandardMaterial({ color: config.colorTheme.accent, metalness: 0.6, roughness: 0.3 });
    const matPayload = new THREE.MeshStandardMaterial({ color: config.colorTheme.payload, metalness: 0.8, roughness: 0.2 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    const scaleH = config.heightM / 60.0;
    const coreRadius = (type === 'STARSHIP' || type === 'SATURN_V') ? 0.55 : 0.38;

    // 1. 發動機噴嘴 (基底對齊 y=0)
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(coreRadius * 0.9, 0.6, 24), matEngine);
    nozzle.position.y = 0.3;
    group.add(nozzle);

    // 2. 芯一級
    const s1Height = 4.8 * scaleH;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius, coreRadius, s1Height, 32), matBody);
    s1.position.y = 0.6 + s1Height / 2;
    group.add(s1);

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 1.01, coreRadius * 1.01, s1Height * 0.18, 32), matAccent);
    ring.position.y = 0.6 + s1Height * 0.7;
    group.add(ring);

    // 3. 助推器
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

    // 4. 芯二級
    const s2Height = 2.4 * scaleH;
    const s2PosY = 0.6 + s1Height + s2Height / 2;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.95, coreRadius, s2Height, 32), matBody);
    s2.position.y = s2PosY;
    group.add(s2);

    // 5. 整流罩 / 飛船
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

    // 6. 逃逸塔 (精確貼合鼻錐頂端)
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

    return {
        root: group,
        boosters: boostersGroup,
        escapeTower: escapeTower
    };
}

export function switchRocketMesh(type) {
    if (!rocketGroup) return;
    while (rocketGroup.children.length > 0) {
        rocketGroup.remove(rocketGroup.children[0]);
    }

    activeRocketParts = createRocketMeshGroup(type);
    rocketGroup.add(activeRocketParts.root);

    const flameGeo = new THREE.ConeGeometry(0.5, 5.0, 24);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.95 });
    flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.y = -2.5;
    flameMesh.rotation.x = Math.PI;
    flameMesh.visible = false;
    rocketGroup.add(flameMesh);

    const coneGeo = new THREE.ConeGeometry(1.6, 2.2, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide });
    machConeMesh = new THREE.Mesh(coneGeo, coneMat);
    machConeMesh.position.y = 7.0;
    rocketGroup.add(machConeMesh);

    rocketGroup.quaternion.set(0, 0, 0, 1);
    rocketGroup.visible = true;
}

export function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.0003);

    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 30000);
    camera.position.set(0, 1008, 22);

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

// 🏢 等比例發射台與發射塔（精準配合火箭尺寸）
function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    
    // 圓形導流台座
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.2 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.8, 0.8, 32), padMat);
    pad.position.set(0, 999.6, 0);
    launchTowerGroup.add(pad);

    const trenchMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d });
    const trench = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.0, 24), trenchMat);
    trench.position.set(0, 999.6, 0);
    launchTowerGroup.add(trench);

    // 紅色桁架發射塔 (高度 12 單位，緊湊貼合)
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
