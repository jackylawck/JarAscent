/**
 * js/physics_core.js - 天體動力學與結構力學核心
 * @license MIT
 */

const THREE = window.THREE;
import { ROCKET_MODELS } from './rockets_data.js';

export const MU = 3.986004418e14;
export const MU_MOON = 4.9048695e12;
export const R_EARTH = 6378137;
export const R_MOON = 1737400;
export const MOON_ORBIT_RADIUS = 384400000;
export const ROTATION_SPEED = 7.292115e-5;
export const J2 = 1.08262668e-3;
export const WORLD_SCALE = 1000 / R_EARTH;

export function getMoonPosition(time) {
    const angularSpeed = 2 * Math.PI / (27.322 * 86400);
    const angle = angularSpeed * time;
    return new THREE.Vector3(MOON_ORBIT_RADIUS * Math.cos(angle), 0, MOON_ORBIT_RADIUS * Math.sin(angle));
}

export class RocketState {
    constructor() {
        this.r = new THREE.Vector3(0, R_EARTH, 0);
        this.v = new THREE.Vector3(0, 0, 0);
        this.mass = 0;
        this.fuel1 = 0;
        this.fuel2 = 0;
        this.stage = 1;
        this.payloadMass = 0;
        this.engine = null;
        this.thrustDir = new THREE.Vector3(0, 1, 0);
        this.throttle = 1.0;
        this.gravityTurnAlt = 8000;
        this.flightTime = 0;
        this.isLaunched = false;
        this.isDestroyed = false;
        this.failureReason = null;
        
        this.escapeTowerSeparated = false;
        this.boostersSeparated = false;
        this.fairingSeparated = false;
        this.stage2Separated = false;

        this.guidanceActive = false;
        this.targetPeriapsis = 300000;
        this.targetApoapsis = 300000;
        this.missionAccomplished = false;
        
        this.maxVelocity = 0;
        this.maxQ = 0;
        this.currentGForce = 1.0;
        this.relativeAirSpeed = 0;
    }

    initEngine(engineKey, payloadMass, fuelFactor = 1.0, turnAltKm = 8) {
        const DB = ROCKET_MODELS[engineKey] || ROCKET_MODELS.CZ10A;
        this.engine = DB;
        this.payloadMass = payloadMass;
        this.fuel1 = DB.fuelMassStage1 * fuelFactor;
        this.fuel2 = DB.fuelMassStage2;
        this.thrustDir.set(0, 1, 0);
        this.gravityTurnAlt = turnAltKm * 1000;
    }

    getCurrentMass() {
        return (this.stage === 1) 
            ? this.engine.dryMassStage1 + this.engine.dryMassStage2 + this.payloadMass + this.fuel1 + this.fuel2
            : this.engine.dryMassStage2 + this.payloadMass + this.fuel2;
    }

    getThrustVector() {
        if (this.isDestroyed) return new THREE.Vector3(0,0,0);
        if (this.stage === 1 && this.fuel1 <= 0) return new THREE.Vector3(0,0,0);
        if (this.stage === 2 && this.fuel2 <= 0) return new THREE.Vector3(0,0,0);
        if (this.missionAccomplished) return new THREE.Vector3(0,0,0);

        const alt = this.r.length() - R_EARTH;
        const altRatio = Math.min(1, Math.max(0, alt / 80000));
        let baseThrust = (this.stage === 1) 
            ? this.engine.thrustSea + (this.engine.thrustVac - this.engine.thrustSea) * altRatio
            : this.engine.thrustStage2;

        if (this.guidanceActive && this.stage === 2) {
            const orbit = getOrbitalElements(this);
            const periError = (orbit.periapsis - this.targetPeriapsis) / this.targetPeriapsis;
            const apoError = (orbit.apoapsis - this.targetApoapsis) / this.targetApoapsis;
            if (periError > -0.02 && apoError > -0.02) {
                const taper = Math.max(0.1, 1.0 - (periError + apoError) * 2);
                baseThrust *= taper;
                if (periError > 0.01 && apoError > 0.01) {
                    this.missionAccomplished = true;
                    this.throttle = 0;
                }
            }
        }
        return this.thrustDir.clone().multiplyScalar(baseThrust * this.throttle);
    }

    getIsp() {
        const alt = this.r.length() - R_EARTH;
        const altRatio = Math.min(1, Math.max(0, alt / 80000));
        return this.engine.ispSea + (this.engine.ispVac - this.engine.ispSea) * altRatio;
    }
}

export function getOrbitalElements(state) {
    const r = state.r, v = state.v;
    const rMag = r.length(), vMag = v.length();
    const h = new THREE.Vector3().crossVectors(r, v);
    const hMag = h.length();
    if (hMag < 1e-6) return { semiMajorAxis: 0, eccentricity: 1, periapsis: 0, apoapsis: 0, isOrbital: false };
    
    const vCrossH = new THREE.Vector3().crossVectors(v, h);
    const eVec = vCrossH.multiplyScalar(1/MU).sub(r.clone().divideScalar(rMag));
    const e = eVec.length();
    const eps = (vMag * vMag) / 2 - MU / rMag;
    const a = (Math.abs(eps) > 1e-10) ? -MU / (2 * eps) : Infinity;
    
    return {
        semiMajorAxis: a,
        eccentricity: e,
        periapsis: (e < 1) ? a * (1 - e) - R_EARTH : 0,
        apoapsis: (e < 1) ? a * (1 + e) - R_EARTH : 0,
        isOrbital: (e < 1 && a > 0 && (a * (1 - e)) > R_EARTH)
    };
}

