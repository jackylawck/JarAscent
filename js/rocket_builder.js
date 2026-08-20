/**
 * js/rocket_builder.js - 航太 AAA 級程序化 PBR 幾何資產管線
 * (Procedural Normal Maps, Tangent-Space Shading, Thermal Ablation & Multi-LOD)
 * @license MIT
 */

const THREE = window.THREE;
import { ROCKET_MODELS } from './rockets_data.js';

// ==================== 1. 程序化 PBR 紋理與法線貼圖生成器 (無需外部圖檔) ====================

function createProceduralRocketMaps(baseColorHex, accentColorHex, hasTileGrid = false, uvRepeats = 6) {
    const size = 1024;
    
    // --- 1. Albedo Canvas (漫反射顏色 + 燒蝕污漬) ---
    const canvasAlbedo = document.createElement('canvas');
    canvasAlbedo.width = size; canvasAlbedo.height = size;
    const ctxA = canvasAlbedo.getContext('2d');

    // --- 2. Height Canvas (高度圖，用於 Sobel 運算推導立體法線) ---
    const canvasHeight = document.createElement('canvas');
    canvasHeight.width = size; canvasHeight.height = size;
    const ctxH = canvasHeight.getContext('2d');

    // 基底顏色與中性高度 (128 灰色代表基準平面)
    ctxA.fillStyle = `#${baseColorHex.toString(16).padStart(6, '0')}`;
    ctxA.fillRect(0, 0, size, size);
    
    ctxH.fillStyle = '#808080';
    ctxH.fillRect(0, 0, size, size);

    const stepX = size / uvRepeats;

    // A. 縱向裝甲拼縫 (Grooves) - 高度下凹 (深灰色)
    ctxA.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctxA.lineWidth = 4;
    ctxH.strokeStyle = '#404040'; // 凹槽
    ctxH.lineWidth = 4;

    for (let x = 0; x <= size; x += stepX) {
        ctxA.beginPath(); ctxA.moveTo(x, 0); ctxA.lineTo(x, size); ctxA.stroke();
        ctxH.beginPath(); ctxH.moveTo(x, 0); ctxH.lineTo(x, size); ctxH.stroke();
    }

    // B. 航太隔熱瓦網格 (Thermal Tiles)
    if (hasTileGrid) {
        ctxA.strokeStyle = 'rgba(0, 0, 0, 0.16)';
        ctxA.lineWidth = 2;
        ctxH.strokeStyle = '#606060';
        ctxH.lineWidth = 2;
        for (let y = 0; y < size; y += 24) {
            ctxA.beginPath(); ctxA.moveTo(0, y); ctxA.lineTo(size, y); ctxA.stroke();
            ctxH.beginPath(); ctxH.moveTo(0, y); ctxH.lineTo(size, y); ctxH.stroke();
        }
    }

    // C. 裝飾加強筋飾帶
    ctxA.fillStyle = `#${accentColorHex.toString(16).padStart(6, '0')}`;
    ctxA.fillRect(0, 160, size, 45);
    ctxA.fillRect(0, 780, size, 55);

    // D. 航空立體鉚釘點陣 (Rivets) - 高度微凸 (高光純白)
    ctxA.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctxH.fillStyle = '#ffffff'; // 鉚釘凸起
    for (let x = 8; x < size; x += stepX / 2) {
        for (let y = 16; y < size; y += 48) {
            ctxA.beginPath(); ctxA.arc(x, y, 2.0, 0, Math.PI * 2); ctxA.fill();
            ctxH.beginPath(); ctxH.arc(x, y, 2.0, 0, Math.PI * 2); ctxH.fill();
        }
    }

    // E. 3A 級微表面磨損：冷凝水流痕與隨機微瑕疵
    ctxA.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let i = 0; i < 40; i++) {
        const sx = Math.random() * size;
        const sy = Math.random() * size * 0.5;
        const sw = 4 + Math.random() * 8;
        const sh = 30 + Math.random() * 120;
        ctxA.fillRect(sx, sy, sw, sh);
    }

    // F. 底部發動機艙高溫熱煙燻燒蝕痕跡 (Thermal Ablation Gradient)
    const heatGradient = ctxA.createLinearGradient(0, size - 160, 0, size);
    heatGradient.addColorStop(0, 'rgba(0,0,0,0)');
    heatGradient.addColorStop(0.7, 'rgba(40, 20, 10, 0.25)');
    heatGradient.addColorStop(1, 'rgba(15, 10, 5, 0.65)');
    ctxA.fillStyle = heatGradient;
    ctxA.fillRect(0, size - 160, size, 160);

    // --- 3. Sobel 偏微分算子從 HeightMap 生成 Tangent-Space 法線貼圖 ---
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = size; normalCanvas.height = size;
    const ctxN = normalCanvas.getContext('2d');

    const imgDataH = ctxH.getImageData(0, 0, size, size);
    const src = imgDataH.data;
    const imgDataN = ctxN.createImageData(size, size);
    const dst = imgDataN.data;

    const getH = (x, y) => {
        const px = (x + size) % size;
        const py = Math.max(0, Math.min(size - 1, y));
        return src[(py * size + px) * 4] / 255.0;
    };

    const strength = 2.2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Sobel 梯度
            const dx = (getH(x + 1, y - 1) + 2 * getH(x + 1, y) + getH(x + 1, y + 1)) -
                       (getH(x - 1, y - 1) + 2 * getH(x - 1, y) + getH(x - 1, y + 1));
            const dy = (getH(x - 1, y + 1) + 2 * getH(x, y + 1) + getH(x + 1, y + 1)) -
                       (getH(x - 1, y - 1) + 2 * getH(x, y - 1) + getH(x + 1, y - 1));

            let nx = -dx * strength;
            let ny = -dy * strength;
            let nz = 1.0;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            nx /= len; ny /= len; nz /= len;

            const idx = (y * size + x) * 4;
            dst[idx] = ((nx * 0.5 + 0.5) * 255) | 0;     // R (X-Tangent)
            dst[idx + 1] = ((ny * 0.5 + 0.5) * 255) | 0; // G (Y-Tangent)
            dst[idx + 2] = ((nz * 0.5 + 0.5) * 255) | 0; // B (Z-Normal)
            dst[idx + 3] = 255;
        }
    }
    ctxN.putImageData(imgDataN, 0, 0);

    const albedoTex = new THREE.CanvasTexture(canvasAlbedo);
    albedoTex.wrapS = THREE.RepeatWrapping; albedoTex.wrapT = THREE.RepeatWrapping;

    const normalTex = new THREE.CanvasTexture(normalCanvas);
    normalTex.wrapS = THREE.RepeatWrapping; normalTex.wrapT = THREE.RepeatWrapping;

    return { albedo: albedoTex, normal: normalTex };
}

