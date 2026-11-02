import { describe, expect, it } from "vitest";
import { polygon } from "@turf/helpers";
import {
  distanceMeters,
  EARTH_RADIUS_METERS,
  geodesicSquareFeet,
  GeometryValidationError,
  SQUARE_METERS_TO_SQUARE_FEET,
  validateAndMeasureAreas,
} from "../shared/geometry";
import type {
  CleaningArea,
  Position,
  Property,
  Service,
} from "../shared/types";

const property: Property = {
  address: "Test property",
  lng: -82.46,
  lat: 27.95,
};
function rectangle(
  id = "one",
  service: Service = "driveway",
  x = 0,
  y = 0,
  width = 0.0001,
  height = 0.0001,
): CleaningArea {
  const a = property.lng + x;
  const b = property.lat + y;
  return {
    id,
    service,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [a, b],
          [a + width, b],
          [a + width, b + height],
          [a, b + height],
          [a, b],
        ],
      ],
    },
  };
}
const measure = (...areas: CleaningArea[]) =>
  validateAndMeasureAreas(areas, property);

describe("geodesic polygon validation and measurement", () => {
  it("converts one square meter to square feet correctly", () => {
    expect(SQUARE_METERS_TO_SQUARE_FEET).toBeCloseTo(1 / 0.3048 ** 2, 12);
  });

  it("agrees with independent spherical rectangle calculation using the Google radius", () => {
    const input = rectangle();
    const value = measure(input).measurements[0].squareFeet;
    const radians = (value: number) => (value * Math.PI) / 180;
    const expected =
      EARTH_RADIUS_METERS ** 2 *
      radians(0.0001) *
      (Math.sin(radians(property.lat + 0.0001)) -
        Math.sin(radians(property.lat))) *
      SQUARE_METERS_TO_SQUARE_FEET;
    expect(Math.abs(value - expected) / expected).toBeLessThan(0.000001);
    expect(value).toBeGreaterThan(1_170);
    expect(value).toBeLessThan(1_190);
  });

  it("measures irregular, angled, and either-winding polygons", () => {
    const input = rectangle();
    input.geometry.coordinates[0].splice(2, 1);
    const triangle = measure(input).measurements[0].squareFeet;
    expect(triangle).toBeCloseTo(
      measure(rectangle()).measurements[0].squareFeet / 2,
      2,
    );
    input.geometry.coordinates[0].reverse();
    expect(measure(input).measurements[0].squareFeet).toBeCloseTo(triangle, 5);
  });

  it("preserves multiple polygons and service assignment through JSON save/load", () => {
    const areas = [
      rectangle(),
      rectangle("two", "sidewalk", 0.0002),
      rectangle("three", "patio", 0, 0.0002),
    ];
    const saved = JSON.parse(JSON.stringify(areas));
    const result = measure(...saved);
    expect(result.areas.map((a) => a.geometry)).toEqual(
      areas.map((a) => a.geometry),
    );
    expect(result.areas.map((a) => a.service)).toEqual([
      "driveway",
      "sidewalk",
      "patio",
    ]);
    expect(result.measurements).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });

  it("updates area when vertices are edited", () => {
    const original = measure(rectangle()).measurements[0].squareFeet;
    const edited = rectangle("one", "driveway", 0, 0, 0.0002);
    expect(measure(edited).measurements[0].squareFeet).toBeCloseTo(
      original * 2,
      3,
    );
  });

  it("unions overlapping same-service outlines and warns, with unique contributions", () => {
    const first = rectangle();
    const second = rectangle("two", "driveway", 0.00005);
    const result = measure(first, second);
    const single = measure(first).measurements[0].squareFeet;
    expect(result.measurements).toHaveLength(1);
    expect(result.measurements[0].areaCount).toBe(2);
    expect(result.measurements[0].squareFeet).toBeCloseTo(single * 1.5, 2);
    expect(result.areas[1].billableSquareFeet).toBeCloseTo(single / 2, 2);
    expect(result.warnings[0]).toMatch(/counted only once/);
  });

  it("charges an identical same-service outline just once", () => {
    const result = measure(rectangle(), rectangle("two"));
    expect(result.areas[1].billableSquareFeet).toBe(0);
    expect(result.measurements[0].squareFeet).toBeCloseTo(
      result.areas[0].squareFeet,
      3,
    );
  });

  it("supports a disconnected union of the same service", () => {
    const result = measure(rectangle(), rectangle("two", "driveway", 0.0002));
    expect(result.measurements[0].squareFeet).toBeCloseTo(
      result.areas[0].squareFeet * 2,
      2,
    );
    expect(result.warnings).toEqual([]);
  });

  it("requires correcting cross-service overlaps", () => {
    expect(() =>
      measure(rectangle(), rectangle("two", "sidewalk", 0.00005)),
    ).toThrow(/Driveway and Sidewalk overlap/);
    expect(() => measure(rectangle(), rectangle("two", "patio"))).toThrow(
      /overlap/,
    );
  });

  it("allows touching service boundaries", () => {
    expect(
      measure(rectangle(), rectangle("two", "sidewalk", 0.0001)).measurements,
    ).toHaveLength(2);
  });

  it("rejects bow-tie self-intersections", () => {
    const input = rectangle();
    const ring = input.geometry.coordinates[0];
    [ring[1], ring[2]] = [ring[2], ring[1]];
    expect(() => measure(input)).toThrow(/crosses itself/);
  });

  it("rejects open, degenerate, and repeated boundaries", () => {
    const open = rectangle();
    open.geometry.coordinates[0].pop();
    expect(() => measure(open)).toThrow(/Complete/);
    const tiny = rectangle("tiny", "driveway", 0, 0, 1e-8, 1e-8);
    expect(() => measure(tiny)).toThrow(/at least 1/);
    const repeated = rectangle();
    repeated.geometry.coordinates[0].splice(
      1,
      0,
      repeated.geometry.coordinates[0][2],
    );
    expect(() => measure(repeated)).toThrow(/repeated/);
  });

  it("rejects holes and invalid numeric coordinates", () => {
    const holes = rectangle();
    holes.geometry.coordinates.push(holes.geometry.coordinates[0]);
    expect(() => measure(holes)).toThrow(/without holes/);
    for (const value of [NaN, Infinity, 181]) {
      const input = rectangle();
      input.geometry.coordinates[0][1][0] = value;
      expect(() => measure(input)).toThrow(/coordinates/);
    }
  });

  it("rejects unrelated distant property outlines", () => {
    expect(() => measure(rectangle("distant", "driveway", 0.01))).toThrow(
      /within 350 meters/,
    );
    expect(() =>
      validateAndMeasureAreas([rectangle()], { ...property, lat: 0, lng: 0 }),
    ).toThrow(/within 350 meters/);
    expect(() =>
      validateAndMeasureAreas([rectangle()], { ...property, lat: NaN }),
    ).toThrow(/coordinates/);
  });

  it("rejects oversized areas and protects against geometry payload abuse", () => {
    expect(() =>
      measure(rectangle("large", "driveway", -0.001, -0.001, 0.002, 0.002)),
    ).toThrow(/too large/);
    expect(() =>
      measure(...Array.from({ length: 31 }, (_, i) => rectangle(`${i}`))),
    ).toThrow(/between 1 and 30/);
    const input = rectangle();
    input.geometry.coordinates[0] = Array.from({ length: 151 }, (_, i) => {
      const angle = (i * Math.PI * 2) / 151;
      return [
        property.lng + Math.cos(angle) * 0.0001,
        property.lat + Math.sin(angle) * 0.0001,
      ] as Position;
    });
    input.geometry.coordinates[0].push(input.geometry.coordinates[0][0]);
    expect(() => measure(input)).toThrow(/no more than 150 corners/);
  });

  it("rejects duplicate IDs and unsupported services", () => {
    expect(() => measure(rectangle(), rectangle())).toThrow(/unique/);
    const input = rectangle();
    input.service = "roof" as Service;
    expect(() => measure(input)).toThrow(/supported/);
    expect(() => measure()).toThrow(GeometryValidationError);
  });

  it("calculates meaningful geodesic distances", () => {
    expect(distanceMeters([0, 0], [0, 0])).toBe(0);
    expect(distanceMeters([0, 0], [0, 0.001])).toBeCloseTo(111.31949, 4);
    expect(
      geodesicSquareFeet(polygon(rectangle().geometry.coordinates)),
    ).toBeGreaterThan(0);
  });
});
