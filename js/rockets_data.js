/**
 * js/rockets_data.js - 航太工業級運載火箭資料庫 v2.1 Master Edition
 * (自描述推進劑熱化學參數、噴管面積比、事件驅動分離時序與三層構型管理)
 * @license MIT
 */

// ==================== 1. 推進劑熱化學物理常數 ====================
export const PROPELLANT_PROPERTIES = {
    "LOX/Kerosene": {
        name: "液氧/煤油 (RP-1)",
        optimalOF: 2.45,
        ofSensitivity: 1.35,
        densityKgM3: 1020
    },
    "Methalox": {
        name: "液氧/甲烷 (LCH4)",
        optimalOF: 3.60,
        ofSensitivity: 1.15,
        densityKgM3: 830
    },
    "Hydrolox": {
        name: "液氧/液氫 (LH2)",
        optimalOF: 5.50,
        ofSensitivity: 1.65,
        densityKgM3: 360
    },
    "Solid": {
        name: "端羥基聚丁二烯固體 (HTPB)",
        optimalOF: 1.00,
        ofSensitivity: 0.10,
        densityKgM3: 1750
    },
    "N2O4/UDMH": {
        name: "四氧化二氮/偏二甲肼",
        optimalOF: 2.15,
        ofSensitivity: 1.20,
        densityKgM3: 1180
    }
};