export function computeDerivatives(state) {
    const { r, v } = state;
    const rMag = r.length();
    const mass = state.getCurrentMass();

    const gravity = r.clone().multiplyScalar(-MU / Math.pow(rMag, 3));

    const x = r.x, y = r.y, z = r.z;
    const rMag2 = rMag * rMag;
    const coeff = 1.5 * J2 * MU * Math.pow(R_EARTH, 2) / (rMag2 * rMag2 * rMag);
    const yRatio = (y * y) / rMag2;
    const j2Acc = new THREE.Vector3(
        coeff * x * (5 * yRatio - 1),
        coeff * y * (5 * yRatio - 3),
        coeff * z * (5 * yRatio - 1)
    );

    const moonPos = getMoonPosition(state.flightTime);
    const rToMoon = moonPos.clone().sub(r);
    const moonAcc = rToMoon.clone().multiplyScalar(MU_MOON / Math.pow(rToMoon.length(), 3))
                    .sub(moonPos.clone().multiplyScalar(MU_MOON / Math.pow(moonPos.length(), 3)));

    const thrustVec = state.getThrustVector();
    const thrustAcc = thrustVec.clone().divideScalar(mass);

    state.currentGForce = (thrustAcc.length() / 9.80665) + (state.isLaunched ? 0 : 1.0);

    // WGS-84 大氣共轉相對風場計算
    let dragAcc = new THREE.Vector3(0,0,0);
    const alt = rMag - R_EARTH;
    if (alt < 100000 && state.isLaunched && mass > 0) {
        const omegaVec = new THREE.Vector3(0, ROTATION_SPEED, 0);
        const atmosVel = new THREE.Vector3().crossVectors(omegaVec, r);
        const relV = v.clone().sub(atmosVel);
        const speed = relV.length();
        state.relativeAirSpeed = speed;

        if (speed > 0.1) {
            const rho = 1.225 * Math.exp(-alt / 8500);
            const Cd = (speed > 300 && speed < 600) ? 0.45 : 0.28;
            const dynQ = 0.5 * rho * speed * speed;
            if (dynQ > state.maxQ) state.maxQ = dynQ;
            dragAcc = relV.normalize().multiplyScalar(-dynQ * Cd * 10.5 / mass);
        }
    }

    return { dr: v.clone(), dv: gravity.add(j2Acc).add(moonAcc).add(thrustAcc).add(dragAcc) };
}

export function rk4Step(state, dt) {
    const s1 = computeDerivatives(state);
    const s2 = computeDerivatives(state);
    const s3 = computeDerivatives(state);
    const s4 = computeDerivatives(state);

    state.r.add( s1.dr.clone().multiplyScalar(dt/6).add(s2.dr.clone().multiplyScalar(dt/3)).add(s3.dr.clone().multiplyScalar(dt/3)).add(s4.dr.clone().multiplyScalar(dt/6)) );
    state.v.add( s1.dv.clone().multiplyScalar(dt/6).add(s2.dv.clone().multiplyScalar(dt/3)).add(s3.dv.clone().multiplyScalar(dt/3)).add(s4.dv.clone().multiplyScalar(dt/6)) );

    if (state.v.length() > state.maxVelocity) state.maxVelocity = state.v.length();

    const thrustMag = state.getThrustVector().length();
    const consumed = (thrustMag > 0 ? thrustMag / (state.getIsp() * 9.80665) : 0) * dt;
    if (state.stage === 1) state.fuel1 = Math.max(0, state.fuel1 - consumed);
    else state.fuel2 = Math.max(0, state.fuel2 - consumed);
    
    state.flightTime += dt;
}

export function executeGuidance(state, dt) {
    if (!state.isLaunched || state.missionAccomplished || state.isDestroyed) return;
    const alt = state.r.length() - R_EARTH;
    
    if (alt < state.gravityTurnAlt) {
        state.thrustDir.set(0, 1, 0);
        return;
    }
    if (alt >= state.gravityTurnAlt && alt < state.gravityTurnAlt + 8000) {
        state.thrustDir.applyAxisAngle(new THREE.Vector3(0,0,1), -0.015).normalize();
        return;
    }
    if (state.v.length() > 300) {
        const error = new THREE.Vector3().crossVectors(state.thrustDir, state.v.clone().normalize());
        const errorAngle = error.length();
        if (errorAngle > 0.0001) {
            state.thrustDir.applyAxisAngle(error.normalize(), -Math.min(errorAngle, 0.8 * dt * 2)).normalize();
        }
    }
}
