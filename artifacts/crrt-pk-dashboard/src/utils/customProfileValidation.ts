export type CustomProfileValidationInput = {
  name: string;
  targetLow: number;
  targetHigh: number;
};

/**
 * Validates the user-controlled fields that define a custom target window.
 * Target concentrations are non-negative and the upper bound must be greater
 * than the lower bound; getTargetStatus treats both boundaries as in range.
 */
export function getCustomProfileValidationMessages({
  name,
  targetLow,
  targetHigh,
}: CustomProfileValidationInput): string[] {
  const messages: string[] = [];

  if (!name.trim()) {
    messages.push("Custom drug name is required.");
  }

  if (
    !Number.isFinite(targetLow) ||
    !Number.isFinite(targetHigh) ||
    targetLow < 0 ||
    targetHigh < 0 ||
    targetHigh <= targetLow
  ) {
    messages.push("Custom target high must be greater than target low.");
  }

  return messages;
}
