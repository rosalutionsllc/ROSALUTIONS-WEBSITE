import { useEffect, useRef, useState } from "react";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  TerraDrawModeUndoRedo,
  TerraDrawSessionUndoRedo,
  ValidateNotSelfIntersecting,
  type GeoJSONStoreFeatures,
  type HexColor,
} from "terra-draw";
import { TerraDrawGoogleMapsAdapter } from "terra-draw-google-maps-adapter";
import {
  MapPin,
  MousePointer2,
  Pencil,
  Undo2,
  Redo2,
  Trash2,
  LocateFixed,
  Check,
  TriangleAlert,
} from "lucide-react";
import {
  SERVICES,
  SERVICE_COLORS,
  SERVICE_LABELS,
  type CleaningArea,
  type Property,
  type Service,
} from "../../shared/types";
import { areasToFeatures, featuresToAreas, googleSquareFeet } from "./map-data";
import { loadGoogleMaps, MAPS_AUTH_ERROR } from "./maps-loader";
import "./property-map.css";

export interface PropertyMapProps {
  apiKey: string;
  property: Property | null;
  onPropertyChange?: (property: Property) => void;
  areas: CleaningArea[];
  onAreasChange?: (areas: CleaningArea[]) => void;
  activeService?: Service;
  readOnly?: boolean;
}

