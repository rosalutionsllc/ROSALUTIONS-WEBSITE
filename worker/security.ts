import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "./env";
import type { Property } from "../shared/types";
export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503,
    message: string,
  ) {
    super(message);
  }
}
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function requestHash(value: Record<string, unknown>): Promise<string> {
  const { turnstileToken: _token, ...payload } = value;
  return sha256(JSON.stringify(canonical(payload)));
}
export function isLocal(c: Context<{ Bindings: Env }>): boolean {
  return (
    c.env.APP_ENV === "local" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(c.req.url).hostname)
  );
}
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export const adminAuth: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  if (isLocal(c)) {
    const expected = c.env.LOCAL_ADMIN_TOKEN;
    const actual = c.req.header("X-Local-Admin-Token");
    if (
      !expected ||
      expected.length < 24 ||
      !actual ||
      (await sha256(actual)) !== (await sha256(expected))
    )
      throw new ApiError(
        401,
        "Enter the local owner token configured in .dev.vars.",
      );
    await next();
    return;
  }
  const domain = c.env.ACCESS_TEAM_DOMAIN;
  const audience = c.env.ACCESS_AUD;
  const owner = c.env.ADMIN_EMAIL;
  if (
    !domain ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(domain) ||
    !audience ||
    !owner
  )
    throw new ApiError(503, "Owner access is not configured.");
  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token)
    throw new ApiError(401, "Sign in through the owner access portal.");
  try {
    let keys = keySets.get(domain);
    if (!keys) {
      keys = createRemoteJWKSet(
        new URL(`https://${domain}/cdn-cgi/access/certs`),
      );
      keySets.set(domain, keys);
    }
    const result = await jwtVerify(token, keys, {
      issuer: `https://${domain}`,
      audience,
    });
    if (
      typeof result.payload.email !== "string" ||
      result.payload.email.toLowerCase() !== owner.toLowerCase()
    )
      throw new Error("wrong owner");
  } catch {
    throw new ApiError(401, "Owner authentication failed. Sign in again.");
  }
  await next();
};
export const safeOrigin: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    const allowed = c.env.APP_URL
      ? new URL(c.env.APP_URL).origin
      : new URL(c.req.url).origin;
    if (
      origin &&
      origin !== allowed &&
      !(isLocal(c) && origin === new URL(c.req.url).origin)
    )
      throw new ApiError(403, "This request must come from this website.");
    if (!c.req.header("Content-Type")?.startsWith("application/json"))
      throw new ApiError(400, "Send application/json.");
  }
  await next();
};
export async function rateLimit(
  c: Context<{ Bindings: Env }>,
  group: string,
  max: number,
  seconds: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ip =
    c.req.header("CF-Connecting-IP") ||
    (isLocal(c) ? "local-development" : "unknown");
  const bucket = await sha256(`${group}:${Math.floor(now / seconds)}:${ip}`);
  const row = await c.env.DB.prepare(
    "INSERT INTO rate_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(bucket, now + seconds)
    .first<{ count: number }>();
  if (row && row.count > max)
    throw new ApiError(
      429,
      "Too many requests. Please wait a little and try again.",
    );
  if (now % 31 === 0)
    await c.env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?")
      .bind(now)
      .run();
}
export async function verifyTurnstile(
  c: Context<{ Bindings: Env }>,
  token?: string,
): Promise<void> {
  if (isLocal(c) && !c.env.TURNSTILE_SECRET_KEY) return;
  if (
    !c.env.TURNSTILE_SECRET_KEY ||
    !c.env.TURNSTILE_SITE_KEY ||
    !c.env.APP_URL
  )
    throw new ApiError(
      503,
      "Online requests are being configured. Please contact us directly.",
    );
  if (!token)
    throw new ApiError(400, "Complete the verification before submitting.");
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: c.env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: c.req.header("CF-Connecting-IP"),
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
    };
    if (
      !response.ok ||
      !result.success ||
      result.hostname !== new URL(c.env.APP_URL).hostname
    )
      throw new ApiError(
        400,
        "Verification expired or failed. Please try again.",
      );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "Verification is temporarily unavailable. Please try again.",
    );
  }
}
export async function verifyProperty(
  c: Context<{ Bindings: Env }>,
  property: Property,
): Promise<Property> {
  if (isLocal(c)) return property;
  if (!c.env.GOOGLE_MAPS_SERVER_KEY)
    throw new ApiError(
      503,
      "Property verification is being configured. Please contact us for a quote.",
    );
  if (!property.placeId)
    throw new ApiError(
      400,
      "Select your property from the address suggestions.",
    );
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("place_id", property.placeId);
    url.searchParams.set("key", c.env.GOOGLE_MAPS_SERVER_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = (await response.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        types?: string[];
        geometry: {
          location: { lat: number; lng: number };
          location_type?: string;
        };
      }>;
    };
    if (!response.ok || data.status !== "OK" || !data.results[0])
      throw new ApiError(
        400,
        "The property could not be verified. Select an address again.",
      );
    const result = data.results[0];
    if (
      !result.types?.some((type) =>
        ["street_address", "premise", "subpremise"].includes(type),
      ) &&
      result.geometry.location_type !== "ROOFTOP"
    ) {
      throw new ApiError(
        400,
        "Choose a complete property address, not a city or region.",
      );
    }
    const dLat = (result.geometry.location.lat - property.lat) * 111320;
    const dLng =
      (result.geometry.location.lng - property.lng) *
      111320 *
      Math.cos((property.lat * Math.PI) / 180);
    if (Math.hypot(dLat, dLng) > 150)
      throw new ApiError(
        400,
        "The selected address and map location do not match.",
      );
    return {
      ...property,
      address: result.formatted_address,
      ...result.geometry.location,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "Property verification is unavailable. Please try again or contact us.",
    );
  }
}
