/**
 * js/rocket_builder.js - 3D 模型自動構建工廠
 */
const THREE = window.THREE;
import { ROCKET_MODELS } from './rockets_data.js';

export function createRocketMesh(type) {
    const config = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
    const group = new THREE.Group();

    const matBody = new THREE.MeshStandardMaterial({ color: config.colorTheme.body, metalness: type === 'STARSHIP' ? 0.9 : 0.5, roughness: 0.2 });
    const matAccent = new THREE.MeshStandardMaterial({ color: config.colorTheme.accent, metalness: 0.6, roughness: 0.3 });
    const matPayload = new THREE.MeshStandardMaterial({ color: config.colorTheme.payload, metalness: 0.8, roughness: 0.2 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    const scaleH = config.heightM / 60.0;
    const coreRadius = (type === 'STARSHIP' || type === 'SATURN_V') ? 0.55 : 0.38;

    // 1. 噴嘴
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

    // 6. 逃逸塔（精確貼合鼻錐）
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