// ==================== 2. 德拉瓦爾鐘型噴嘴 (LatheGeometry 連續拋物線車削) ====================

function createAdvancedNozzle(radius, height, segments, matEngine, matGimbal) {
    const group = new THREE.Group();

    // 德拉瓦爾鐘型連續拋物線樣條 (de Laval Bell Contour)
    const points = [];
    const steps = Math.max(12, Math.floor(segments * 0.6));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = t * height;
        // 喉部收縮 0.35R -> 鐘型擴散 1.0R (平滑二次拋物線)
        const r = radius * (0.35 + t * t * 0.65);
        points.push(new THREE.Vector2(r, y));
    }
    // 燃燒室收縮段與注元器頭部 (Injector Dome)
    points.push(new THREE.Vector2(radius * 0.48, height * 1.15));
    points.push(new THREE.Vector2(radius * 0.40, height * 1.28));
    points.push(new THREE.Vector2(0.01, height * 1.30));

    const nozzleGeo = new THREE.LatheGeometry(points, segments);
    const nozzle = new THREE.Mesh(nozzleGeo, matEngine);
    nozzle.rotation.x = Math.PI; // 轉向朝下 (-Y)
    nozzle.position.y = height * 1.30;
    group.add(nozzle);

    // 萬向節加強環 (Gimbal Ring)
    const gimbalGeo = new THREE.TorusGeometry(radius * 0.52, radius * 0.04, 8, Math.max(12, Math.floor(segments / 2)));
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

    const ringGeo = new THREE.TorusGeometry(radius * 1.015, 0.02, 6, 32);
    const topRing = new THREE.Mesh(ringGeo, shieldMat);
    topRing.position.y = yPos + height * 0.48;
    topRing.rotation.x = Math.PI / 2;
    const botRing = new THREE.Mesh(ringGeo, shieldMat);
    botRing.position.y = yPos - height * 0.48;
    botRing.rotation.x = Math.PI / 2;
    parentGroup.add(topRing);
    parentGroup.add(botRing);

    const boltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.09, 6);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(Math.cos(angle) * radius * 1.02, yPos, Math.sin(angle) * radius * 1.02);
        bolt.rotation.z = Math.PI / 2;
        bolt.rotation.y = -angle;
        parentGroup.add(bolt);
    }
}

