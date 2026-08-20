/**
 * js/rocket_builder.js - 3D 幾何模型工廠 (支援各級實體拆解分離)
 * @license MIT
 */

const THREE = window.THREE;
import { ROCKET_MODELS } from './rockets_data.js';

export function createRocketMesh(type) {
    const config = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
    const rootGroup = new THREE.Group();

    const matBody = new THREE.MeshStandardMaterial({ color: config.colorTheme.body, metalness: type === 'STARSHIP' ? 0.9 : 0.5, roughness: 0.2 });
    const matAccent = new THREE.MeshStandardMaterial({ color: config.colorTheme.accent, metalness: 0.6, roughness: 0.3 });
    const matPayload = new THREE.MeshStandardMaterial({ color: config.colorTheme.payload, metalness: 0.8, roughness: 0.2 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    const scaleH = config.heightM / 60.0;
    const coreRadius = (type === 'STARSHIP' || type === 'SATURN_V') ? 0.55 : 0.38;

    // 1. 一級芯級 (Stage 1)
    const stage1Group = new THREE.Group();
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(coreRadius * 0.9, 0.6, 24), matEngine);
    nozzle.position.y = 0.3;
    stage1Group.add(nozzle);

    const s1Height = 4.8 * scaleH;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius, coreRadius, s1Height, 32), matBody);
    s1.position.y = 0.6 + s1Height / 2;
    stage1Group.add(s1);

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 1.01, coreRadius * 1.01, s1Height * 0.18, 32), matAccent);
    ring.position.y = 0.6 + s1Height * 0.7;
    stage1Group.add(ring);
    rootGroup.add(stage1Group);

    // 2. 助推器群組 (Boosters)
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
    rootGroup.add(boostersGroup);

    // 3. 二級芯級與發動機 (Stage 2)
    const stage2Group = new THREE.Group();
    const s2Nozzle = new THREE.Mesh(new THREE.ConeGeometry(coreRadius * 0.6, 0.4, 16), matEngine);
    s2Nozzle.position.y = 0.6 + s1Height + 0.2;
    stage2Group.add(s2Nozzle);

    const s2Height = 2.4 * scaleH;
    const s2PosY = 0.6 + s1Height + s2Height / 2;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.95, coreRadius, s2Height, 32), matBody);
    s2.position.y = s2PosY;
    stage2Group.add(s2);
    rootGroup.add(stage2Group);

    // 4. 整流罩 (Fairing - 左/右兩瓣)
    const fairingGroup = new THREE.Group();
    const fairingHeight = 1.8 * scaleH;
    const fairingPosY = 0.6 + s1Height + s2Height + fairingHeight / 2;
    const fairing = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.75, coreRadius * 0.95, fairingHeight, 24), matPayload);
    fairing.position.y = fairingPosY;
    
    const noseHeight = 1.4 * scaleH;
    const nosePosY = fairingPosY + fairingHeight / 2 + noseHeight / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(coreRadius * 0.75, noseHeight, 24), matBody);
    nose.position.y = nosePosY;
    
    fairingGroup.add(fairing);
    fairingGroup.add(nose);
    rootGroup.add(fairingGroup);

    // 5. 逃逸塔 (Escape Tower)
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
    rootGroup.add(escapeTower);

    return {
        root: rootGroup,
        stage1: stage1Group,
        boosters: boostersGroup,
        stage2: stage2Group,
        fairing: fairingGroup,
        escapeTower: escapeTower,
        nosePosY: nosePosY
    };
}
