import { describe, expect, it, vi, afterEach } from "vitest";
import {
  areasToFeatures,
  featuresToAreas,
  googleSquareFeet,
  SQUARE_FEET_PER_SQUARE_METER,
} from "../src/components/map-data";
import type { CleaningArea } from "../shared/types";
import type { GeoJSONStoreFeatures } from "terra-draw";
const area: CleaningArea = {
  id: "area-1",
  service: "patio",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-82.45, 27.95],
        [-82.4499, 27.95],
        [-82.4499, 27.9501],
        [-82.45, 27.95],
      ],
    ],
  },
};
afterEach(() => vi.unstubAllGlobals());
describe("Google/Terra Draw geometry bridge", () => {
  it("round-trips stored service assignments and geographic vertices without changing the source", () => {
    const features = areasToFeatures([area]);
    expect(featuresToAreas(features, "driveway")).toEqual([area]);
    (features[0].geometry as typeof area.geometry).coordinates[0][0][0] = 0;
    expect(area.geometry.coordinates[0][0][0]).toBe(-82.45);
  });
  it("retains multiple areas and ignores unfinished polygons and helper handles", () => {
    const features = areasToFeatures([
      area,
      { ...area, id: "area-2", service: "sidewalk" },
    ]);
    const unfinished = {
      ...features[0],
      id: "in-progress",
      properties: { mode: "polygon", currentlyDrawing: true },
    };
    const point: GeoJSONStoreFeatures = {
      type: "Feature",
      id: "point",
      properties: { mode: "select" },
      geometry: { type: "Point", coordinates: [-82.45, 27.95] },
    };
    expect(
      featuresToAreas([...features, unfinished, point], "driveway").map(
        (item) => item.service,
      ),
    ).toEqual(["patio", "sidewalk"]);
  });
  it("assigns newly finished polygons to the selected service", () => {
    const feature = areasToFeatures([area])[0];
    delete feature.properties.service;
    expect(featuresToAreas([feature], "sidewalk")[0].service).toBe("sidewalk");
  });
  it("computes immediately using Google spherical area with lng/lat converted correctly", () => {
    const computeArea = vi.fn(() => 100);
    vi.stubGlobal("google", {
      maps: { geometry: { spherical: { computeArea } } },
    });
    expect(googleSquareFeet(area)).toBeCloseTo(1076.3910416709722, 10);
    expect(computeArea).toHaveBeenCalledWith(
      area.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng })),
    );
    expect(SQUARE_FEET_PER_SQUARE_METER).toBeCloseTo(1 / (0.3048 * 0.3048), 12);
  });
});
