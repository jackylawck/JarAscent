/**
 * js/rocket_engine.js - 3D 渲染與真實動態粒子尾焰管線
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
    controls.maxDistance = 20000;
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

// 殘骸真實重力下墜物理系統
export function spawnDebrisPiece(state, mesh, relativeImpulse) {
    if (!mesh) return;
    const debrisGroup = new THREE.Group();
    debrisGroup.add(mesh.clone());
    scene.add(debrisGroup);

    debrisList.push({
        r: state.r.clone(),
        v: state.v.clone().add(relativeImpulse),
        mesh: debrisGroup,
        rotAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        rotSpeed: 0.8 + Math.random() * 1.5,
        life: 180
    });
}

export function updateDebris(dt) {
    for (let i = debrisList.length - 1; i >= 0; i--) {
        const d = debrisList[i];
        d.life -= dt;
        
        const rMag = d.r.length();
        const alt = rMag - R_EARTH;
        const grav = d.r.clone().multiplyScalar(-MU / (rMag * rMag * rMag));
        
        let drag = new THREE.Vector3(0,0,0);
        if (alt < 100000 && alt > 0) {
            const rho = 1.225 * Math.exp(-alt / 8500);
            const speed = d.v.length();
            if (speed > 1.0) {
                drag = d.v.clone().normalize().multiplyScalar(-0.5 * rho * speed * speed * 1.2 * 8.0 / 4000.0);
            }
        }
        
        d.v.add(grav.add(drag).multiplyScalar(dt));
        d.r.add(d.v.clone().multiplyScalar(dt));
        
        const visualAlt = (alt < 5000) ? 0.4 + (alt * 0.035) : 0.4 + (5000 * 0.035) + (alt - 5000) * WORLD_SCALE;
        const visualPos = d.r.clone().normalize().multiplyScalar(1000 + visualAlt);
        const visualScale = (alt < 5000) ? 1.0 : Math.min(10.0, 1.0 + Math.log10(1 + (alt - 5000) / 1000) * 3.5);
        
        d.mesh.position.copy(visualPos);
        d.mesh.scale.set(visualScale, visualScale, visualScale);
        d.mesh.rotateOnAxis(d.rotAxis, d.rotSpeed * dt);

        if (d.life <= 0 || d.r.length() < R_EARTH) {
            scene.remove(d.mesh);
            debrisList.splice(i, 1);
        }
    }
}

// 🚀 動態真實發射尾焰（一級橘紅大氣火焰 / 二級深藍真空羽流）
export function spawnExhaustParticles(nozzleWorldPos, thrustDir, power, isStage2 = false, isHighAlt = false) {
    if (exhaustParticles.length > 300) return;
    
    const count = isStage2 ? 4 : 8;
    const spread = isHighAlt ? 1.8 : 0.6; // 高空真空羽流會向外膨脹
    const baseSpeed = isStage2 ? 14 : 20;

    for (let i = 0; i < count; i++) {
        let colorHex = 0xff6600;
        if (isStage2) {
            colorHex = Math.random() > 0.4 ? 0x38bdf8 : 0x818cf8; // 二級液氫液氧/甲烷藍紫光
        } else {
            colorHex = Math.random() > 0.3 ? 0xff5500 : (Math.random() > 0.5 ? 0xfbbf24 : 0xffffff);
        }

        const size = (isStage2 ? 0.25 : 0.4) + Math.random() * 0.3;
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(size, 6, 6),
            new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 })
        );

        p.position.copy(nozzleWorldPos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
        ));
        scene.add(p);

        // 沿著反推力方向高速噴射
        const ejectDir = thrustDir.clone().negate();
        ejectDir.x += (Math.random() - 0.5) * spread;
        ejectDir.z += (Math.random() - 0.5) * spread;
        ejectDir.normalize();

        exhaustParticles.push({
            mesh: p,
            vel: ejectDir.multiplyScalar(baseSpeed * power),
            expansion: isHighAlt ? 1.08 : 1.03,
            life: isStage2 ? 0.45 : 0.75
        });
    }
}

export function updateExhaustParticles(dt) {
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
        const p = exhaustParticles[i];
        p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
        p.mesh.scale.multiplyScalar(p.expansion);
        p.life -= dt * 2.0;
        p.mesh.material.opacity = Math.max(0, p.life);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            exhaustParticles.splice(i, 1);
        }
    }
}
