import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSummary,
  generateConcentrationProfile,
  getTargetStatus,
  type PkInputs,
} from "./pkMath.ts";

const BASE_INPUTS: PkInputs = {
  vdLPerKg: 0.5,
  proteinBindingPercent: 20,
  molecularWeightDa: 500,
  bolusDoseMg: 1000,
  intervalHours: 12,
  weightKg: 70,
  residualClearanceMlMin: 10,
  bloodFlowMlMin: 100,
  replacementFluidMlH: 1200,
  dialysateMlH: 1500,
  ultrafiltrationMlH: 100,
  filterDurationHours: 24,
  modality: "CVVH",
  dilutionMode: "pre",
};

function assertClose(actual: number, expected: number, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("CVVH uses replacement plus ultrafiltration and pre-filter dilution", () => {
  const summary = calculateSummary(BASE_INPUTS);

  assertClose(summary.prescribedEffluentLh, 1.3);
  assertClose(summary.effluentLh, 1.3);
  assertClose(summary.dilutionFactor, 100 / 120);
  assertClose(summary.crrtClearanceLh, 1.3 * 0.8 * (100 / 120));
  assertClose(summary.totalClearanceWithCrrtLh, 0.6 + 1.3 * 0.8 * (100 / 120));
});

test("CVVH post-filter replacement does not dilute membrane passage", () => {
  const summary = calculateSummary({
    ...BASE_INPUTS,
    dilutionMode: "post",
  });

  assert.equal(summary.dilutionFactor, 1);
  assertClose(summary.crrtClearanceLh, 1.3 * 0.8);
});

test("CVVHD uses dialysate plus ultrafiltration without replacement dilution", () => {
  const summary = calculateSummary({
    ...BASE_INPUTS,
    modality: "CVVHD",
    dilutionMode: "pre",
  });

  assertClose(summary.prescribedEffluentLh, 1.6);
  assertClose(summary.crrtClearanceLh, 1.6 * 0.8);
  assert.equal(summary.dilutionFactor, 1);
});

test("target status honors both boundaries and distinguishes outside values", () => {
  assert.equal(getTargetStatus(15, 15, 20), "within target");
  assert.equal(getTargetStatus(20, 15, 20), "within target");
  assert.equal(getTargetStatus(14.99, 15, 20), "below target");
  assert.equal(getTargetStatus(20.01, 15, 20), "above target");
});

test("custom target windows classify the same concentration independently of the PK model", () => {
  const profile = generateConcentrationProfile(
    BASE_INPUTS,
    calculateSummary(BASE_INPUTS),
    24,
  );
  const concentrationAt24 = profile[24]?.withCrrt;

  assert.ok(concentrationAt24 !== undefined);
  assert.equal(
    getTargetStatus(
      concentrationAt24,
      concentrationAt24 - 0.01,
      concentrationAt24 + 0.01,
    ),
    "within target",
  );
  assert.equal(
    getTargetStatus(concentrationAt24, 0, concentrationAt24 - 0.01),
    "above target",
  );
});

test("zero residual clearance produces infinite no-CRRT half-life without hiding CRRT clearance", () => {
  const summary = calculateSummary({
    ...BASE_INPUTS,
    residualClearanceMlMin: 0,
  });

  assert.equal(summary.endogenousClearanceLh, 0);
  assert.equal(summary.halfLifeWithoutCrrtHours, Number.POSITIVE_INFINITY);
  assertClose(summary.totalClearanceWithCrrtLh, summary.crrtClearanceLh);
});

test("high molecular weight is surfaced as an assumed membrane-passage flag", () => {
  const summary = calculateSummary({
    ...BASE_INPUTS,
    molecularWeightDa: 1500,
  });

  assert.equal(summary.assumedMembranePassage, true);
  assert.equal(summary.sievingCoefficient, 0.8);
});
