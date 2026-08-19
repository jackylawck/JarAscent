/**
 * js/rocket_engine.js - 3D 渲染、場景構建與視覺特效 (修復尾焰與分體結構)
 * @license MIT
 */

const THREE = window.THREE;
import { createRocketMesh } from './rocket_builder.js';
import { ROCKET_MODELS } from './rockets_data.js';
import { MU, R_EARTH, R_MOON, WORLD_SCALE, getMoonPosition } from './physics_core.js';

export let scene, camera, renderer, controls;
export let rocketGroup, flameMesh, machConeMesh, exhaustParticles = [];
export let activeRocketParts = null;
export let earthMesh, moonMesh, launchTowerGroup, rocketLight, sunLight, hemiLight;
export let velArrow, thrustArrow;
export let debrisList = [];
export let explosionParticles = [];
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
    if (starFieldMesh) {
        starFieldMesh.material.opacity = ratio * 0.9;
    }
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

    // 🔥 修復尾焰幾何體與朝向：頂點在 (0, 0, 0)，向下 (-Y) 延伸
    const flameGeo = new THREE.ConeGeometry(0.45, 4.0, 24);
    flameGeo.translate(0, -2.0, 0);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });
    flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.visible = false;
    rocketGroup.add(flameMesh);

    // 💨 音障蒸氣錐
    const coneGeo = new THREE.ConeGeometry(1.8, 2.5, 32, 1, true);
    coneGeo.translate(0, -1.25, 0);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    machConeMesh = new THREE.Mesh(coneGeo, coneMat);
    machConeMesh.position.y = activeRocketParts.nosePosY || 9.0;
    machConeMesh.visible = false;
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

function buildLaunchPadAndTower() {
    launchTowerGroup = new THREE.Group();
    
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.2 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.8, 0.8, 32), padMat);
    pad.position.set(0, 999.6, 0);
    launchTowerGroup.add(pad);

    const trenchMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1d });
    const trench = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.0, 24), trenchMat);
    trench.position.set(0, 999.6, 0);
    launchTowerGroup.add(trench);

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

export function triggerCatastrophicExplosion(pos) {
    if (!rocketGroup) return;
    rocketGroup.visible = false;
    if (flameMesh) flameMesh.visible = false;

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

export function spawnDebrisPiece(state, mesh, relVel) {
    if (!mesh) return;
    const debrisGroup = new THREE.Group();
    debrisGroup.add(mesh.clone());
    debrisGroup.position.copy(state.r.clone().normalize().multiplyScalar(1000 + ((state.r.length() - R_EARTH) * 0.035)));
    debrisGroup.quaternion.copy(rocketGroup.quaternion);
    scene.add(debrisGroup);

    debrisList.push({
        r: state.r.clone(),
        v: state.v.clone().add(relVel),
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
        
        const alt = Math.max(0, d.r.length() - R_EARTH);
        const visualPos = d.r.clone().normalize().multiplyScalar(1000 + (alt * 0.035));
        d.mesh.position.copy(visualPos);
        d.mesh.rotation.x += dt * 0.5;
        d.mesh.rotation.z += dt * 0.3;

        if (d.life <= 0 || d.r.length() < R_EARTH) {
            scene.remove(d.mesh);
            debrisList.splice(i, 1);
        }
    }
}

export function spawnExhaustParticles(pos, power, isLowAltitude = true) {
    if (exhaustParticles.length > 250) return;
    
    const count = isLowAltitude ? 5 : 2;
    const spread = isLowAltitude ? 2.0 : 0.8;
    const windDir = new THREE.Vector3(0.2, 0, -0.1).normalize();

    for (let i = 0; i < count; i++) {
        const isFire = Math.random() < 0.5;
        const size = isLowAltitude ? (0.25 + Math.random() * 0.35) : (0.12 + Math.random() * 0.18);
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(size, 6, 6),
            new THREE.MeshBasicMaterial({ color: isFire ? 0xff6600 : 0xcccccc, transparent: true, opacity: 0.85 })
        );

        p.position.set(pos.x + (Math.random() - 0.5) * 0.3, pos.y - 0.5, pos.z + (Math.random() - 0.5) * 0.3);
        scene.add(p);

        exhaustParticles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * spread + windDir.x * 0.8,
            vy: -(4 + Math.random() * 5) * power,
            vz: (Math.random() - 0.5) * spread + windDir.z * 0.8,
            expansion: 1.04,
            life: 0.8
        });
    }
}

export function updateExhaustParticles(dt) {
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
        const p = exhaustParticles[i];
        p.mesh.position.add(new THREE.Vector3(p.vx, p.vy, p.vz).multiplyScalar(dt));
        p.mesh.scale.multiplyScalar(p.expansion);
        p.life -= dt * 2.0;
        p.mesh.material.opacity = Math.max(0, p.life);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            exhaustParticles.splice(i, 1);
        }
    }
}
