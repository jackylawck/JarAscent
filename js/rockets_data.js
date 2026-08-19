/**
 * js/rockets_data.js - 航太級火箭數據庫 v2.0
 * 架構：基礎推進級 (Base) → 任務構型 (Config) → 視覺塗裝 (Theme)
 * 嚴格遵循 SI 國際單位制 (kg, N, s, m)
 * @license MIT
 */

// ==================== 1. 🧬 基礎推進模組庫 (Base Stages) ====================
export const ROCKET_BASES = Object.freeze({
    // 長征十號 基礎芯級 (YF-100K 液氧煤油 + YF-75E 液氫液氧)
    CZ10_BASE: {
        stages: 2,
        dryMassStage1: 35000, /* kg */  fuelMassStage1: 420000, /* kg */
        dryMassStage2: 6000,  /* kg */  fuelMassStage2: 95000,  /* kg */
        thrustSea: 7500000,   /* N */   thrustVac: 8200000,     /* N */
        ispSea: 288,          /* s */   ispVac: 315,            /* s */
        thrustStage2: 1200000 /* N */
    },
    // 長征十二號 基礎芯級 (4米級直徑，4台 YF-100K)
    CZ12_BASE: {
        stages: 2,
        dryMassStage1: 24000, /* kg */  fuelMassStage1: 380000, /* kg */
        dryMassStage2: 4500,  /* kg */  fuelMassStage2: 80000,  /* kg */
        thrustSea: 4800000,   /* N */   thrustVac: 5200000,     /* N */
        ispSea: 295,          /* s */   ispVac: 320,            /* s */
        thrustStage2: 850000  /* N */
    },
    // 天龍三號 基礎芯級 (大型液體可復用芯級)
    TL3_BASE: {
        stages: 2,
        dryMassStage1: 36000, /* kg */  fuelMassStage1: 530000, /* kg */
        dryMassStage2: 5000,  /* kg */  fuelMassStage2: 90000,  /* kg */
        thrustSea: 7700000,   /* N */   thrustVac: 8400000,     /* N */
        ispSea: 285,          /* s */   ispVac: 312,            /* s */
        thrustStage2: 1100000 /* N */
    },
    // 力箭二號 基礎芯級 (液體芯級 + 液體助推器模組)
    LJ2_BASE: {
        stages: 2,
        dryMassStage1: 32000, /* kg */  fuelMassStage1: 420000, /* kg */
        dryMassStage2: 4500,  /* kg */  fuelMassStage2: 70000,  /* kg */
        thrustSea: 6600000,   /* N */   thrustVac: 7100000,     /* N */
        ispSea: 280,          /* s */   ispVac: 308,            /* s */
        thrustStage2: 800000  /* N */
    },
    // 引力一號 基礎固體芯級 (全固體推進級)
    YL1_BASE: {
        stages: 3,
        dryMassStage1: 45000, /* kg */  fuelMassStage1: 360000, /* kg */
        dryMassStage2: 8000,  /* kg */  fuelMassStage2: 40000,  /* kg */
        thrustSea: 6000000,   /* N */   thrustVac: 6400000,     /* N */
        ispSea: 245,          /* s */   ispVac: 275,            /* s */
        thrustStage2: 1200000 /* N */
    },
    // 雙曲線三號 基礎芯級 (液氧甲烷可復用芯級)
    SQX3_BASE: {
        stages: 2,
        dryMassStage1: 34000, /* kg */  fuelMassStage1: 490000, /* kg */
        dryMassStage2: 5000,  /* kg */  fuelMassStage2: 85000,  /* kg */
        thrustSea: 7600000,   /* N */   thrustVac: 8300000,     /* N */
        ispSea: 325,          /* s */   ispVac: 360,            /* s */
        thrustStage2: 1000000 /* N */
    },
    // 星艦全系統 (Super Heavy + Starship)
    STARSHIP_BASE: {
        stages: 2,
        dryMassStage1: 200000, /* kg */ fuelMassStage1: 3400000, /* kg */
        dryMassStage2: 100000, /* kg */ fuelMassStage2: 1200000, /* kg */
        thrustSea: 75000000,   /* N */  thrustVac: 82000000,     /* N */
        ispSea: 327,           /* s */  ispVac: 363,             /* s */
        thrustStage2: 14700000 /* N */
    },
    // 土星五號 (S-IC + S-II + S-IVB)
    SATURN_V_BASE: {
        stages: 3,
        dryMassStage1: 130000, /* kg */ fuelMassStage1: 2160000, /* kg */
        dryMassStage2: 40000,  /* kg */ fuelMassStage2: 480000,  /* kg */
        thrustSea: 34500000,   /* N */  thrustVac: 38700000,     /* N */
        ispSea: 263,           /* s */  ispVac: 304,             /* s */
        thrustStage2: 5115000  /* N */
    },
    // 長征二號F 基礎載人芯級
    CZ2F_BASE: {
        stages: 2,
        dryMassStage1: 30000, /* kg */  fuelMassStage1: 450000, /* kg */
        dryMassStage2: 5500,  /* kg */  fuelMassStage2: 90000,  /* kg */
        thrustSea: 5920000,   /* N */   thrustVac: 6500000,     /* N */
        ispSea: 289,          /* s */   ispVac: 315,            /* s */
        thrustStage2: 742000  /* N */
    }
});

