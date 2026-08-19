/**
 * js/rockets_registry.js - 火箭工廠註冊表
 * 集中管理所有火箭型號的物理數據與 3D 幾何特徵，方便未來無限擴充
 */

const THREE = window.THREE;

export const ROCKET_MODELS = Object.freeze({
    // 🇨🇳 中國新一代載人與重型火箭
    CZ10A: {
        name: "長征十號甲 (CZ-10A 登月載人)",
        heightM: 67,
        stages: 2,
        hasTower: true,
        hasBoosters: false,
        thrustSea: 7500000, thrustVac: 8200000, ispSea: 288, ispVac: 315,
        dryMassStage1: 35000, fuelMassStage1: 420000, dryMassStage2: 6000, fuelMassStage2: 95000, thrustStage2: 1200000,
        colorTheme: { body: 0xf8fafc, accent: 0xdc2626, ring: 0x0f172a, payload: 0xfbbf24 }
    },
    CZ12B: {
        name: "長征十二號乙 (CZ-12B 4米級)",
        heightM: 62,
        stages: 2,
        hasTower: false,
        hasBoosters: false,
        thrustSea: 4800000, thrustVac: 5200000, ispSea: 295, ispVac: 320,
        dryMassStage1: 24000, fuelMassStage1: 380000, dryMassStage2: 4500, fuelMassStage2: 80000, thrustStage2: 850000,
        colorTheme: { body: 0xf8fafc, accent: 0x0284c7, ring: 0xdc2626, payload: 0xf8fafc }
    },
    TL3: {
        name: "天龍三號 (TL-3 大型液體)",
        heightM: 71,
        stages: 2,
        hasTower: false,
        hasBoosters: false,
        thrustSea: 7700000, thrustVac: 8400000, ispSea: 285, ispVac: 312,
        dryMassStage1: 36000, fuelMassStage1: 530000, dryMassStage2: 5000, fuelMassStage2: 90000, thrustStage2: 1100000,
        colorTheme: { body: 0xf8fafc, accent: 0x0f172a, ring: 0xdc2626, payload: 0xf8fafc }
    },
    LJ2: {
        name: "力箭二號 (LJ-2 捆綁液體)",
        heightM: 53,
        stages: 2,
        hasTower: false,
        hasBoosters: true,
        boosterCount: 2,
        thrustSea: 6600000, thrustVac: 7100000, ispSea: 280, ispVac: 308,
        dryMassStage1: 32000, fuelMassStage1: 420000, dryMassStage2: 4500, fuelMassStage2: 70000, thrustStage2: 800000,
        colorTheme: { body: 0xf8fafc, accent: 0x0284c7, ring: 0x0f172a, payload: 0xf8fafc }
    },
    YL1: {
        name: "引力一號 (Gravity-1 全固體捆綁)",
        heightM: 42,
        stages: 3,
        hasTower: false,
        hasBoosters: true,
        boosterCount: 4,
        thrustSea: 6000000, thrustVac: 6400000, ispSea: 245, ispVac: 275,
        dryMassStage1: 45000, fuelMassStage1: 360000, dryMassStage2: 8000, fuelMassStage2: 40000, thrustStage2: 1200000,
        colorTheme: { body: 0xf8fafc, accent: 0x1e3a8a, ring: 0xf59e0b, payload: 0xf8fafc }
    },
    SQX3: {
        name: "雙曲線三號 (Hyperbola-3 可重複)",
        heightM: 69,
        stages: 2,
        hasTower: false,
        hasBoosters: false,
        thrustSea: 7600000, thrustVac: 8300000, ispSea: 325, ispVac: 360,
        dryMassStage1: 34000, fuelMassStage1: 490000, dryMassStage2: 5000, fuelMassStage2: 85000, thrustStage2: 1000000,
        colorTheme: { body: 0x0f172a, accent: 0xdc2626, ring: 0xf8fafc, payload: 0xf8fafc }
    },
    // 🇺🇸 全球重型標竿
    STARSHIP: {
        name: "星艦全系統 (Starship 120m)",
        heightM: 120,
        stages: 2,
        hasTower: false,
        hasBoosters: false,
        thrustSea: 75000000, thrustVac: 82000000, ispSea: 327, ispVac: 363,
        dryMassStage1: 200000, fuelMassStage1: 3400000, dryMassStage2: 100000, fuelMassStage2: 1200000, thrustStage2: 14700000,
        colorTheme: { body: 0xe2e8f0, accent: 0x0f172a, ring: 0x0f172a, payload: 0x0f172a }
    },
    SATURN_V: {
        name: "土星五號 (Saturn V 110m)",
        heightM: 110,
        stages: 3,
        hasTower: true,
        hasBoosters: false,
        thrustSea: 34500000, thrustVac: 38700000, ispSea: 263, ispVac: 304,
        dryMassStage1: 130000, fuelMassStage1: 2160000, dryMassStage2: 40000, fuelMassStage2: 480000, thrustStage2: 5115000,
        colorTheme: { body: 0xf8fafc, accent: 0x0f172a, ring: 0x0f172a, payload: 0xf8fafc }
    },
    CZ2F: {
        name: "長征二號F (CZ-2F 載人型)",
        heightM: 58,
        stages: 2,
        hasTower: true,
        hasBoosters: true,
        boosterCount: 4,
        thrustSea: 5920000, thrustVac: 6500000, ispSea: 289, ispVac: 315,
        dryMassStage1: 30000, fuelMassStage1: 450000, dryMassStage2: 5500, fuelMassStage2: 90000, thrustStage2: 742000,
        colorTheme: { body: 0xf8fafc, accent: 0xdc2626, ring: 0x0284c7, payload: 0xfbbf24 }
    }
});

/**
 * 根據型號參數建立 3D 網格架構
 */
export function createRocketMeshGroup(type) {
    const config = ROCKET_MODELS[type] || ROCKET_MODELS.CZ10A;
    const group = new THREE.Group();

    const matBody = new THREE.MeshStandardMaterial({ color: config.colorTheme.body, metalness: type === 'STARSHIP' ? 0.9 : 0.5, roughness: 0.2 });
    const matAccent = new THREE.MeshStandardMaterial({ color: config.colorTheme.accent, metalness: 0.6, roughness: 0.3 });
    const matRing = new THREE.MeshStandardMaterial({ color: config.colorTheme.ring, metalness: 0.7, roughness: 0.2 });
    const matPayload = new THREE.MeshStandardMaterial({ color: config.colorTheme.payload, metalness: 0.8, roughness: 0.2 });
    const matEngine = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.1 });

    // 比例縮放（基準半徑 0.4，高度隨實際米數調整）
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

    // 塗裝環
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
    const nose = new THREE.Mesh(new THREE.ConeGeometry(coreRadius * 0.75, 1.4 * scaleH, 24), matBody);
    nose.position.y = fairingPosY + fairingHeight / 2 + (0.7 * scaleH);
    group.add(fairing);
    group.add(nose);

    // 6. 逃逸塔
    const escapeTower = new THREE.Group();
    if (config.hasTower) {
        const topY = nose.position.y + 0.7 * scaleH;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 2.2 * scaleH, 12), matAccent);
        pole.position.y = topY + 1.1 * scaleH;
        const tNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4 * scaleH, 12), matEngine);
        tNozzle.position.y = topY + 2.2 * scaleH;
        escapeTower.add(pole); escapeTower.add(tNozzle);
    }
    group.add(escapeTower);

    // 特殊 Starship 襟翼
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
