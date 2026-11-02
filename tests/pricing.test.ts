import { describe, expect, it } from "vitest";
import {
  calculateEstimate,
  priceMeasurements,
  PricingValidationError,
  roundMeasuredCents,
  validatePricing,
} from "../shared/pricing";
import type {
  CleaningArea,
  PricingConfig,
  Property,
  Service,
} from "../shared/types";

const pricing: PricingConfig = {
  version: "test-v1",
  ratesCents: { driveway: 21, sidewalk: 21, patio: 21 },
  minimumCents: 15_000,
  reviewThresholdSqFt: 5_000,
  taxBasisPoints: 0,
  enabledServices: ["driveway", "sidewalk", "patio"],
};
const measurement = (
  squareFeet: number,
  service: Service = "driveway",
  areaCount = 1,
) => ({ service, squareFeet, areaCount });

describe("trusted pricing", () => {
  it.each([
    [400, 15_000],
    [700, 15_000],
    [900, 18_900],
    [1_000, 21_000],
    [1_500, 31_500],
    [2_000, 42_000],
  ])("%i square feet costs %i cents", (squareFeet, totalCents) => {
    expect(
      priceMeasurements([measurement(squareFeet)], pricing).totalCents,
    ).toBe(totalCents);
  });

  it("applies one visit minimum to multiple services", () => {
    const small = priceMeasurements(
      [
        measurement(200),
        measurement(100, "sidewalk"),
        measurement(100, "patio"),
      ],
      pricing,
    );
    expect(small.subtotalCents).toBe(8_400);
    expect(small.minimumAdjustmentCents).toBe(6_600);
    expect(small.totalCents).toBe(15_000);
    const large = priceMeasurements(
      [measurement(1_000), measurement(200, "sidewalk")],
      pricing,
    );
    expect(large.totalCents).toBe(25_200);
    expect(large.minimumAdjustmentCents).toBe(0);
  });

  it("groups same-service areas before rounding cents", () => {
    const result = priceMeasurements([measurement(1.01), measurement(1.01)], {
      ...pricing,
      minimumCents: 0,
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].areaCount).toBe(2);
    expect(result.lines[0].squareFeet).toBe(2.02);
    expect(result.totalCents).toBe(42);
  });

  it.each([NaN, Infinity, -Infinity, -1, 0, 100_001])(
    "rejects invalid measurement %s",
    (value) => {
      expect(() => priceMeasurements([measurement(value)], pricing)).toThrow(
        PricingValidationError,
      );
    },
  );

  it("rejects empty measurements and malformed counts", () => {
    expect(() => priceMeasurements([], pricing)).toThrow();
    expect(() =>
      priceMeasurements([measurement(100, "driveway", 0)], pricing),
    ).toThrow();
    expect(() =>
      priceMeasurements([measurement(100, "driveway", 1.5)], pricing),
    ).toThrow();
    expect(() =>
      priceMeasurements(
        [measurement(100, "driveway", 30), measurement(100, "patio")],
        pricing,
      ),
    ).toThrow();
  });

  it("rounds decimal half-cents consistently without floating point drift", () => {
    expect(roundMeasuredCents(1.005, 100)).toBe(101);
    expect(roundMeasuredCents(1.0049, 100)).toBe(100);
    expect(roundMeasuredCents(10.5, 21)).toBe(221);
    expect(roundMeasuredCents(0.5, 1)).toBe(1);
    expect(roundMeasuredCents(1e-7, 21)).toBe(0);
    expect(roundMeasuredCents(0, 21)).toBe(0);
  });

  it("does not separately calculate tax by default; configured tax applies after minimum", () => {
    expect(priceMeasurements([measurement(400)], pricing).taxCents).toBe(0);
    const taxed = priceMeasurements([measurement(400)], {
      ...pricing,
      taxBasisPoints: 725,
    });
    expect(taxed.taxCents).toBe(1_088);
    expect(taxed.totalCents).toBe(16_088);
  });

  it("marks special conditions and jobs over the threshold for review without surcharges", () => {
    const clean = priceMeasurements([measurement(900)], pricing);
    const stained = priceMeasurements([measurement(900)], pricing, [
      "Oil stains",
      "Rust stains",
    ]);
    expect(stained.totalCents).toBe(clean.totalCents);
    expect(stained.needsReview).toBe(true);
    expect(stained.reviewReasons).toHaveLength(2);
    expect(priceMeasurements([measurement(5_000)], pricing).needsReview).toBe(
      false,
    );
    expect(
      priceMeasurements([measurement(5_000.01)], pricing).needsReview,
    ).toBe(true);
  });

  it("uses configured rates and rejects disabled services", () => {
    const configured = {
      ...pricing,
      ratesCents: { driveway: 30, sidewalk: 25, patio: 21 },
    };
    expect(priceMeasurements([measurement(1_000)], configured).totalCents).toBe(
      30_000,
    );
    expect(() =>
      priceMeasurements([measurement(1_000, "sidewalk")], {
        ...pricing,
        enabledServices: ["driveway"],
      }),
    ).toThrow(/unavailable/);
    expect(() =>
      priceMeasurements([measurement(1_000)], pricing, ["invented fee"]),
    ).toThrow();
  });

  it("rejects invalid pricing configuration", () => {
    expect(() =>
      validatePricing({
        ...pricing,
        ratesCents: { ...pricing.ratesCents, driveway: 0.21 },
      }),
    ).toThrow();
    expect(() => validatePricing({ ...pricing, minimumCents: -1 })).toThrow();
    expect(() =>
      validatePricing({ ...pricing, taxBasisPoints: NaN }),
    ).toThrow();
    expect(() =>
      validatePricing({ ...pricing, reviewThresholdSqFt: 0 }),
    ).toThrow();
  });

  it("recalculates price and size from geometry, ignoring fields supplied by a hostile client", () => {
    const property: Property = {
      address: "Test property",
      lat: 27.95,
      lng: -82.46,
    };
    const area: CleaningArea & {
      squareFeet: number;
      totalCents: number;
      rateCents: number;
    } = {
      id: "driveway-one",
      service: "driveway",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-82.46, 27.95],
            [-82.4598, 27.95],
            [-82.4598, 27.9502],
            [-82.46, 27.9502],
            [-82.46, 27.95],
          ],
        ],
      },
      squareFeet: 1,
      totalCents: 1,
      rateCents: 0,
    };
    const result = calculateEstimate([area], property, pricing);
    expect(result.totalSquareFeet).toBeGreaterThan(4_000);
    expect(result.totalCents).toBeGreaterThan(80_000);
    expect(result.lines[0].rateCents).toBe(21);
  });
});