// ==================== 2. 🛠️ 任務構型庫 (Configurations) ====================
export const ROCKET_CONFIGS = Object.freeze({
    CZ10A: {
        base: "CZ10_BASE",
        name: "長征十號甲 (CZ-10A 登月載人)",
        nameEn: "Long March 10A (CZ-10A Lunar)",
        heightM: 67,
        hasTower: true,
        hasBoosters: false,
        payloadCapacity: 14000, /* kg to LTO */
        missionType: "Crewed Lunar Exploration"
    },
    CZ12B: {
        base: "CZ12_BASE",
        name: "長征十二號乙 (CZ-12B 4米級)",
        nameEn: "Long March 12B (CZ-12B 4m)",
        heightM: 62,
        hasTower: false,
        hasBoosters: false,
        payloadCapacity: 12000, /* kg to LEO */
        missionType: "Commercial LEO Deployment"
    },
    TL3: {
        base: "TL3_BASE",
        name: "天龍三號 (TL-3 大型液體)",
        nameEn: "Tianlong-3 (TL-3 Large Liquid)",
        heightM: 71,
        hasTower: false,
        hasBoosters: false,
        payloadCapacity: 17000, /* kg to LEO */
        missionType: "Mega-Constellation Deployment"
    },
    LJ2: {
        base: "LJ2_BASE",
        name: "力箭二號 (LJ-2 捆綁液體)",
        nameEn: "Lijian-2 (LJ-2 Boosted)",
        heightM: 53,
        hasTower: false,
        hasBoosters: true,
        boosterCount: 2,
        payloadCapacity: 12000, /* kg to SSO */
        missionType: "Sun-Synchronous Orbit"
    },
    YL1: {
        base: "YL1_BASE",
        name: "引力一號 (Gravity-1 全固體)",
        nameEn: "Gravity-1 (YL-1 All-Solid)",
        heightM: 42,
        hasTower: false,
        hasBoosters: true,
        boosterCount: 4,
        payloadCapacity: 6500, /* kg to LEO */
        missionType: "Rapid Tactical Launch"
    },
    SQX3: {
        base: "SQX3_BASE",
        name: "雙曲線三號 (Hyperbola-3)",
        nameEn: "Hyperbola-3 (SQX-3 Reusable)",
        heightM: 69,
        hasTower: false,
        hasBoosters: false,
        payloadCapacity: 13400, /* kg to LEO */
        missionType: "Reusable Heavy Lift"
    },
    STARSHIP: {
        base: "STARSHIP_BASE",
        name: "星艦全系統 (Starship 120m)",
        nameEn: "Starship Full Stack (120m)",
        heightM: 120,
        hasTower: false,
        hasBoosters: false,
        payloadCapacity: 150000, /* kg to LEO */
        missionType: "Interplanetary Colonization"
    },
    SATURN_V: {
        base: "SATURN_V_BASE",
        name: "土星五號 (Saturn V 110m)",
        nameEn: "Saturn V (Apollo 110m)",
        heightM: 110,
        hasTower: true,
        hasBoosters: false,
        payloadCapacity: 140000, /* kg to LEO */
        missionType: "Apollo Lunar Program"
    },
    CZ2F: {
        base: "CZ2F_BASE",
        name: "長征二號F (CZ-2F 載人型)",
        nameEn: "Long March 2F (CZ-2F Shenzhou)",
        heightM: 58,
        hasTower: true,
        hasBoosters: true,
        boosterCount: 4,
        payloadCapacity: 8600, /* kg to LEO */
        missionType: "Shenzhou Crewed Mission"
    }
});

// ==================== 3. 🎨 視覺塗裝主題庫 (Visual Themes) ====================
export const ROCKET_THEMES = Object.freeze({
    CZ10A:    { body: 0xf8fafc, accent: 0xdc2626, ring: 0x0f172a, payload: 0xfbbf24 },
    CZ12B:    { body: 0xf8fafc, accent: 0x0284c7, ring: 0xdc2626, payload: 0xf8fafc },
    TL3:      { body: 0xf8fafc, accent: 0x0f172a, ring: 0xdc2626, payload: 0xf8fafc },
    LJ2:      { body: 0xf8fafc, accent: 0x0284c7, ring: 0x0f172a, payload: 0xf8fafc },
    YL1:      { body: 0xf8fafc, accent: 0x1e3a8a, ring: 0xf59e0b, payload: 0xf8fafc },
    SQX3:     { body: 0x0f172a, accent: 0xdc2626, ring: 0xf8fafc, payload: 0xf8fafc },
    STARSHIP: { body: 0xe2e8f0, accent: 0x0f172a, ring: 0x0f172a, payload: 0x0f172a },
    SATURN_V: { body: 0xf8fafc, accent: 0x0f172a, ring: 0x0f172a, payload: 0xf8fafc },
    CZ2F:     { body: 0xf8fafc, accent: 0xdc2626, ring: 0x0284c7, payload: 0xfbbf24 }
});

// ==================== 4. 🔧 構型合成器 (Assembly Engine) ====================
export function assembleRocket(configKey) {
    const config = ROCKET_CONFIGS[configKey];
    if (!config) throw new Error(`[Configuration Anomaly] Unknown vehicle key: ${configKey}`);
    
    const base = ROCKET_BASES[config.base];
    if (!base) throw new Error(`[Base Stage Missing] Undefined base core: ${config.base}`);
    
    const theme = ROCKET_THEMES[configKey] || { body: 0xffffff, accent: 0x38bdf8, ring: 0x0f172a, payload: 0xffffff };

    return Object.freeze({
        ...base,
        name: config.name,
        nameEn: config.nameEn,
        heightM: config.heightM,
        hasTower: config.hasTower,
        hasBoosters: config.hasBoosters,
        boosterCount: config.boosterCount || 0,
        payloadCapacity: config.payloadCapacity,
        missionType: config.missionType,
        colorTheme: theme
    });
}

// ==================== 5. 🚀 頂層出口 (向後相容介面) ====================
export const ROCKET_MODELS = Object.freeze(
    Object.keys(ROCKET_CONFIGS).reduce((registry, key) => {
        registry[key] = assembleRocket(key);
        return registry;
    }, {})
);