// ==================== 4. 主火箭裝配工廠 (支援 LOD 細分適配) ====================

export function createRocketMesh(type, lodLevel = 0) {
    const config = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
    const rootGroup = new THREE.Group();

    // 🎯 LOD 細分度控制：LOD0 (64段) / LOD1 (32段) / LOD2 (16段)
    const HIGH_SEGMENTS = lodLevel === 2 ? 16 : (lodLevel === 1 ? 32 : 64);
    const NOZZLE_SEGMENTS = lodLevel === 2 ? 12 : (lodLevel === 1 ? 20 : 32);

    // 程序化 PBR 貼圖 (漫反射 + 切線空間立體法線)
    const maps = createProceduralRocketMaps(config.colorTheme.body, config.colorTheme.accent, type === 'STARSHIP', 6);
    
    const matBody = new THREE.MeshStandardMaterial({
        map: maps.albedo,
        normalMap: maps.normal,
        normalScale: new THREE.Vector2(0.85, 0.85),
        metalness: type === 'STARSHIP' ? 0.92 : 0.28,
        roughness: type === 'STARSHIP' ? 0.18 : 0.32
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
        const noz = createAdvancedNozzle(nozzleRadius, nozzleHeight, NOZZLE_SEGMENTS, matEngine, matGimbal);
        noz.position.set(nx, 0.1, nz);
        stage1Group.add(noz);
    });

    const s1Height = 4.8 * scaleH;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius, coreRadius, s1Height, HIGH_SEGMENTS), matBody);
    s1.position.y = 0.7 + s1Height / 2;
    stage1Group.add(s1);

    const aftSkirt = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 1.03, coreRadius * 1.03, 0.45, HIGH_SEGMENTS), matAccent);
    aftSkirt.position.y = 0.9;
    stage1Group.add(aftSkirt);

    const interstageHeight = 0.55 * scaleH;
    const interstagePosY = 0.7 + s1Height + interstageHeight / 2;
    const interstage = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.98, coreRadius * 0.98, interstageHeight, HIGH_SEGMENTS), matInterstage);
    interstage.position.y = interstagePosY;
    stage1Group.add(interstage);

    if (lodLevel < 2) {
        addPyroBoltsAndThermalShield(stage1Group, coreRadius, interstagePosY, interstageHeight, 8);
    }
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

            const bBody = new THREE.Mesh(new THREE.CylinderGeometry(bRadius, bRadius, bHeight, Math.max(16, Math.floor(HIGH_SEGMENTS / 2))), matBody);
            const bNose = new THREE.Mesh(new THREE.ConeGeometry(bRadius, bHeight * 0.24, Math.max(16, Math.floor(HIGH_SEGMENTS / 2))), matAccent);
            bNose.position.y = bHeight / 2 + (bHeight * 0.12);

            const bNoz = createAdvancedNozzle(bRadius * 0.75, 0.45, NOZZLE_SEGMENTS, matEngine, matGimbal);
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

    const s2Noz = createAdvancedNozzle(coreRadius * 0.65, 0.65, NOZZLE_SEGMENTS, matEngine, matGimbal);
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
        new THREE.CylinderGeometry(coreRadius * 0.75, coreRadius * 0.96, fairingHeight, Math.max(16, Math.floor(HIGH_SEGMENTS / 2)), 1, false, 0, Math.PI),
        matPayload
    );
    fL.position.y = fairingPosY;
    const nL = new THREE.Mesh(
        new THREE.ConeGeometry(coreRadius * 0.75, noseHeight, Math.max(16, Math.floor(HIGH_SEGMENTS / 2)), 1, false, 0, Math.PI),
        matBody
    );
    nL.position.y = nosePosY;
    fairingLeftGroup.add(fL);
    fairingLeftGroup.add(nL);
    rootGroup.add(fairingLeftGroup);

    const fairingRightGroup = new THREE.Group();
    const fR = new THREE.Mesh(
        new THREE.CylinderGeometry(coreRadius * 0.75, coreRadius * 0.96, fairingHeight, Math.max(16, Math.floor(HIGH_SEGMENTS / 2)), 1, false, Math.PI, Math.PI),
        matPayload
    );
    fR.position.y = fairingPosY;
    const nR = new THREE.Mesh(
        new THREE.ConeGeometry(coreRadius * 0.75, noseHeight, Math.max(16, Math.floor(HIGH_SEGMENTS / 2)), 1, false, Math.PI, Math.PI),
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
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, towerHeight, 12), matAccent);
        pole.position.y = topY + towerHeight / 2;
        const tNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35 * scaleH, 12), matEngine);
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