export function PropertyMap({
  apiKey,
  property,
  onPropertyChange,
  areas,
  onAreasChange,
  activeService = "driveway",
  readOnly = false,
}: PropertyMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const searchElement = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const draw = useRef<TerraDraw | null>(null);
  const polygons = useRef<google.maps.Polygon[]>([]);
  const current = useRef({
    property,
    areas,
    activeService,
    onPropertyChange,
    onAreasChange,
  });
  current.current = {
    property,
    areas,
    activeService,
    onPropertyChange,
    onAreasChange,
  };
  const updating = useRef(false);
  const lastPublished = useRef(JSON.stringify(areas));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"polygon" | "select">("select");
  const [history, setHistory] = useState({ undo: false, redo: false });
  const [loadingAttempt, setLoadingAttempt] = useState(0);

  useEffect(() => {
    if (!apiKey) return;
    let disposed = false;
    let frame = 0;
    let autocomplete: google.maps.places.PlaceAutocompleteElement | undefined;
    let localDraw: TerraDraw | undefined;
    setReady(false);
    setError("");
    const onAuthError = () =>
      setError(
        "Property maps are temporarily unavailable. Please request a custom quote.",
      );
    window.addEventListener(MAPS_AUTH_ERROR, onAuthError);
    const start = async () => {
      try {
        await loadGoogleMaps(apiKey);
        if (disposed || !mapElement.current) return;
        const center = current.current.property ?? {
          lat: 27.9506,
          lng: -82.4572,
        };
        const instance = new google.maps.Map(mapElement.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom: current.current.property ? 20 : 11,
          mapTypeId: "satellite",
          tilt: 0,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
          mapTypeControlOptions: { mapTypeIds: ["satellite", "roadmap"] },
        });
        map.current = instance;
        if (!readOnly) {
          const color = (feature: GeoJSONStoreFeatures): HexColor =>
            SERVICE_COLORS[
              (feature.properties.service as Service) ??
                current.current.activeService
            ] as HexColor;
          localDraw = new TerraDraw({
            adapter: new TerraDrawGoogleMapsAdapter({
              lib: google.maps,
              map: instance,
              coordinatePrecision: 9,
              isolatedData: true,
            }),
            modes: [
              new TerraDrawPolygonMode({
                pointerDistance: 18,
                showCoordinatePoints: true,
                keyEvents: { finish: "Enter", cancel: "Escape" },
                validation: ValidateNotSelfIntersecting,
                styles: {
                  fillColor: color,
                  fillOpacity: 0.3,
                  outlineColor: color,
                  outlineWidth: 3,
                  closingPointColor: "#ffffff",
                  closingPointWidth: 8,
                  closingPointOutlineColor: "#0b2340",
                  closingPointOutlineWidth: 2,
                  coordinatePointWidth: 5,
                },
              }),
              new TerraDrawSelectMode({
                pointerDistance: 18,
                flags: {
                  polygon: {
                    feature: {
                      draggable: true,
                      selfIntersectable: false,
                      coordinates: {
                        draggable: true,
                        deletable: true,
                        midpoints: true,
                      },
                    },
                  },
                },
                styles: {
                  selectedPolygonColor: color,
                  selectedPolygonOutlineColor: "#ffffff",
                  selectedPolygonOutlineWidth: 3,
                  selectedPolygonFillOpacity: 0.4,
                  selectionPointWidth: 7,
                  selectionPointColor: "#ffffff",
                  selectionPointOutlineColor: "#0b2340",
                  selectionPointOutlineWidth: 2,
                  midPointColor: "#ffffff",
                  midPointWidth: 5,
                },
              }),
            ],
            undoRedo: {
              modeLevel: new TerraDrawModeUndoRedo(),
              sessionLevel: new TerraDrawSessionUndoRedo(),
            },
          });
          draw.current = localDraw;
          const publish = () => {
            if (disposed || updating.current || !localDraw?.enabled) return;
            const next = featuresToAreas(
              localDraw.getSnapshot(),
              current.current.activeService,
            );
            const serialized = JSON.stringify(next);
            if (serialized !== lastPublished.current) {
              lastPublished.current = serialized;
              current.current.onAreasChange?.(next);
            }
            setHistory({
              undo: localDraw.canUndo(),
              redo: localDraw.canRedo(),
            });
          };
          localDraw.on("change", () => {
            if (updating.current) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(publish);
          });
          localDraw.on("finish", (id, context) => {
            if (disposed || !localDraw) return;
            const feature = localDraw.getSnapshotFeature(id);
            if (
              feature?.geometry.type === "Polygon" &&
              !feature.properties.service
            )
              localDraw.updateFeatureProperties(id, {
                service: current.current.activeService,
              });
            publish();
            if (context.action === "draw") {
              localDraw.setMode("select");
              localDraw.selectFeature(id);
              setMode("select");
            }
          });
          localDraw.on("select", (id) => setSelectedId(String(id)));
          localDraw.on("deselect", () => setSelectedId(null));
          localDraw.on("history", () => {
            if (localDraw?.enabled)
              setHistory({
                undo: localDraw.canUndo(),
                redo: localDraw.canRedo(),
              });
          });
          localDraw.on("ready", () => {
            if (disposed || !localDraw) return;
            updating.current = true;
            localDraw.addFeatures(areasToFeatures(current.current.areas));
            lastPublished.current = JSON.stringify(current.current.areas);
            updating.current = false;
            localDraw.setMode("select");
            localDraw.clearUndoRedoHistory();
            setReady(true);
          });
          localDraw.start();
          if (searchElement.current) {
            autocomplete = new google.maps.places.PlaceAutocompleteElement({
              locationBias: {
                center: { lat: 27.9506, lng: -82.4572 },
                radius: 50000,
              },
              requestedRegion: "us",
            });
            autocomplete.placeholder = "Enter your property address";
            autocomplete.setAttribute("aria-label", "Property address");
            autocomplete.addEventListener("gmp-error", () =>
              setSearchError(
                "Address search is unavailable. Try again or request a custom quote.",
              ),
            );
            autocomplete.addEventListener("gmp-select", async (event) => {
              setSearchError("");
              try {
                const place = event.placePrediction.toPlace();
                await place.fetchFields({
                  fields: ["formattedAddress", "location", "id"],
                });
                if (disposed) return;
                if (!place.location || !place.formattedAddress)
                  throw new Error(
                    "Select a full property address from the suggestions.",
                  );
                const next = {
                  address: place.formattedAddress,
                  lat: place.location.lat(),
                  lng: place.location.lng(),
                  placeId: place.id,
                };
                const previous = current.current.property;
                const changed =
                  previous &&
                  (previous.placeId !== next.placeId ||
                    previous.lat !== next.lat ||
                    previous.lng !== next.lng);
                if (
                  changed &&
                  current.current.areas.length &&
                  !window.confirm(
                    "Changing the property will clear the current outlines. Continue?",
                  )
                )
                  return;
                if (changed) {
                  updating.current = true;
                  localDraw?.clear();
                  localDraw?.clearUndoRedoHistory();
                  updating.current = false;
                  lastPublished.current = "[]";
                  current.current.onAreasChange?.([]);
                  setSelectedId(null);
                }
                current.current.onPropertyChange?.(next);
                instance.setCenter({ lat: next.lat, lng: next.lng });
                instance.setZoom(20);
              } catch (cause) {
                setSearchError(
                  cause instanceof Error
                    ? cause.message
                    : "Address search failed. Please try again.",
                );
              }
            });
            searchElement.current.replaceChildren(autocomplete);
          }
        } else {
          setReady(true);
        }
      } catch {
        if (!disposed)
          setError(
            "We could not load property maps. Please try again or request a custom quote.",
          );
      }
    };
    void start();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener(MAPS_AUTH_ERROR, onAuthError);
      autocomplete?.remove();
      if (localDraw?.enabled) localDraw.stop();
      polygons.current.forEach((polygon) => polygon.setMap(null));
      polygons.current = [];
      draw.current = null;
      map.current = null;
    };
  }, [apiKey, readOnly, loadingAttempt]);

  useEffect(() => {
    if (!ready || !map.current || !property) return;
    map.current.setCenter({ lat: property.lat, lng: property.lng });
    map.current.setZoom(20);
  }, [ready, property?.lat, property?.lng]);

  useEffect(() => {
    if (!ready || !map.current) return;
    if (readOnly) {
      polygons.current.forEach((polygon) => polygon.setMap(null));
      polygons.current = areas.map(
        (area) =>
          new google.maps.Polygon({
            paths: area.geometry.coordinates.map((ring) =>
              ring.map(([lng, lat]) => ({ lat, lng })),
            ),
            strokeColor: SERVICE_COLORS[area.service],
            strokeWeight: 3,
            fillColor: SERVICE_COLORS[area.service],
            fillOpacity: 0.3,
            clickable: false,
            map: map.current,
          }),
      );
    } else if (
      draw.current &&
      JSON.stringify(areas) !== lastPublished.current
    ) {
      updating.current = true;
      draw.current.clear();
      draw.current.addFeatures(areasToFeatures(areas));
      draw.current.clearUndoRedoHistory();
      lastPublished.current = JSON.stringify(areas);
      updating.current = false;
      setSelectedId(null);
    }
  }, [areas, ready, readOnly]);

  const setTool = (tool: "polygon" | "select") => {
    if (!draw.current || !ready) return;
    draw.current.setMode(tool);
    setMode(tool);
    setSelectedId(null);
    mapElement.current?.focus();
  };
  const selected = areas.find((area) => area.id === selectedId);
  const fallback = (
    <a className="map-contact-link" href="/contact?subject=Custom%20quote">
      Request a custom quote <span aria-hidden="true">→</span>
    </a>
  );
  if (!apiKey || error)
    return (
      <div className="map-unavailable" role="status">
        <MapPin size={32} aria-hidden="true" />
        <h3>Let’s take a closer look at your property.</h3>
        <p>
          {error ||
            "Online property measurements are being prepared. Send us your address and the areas you’d like cleaned, and we’ll help with a personal estimate."}
        </p>
        {error && (
          <button
            type="button"
            className="map-tool"
            onClick={() => {
              setError("");
              setLoadingAttempt((attempt) => attempt + 1);
            }}
          >
            Try loading the map again
          </button>
        )}
        {fallback}
      </div>
    );

  return (
    <div className="property-map">
      {!readOnly && (
        <div className="map-search">
          <label>Find your property</label>
          <div ref={searchElement} className="map-address-input" />
          {property && (
            <p className="map-address">
              <MapPin size={15} aria-hidden="true" /> {property.address}
            </p>
          )}
          {searchError && (
            <p role="alert" className="map-error">
              {searchError} {fallback}
            </p>
          )}
        </div>
      )}
      {!readOnly && (
        <>
          <p className="map-instructions">
            <strong>
              {mode === "polygon"
                ? `Outlining: ${SERVICE_LABELS[activeService]}`
                : "Draw the areas you want cleaned"}
            </strong>
            <br />
            Tap around the edges of the area you want cleaned. Tap the first
            point again or choose Finish outline to calculate its size. Use two
            fingers to pan the map on a phone.
          </p>
          <div className="map-toolbar" aria-label="Property outline tools">
            <button
              className="map-tool"
              type="button"
              disabled={!ready || !property}
              aria-pressed={mode === "polygon"}
              onClick={() => setTool("polygon")}
            >
              <Pencil size={16} /> Add{" "}
              {SERVICE_LABELS[activeService].toLowerCase()}
            </button>
            <button
              className="map-tool"
              type="button"
              disabled={!ready || mode !== "polygon"}
              onClick={() =>
                mapElement.current?.dispatchEvent(
                  new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
                )
              }
            >
              <Check size={16} /> Finish outline
            </button>
            <button
              className="map-tool"
              type="button"
              disabled={!ready || !areas.length}
              aria-pressed={mode === "select"}
              onClick={() => setTool("select")}
            >
              <MousePointer2 size={16} /> Edit / move
            </button>
            <button
              className="map-tool"
              type="button"
              disabled={!ready || !history.undo}
              onClick={() => draw.current?.undo()}
            >
              <Undo2 size={16} /> Undo
            </button>
            <button
              className="map-tool"
              type="button"
              disabled={!ready || !history.redo}
              onClick={() => draw.current?.redo()}
            >
              <Redo2 size={16} /> Redo
            </button>
            <button
              className="map-tool"
              type="button"
              disabled={!ready || !property}
              onClick={() => {
                if (property) {
                  map.current?.setCenter({
                    lat: property.lat,
                    lng: property.lng,
                  });
                  map.current?.setZoom(20);
                }
              }}
            >
              <LocateFixed size={16} /> Recenter
            </button>
          </div>
        </>
      )}
      <div className="map-canvas-wrap">
        <div
          ref={mapElement}
          className="map-canvas"
          tabIndex={0}
          role="region"
          aria-label={
            readOnly
              ? "Satellite map with saved cleaning outlines"
              : "Satellite map: click to draw an outline, Enter to finish, Escape to cancel"
          }
        />
        {!ready && (
          <div className="map-loading" role="status">
            Loading satellite map…
          </div>
        )}
      </div>
      <div className="map-legend" aria-label="Outline colors">
        {SERVICES.map((service) => (
          <span key={service}>
            <i
              style={{ background: SERVICE_COLORS[service] }}
              aria-hidden="true"
            />
            {SERVICE_LABELS[service]}
          </span>
        ))}
      </div>
      {!readOnly && selected && (
        <div className="map-selection">
          <label htmlFor="selected-area-service">
            Selected outline’s service
          </label>
          <select
            id="selected-area-service"
            value={selected.service}
            onChange={(event) =>
              draw.current?.updateFeatureProperties(selected.id, {
                service: event.target.value,
              })
            }
          >
            {SERVICES.map((service) => (
              <option value={service} key={service}>
                {SERVICE_LABELS[service]}
              </option>
            ))}
          </select>
          <button
            className="map-tool map-delete"
            type="button"
            onClick={() => {
              draw.current?.removeFeatures([selected.id]);
              setSelectedId(null);
            }}
          >
            <Trash2 size={16} /> Delete outline
          </button>
          <p>
            Drag the white points to reshape. Drag the outline to move it. Drag
            a midpoint to add a corner.
          </p>
        </div>
      )}
      {ready && areas.length > 0 && (
        <div className="map-area-list">
          <div className="map-area-heading">
            <strong>
              {areas.length} outlined {areas.length === 1 ? "area" : "areas"}
            </strong>
            {!readOnly && (
              <button
                className="map-clear"
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Clear all property outlines? You can undo this action.",
                    )
                  ) {
                    draw.current?.clear();
                    setSelectedId(null);
                  }
                }}
              >
                Clear all
              </button>
            )}
          </div>
          {areas.map((area, index) => (
            <div className="map-area-row" key={area.id}>
              <span
                className="map-area-dot"
                style={{ background: SERVICE_COLORS[area.service] }}
              />
              {readOnly ? (
                <span>
                  {SERVICE_LABELS[area.service]} {index + 1}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    draw.current?.selectFeature(area.id);
                    setMode("select");
                  }}
                >
                  {SERVICE_LABELS[area.service]} {index + 1}
                </button>
              )}
              <span>
                {Math.round(googleSquareFeet(area)).toLocaleString()} sq. ft.
              </span>
            </div>
          ))}
          <p className="map-measurement-note">
            <TriangleAlert size={14} aria-hidden="true" /> Individual outline
            sizes are shown here. The estimate combines overlapping outlines of
            the same service so you aren’t charged twice. Overlaps between
            different services must be corrected.
          </p>
        </div>
      )}
      {!readOnly && (
        <p className="map-help">
          Satellite imagery can be older than your property’s current condition.
          Can’t see the surface clearly? {fallback}
        </p>
      )}
    </div>
  );
}
export default PropertyMap;
