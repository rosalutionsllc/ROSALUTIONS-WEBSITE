import type { GeoJSONStoreFeatures } from "terra-draw";
import {
  SERVICES,
  type CleaningArea,
  type Service,
  type PolygonGeometry,
} from "../../shared/types";

export const SQUARE_FEET_PER_SQUARE_METER = 10.763910416709722;

export function areasToFeatures(areas: CleaningArea[]): GeoJSONStoreFeatures[] {
  return areas.map((area) => ({
    type: "Feature",
    id: area.id,
    geometry: structuredClone(area.geometry),
    properties: { mode: "polygon", service: area.service },
  }));
}

/** Excludes Terra Draw's vertices, selection handles, and unfinished outlines. */
export function featuresToAreas(
  features: GeoJSONStoreFeatures[],
  defaultService: Service,
): CleaningArea[] {
  return features
    .filter(
      (feature) =>
        feature.geometry.type === "Polygon" &&
        feature.properties.mode === "polygon" &&
        !feature.properties.currentlyDrawing &&
        feature.id !== undefined,
    )
    .map((feature) => ({
      id: String(feature.id),
      service: SERVICES.includes(feature.properties.service as Service)
        ? (feature.properties.service as Service)
        : defaultService,
      geometry: structuredClone(feature.geometry) as PolygonGeometry,
    }));
}

export function googleSquareFeet(area: CleaningArea): number {
  if (typeof google === "undefined" || !google.maps.geometry?.spherical)
    return 0;
  const ring = area.geometry.coordinates[0];
  const squareMeters = google.maps.geometry.spherical.computeArea(
    ring.map(([lng, lat]) => ({ lat, lng })),
  );
  return squareMeters * SQUARE_FEET_PER_SQUARE_METER;
}
