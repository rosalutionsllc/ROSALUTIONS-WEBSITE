/** Browser-restricted Google Maps key only. Server secrets must never reach this module. */
let loading: Promise<void> | null = null;
let loadedKey: string | null = null;
const SCRIPT_ID = "rosalutions-google-maps";
const CALLBACK_NAME = "__rosalutionsMapsReady";
export const MAPS_AUTH_ERROR = "rosalutions:maps-auth-error";
type MapsWindow = Window & {
  [CALLBACK_NAME]?: () => void;
  gm_authFailure?: () => void;
};

export async function loadGoogleMaps(apiKey: string): Promise<void> {
  if (!apiKey.trim())
    throw new Error("Property maps are not available right now.");
  if (typeof google !== "undefined" && google.maps?.importLibrary) {
    await Promise.all(
      ["maps", "places", "geometry"].map((name) =>
        google.maps.importLibrary(name),
      ),
    );
    return;
  }
  if (loading && loadedKey !== apiKey)
    throw new Error("Map settings changed. Please reload this page.");
  if (!loading) {
    loadedKey = apiKey;
    loading = new Promise<void>((resolve, reject) => {
      const target = window as MapsWindow;
      const script = document.createElement("script");
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        script.remove();
        delete target[CALLBACK_NAME];
        loading = null;
        loadedKey = null;
        reject(
          new Error(
            "We could not load property maps. Please try again or request a custom quote.",
          ),
        );
      };
      const timeout = window.setTimeout(fail, 20000);
      target[CALLBACK_NAME] = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        delete target[CALLBACK_NAME];
        resolve();
      };
      target.gm_authFailure = () => {
        fail();
        window.dispatchEvent(new Event(MAPS_AUTH_ERROR));
      };
      const parameters = new URLSearchParams({
        key: apiKey,
        v: "weekly",
        loading: "async",
        callback: CALLBACK_NAME,
      });
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?${parameters}`;
      script.onerror = fail;
      document.head.appendChild(script);
    });
  }
  await loading;
  await Promise.all(
    ["maps", "places", "geometry"].map((name) =>
      google.maps.importLibrary(name),
    ),
  );
}
