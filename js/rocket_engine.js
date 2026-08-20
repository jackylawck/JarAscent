/**
 * js/rocket_engine.js - 航太視景引擎 v3.1 Master Edition
 * (羽流背壓生命週期、質量權重殘骸縮放、發射台熱蒸汽與 ECI 1:1 映射)
 * @license MIT
 */

const THREE = window.THREE;
import { createRocketMesh } from './rocket_builder.js';
import { ROCKET_MODELS } from './rockets_data.js';
import { MU, R_EARTH, R_MOON, WORLD_SCALE, getMoonPosition } from './physics_core.js';

export let scene, camera, renderer, controls;
export let rocketGroup, activeRocketParts = null;
export let earthMesh, moonMesh, launchTowerGroup, rocketLight, sunLight, hemiLight;
export let debrisList = [];
export let explosionParticles = [];
export let exhaustParticles = [];
export let padSteamParticles = [];
export let starFieldMesh = null;

function createEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    oceanGrad.addColorStop(0, '#0a2342'); oceanGrad.addColorStop(0.5, '#021024'); oceanGrad.addColorStop(1, '#0a2342');
    ctx.fillStyle = oceanGrad; ctx.fillRect(0, 0, 2048, 1024);
    ctx.fillStyle = '#1e3d2f';
    [[400, 300, 240, 180], [700, 250, 180, 120], [1300, 400, 320, 220], [1600, 650, 220, 160], [500, 700, 200, 280], [1700, 300, 260, 180]].forEach(([x, y, rx, ry]) => {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.PI/6, 0, Math.PI*2); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)'; ctx.lineWidth = 1.5;
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
    starFieldMesh = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 16, transparent: true, opacity: 0.0 }));
    return starFieldMesh;
}

export function updateEnvironmentVisuals(alt) {
    if (!scene) return;
    const ratio = Math.min(1.0, Math.max(0.0, alt / 80000));
    const skyColor = new THREE.Color(0x38bdf8);
    const spaceColor = new THREE.Color(0x020617);
    scene.background = skyColor.clone().lerp(spaceColor, ratio);
    scene.fog.density = 0.0003 * (1.0 - ratio);
    if (starFieldMesh) starFieldMesh.material.opacity = ratio * 0.9;
}

export function setEnvironmentMode(mode) {
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

export function switchRocketMesh(type) {
    if (!rocketGroup) return;
    while (rocketGroup.children.length > 0) {
        rocketGroup.remove(rocketGroup.children[0]);
    }

    activeRocketParts = createRocketMesh(type);
    rocketGroup.add(activeRocketParts.root);
    rocketGroup.quaternion.set(0, 0, 0, 1);
    rocketGroup.visible = true;
}

export function initRocketScene(containerEl) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.0003);

    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 50000);
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
    controls.maxDistance = 25000;
    controls.target.set(0, 1004, 0);

    scene.add(createStarField());

    sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    sunLight.position.set(2000, 4000, 3000);
    scene.add(sunLight);

    hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.2);
    scene.add(hemiLight);

    rocketLight = new THREE.PointLight(0xff6600, 0, 300);
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
}

function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.2 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.8, 0.8, 32), padMat);
    pad.position.set(0, 999.6, 0);
    launchTowerGroup.add(pad);

    const towerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.4 });
    const tower = new THREE.Group();
    const colGeo = new THREE.CylinderGeometry(0.06, 0.06, 12, 8);
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([cx, cz]) => {
        const col = new THREE.Mesh(colGeo, towerMat); col.position.set(cx, 6, cz); tower.add(col);
    });
    for (let y = 1; y <= 11; y += 1.5) {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), towerMat); b1.position.set(0, y, 0.6); tower.add(b1);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), towerMat); b2.position.set(0, y, -0.6); tower.add(b2);
        const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.2), towerMat); b3.position.set(0.6, y, 0); tower.add(b3);
        const b4 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.2), towerMat); b4.position.set(-0.6, y, 0); tower.add(b4);
    }
    const armMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.8 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.2), armMat);
    arm.position.set(-0.7, 9.5, 0); tower.add(arm);
    tower.position.set(2.0, 1000.0, 0);
    launchTowerGroup.add(tower);
    scene.add(launchTowerGroup);
}