// ==================== 2. 基礎推進級核心參數 (BASE TIERS) ====================
const ROCKET_BASES = {
    // 中國新一代主力
    CZ10_BASE: {
        heightM: 67.0,
        coreDiameterM: 5.0,
        dryMassStage1: 34000 /* kg */,
        fuelMassStage1: 420000 /* kg */,
        dryMassStage2: 12000 /* kg */,
        fuelMassStage2: 95000 /* kg */,
        thrustSea: 8400000 /* N (7x YF-100K) */,
        thrustVac: 9300000 /* N */,
        ispSea: 301.5 /* s */,
        ispVac: 335.0 /* s */,
        thrustStage2: 1200000 /* N (3x YF-100M) */,
        ispStage2: 350.0 /* s */,
        propellantType: "LOX/Kerosene",
        optimalOF: 2.45,
        ofSensitivity: 1.35,
        expansionRatio: 35.0,
        frontalArea: 19.63 /* m^2 */
    },
    CZ12B_BASE: {
        heightM: 59.0,
        coreDiameterM: 3.8,
        dryMassStage1: 22000 /* kg */,
        fuelMassStage1: 280000 /* kg */,
        dryMassStage2: 7500 /* kg */,
        fuelMassStage2: 58000 /* kg */,
        thrustSea: 5000000 /* N (4x YF-100K) */,
        thrustVac: 5500000 /* N */,
        ispSea: 301.5 /* s */,
        ispVac: 335.0 /* s */,
        thrustStage2: 800000 /* N */,
        ispStage2: 345.0 /* s */,
        propellantType: "LOX/Kerosene",
        optimalOF: 2.45,
        ofSensitivity: 1.35,
        expansionRatio: 32.0,
        frontalArea: 11.34 /* m^2 */
    },
    TL3_BASE: {
        heightM: 71.0,
        coreDiameterM: 3.8,
        dryMassStage1: 26000 /* kg */,
        fuelMassStage1: 360000 /* kg */,
        dryMassStage2: 8500 /* kg */,
        fuelMassStage2: 65000 /* kg */,
        thrustSea: 7550000 /* N (9x TH-12) */,
        thrustVac: 8300000 /* N */,
        ispSea: 285.0 /* s */,
        ispVac: 320.0 /* s */,
        thrustStage2: 950000 /* N */,
        ispStage2: 340.0 /* s */,
        propellantType: "LOX/Kerosene",
        optimalOF: 2.40,
        ofSensitivity: 1.30,
        expansionRatio: 30.0,
        frontalArea: 11.34 /* m^2 */
    },
    LJ2_BASE: {
        heightM: 53.0,
        coreDiameterM: 3.35,
        dryMassStage1: 18000 /* kg */,
        fuelMassStage1: 210000 /* kg */,
        dryMassStage2: 6000 /* kg */,
        fuelMassStage2: 45000 /* kg */,
        thrustSea: 4000000 /* N */,
        thrustVac: 4400000 /* N */,
        ispSea: 290.0 /* s */,
        ispVac: 325.0 /* s */,
        thrustStage2: 600000 /* N */,
        ispStage2: 335.0 /* s */,
        propellantType: "LOX/Kerosene",
        optimalOF: 2.45,
        ofSensitivity: 1.35,
        expansionRatio: 28.0,
        frontalArea: 8.81 /* m^2 */
    },
    YL1_BASE: {
        heightM: 30.0,
        coreDiameterM: 2.65,
        dryMassStage1: 14000 /* kg */,
        fuelMassStage1: 180000 /* kg */,
        dryMassStage2: 5000 /* kg */,
        fuelMassStage2: 42000 /* kg */,
        thrustSea: 5900000 /* N (全固體芯級+捆綁) */,
        thrustVac: 6200000 /* N */,
        ispSea: 245.0 /* s */,
        ispVac: 275.0 /* s */,
        thrustStage2: 1200000 /* N */,
        ispStage2: 285.0 /* s */,
        propellantType: "Solid",
        optimalOF: 1.00,
        ofSensitivity: 0.10,
        expansionRatio: 18.0,
        frontalArea: 5.51 /* m^2 */
    },
    SQX3_BASE: {
        heightM: 69.0,
        coreDiameterM: 4.2,
        dryMassStage1: 28000 /* kg */,
        fuelMassStage1: 390000 /* kg */,
        dryMassStage2: 9000 /* kg */,
        fuelMassStage2: 72000 /* kg */,
        thrustSea: 7600000 /* N (9x JD-2 焦點二號) */,
        thrustVac: 8400000 /* N */,
        ispSea: 315.0 /* s */,
        ispVac: 355.0 /* s */,
        thrustStage2: 1050000 /* N */,
        ispStage2: 365.0 /* s */,
        propellantType: "Methalox",
        optimalOF: 3.60,
        ofSensitivity: 1.15,
        expansionRatio: 40.0,
        frontalArea: 13.85 /* m^2 */
    },
    CZ2F_BASE: {
        heightM: 58.3,
        coreDiameterM: 3.35,
        dryMassStage1: 20000 /* kg */,
        fuelMassStage1: 220000 /* kg */,
        dryMassStage2: 7000 /* kg */,
        fuelMassStage2: 86000 /* kg */,
        thrustSea: 5920000 /* N (4x YF-20B + 4助推) */,
        thrustVac: 6400000 /* N */,
        ispSea: 259.0 /* s */,
        ispVac: 289.0 /* s */,
        thrustStage2: 738000 /* N (YF-24B) */,
        ispStage2: 295.0 /* s */,
        propellantType: "N2O4/UDMH",
        optimalOF: 2.15,
        ofSensitivity: 1.20,
        expansionRatio: 25.0,
        frontalArea: 8.81 /* m^2 */
    },

    // 全球重型標竿
    STARSHIP_BASE: {
        heightM: 121.0,
        coreDiameterM: 9.0,
        dryMassStage1: 200000 /* kg (Super Heavy) */,
        fuelMassStage1: 3400000 /* kg */,
        dryMassStage2: 100000 /* kg (Ship) */,
        fuelMassStage2: 1200000 /* kg */,
        thrustSea: 72000000 /* N (33x Raptor 2/3) */,
        thrustVac: 78000000 /* N */,
        ispSea: 327.0 /* s */,
        ispVac: 350.0 /* s */,
        thrustStage2: 14700000 /* N (6x Raptor) */,
        ispStage2: 380.0 /* s (RVac) */,
        propellantType: "Methalox",
        optimalOF: 3.60,
        ofSensitivity: 1.15,
        expansionRatio: 80.0,
        frontalArea: 63.62 /* m^2 */
    },
    SATURN_V_BASE: {
        heightM: 110.6,
        coreDiameterM: 10.1,
        dryMassStage1: 130000 /* kg (S-IC) */,
        fuelMassStage1: 2160000 /* kg */,
        dryMassStage2: 40000 /* kg (S-II) */,
        fuelMassStage2: 440000 /* kg */,
        thrustSea: 34500000 /* N (5x F-1) */,
        thrustVac: 38700000 /* N */,
        ispSea: 263.0 /* s */,
        ispVac: 304.0 /* s */,
        thrustStage2: 5000000 /* N (5x J-2) */,
        ispStage2: 421.0 /* s (Hydrolox) */,
        propellantType: "LOX/Kerosene",
        optimalOF: 2.27,
        ofSensitivity: 1.40,
        expansionRatio: 16.0,
        frontalArea: 80.12 /* m^2 */
    }
};

