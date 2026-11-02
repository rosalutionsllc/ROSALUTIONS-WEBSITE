import { GEOMETRY_LIMITS, validateAndMeasureAreas } from "./geometry";
import type { Measurement } from "./geometry";
import { SERVICES, SPECIAL_CONDITIONS } from "./types";
import type {
  CleaningArea,
  Estimate,
  PricingConfig,
  Property,
  Service,
} from "./types";

export class PricingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingValidationError";
  }
}

const fail = (message: string): never => {
  throw new PricingValidationError(message);
};

export function validatePricing(pricing: PricingConfig): void {
  if (
    !pricing ||
    typeof pricing.version !== "string" ||
    !pricing.version.trim() ||
    pricing.version.length > 100
  ) {
    fail("Pricing needs a valid version.");
  }
  if (
    !pricing.ratesCents ||
    SERVICES.some(
      (service) =>
        !Number.isSafeInteger(pricing.ratesCents[service]) ||
        pricing.ratesCents[service] <= 0 ||
        pricing.ratesCents[service] > 10_000,
    )
  ) {
    fail("Service rates must be positive integer cents per square foot.");
  }
  if (
    !Number.isSafeInteger(pricing.minimumCents) ||
    pricing.minimumCents < 0 ||
    pricing.minimumCents > 10_000_000
  ) {
    fail("The minimum charge must be a valid nonnegative amount in cents.");
  }
  if (
    !Number.isFinite(pricing.reviewThresholdSqFt) ||
    pricing.reviewThresholdSqFt <= 0 ||
    pricing.reviewThresholdSqFt > GEOMETRY_LIMITS.maxTotalSquareFeet
  ) {
    fail("The review threshold must be a valid square-footage limit.");
  }
  if (
    !Number.isSafeInteger(pricing.taxBasisPoints) ||
    pricing.taxBasisPoints < 0 ||
    pricing.taxBasisPoints > 10_000
  ) {
    fail("The tax rate must be between zero and 10,000 basis points.");
  }
  if (
    !Array.isArray(pricing.enabledServices) ||
    new Set(pricing.enabledServices).size !== pricing.enabledServices.length ||
    pricing.enabledServices.some((service) => !SERVICES.includes(service))
  ) {
    fail(
      "Enabled services must be supported service names without duplicates.",
    );
  }
}

/**
 * Round half up to integer cents exactly once per service subtotal. Measurement
 * precision is retained; only amounts are rounded. The visit minimum is applied
 * once after summing service lines, followed by tax rounded once in cents.
 * Decimal conversion and BigInt avoid binary floating-point rounding at .5 cent.
 */
export function roundMeasuredCents(
  squareFeet: number,
  rateCents: number,
): number {
  if (
    !Number.isFinite(squareFeet) ||
    squareFeet < 0 ||
    !Number.isSafeInteger(rateCents) ||
    rateCents < 0
  ) {
    fail("Cannot calculate a price from an invalid measurement or rate.");
  }
  const [mantissa, exponentText = "0"] = squareFeet
    .toString()
    .toLowerCase()
    .split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const exponent = Number(exponentText) - fraction.length;
  let numerator = BigInt(whole + fraction) * BigInt(rateCents);
  let denominator = 1n;
  if (exponent >= 0) numerator *= 10n ** BigInt(exponent);
  else denominator = 10n ** BigInt(-exponent);
  const rounded = (numerator * 2n + denominator) / (2n * denominator);
  const value = Number(rounded);
  if (!Number.isSafeInteger(value))
    fail("The calculated amount exceeds the supported limit.");
  return value;
}

export function priceMeasurements(
  measurements: Measurement[],
  pricing: PricingConfig,
  conditions: string[] = [],
): Estimate {
  validatePricing(pricing);
  if (
    !Array.isArray(measurements) ||
    measurements.length === 0 ||
    measurements.length > GEOMETRY_LIMITS.maxAreas
  ) {
    fail("Add at least one measured cleaning area.");
  }
  if (
    !Array.isArray(conditions) ||
    conditions.length > SPECIAL_CONDITIONS.length ||
    conditions.some((condition) => !SPECIAL_CONDITIONS.includes(condition)) ||
    new Set(conditions).size !== conditions.length
  ) {
    fail("Select valid special cleaning conditions.");
  }
  const grouped = new Map<Service, Measurement>();
  for (const measurement of measurements) {
    if (
      !measurement ||
      !SERVICES.includes(measurement.service) ||
      !pricing.enabledServices.includes(measurement.service)
    ) {
      fail(
        "One selected service is unavailable for instant pricing. Please request a custom quote.",
      );
    }
    if (
      !Number.isFinite(measurement.squareFeet) ||
      measurement.squareFeet <= 0 ||
      measurement.squareFeet > GEOMETRY_LIMITS.maxTotalSquareFeet ||
      !Number.isSafeInteger(measurement.areaCount) ||
      measurement.areaCount < 1 ||
      measurement.areaCount > GEOMETRY_LIMITS.maxAreas
    ) {
      fail("A cleaning-area measurement is invalid.");
    }
    const existing = grouped.get(measurement.service);
    grouped.set(measurement.service, {
      service: measurement.service,
      squareFeet: (existing?.squareFeet ?? 0) + measurement.squareFeet,
      areaCount: (existing?.areaCount ?? 0) + measurement.areaCount,
    });
  }
  const lines = SERVICES.filter((service) => grouped.has(service)).map(
    (service) => {
      const measurement = grouped.get(service)!;
      return {
        ...measurement,
        rateCents: pricing.ratesCents[service],
        amountCents: roundMeasuredCents(
          measurement.squareFeet,
          pricing.ratesCents[service],
        ),
      };
    },
  );
  const totalSquareFeet = lines.reduce((sum, line) => sum + line.squareFeet, 0);
  if (
    totalSquareFeet > GEOMETRY_LIMITS.maxTotalSquareFeet ||
    lines.reduce((sum, line) => sum + line.areaCount, 0) >
      GEOMETRY_LIMITS.maxAreas
  ) {
    fail("The total cleaning area exceeds the instant-quote limit.");
  }
  const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const minimumAdjustmentCents = Math.max(
    0,
    pricing.minimumCents - subtotalCents,
  );
  const beforeTax = subtotalCents + minimumAdjustmentCents;
  const taxCents = Number(
    (BigInt(beforeTax) * BigInt(pricing.taxBasisPoints) * 2n + 10_000n) /
      20_000n,
  );
  const reviewReasons = conditions.map(
    (condition) =>
      `${condition}: special treatment may require a revised quote.`,
  );
  if (totalSquareFeet > pricing.reviewThresholdSqFt) {
    reviewReasons.push(
      `Jobs larger than ${pricing.reviewThresholdSqFt.toLocaleString("en-US")} sq ft require manual review.`,
    );
  }
  return {
    lines,
    totalSquareFeet,
    subtotalCents,
    minimumAdjustmentCents,
    taxCents,
    totalCents: beforeTax + taxCents,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    warnings: [],
    pricingVersion: pricing.version,
  };
}

export function calculateEstimate(
  areas: CleaningArea[],
  property: Property,
  pricing: PricingConfig,
  conditions: string[] = [],
): Estimate {
  const measured = validateAndMeasureAreas(areas, property);
  return {
    ...priceMeasurements(measured.measurements, pricing, conditions),
    warnings: measured.warnings,
  };
}
