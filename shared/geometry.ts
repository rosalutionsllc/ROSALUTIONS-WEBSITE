import turfArea from "@turf/area";
import union from "@turf/union";
import intersect from "@turf/intersect";
import kinks from "@turf/kinks";
import { featureCollection, polygon } from "@turf/helpers";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { SERVICES, SERVICE_LABELS } from "./types";
import type { CleaningArea, Position, Property, Service } from "./types";

/** Google Maps spherical geometry uses the WGS84 equatorial radius. */
export const EARTH_RADIUS_METERS = 6_378_137;
export const SQUARE_METERS_TO_SQUARE_FEET = 10.763910416709722;
export const GEOMETRY_LIMITS = Object.freeze({
  maxAreas: 30,
  maxVertices: 150,
  maxDistanceMeters: 350,
  minAreaSquareFeet: 1,
  maxTotalSquareFeet: 100_000,
  overlapToleranceSquareFeet: 0.5,
});

export class GeometryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeometryValidationError";
  }
}

export interface Measurement {
  service: Service;
  squareFeet: number;
  areaCount: number;
}

export interface ValidatedArea extends CleaningArea {
  /** Raw physical area of this particular polygon. */
  squareFeet: number;
  /** Previously covered portions of this service are excluded. */
  billableSquareFeet: number;
}

export interface MeasuredAreas {
  areas: ValidatedArea[];
  measurements: Measurement[];
  warnings: string[];
}

type Surface = Feature<Polygon | MultiPolygon>;
const radians = (value: number) => (value * Math.PI) / 180;

/** Independent spherical geodesic measurement, normalized to Google's radius. */
export function geodesicSquareFeet(surface: Surface): number {
  // Turf uses mean Earth radius 6371008.8 m. Scaling area preserves the same
  // spherical model and matches Maps' default radius for small property outlines.
  return (
    turfArea(surface) *
    (EARTH_RADIUS_METERS / 6_371_008.8) ** 2 *
    SQUARE_METERS_TO_SQUARE_FEET
  );
}

export function distanceMeters(a: Position, b: Position): number {
  const dLat = radians(b[1] - a[1]);
  const dLng = radians(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLng / 2) ** 2;
  return (
    2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
  );
}

function validPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 85
  );
}

function fail(message: string): never {
  throw new GeometryValidationError(message);
}

/**
 * Checks untrusted GeoJSON and remeasures it. Same-service unions are charged
 * once. Cross-service intersections need correction before a quote is saved.
 * Coordinates must be close to the selected property, not merely within Tampa.
 */
