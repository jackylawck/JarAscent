/**
 * js/rockets_data.js - 全球火箭規格、塗裝與多語系字典
 * @license MIT
 */

export const ROCKET_MODELS = Object.freeze({
    CZ10A: {
        name: "長征十號甲 (CZ-10A 登月載人)", nameEn: "Long March 10A (CZ-10A Lunar)",
        heightM: 67, stages: 2, hasTower: true, hasBoosters: false,
        thrustSea: 7500000, thrustVac: 8200000, ispSea: 288, ispVac: 315,
        dryMassStage1: 35000, fuelMassStage1: 420000, dryMassStage2: 6000, fuelMassStage2: 95000, thrustStage2: 1200000,
        colorTheme: { body: 0xf8fafc, accent: 0xdc2626, ring: 0x0f172a, payload: 0xfbbf24 }
    },
    CZ12B: {
        name: "長征十二號乙 (CZ-12B 4米級)", nameEn: "Long March 12B (CZ-12B 4m)",
        heightM: 62, stages: 2, hasTower: false, hasBoosters: false,
        thrustSea: 4800000, thrustVac: 5200000, ispSea: 295, ispVac: 320,
        dryMassStage1: 24000, fuelMassStage1: 380000, dryMassStage2: 4500, fuelMassStage2: 80000, thrustStage2: 850000,
        colorTheme: { body: 0xf8fafc, accent: 0x0284c7, ring: 0xdc2626, payload: 0xf8fafc }
    },
    TL3: {
        name: "天龍三號 (TL-3 大型液體)", nameEn: "Tianlong-3 (TL-3 Large Liquid)",
        heightM: 71, stages: 2, hasTower: false, hasBoosters: false,
        thrustSea: 7700000, thrustVac: 8400000, ispSea: 285, ispVac: 312,
        dryMassStage1: 36000, fuelMassStage1: 530000, dryMassStage2: 5000, fuelMassStage2: 90000, thrustStage2: 1100000,
        colorTheme: { body: 0xf8fafc, accent: 0x0f172a, ring: 0xdc2626, payload: 0xf8fafc }
    },
    LJ2: {
        name: "力箭二號 (LJ-2 捆綁液體)", nameEn: "Lijian-2 (LJ-2 Boosted)",
        heightM: 53, stages: 2, hasTower: false, hasBoosters: true, boosterCount: 2,
        thrustSea: 6600000, thrustVac: 7100000, ispSea: 280, ispVac: 308,
        dryMassStage1: 32000, fuelMassStage1: 420000, dryMassStage2: 4500, fuelMassStage2: 70000, thrustStage2: 800000,
        colorTheme: { body: 0xf8fafc, accent: 0x0284c7, ring: 0x0f172a, payload: 0xf8fafc }
    },
    YL1: {
        name: "引力一號 (Gravity-1 全固體)", nameEn: "Gravity-1 (YL-1 All-Solid)",
        heightM: 42, stages: 3, hasTower: false, hasBoosters: true, boosterCount: 4,
        thrustSea: 6000000, thrustVac: 6400000, ispSea: 245, ispVac: 275,
        dryMassStage1: 45000, fuelMassStage1: 360000, dryMassStage2: 8000, fuelMassStage2: 40000, thrustStage2: 1200000,
        colorTheme: { body: 0xf8fafc, accent: 0x1e3a8a, ring: 0xf59e0b, payload: 0xf8fafc }
    },
    SQX3: {
        name: "雙曲線三號 (Hyperbola-3)", nameEn: "Hyperbola-3 (SQX-3 Reusable)",
        heightM: 69, stages: 2, hasTower: false, hasBoosters: false,
        thrustSea: 7600000, thrustVac: 8300000, ispSea: 325, ispVac: 360,
        dryMassStage1: 34000, fuelMassStage1: 490000, dryMassStage2: 5000, fuelMassStage2: 85000, thrustStage2: 1000000,
        colorTheme: { body: 0x0f172a, accent: 0xdc2626, ring: 0xf8fafc, payload: 0xf8fafc }
    },
    STARSHIP: {
        name: "星艦全系統 (Starship 120m)", nameEn: "Starship Full Stack (120m)",
        heightM: 120, stages: 2, hasTower: false, hasBoosters: false,
        thrustSea: 75000000, thrustVac: 82000000, ispSea: 327, ispVac: 363,
        dryMassStage1: 200000, fuelMassStage1: 3400000, dryMassStage2: 100000, fuelMassStage2: 1200000, thrustStage2: 14700000,
        colorTheme: { body: 0xe2e8f0, accent: 0x0f172a, ring: 0x0f172a, payload: 0x0f172a }
    },
    SATURN_V: {
        name: "土星五號 (Saturn V 110m)", nameEn: "Saturn V (Apollo 110m)",
        heightM: 110, stages: 3, hasTower: true, hasBoosters: false,
        thrustSea: 34500000, thrustVac: 38700000, ispSea: 263, ispVac: 304,
        dryMassStage1: 130000, fuelMassStage1: 2160000, dryMassStage2: 40000, fuelMassStage2: 480000, thrustStage2: 5115000,
        colorTheme: { body: 0xf8fafc, accent: 0x0f172a, ring: 0x0f172a, payload: 0xf8fafc }
    },
    CZ2F: {
        name: "長征二號F (CZ-2F 載人型)", nameEn: "Long March 2F (CZ-2F Shenzhou)",
        heightM: 58, stages: 2, hasTower: true, hasBoosters: true, boosterCount: 4,
        thrustSea: 5920000, thrustVac: 6500000, ispSea: 289, ispVac: 315,
        dryMassStage1: 30000, fuelMassStage1: 450000, dryMassStage2: 5500, fuelMassStage2: 90000, thrustStage2: 742000,
        colorTheme: { body: 0xf8fafc, accent: 0xdc2626, ring: 0x0284c7, payload: 0xfbbf24 }
    }
});
