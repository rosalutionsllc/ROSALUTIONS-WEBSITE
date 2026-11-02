export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("rosalutions.localAdminToken");
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ||
      (options.method && !["GET", "HEAD"].includes(options.method))
        ? { "Content-Type": "application/json" }
        : {}),
      ...(path.startsWith("/api/admin/") && token
        ? { "X-Local-Admin-Token": token }
        : {}),
      ...options.headers,
    },
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!response.ok)
    throw new ApiError(
      result.error ||
        result.message ||
        "The request could not be completed. Please try again.",
      response.status,
    );
  return result as T;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const sqft = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
export async function submissionKey(
  payload: unknown,
  namespace: string,
): Promise<string> {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const hash = Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const saved = sessionStorage.getItem(namespace);
  if (saved) {
    try {
      const previous = JSON.parse(saved);
      if (previous.hash === hash) return previous.key;
    } catch {
      /* replace malformed local state */
    }
  }
  const key = crypto.randomUUID();
  sessionStorage.setItem(namespace, JSON.stringify({ hash, key }));
  return key;
}