export function triggerCatastrophicExplosion(pos) {
    if (!rocketGroup) return;
    rocketGroup.visible = false;

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

export function updateExplosion(dt) {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const ep = explosionParticles[i];
        ep.vy -= 9.8 * dt; // 重力彈道加速度
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

// 🔬 殘骸派生：加入質量感知縮放係數 (Mass-Weighted Visual Scale)
export function spawnDebrisPiece(state, mesh, relativeImpulse, aeroProfile = null) {
    if (!mesh) return;
    const debrisGroup = new THREE.Group();
    debrisGroup.add(mesh.clone());
    scene.add(debrisGroup);

    const profile = aeroProfile || { mass: 5000, refArea: 8.0, cd: 0.8, pitchRate: 0.15 };
    const initialQuat = rocketGroup.quaternion.clone();
    debrisGroup.quaternion.copy(initialQuat);

    // 重型引擎結構視覺上更厚重紮實
    const massWeightScale = 0.65 + Math.min(1.0, profile.mass / 40000) * 0.7;

    debrisList.push({
        r: state.r.clone(),
        v: state.v.clone().add(relativeImpulse),
        mass: profile.mass,
        refArea: profile.refArea,
        cdBase: profile.cd,
        pitchRate: profile.pitchRate,
        rotAxis: profile.tiltAxis ? profile.tiltAxis.clone().normalize() : new THREE.Vector3(1, 0, 0),
        quat: initialQuat,
        massWeightScale: massWeightScale,
        mesh: debrisGroup,
        life: 240
    });
}

// 🔬 絕對 ECI 坐標映射 + 跨音速波阻峰值
export function updateDebris(dt, currentRocketVisualScale = 1.0) {
    for (let i = debrisList.length - 1; i >= 0; i--) {
        const d = debrisList[i];
        d.life -= dt;
        
        const rMag = d.r.length();
        const alt = rMag - R_EARTH;
        const speed = d.v.length();
        
        const grav = d.r.clone().multiplyScalar(-MU / (rMag * rMag * rMag));
        
        const mach = speed / 340.0;
        let cd = d.cdBase;
        if (mach >= 0.8 && mach <= 1.3) {
            cd *= 2.4; // 跨音速波阻突增
        } else if (mach > 1.3) {
            cd *= 0.85;
        }

        let drag = new THREE.Vector3(0, 0, 0);
        if (alt < 100000 && alt > 0) {
            const rho = 1.225 * Math.exp(-alt / 8500);
            if (speed > 0.1) {
                const dragAcc = (0.5 * rho * speed * speed * cd * d.refArea) / d.mass;
                drag = d.v.clone().normalize().multiplyScalar(-dragAcc);
            }
        }
        
        d.v.add(grav.add(drag).multiplyScalar(dt));
        d.r.add(d.v.clone().multiplyScalar(dt));
        
        const visualPos = d.r.clone().multiplyScalar(WORLD_SCALE);
        d.mesh.position.copy(visualPos);
        
        const effectiveScale = currentRocketVisualScale * d.massWeightScale;
        d.mesh.scale.set(effectiveScale, effectiveScale, effectiveScale);
        
        const deltaQuat = new THREE.Quaternion().setFromAxisAngle(d.rotAxis, d.pitchRate * dt);
        d.quat.multiply(deltaQuat);
        d.mesh.quaternion.copy(d.quat);

        if (d.life <= 0 || alt <= 0) {
            scene.remove(d.mesh);
            debrisList.splice(i, 1);
        }
    }
}

// 🔬 動態羽流：熱輻射光譜演變 + 氣壓背壓生命週期脫鉤
export function spawnExhaustParticles(nozzleWorldPos, thrustDir, power, isStage2 = false, currentAlt = 0) {
    if (exhaustParticles.length > 350) return;
    
    const rho = 1.225 * Math.exp(-currentAlt / 8500);
    const pressureRatio = Math.max(0.0, Math.min(1.0, rho / 1.225));
    
    const plumeSpread = isStage2 
        ? (0.8 + (1.0 - pressureRatio) * 1.8) 
        : (0.35 + (1.0 - pressureRatio) * 1.2);
    
    const count = isStage2 ? 4 : 8;
    const baseSpeed = isStage2 ? 16 : 24;

    const altRatio = Math.min(1.0, currentAlt / 45000);
    const seaLevelColor = new THREE.Color(0xff5500);
    const vacuumColor = isStage2 ? new THREE.Color(0x38bdf8) : new THREE.Color(0x818cf8);
    const currentSpectrumColor = seaLevelColor.clone().lerp(vacuumColor, isStage2 ? 0.9 : altRatio * 0.75);

    // 🔬 生命週期脫鉤：稀薄高空散熱慢，粒子殘留時間加倍
    const baseLife = isStage2 ? 0.45 : 0.70;
    const dynamicLife = baseLife * (0.6 + (1.0 - pressureRatio) * 0.9);

    for (let i = 0; i < count; i++) {
        const size = (isStage2 ? 0.22 : 0.38) + Math.random() * 0.25;
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(size, 6, 6),
            new THREE.MeshBasicMaterial({ 
                color: currentSpectrumColor.clone().offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.1),
                transparent: true, 
                opacity: 0.9 
            })
        );

        p.position.copy(nozzleWorldPos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15
        ));
        scene.add(p);

        const ejectDir = thrustDir.clone().negate();
        ejectDir.x += (Math.random() - 0.5) * plumeSpread;
        ejectDir.z += (Math.random() - 0.5) * plumeSpread;
        ejectDir.normalize();

        exhaustParticles.push({
            mesh: p,
            vel: ejectDir.multiplyScalar(baseSpeed * power),
            expansion: 1.01 + (1.0 - pressureRatio) * 0.12,
            life: dynamicLife,
            maxLife: dynamicLife
        });
    }
}