export function validateAndMeasureAreas(
  areas: CleaningArea[],
  property: Property,
): MeasuredAreas {
  if (!property || !validPosition([property.lng, property.lat])) {
    fail("Select a property with valid geographic coordinates.");
  }
  if (
    !Array.isArray(areas) ||
    areas.length === 0 ||
    areas.length > GEOMETRY_LIMITS.maxAreas
  ) {
    fail(`Draw between 1 and ${GEOMETRY_LIMITS.maxAreas} cleaning areas.`);
  }

  const ids = new Set<string>();
  const grouped = new Map<Service, Surface>();
  const counts = new Map<Service, number>();
  const validated: ValidatedArea[] = [];
  const warnings: string[] = [];
  let vertexCount = 0;

  for (const candidate of areas) {
    if (
      !candidate ||
      typeof candidate.id !== "string" ||
      !candidate.id.trim() ||
      candidate.id.length > 100 ||
      ids.has(candidate.id)
    ) {
      fail("Each outline needs a unique, valid ID.");
    }
    ids.add(candidate.id);
    if (!SERVICES.includes(candidate.service))
      fail("Choose a supported cleaning service for every outline.");
    if (
      !candidate.geometry ||
      candidate.geometry.type !== "Polygon" ||
      !Array.isArray(candidate.geometry.coordinates) ||
      candidate.geometry.coordinates.length !== 1
    ) {
      fail("Each cleaning area must be one polygon without holes.");
    }
    const ring = candidate.geometry.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4)
      fail("An outline needs at least three corners and a closed boundary.");
    vertexCount += ring.length - 1;
    if (vertexCount > GEOMETRY_LIMITS.maxVertices) {
      fail(
        `Use no more than ${GEOMETRY_LIMITS.maxVertices} corners across all outlines.`,
      );
    }
    if (!ring.every(validPosition))
      fail("An outline contains invalid geographic coordinates.");
    if (ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1]) {
      fail("Complete the outline by connecting its last corner to its first.");
    }
    const unique = new Set(
      ring.slice(0, -1).map((point) => `${point[0]},${point[1]}`),
    );
    if (unique.size !== ring.length - 1)
      fail("Remove repeated corners from the outline.");
    if (
      ring.some(
        (point) =>
          distanceMeters([property.lng, property.lat], point) >
          GEOMETRY_LIMITS.maxDistanceMeters,
      )
    ) {
      fail(
        `Keep every outline within ${GEOMETRY_LIMITS.maxDistanceMeters} meters of the selected property. Contact us for larger sites.`,
      );
    }
    // Avoid a world-spanning planar polygon at the antimeridian. Such sites
    // need a manual quote; this does not restrict service to a ZIP-code list.
    if (
      Math.max(...ring.map((p) => p[0])) - Math.min(...ring.map((p) => p[0])) >
      1
    ) {
      fail(
        "This outline crosses a geographic boundary. Please request a custom quote.",
      );
    }

    const geometry = {
      type: "Polygon" as const,
      coordinates: [ring.map((point) => [...point] as Position)],
    };
    const feature = polygon(geometry.coordinates);
    let squareFeet: number;
    let merged: Surface;
    const previous = grouped.get(candidate.service);
    try {
      if (kinks(feature).features.length > 0)
        fail(
          "An outline crosses itself. Move its corners so the boundary does not cross.",
        );
      squareFeet = geodesicSquareFeet(feature);
      if (
        !Number.isFinite(squareFeet) ||
        squareFeet < GEOMETRY_LIMITS.minAreaSquareFeet
      ) {
        fail(
          `Each outline must cover at least ${GEOMETRY_LIMITS.minAreaSquareFeet} square foot.`,
        );
      }
      if (squareFeet > GEOMETRY_LIMITS.maxTotalSquareFeet)
        fail(
          "This area is too large for an instant quote. Please request a custom quote.",
        );
      merged = previous
        ? union(featureCollection([previous, feature]))!
        : feature;
      if (!merged)
        fail("This outline could not be measured. Please redraw it.");
    } catch (error) {
      if (error instanceof GeometryValidationError) throw error;
      fail(
        "This outline could not be measured. Please redraw it with a simple, non-crossing boundary.",
      );
    }

    const previousArea = previous ? geodesicSquareFeet(previous) : 0;
    const unionArea = geodesicSquareFeet(merged);
    const billableSquareFeet = Math.max(0, unionArea - previousArea);
    if (
      squareFeet - billableSquareFeet >
      GEOMETRY_LIMITS.overlapToleranceSquareFeet
    ) {
      const warning = `${SERVICE_LABELS[candidate.service]} outlines overlap. The shared area is counted only once.`;
      if (!warnings.includes(warning)) warnings.push(warning);
    }
    grouped.set(candidate.service, merged);
    counts.set(candidate.service, (counts.get(candidate.service) ?? 0) + 1);
    validated.push({
      id: candidate.id,
      service: candidate.service,
      geometry,
      squareFeet,
      billableSquareFeet,
    });
  }

  const entries = [...grouped.entries()];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      let overlap: Surface | null;
      try {
        overlap = intersect(featureCollection([entries[i][1], entries[j][1]]));
      } catch {
        fail(
          "These outlines could not be compared. Please redraw the overlapping boundaries.",
        );
      }
      if (
        overlap &&
        geodesicSquareFeet(overlap) > GEOMETRY_LIMITS.overlapToleranceSquareFeet
      ) {
        fail(
          `${SERVICE_LABELS[entries[i][0]]} and ${SERVICE_LABELS[entries[j][0]]} overlap. Adjust their boundaries so you are not charged twice.`,
        );
      }
    }
  }

  const measurements = SERVICES.filter((service) => grouped.has(service)).map(
    (service) => ({
      service,
      squareFeet: geodesicSquareFeet(grouped.get(service)!),
      areaCount: counts.get(service)!,
    }),
  );
  if (
    measurements.reduce((sum, line) => sum + line.squareFeet, 0) >
    GEOMETRY_LIMITS.maxTotalSquareFeet
  ) {
    fail(
      "The total outlined area is too large for an instant quote. Please request a custom quote.",
    );
  }
  return { areas: validated, measurements, warnings };
}
