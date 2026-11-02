// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { GeoJSONStoreFeatures } from "terra-draw";
import type { CleaningArea } from "../shared/types";

const harness = vi.hoisted(() => ({
  draws: [] as any[],
  options: [] as any[],
  mapInstances: [] as any[],
}));
vi.mock("../src/components/maps-loader", () => ({
  loadGoogleMaps: vi.fn(async () => {}),
  MAPS_AUTH_ERROR: "maps-auth-error-test",
}));
vi.mock("terra-draw-google-maps-adapter", () => ({
  TerraDrawGoogleMapsAdapter: class {},
}));
vi.mock("terra-draw", () => {
  class Draw {
    enabled = false;
    snapshot: GeoJSONStoreFeatures[] = [];
    listeners: Record<string, Function[]> = {};
    currentMode = "select";
    undo = vi.fn(() => true);
    redo = vi.fn(() => true);
    constructor(options: unknown) {
      harness.draws.push(this);
      harness.options.push(options);
    }
    on(name: string, callback: Function) {
      (this.listeners[name] ??= []).push(callback);
    }
    emit(name: string, ...args: unknown[]) {
      this.listeners[name]?.forEach((callback) => callback(...args));
    }
    start() {
      this.enabled = true;
      this.emit("ready");
    }
    stop() {
      this.enabled = false;
    }
    getSnapshot() {
      return this.snapshot;
    }
    getSnapshotFeature(id: string) {
      return this.snapshot.find((feature) => feature.id === id);
    }
    clear() {
      this.snapshot = [];
      this.emit("change");
    }
    addFeatures(features: GeoJSONStoreFeatures[]) {
      this.snapshot.push(...features);
      return [];
    }
    setMode(mode: string) {
      this.currentMode = mode;
    }
    canUndo() {
      return true;
    }
    canRedo() {
      return false;
    }
    clearUndoRedoHistory() {}
    selectFeature(id: string) {
      this.emit("select", id);
    }
    removeFeatures(ids: string[]) {
      this.snapshot = this.snapshot.filter(
        (feature) => !ids.includes(String(feature.id)),
      );
      this.emit("change");
    }
    updateFeatureProperties(id: string, properties: object) {
      const f = this.getSnapshotFeature(id);
      if (f) Object.assign(f.properties, properties);
      this.emit("change");
    }
  }
  return {
    TerraDraw: Draw,
    TerraDrawPolygonMode: class {},
    TerraDrawSelectMode: class {},
    TerraDrawModeUndoRedo: class {},
    TerraDrawSessionUndoRedo: class {},
    ValidateNotSelfIntersecting: vi.fn(),
  };
});
import { PropertyMap } from "../src/components/PropertyMap";
import { areasToFeatures } from "../src/components/map-data";

class MockAutocomplete extends HTMLElement {
  placeholder = "";
  constructor(_options?: unknown) {
    super();
  }
}
if (!customElements.get("mock-google-autocomplete"))
  customElements.define("mock-google-autocomplete", MockAutocomplete);
