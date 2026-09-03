export type CrrtModality = 'CVVH' | 'CVVHD';
export type DilutionMode = 'pre' | 'post';
export type TargetStatus = 'below target' | 'within target' | 'above target';

export interface PkInputs {
  vdLPerKg: number;
  proteinBindingPercent: number;
  molecularWeightDa: number;
  bolusDoseMg: number;
  intervalHours: number;
  weightKg: number;
  residualClearanceMlMin: number;
  effluentMlKgH: number;
  modality: CrrtModality;
  dilutionMode: DilutionMode;
}

export interface PkSummary {
  vdL: number;
  sievingCoefficient: number;
  saturationCoefficient: number;
  endogenousClearanceLh: number;
  crrtClearanceLh: number;
  totalClearanceWithCrrtLh: number;
  halfLifeWithCrrtHours: number;
  halfLifeWithoutCrrtHours: number;
  effluentLh: number;
  dilutionFactor: number;
  assumedMembranePassage: boolean;
}

export interface ConcentrationPoint {
  time: number;
  withCrrt: number;
  withoutCrrt: number;
}

export function getTargetStatus(
  concentration: number,
  targetLow: number,
  targetHigh: number,
): TargetStatus {
  if (concentration < targetLow) return 'below target';
  if (concentration > targetHigh) return 'above target';
  return 'within target';
}

const MINUTES_PER_HOUR = 60;
const ML_PER_LITER = 1000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Estimates the unbound fraction available to cross the CRRT membrane.
 * This is a screening approximation: Sc/Sa ≈ fu = 1 - protein binding.
 */
export function estimateFreeFraction(proteinBindingPercent: number): number {
  return clamp(1 - proteinBindingPercent / 100, 0, 1);
}

/**
 * Computes clearance terms in L/h.
 *
 * CVVH (convection): CLcrrt = Qeff × Sc × dilution factor
 * CVVHD (diffusion): CLcrrt = Qd × Sa
 *
 * With the limited prescription inputs requested by the brief, pre-filter
 * dilution is represented by a transparent 0.75 factor. A bedside model
 * with blood flow and replacement-fluid rates should replace this assumption
 * with Qb / (Qb + Qpre).
 */
export function calculateSummary(inputs: PkInputs): PkSummary {
  const vdL = Math.max(inputs.vdLPerKg * inputs.weightKg, 0.01);
  const freeFraction = estimateFreeFraction(inputs.proteinBindingPercent);
  const effluentLh = Math.max(
    (inputs.effluentMlKgH * inputs.weightKg) / ML_PER_LITER,
    0,
  );
  const endogenousClearanceLh = Math.max(
    (inputs.residualClearanceMlMin * MINUTES_PER_HOUR) / ML_PER_LITER,
    0,
  );
  const dilutionFactor =
    inputs.modality === 'CVVH' && inputs.dilutionMode === 'pre' ? 0.75 : 1;
  const crrtClearanceLh =
    inputs.modality === 'CVVH'
      ? effluentLh * freeFraction * dilutionFactor
      : effluentLh * freeFraction;
  const totalClearanceWithCrrtLh =
    endogenousClearanceLh + crrtClearanceLh;

  return {
    vdL,
    sievingCoefficient: freeFraction,
    saturationCoefficient: freeFraction,
    endogenousClearanceLh,
    crrtClearanceLh,
    totalClearanceWithCrrtLh,
    halfLifeWithCrrtHours:
      totalClearanceWithCrrtLh > 0
        ? (Math.log(2) * vdL) / totalClearanceWithCrrtLh
        : Number.POSITIVE_INFINITY,
    halfLifeWithoutCrrtHours:
      endogenousClearanceLh > 0
        ? (Math.log(2) * vdL) / endogenousClearanceLh
        : Number.POSITIVE_INFINITY,
    effluentLh,
    dilutionFactor,
    assumedMembranePassage: inputs.molecularWeightDa > 1000,
  };
}

function concentrationAtTime(
  timeHours: number,
  doseMg: number,
  intervalHours: number,
  vdL: number,
  clearanceLh: number,
): number {
  const eliminationRate =
    clearanceLh > 0 ? clearanceLh / vdL : 0;
  const doseCount = Math.floor(timeHours / intervalHours);
  let concentration = 0;

  for (let doseIndex = 0; doseIndex <= doseCount; doseIndex += 1) {
    const doseTime = doseIndex * intervalHours;
    const elapsed = Math.max(timeHours - doseTime, 0);
    concentration +=
      (doseMg / vdL) * Math.exp(-eliminationRate * elapsed);
  }

  return concentration;
}

/**
 * Generates an hourly concentration-time profile using repeated IV boluses.
 * The chart is intentionally a comparative model, not a dosing recommendation.
 */
export function generateConcentrationProfile(
  inputs: PkInputs,
  summary: PkSummary = calculateSummary(inputs),
  durationHours = 72,
): ConcentrationPoint[] {
  const points: ConcentrationPoint[] = [];
  const intervalHours = Math.max(inputs.intervalHours, 0.25);

  for (let time = 0; time <= durationHours; time += 1) {
    points.push({
      time,
      withCrrt: concentrationAtTime(
        time,
        inputs.bolusDoseMg,
        intervalHours,
        summary.vdL,
        summary.totalClearanceWithCrrtLh,
      ),
      withoutCrrt: concentrationAtTime(
        time,
        inputs.bolusDoseMg,
        intervalHours,
        summary.vdL,
        summary.endogenousClearanceLh,
      ),
    });
  }

  return points;
}