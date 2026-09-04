import assert from "node:assert/strict";
import test from "node:test";

import { getCustomProfileValidationMessages } from "./customProfileValidation.ts";

test("invalid custom target ranges are rejected", () => {
  assert.deepEqual(
    getCustomProfileValidationMessages({
      name: "Meropenem custom",
      targetLow: 10,
      targetHigh: 10,
    }),
    ["Custom target high must be greater than target low."],
  );
  assert.deepEqual(
    getCustomProfileValidationMessages({
      name: "Meropenem custom",
      targetLow: -1,
      targetHigh: 10,
    }),
    ["Custom target high must be greater than target low."],
  );
});

test("empty or whitespace-only custom names are rejected", () => {
  assert.deepEqual(
    getCustomProfileValidationMessages({
      name: "   ",
      targetLow: 2,
      targetHigh: 8,
    }),
    ["Custom drug name is required."],
  );
});

test("valid custom names and target windows pass validation", () => {
  assert.deepEqual(
    getCustomProfileValidationMessages({
      name: "  ICU custom  ",
      targetLow: 2,
      targetHigh: 8,
    }),
    [],
  );
});
