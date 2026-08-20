/**
 * js/rocket_builder.js - 航太 CAD 級程式化幾何資產工廠 (Lathe Bell Nozzle & UV-Locked)
 * @license MIT
 */

const THREE = window.THREE;
import { ROCKET_MODELS } from './rockets_data.js';

// ==================== 1. 程序化航太裝甲與消光紋理 (UV鎖定) ====================
function createProceduralRocketTexture(baseColorHex, accentColorHex, hasTileGrid = false, uvRepeats = 4) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 1. 基底漆面
    ctx.fillStyle = `#${baseColorHex.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. 垂直金屬裝配縫 (縱向桁條)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 3;
    const stepX = 1024 / uvRepeats;
    for (let x = 0; x <= 1024; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
    }

    // 3. 航太隔熱瓦網格 (Starship / 載人前段)
    if (hasTileGrid) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1.5;
        for (let y = 0; y < 1024; y += 24) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1024, y);
            ctx.stroke();
        }
    }

    // 4. 裝配飾帶
    ctx.fillStyle = `#${accentColorHex.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 160, 1024, 45);
    ctx.fillRect(0, 780, 1024, 55);

    // 5. 高密度航空鉚釘點陣
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let x = 8; x < 1024; x += stepX / 2) {
        for (let y = 16; y < 1024; y += 48) {
            ctx.beginPath();
            ctx.arc(x, y, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// ==================== 2. 德拉瓦爾鐘型噴嘴 (LatheGeometry 連續車削) ====================
function createAdvancedNozzle(radius, height, segments, matEngine, matGimbal) {
    const group = new THREE.Group();

    // 拋物線鐘型噴管擴散樣條點陣 (de Laval Bell Contour)
    const points = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = t * height;
        // 喉部收縮 0.35R -> 鐘型擴散 1.0R (二次平滑拋物線)
        const r = radius * (0.35 + t * t * 0.65);
        points.push(new THREE.Vector2(r, y));
    }
    // 燃燒室收縮段與注元器頭部 (Injector Dome)
    points.push(new THREE.Vector2(radius * 0.48, height * 1.15));
    points.push(new THREE.Vector2(radius * 0.40, height * 1.28));
    points.push(new THREE.Vector2(0.01, height * 1.30));

    const nozzleGeo = new THREE.LatheGeometry(points, segments);
    const nozzle = new THREE.Mesh(nozzleGeo, matEngine);
    nozzle.rotation.x = Math.PI; // 轉向讓噴嘴口朝下 (-Y)
    nozzle.position.y = height * 1.30;
    group.add(nozzle);

    // 萬向節環 (Gimbal Ring)
    const gimbalGeo = new THREE.TorusGeometry(radius * 0.52, radius * 0.04, 8, 24);
    const gimbal = new THREE.Mesh(gimbalGeo, matGimbal);
    gimbal.position.y = height * 1.30;
    gimbal.rotation.x = Math.PI / 2;
    group.add(gimbal);

    return group;
}

// ==================== 3. 爆炸螺栓與熱防護隔離環 ====================
function addPyroBoltsAndThermalShield(parentGroup, radius, yPos, height, count = 8) {
    const boltMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b, metalness: 0.9, roughness: 0.2, emissive: 0xd97706, emissiveIntensity: 0.25
    });
    const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x18181b, metalness: 0.9, roughness: 0.4
    });

    // 上下熱防護隔離環 (Thermal Shield Rings)
    const ringGeo = new THREE.TorusGeometry(radius * 1.015, 0.02, 8, 64);
    const topRing = new THREE.Mesh(ringGeo, shieldMat);
    topRing.position.y = yPos + height * 0.48;
    topRing.rotation.x = Math.PI / 2;
    const botRing = new THREE.Mesh(ringGeo, shieldMat);
    botRing.position.y = yPos - height * 0.48;
    botRing.rotation.x = Math.PI / 2;
    parentGroup.add(topRing);
    parentGroup.add(botRing);

    // 實體火工品爆炸螺栓
    const boltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.09, 8);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(Math.cos(angle) * radius * 1.02, yPos, Math.sin(angle) * radius * 1.02);
        bolt.rotation.z = Math.PI / 2;
        bolt.rotation.y = -angle;
        parentGroup.add(bolt);
    }
}