const property = {
  address: "A Tampa property",
  lat: 27.95,
  lng: -82.45,
  placeId: "test-place",
};
const area: CleaningArea = {
  id: "a1",
  service: "driveway",
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
beforeEach(() => {
  harness.draws.length = 0;
  harness.options.length = 0;
  harness.mapInstances.length = 0;
  vi.stubGlobal("google", {
    maps: {
      Map: class {
        setCenter = vi.fn();
        setZoom = vi.fn();
        constructor(_element: unknown, options: unknown) {
          harness.mapInstances.push({ instance: this, options });
        }
      },
      places: { PlaceAutocompleteElement: MockAutocomplete },
      geometry: { spherical: { computeArea: () => 50 } },
      Polygon: class {
        setMap = vi.fn();
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("property map interactions with mocked Google and Terra Draw", () => {
  it("provides a useful custom-quote fallback without a Maps key", () => {
    render(<PropertyMap apiKey="" property={null} areas={[]} />);
    expect(
      screen
        .getByRole("link", { name: /Request a custom quote/ })
        .getAttribute("href"),
    ).toContain("/contact");
    expect(harness.draws).toHaveLength(0);
  });
  it("starts satellite imagery and loads existing saved outlines", async () => {
    render(
      <PropertyMap apiKey="test-key" property={property} areas={[area]} />,
    );
    await waitFor(() => expect(harness.draws[0]?.snapshot).toHaveLength(1));
    expect(harness.mapInstances[0].options.mapTypeId).toBe("satellite");
    expect(harness.mapInstances[0].options.zoom).toBe(20);
    expect(harness.draws[0].snapshot[0].properties.service).toBe("driveway");
  });
  it("publishes a newly drawn polygon with the active service and preserves existing areas", async () => {
    const changed = vi.fn();
    render(
      <PropertyMap
        apiKey="test-key"
        property={property}
        areas={[area]}
        activeService="sidewalk"
        onAreasChange={changed}
      />,
    );
    await waitFor(() => expect(harness.draws[0]?.enabled).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Add sidewalk" }));
    const draw = harness.draws[0];
    expect(draw.currentMode).toBe("polygon");
    const newFeature = areasToFeatures([
      { ...area, id: "a2", service: "sidewalk" },
    ])[0];
    delete newFeature.properties.service;
    draw.snapshot.push(newFeature);
    draw.emit("finish", "a2", { action: "draw" });
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(
      changed.mock.lastCall?.[0].map((item: CleaningArea) => item.service),
    ).toEqual(["driveway", "sidewalk"]);
    expect(draw.currentMode).toBe("select");
  });
  it("publishes edits and deletions instead of discarding earlier geometry", async () => {
    const changed = vi.fn();
    render(
      <PropertyMap
        apiKey="test-key"
        property={property}
        areas={[area]}
        onAreasChange={changed}
      />,
    );
    await waitFor(() => expect(harness.draws[0]?.enabled).toBe(true));
    const draw = harness.draws[0];
    draw.snapshot[0].geometry.coordinates[0][1][0] = -82.4498;
    draw.emit("change");
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(changed.mock.lastCall?.[0][0].geometry.coordinates[0][1][0]).toBe(
      -82.4498,
    );
    draw.removeFeatures(["a1"]);
    await waitFor(() => expect(changed.mock.lastCall?.[0]).toEqual([]));
  });
  it("selects a Places result and updates the property without limiting ZIP codes", async () => {
    const changed = vi.fn();
    const { container } = render(
      <PropertyMap
        apiKey="test-key"
        property={null}
        areas={[]}
        onPropertyChange={changed}
      />,
    );
    await waitFor(() =>
      expect(
        container.querySelector("mock-google-autocomplete"),
      ).not.toBeNull(),
    );
    const event = new Event("gmp-select");
    Object.assign(event, {
      placePrediction: {
        toPlace: () => ({
          formattedAddress: "123 Example Street, Brandon, FL",
          id: "place-2",
          location: { lat: () => 27.93, lng: () => -82.29 },
          fetchFields: async () => {},
        }),
      },
    });
    container.querySelector("mock-google-autocomplete")?.dispatchEvent(event);
    await waitFor(() =>
      expect(changed).toHaveBeenCalledWith({
        address: "123 Example Street, Brandon, FL",
        lat: 27.93,
        lng: -82.29,
        placeId: "place-2",
      }),
    );
  });
  it("shows a contact route when Google rejects authentication", async () => {
    render(<PropertyMap apiKey="test-key" property={property} areas={[]} />);
    await waitFor(() => expect(harness.draws[0]?.enabled).toBe(true));
    window.dispatchEvent(new Event("maps-auth-error-test"));
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Request a custom quote/ }),
      ).toBeTruthy(),
    );
    expect(screen.getByText(/temporarily unavailable/)).toBeTruthy();
  });
});