// ==================== 3. 任務構型與分離事件資料庫 (CONFIG MODELS) ====================
export const ROCKET_MODELS = {
    CZ10A: {
        ...ROCKET_BASES.CZ10_BASE,
        name: "長征十號甲 (CZ-10A 登月載人)",
        nameEn: "Long March 10A (Crew Lunar)",
        missionType: "LTO/LEO",
        stages: 2,
        hasBoosters: false,
        boosterCount: 0,
        hasTower: true,
        colorTheme: { body: 0xffffff, accent: 0xdc2626, payload: 0x0284c7 },
        separationEvents: [
            { event: "escapeTower", time: 20.0, impulse: 45.0, mass: 1800, refArea: 1.5, cd: 0.60 },
            { event: "boosters", time: 45.0, impulse: -14.0, mass: 34000, refArea: 19.6, cd: 0.82 },
            { event: "fairing", time: 60.0, impulse: 18.0, mass: 900, refArea: 6.5, cd: 1.25 },
            { event: "stage2", time: 110.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    },
    CZ12B: {
        ...ROCKET_BASES.CZ12B_BASE,
        name: "長征十二號乙 (CZ-12B 4米級主力)",
        nameEn: "Long March 12B (Commercial Heavy)",
        missionType: "LEO/SSO",
        stages: 2,
        hasBoosters: false,
        boosterCount: 0,
        hasTower: false,
        colorTheme: { body: 0xf8fafc, accent: 0x0284c7, payload: 0x334155 },
        separationEvents: [
            { event: "boosters", time: 48.0, impulse: -13.0, mass: 22000, refArea: 11.3, cd: 0.80 },
            { event: "fairing", time: 65.0, impulse: 16.0, mass: 750, refArea: 5.2, cd: 1.20 },
            { event: "stage2", time: 115.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    },
    TL3: {
        ...ROCKET_BASES.TL3_BASE,
        name: "天龍三號 (TL-3 大型液體複用)",
        nameEn: "Tianlong-3 (Heavy Reusable)",
        missionType: "LEO Constellation",
        stages: 2,
        hasBoosters: false,
        boosterCount: 0,
        hasTower: false,
        colorTheme: { body: 0xffffff, accent: 0x0284c7, payload: 0x0f172a },
        separationEvents: [
            { event: "boosters", time: 50.0, impulse: -15.0, mass: 26000, refArea: 11.3, cd: 0.80 },
            { event: "fairing", time: 68.0, impulse: 17.0, mass: 800, refArea: 5.5, cd: 1.20 },
            { event: "stage2", time: 120.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    },
    LJ2: {
        ...ROCKET_BASES.LJ2_BASE,
        name: "力箭二號 (LJ-2 液體捆綁型)",
        nameEn: "Kinetica-2 (Liquid Clustered)",
        missionType: "SSO/LEO",
        stages: 2,
        hasBoosters: true,
        boosterCount: 2,
        hasTower: false,
        colorTheme: { body: 0xf1f5f9, accent: 0xe11d48, payload: 0x1e293b },
        separationEvents: [
            { event: "boosters", time: 42.0, impulse: -12.0, mass: 18000, refArea: 8.8, cd: 0.78 },
            { event: "fairing", time: 58.0, impulse: 15.0, mass: 650, refArea: 4.8, cd: 1.20 },
            { event: "stage2", time: 105.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    },
    YL1: {
        ...ROCKET_BASES.YL1_BASE,
        name: "引力一號 (Gravity-1 全固體捆綁)",
        nameEn: "Gravity-1 (All-Solid Heavy)",
        missionType: "LEO Mass Constellation",
        stages: 2,
        hasBoosters: true,
        boosterCount: 4,
        hasTower: false,
        colorTheme: { body: 0xffffff, accent: 0x2563eb, payload: 0x475569 },
        separationEvents: [
            { event: "boosters", time: 38.0, impulse: -16.0, mass: 14000, refArea: 5.5, cd: 0.75 },
            { event: "fairing", time: 52.0, impulse: 16.0, mass: 550, refArea: 3.8, cd: 1.25 },
            { event: "stage2", time: 95.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    },
    SQX3: {
        ...ROCKET_BASES.SQX3_BASE,
        name: "雙曲線三號 (Hyperbola-3 液氧甲烷)",
        nameEn: "Hyperbola-3 (Methalox VTVL)",
        missionType: "LEO Reusable",
        stages: 2,
        hasBoosters: false,
        boosterCount: 0,
        hasTower: false,
        colorTheme: { body: 0x0f172a, accent: 0x38bdf8, payload: 0x0284c7 },
        separationEvents: [
            { event: "boosters", time: 52.0, impulse: -14.0, mass: 28000, refArea: 13.8, cd: 0.80 },
            { event: "fairing", time: 70.0, impulse: 18.0, mass: 850, refArea: 6.0, cd: 1.20 },
            { event: "stage2", time: 125.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    },
    CZ2F: {
        ...ROCKET_BASES.CZ2F_BASE,
        name: "長征二號F (CZ-2F 神舟載人型)",
        nameEn: "Long March 2F (Shenzhou Crewed)",
        missionType: "LEO Crew Station",
        stages: 2,
        hasBoosters: true,
        boosterCount: 4,
        hasTower: true,
        colorTheme: { body: 0xffffff, accent: 0xdc2626, payload: 0x1d4ed8 },
        separationEvents: [
            { event: "escapeTower", time: 20.0, impulse: 45.0, mass: 1600, refArea: 1.4, cd: 0.60 },
            { event: "boosters", time: 45.0, impulse: -13.0, mass: 20000, refArea: 8.8, cd: 0.78 },
            { event: "fairing", time: 62.0, impulse: 16.0, mass: 700, refArea: 5.0, cd: 1.20 },
            { event: "stage2", time: 110.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    },
    STARSHIP: {
        ...ROCKET_BASES.STARSHIP_BASE,
        name: "星艦全系統 (Starship 120m 超重型)",
        nameEn: "Starship Full Stack (120m Heavy)",
        missionType: "Interplanetary/Mars",
        stages: 2,
        hasBoosters: false,
        boosterCount: 0,
        hasTower: false,
        colorTheme: { body: 0x94a3b8, accent: 0x0f172a, payload: 0x1e293b },
        separationEvents: [
            { event: "boosters", time: 65.0, impulse: -16.0, mass: 200000, refArea: 63.6, cd: 0.85 },
            { event: "fairing", time: 85.0, impulse: 22.0, mass: 2500, refArea: 24.0, cd: 1.15 },
            { event: "stage2", time: 150.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    },
    SATURN_V: {
        ...ROCKET_BASES.SATURN_V_BASE,
        name: "土星五號 (Saturn V 阿波羅登月)",
        nameEn: "Saturn V (Apollo Lunar)",
        missionType: "Lunar Landing",
        stages: 2,
        hasBoosters: false,
        boosterCount: 0,
        hasTower: true,
        colorTheme: { body: 0xffffff, accent: 0x0f172a, payload: 0x334155 },
        separationEvents: [
            { event: "escapeTower", time: 24.0, impulse: 45.0, mass: 2200, refArea: 2.2, cd: 0.60 },
            { event: "boosters", time: 55.0, impulse: -15.0, mass: 130000, refArea: 80.1, cd: 0.88 },
            { event: "fairing", time: 75.0, impulse: 20.0, mass: 1800, refArea: 18.0, cd: 1.20 },
            { event: "stage2", time: 135.0, impulse: 0.0, mass: 0, refArea: 0, cd: 0 }
        ]
    }
};