// ==================== 4. 主火箭裝配工廠 ====================
export function createRocketMesh(type) {
    const config = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
    const rootGroup = new THREE.Group();
    const HIGH_SEGMENTS = 64; // 全面啟用 64 細分曲面

    // 裝配材質
    const bodyTex = createProceduralRocketTexture(config.colorTheme.body, config.colorTheme.accent, type === 'STARSHIP', 6);
    const matBody = new THREE.MeshStandardMaterial({
        map: bodyTex,
        metalness: type === 'STARSHIP' ? 0.92 : 0.25,
        roughness: type === 'STARSHIP' ? 0.18 : 0.35
    });

    const matAccent = new THREE.MeshStandardMaterial({ color: config.colorTheme.accent, metalness: 0.5, roughness: 0.3 });
    const matPayload = new THREE.MeshStandardMaterial({ color: config.colorTheme.payload, metalness: 0.7, roughness: 0.25 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.95, roughness: 0.2 });
    const matGimbal = new THREE.MeshStandardMaterial({ color: 0x52525b, metalness: 0.85, roughness: 0.3 });
    const matInterstage = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.5 });

    const scaleH = config.heightM / 60.0;
    const coreRadius = (type === 'STARSHIP' || type === 'SATURN_V') ? 0.55 : 0.38;

    // ----------------- 1. 一級芯級 (Stage 1) -----------------
    const stage1Group = new THREE.Group();

    // 5台鐘型發動機簇 (Engine Cluster)
    const nozzleRadius = coreRadius * 0.32;
    const nozzleHeight = 0.65;
    const nozzlePositions = [
        [0, 0],
        [coreRadius * 0.48, 0],
        [-coreRadius * 0.48, 0],
        [0, coreRadius * 0.48],
        [0, -coreRadius * 0.48]
    ];
    nozzlePositions.forEach(([nx, nz]) => {
        const noz = createAdvancedNozzle(nozzleRadius, nozzleHeight, 32, matEngine, matGimbal);
        noz.position.set(nx, 0.1, nz);
        stage1Group.add(noz);
    });

    // 芯一級桶身
    const s1Height = 4.8 * scaleH;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius, coreRadius, s1Height, HIGH_SEGMENTS), matBody);
    s1.position.y = 0.7 + s1Height / 2;
    stage1Group.add(s1);

    // 底部基座加強裙邊
    const aftSkirt = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 1.03, coreRadius * 1.03, 0.45, HIGH_SEGMENTS), matAccent);
    aftSkirt.position.y = 0.9;
    stage1Group.add(aftSkirt);

    // 級間段 (Interstage) + 爆炸螺栓與隔離環
    const interstageHeight = 0.55 * scaleH;
    const interstagePosY = 0.7 + s1Height + interstageHeight / 2;
    const interstage = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.98, coreRadius * 0.98, interstageHeight, HIGH_SEGMENTS), matInterstage);
    interstage.position.y = interstagePosY;
    stage1Group.add(interstage);

    addPyroBoltsAndThermalShield(stage1Group, coreRadius, interstagePosY, interstageHeight, 8);
    rootGroup.add(stage1Group);

    // ----------------- 2. 助推器 (Boosters) -----------------
    const boostersGroup = new THREE.Group();
    if (config.hasBoosters) {
        const bCount = config.boosterCount || 4;
        const bRadius = coreRadius * 0.52;
        const bHeight = s1Height * 0.82;

        for (let i = 0; i < bCount; i++) {
            const angle = (i / bCount) * Math.PI * 2;
            const b = new THREE.Group();

            const bBody = new THREE.Mesh(new THREE.CylinderGeometry(bRadius, bRadius, bHeight, 32), matBody);
            const bNose = new THREE.Mesh(new THREE.ConeGeometry(bRadius, bHeight * 0.24, 32), matAccent);
            bNose.position.y = bHeight / 2 + (bHeight * 0.12);

            const bNoz = createAdvancedNozzle(bRadius * 0.75, 0.45, 24, matEngine, matGimbal);
            bNoz.position.y = -bHeight / 2 - 0.45;

            b.add(bBody);
            b.add(bNose);
            b.add(bNoz);

            b.position.set(
                Math.cos(angle) * (coreRadius + bRadius * 1.02),
                0.7 + bHeight / 2 + 0.3,
                Math.sin(angle) * (coreRadius + bRadius * 1.02)
            );
            boostersGroup.add(b);
        }
    }
    rootGroup.add(boostersGroup);

    // ----------------- 3. 二級芯級 (Stage 2) -----------------
    const stage2Group = new THREE.Group();

    // 二級真空鐘型噴嘴
    const s2Noz = createAdvancedNozzle(coreRadius * 0.65, 0.65, 32, matEngine, matGimbal);
    s2Noz.position.y = 0.7 + s1Height + 0.1;
    stage2Group.add(s2Noz);

    const s2Height = 2.4 * scaleH;
    const s2PosY = 0.7 + s1Height + interstageHeight + s2Height / 2;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.95, coreRadius, s2Height, HIGH_SEGMENTS), matBody);
    s2.position.y = s2PosY;
    stage2Group.add(s2);
    rootGroup.add(stage2Group);

    // ----------------- 4. 蚌殼式整流罩 (Clamshell Fairing) -----------------
    const fairingHeight = 1.8 * scaleH;
    const noseHeight = 1.4 * scaleH;
    const fairingPosY = s2PosY + s2Height / 2 + fairingHeight / 2;
    const nosePosY = fairingPosY + fairingHeight / 2 + noseHeight / 2;

    const fairingLeftGroup = new THREE.Group();
    const fL = new THREE.Mesh(
        new THREE.CylinderGeometry(coreRadius * 0.75, coreRadius * 0.96, fairingHeight, 32, 1, false, 0, Math.PI),
        matPayload
    );
    fL.position.y = fairingPosY;
    const nL = new THREE.Mesh(
        new THREE.ConeGeometry(coreRadius * 0.75, noseHeight, 32, 1, false, 0, Math.PI),
        matBody
    );
    nL.position.y = nosePosY;
    fairingLeftGroup.add(fL);
    fairingLeftGroup.add(nL);
    rootGroup.add(fairingLeftGroup);

    const fairingRightGroup = new THREE.Group();
    const fR = new THREE.Mesh(
        new THREE.CylinderGeometry(coreRadius * 0.75, coreRadius * 0.96, fairingHeight, 32, 1, false, Math.PI, Math.PI),
        matPayload
    );
    fR.position.y = fairingPosY;
    const nR = new THREE.Mesh(
        new THREE.ConeGeometry(coreRadius * 0.75, noseHeight, 32, 1, false, Math.PI, Math.PI),
        matBody
    );
    nR.position.y = nosePosY;
    fairingRightGroup.add(fR);
    fairingRightGroup.add(nR);
    rootGroup.add(fairingRightGroup);

    // ----------------- 5. 逃逸塔 (Escape Tower) -----------------
    const escapeTower = new THREE.Group();
    if (config.hasTower) {
        const topY = nosePosY + noseHeight / 2;
        const towerHeight = 2.2 * scaleH;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, towerHeight, 16), matAccent);
        pole.position.y = topY + towerHeight / 2;
        const tNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35 * scaleH, 16), matEngine);
        tNozzle.position.y = topY + towerHeight + (0.17 * scaleH);
        escapeTower.add(pole);
        escapeTower.add(tNozzle);
    }
    rootGroup.add(escapeTower);

    if (type === 'STARSHIP') {
        const flapGeo = new THREE.BoxGeometry(0.04, 1.2, 0.75);
        const f1 = new THREE.Mesh(flapGeo, matAccent);
        f1.position.set(coreRadius * 1.1, fairingPosY, 0);
        const f2 = new THREE.Mesh(flapGeo, matAccent);
        f2.position.set(-coreRadius * 1.1, fairingPosY, 0);
        rootGroup.add(f1);
        rootGroup.add(f2);
    }

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
