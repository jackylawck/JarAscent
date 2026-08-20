/**
 * js/rocket_builder.js - 3D 幾何模型工廠 (高精細度與蚌殼式整流罩)
 * @license MIT
 */

const THREE = window.THREE;
import { ROCKET_MODELS } from './rockets_data.js';

export function createRocketMesh(type) {
    const config = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
    const rootGroup = new THREE.Group();

    const matBody = new THREE.MeshStandardMaterial({ color: config.colorTheme.body, metalness: type === 'STARSHIP' ? 0.9 : 0.2, roughness: 0.4 });
    const matAccent = new THREE.MeshStandardMaterial({ color: config.colorTheme.accent, metalness: 0.6, roughness: 0.3 });
    const matPayload = new THREE.MeshStandardMaterial({ color: config.colorTheme.payload, metalness: 0.8, roughness: 0.2 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.5 });
    const matInterstage = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.6, wireframe: false });

    const scaleH = config.heightM / 60.0;
    const coreRadius = (type === 'STARSHIP' || type === 'SATURN_V') ? 0.55 : 0.38;

    // 1. 一級芯級 (Stage 1) 與 多噴嘴引擎細節
    const stage1Group = new THREE.Group();
    
    // 主引擎群 (模擬多台發動機簇)
    const engineCluster = new THREE.Group();
    const bellRadius = coreRadius * 0.35;
    const bellOffsets = [[0,0], [coreRadius*0.5, 0], [-coreRadius*0.5, 0], [0, coreRadius*0.5], [0, -coreRadius*0.5]];
    bellOffsets.forEach(pos => {
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(bellRadius, bellRadius*0.3, 0.6, 16), matEngine);
        bell.position.set(pos[0], 0.3, pos[1]);
        engineCluster.add(bell);
    });
    stage1Group.add(engineCluster);

    const s1Height = 4.8 * scaleH;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius, coreRadius, s1Height, 32), matBody);
    s1.position.y = 0.6 + s1Height / 2;
    stage1Group.add(s1);

    // 底部隔熱段/尾段
    const aftSkirt = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius*1.02, coreRadius*1.02, 0.4, 32), matAccent);
    aftSkirt.position.y = 0.8;
    stage1Group.add(aftSkirt);

    rootGroup.add(stage1Group);

    // 2. 助推器 (Boosters)
    const boostersGroup = new THREE.Group();
    if (config.hasBoosters) {
        const bCount = config.boosterCount || 4;
        const bRadius = coreRadius * 0.5;
        const bHeight = s1Height * 0.8;
        for (let i = 0; i < bCount; i++) {
            const angle = (i / bCount) * Math.PI * 2;
            const b = new THREE.Group();
            const bBody = new THREE.Mesh(new THREE.CylinderGeometry(bRadius, bRadius, bHeight, 24), matBody);
            const bNose = new THREE.Mesh(new THREE.ConeGeometry(bRadius, bHeight * 0.25, 24), matAccent);
            bNose.position.y = bHeight / 2 + (bHeight * 0.125);
            const bNozzle = new THREE.Mesh(new THREE.CylinderGeometry(bRadius*0.8, bRadius*0.3, 0.4, 16), matEngine);
            bNozzle.position.y = -bHeight / 2 - 0.2;
            
            b.add(bBody); b.add(bNose); b.add(bNozzle);
            b.position.set(Math.cos(angle) * (coreRadius + bRadius * 1.02), 0.6 + bHeight / 2 + 0.2, Math.sin(angle) * (coreRadius + bRadius * 1.02));
            boostersGroup.add(b);
        }
    }
    rootGroup.add(boostersGroup);

    // 級間段 (Interstage - 留給二級)
    const interstageHeight = 0.5 * scaleH;
    const interstage = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius*0.98, coreRadius*0.98, interstageHeight, 32), matInterstage);
    interstage.position.y = 0.6 + s1Height + interstageHeight / 2;
    stage1Group.add(interstage); // 級間段通常跟著一級掉落

    // 3. 二級芯級 (Stage 2)
    const stage2Group = new THREE.Group();
    const s2Nozzle = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.6, coreRadius * 0.2, 0.5, 16), matEngine);
    s2Nozzle.position.y = 0.6 + s1Height + interstageHeight - 0.2;
    stage2Group.add(s2Nozzle);

    const s2Height = 2.4 * scaleH;
    const s2PosY = 0.6 + s1Height + interstageHeight + s2Height / 2;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.95, coreRadius, s2Height, 32), matBody);
    s2.position.y = s2PosY;
    stage2Group.add(s2);
    rootGroup.add(stage2Group);

    // 4. 蚌殼式整流罩 (Clamshell Fairing - 左半/右半)
    const fairingHeight = 1.8 * scaleH;
    const noseHeight = 1.4 * scaleH;
    const fairingPosY = s2PosY + s2Height / 2 + fairingHeight / 2;
    const nosePosY = fairingPosY + fairingHeight / 2 + noseHeight / 2;

    // 左半整流罩 (ThetaStart 0, ThetaLength PI)
    const fairingLeftGroup = new THREE.Group();
    const fL = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius*0.75, coreRadius*0.95, fairingHeight, 24, 1, false, 0, Math.PI), matPayload);
    fL.position.y = fairingPosY;
    const nL = new THREE.Mesh(new THREE.ConeGeometry(coreRadius*0.75, noseHeight, 24, 1, false, 0, Math.PI), matBody);
    nL.position.y = nosePosY;
    fairingLeftGroup.add(fL); fairingLeftGroup.add(nL);
    rootGroup.add(fairingLeftGroup);

    // 右半整流罩 (ThetaStart PI, ThetaLength PI)
    const fairingRightGroup = new THREE.Group();
    const fR = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius*0.75, coreRadius*0.95, fairingHeight, 24, 1, false, Math.PI, Math.PI), matPayload);
    fR.position.y = fairingPosY;
    const nR = new THREE.Mesh(new THREE.ConeGeometry(coreRadius*0.75, noseHeight, 24, 1, false, Math.PI, Math.PI), matBody);
    nR.position.y = nosePosY;
    fairingRightGroup.add(fR); fairingRightGroup.add(nR);
    rootGroup.add(fairingRightGroup);

    // 5. 逃逸塔 (Escape Tower)
    const escapeTower = new THREE.Group();
    if (config.hasTower) {
        const topY = nosePosY + noseHeight / 2;
        const towerHeight = 2.0 * scaleH;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, towerHeight, 12), matAccent);
        pole.position.y = topY + towerHeight / 2;
        const tNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3 * scaleH, 12), matEngine);
        tNozzle.position.y = topY + towerHeight + (0.15 * scaleH);
        escapeTower.add(pole); escapeTower.add(tNozzle);
    }
    rootGroup.add(escapeTower);

    return {
        root: rootGroup,
        stage1: stage1Group,
        boosters: boostersGroup,
        stage2: stage2Group,
        fairingL: fairingLeftGroup,
        fairingR: fairingRightGroup,
        escapeTower: escapeTower,
        nosePosY: nosePosY
    };
}