export function updateExhaustParticles(dt) {
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
        const p = exhaustParticles[i];
        p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
        p.mesh.scale.multiplyScalar(p.expansion);
        p.life -= dt * 2.0;
        p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            exhaustParticles.splice(i, 1);
        }
    }
}

// 🔬 發射台水噴淋降噪殘留蒸汽 (Pad Steam Effusion)
export function spawnPadSteam() {
    if (padSteamParticles.length > 80) return;
    for (let i = 0; i < 2; i++) {
        const size = 0.4 + Math.random() * 0.8;
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(size, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.35 })
        );
        p.position.set(
            (Math.random() - 0.5) * 3.5,
            1000.4 + 0.3 + Math.random() * 0.4,
            (Math.random() - 0.5) * 3.5
        );
        scene.add(p);

        padSteamParticles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 0.8 + Math.random() * 1.2,
            vz: (Math.random() - 0.5) * 1.5,
            life: 2.2
        });
    }
}

export function updatePadSteam(dt) {
    for (let i = padSteamParticles.length - 1; i >= 0; i--) {
        const s = padSteamParticles[i];
        s.mesh.position.add(new THREE.Vector3(s.vx, s.vy, s.vz).multiplyScalar(dt));
        s.mesh.scale.multiplyScalar(1.04);
        s.life -= dt;
        s.mesh.material.opacity = Math.max(0, (s.life / 2.2) * 0.35);
        if (s.life <= 0) {
            scene.remove(s.mesh);
            padSteamParticles.splice(i, 1);
        }
    }
}
