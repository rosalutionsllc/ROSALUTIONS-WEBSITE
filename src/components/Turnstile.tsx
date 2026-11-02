import { useEffect, useRef, useState } from "react";
type TurnstileApi = {
  render: (el: HTMLElement, config: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
let scriptPromise: Promise<void> | undefined;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = undefined;
        reject(new Error("Verification could not load."));
      };
      document.head.appendChild(script);
    });
  return scriptPromise;
}
export default function Turnstile({
  siteKey,
  onToken,
  reset = 0,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  reset?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [error, setError] = useState("");
  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let widget: string | undefined;
    setError("");
    callback.current("");
    loadTurnstile()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widget = window.turnstile.render(container.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(""),
          "error-callback": () => {
            callback.current("");
            setError(
              "Verification needs another attempt. Please reload or contact us directly.",
            );
          },
        });
      })
      .catch(() =>
        setError(
          "Verification could not load. Please reload or contact us directly.",
        ),
      );
    return () => {
      cancelled = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, reset]);
  return (
    <div>
      <div ref={container} />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
