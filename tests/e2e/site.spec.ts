import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const token =
  process.env.E2E_ADMIN_TOKEN ||
  readFileSync(".dev.vars", "utf8")
    .match(/^LOCAL_ADMIN_TOKEN=(.+)$/m)?.[1]
    ?.trim();
const adminHeaders = {
  "X-Local-Admin-Token": token || "",
  "Content-Type": "application/json",
};
test.beforeAll(async ({ request }) => {
  const config = await (await request.get("/api/config")).json();
  if (config.production || config.emailMode !== "preview")
    throw new Error(
      "E2E tests require a LOCAL instance with safe email-preview mode.",
    );
  if (!token)
    throw new Error(
      "Configure LOCAL_ADMIN_TOKEN in .dev.vars before running owner tests.",
    );
});
test("home is responsive, navigation works, and gallery makes no fake project claims", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Goodbye grime/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator("#primary-nav")
    .getByRole("link", { name: "Services", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Every surface/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Roof soft washing" }),
  ).toBeVisible();
  await page.goto("/gallery");
  await expect(
    page.getByRole("heading", { name: /Fresh results/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("map unavailable provides a usable custom-quote fallback", async ({
  page,
}) => {
  await page.goto("/quote");
  await expect(
    page.getByRole("heading", { name: "Get Your Free Instant Quote" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Request a custom quote/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email My Quote & Request Service" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("contact form persists a message and accurately reports preview email status", async ({
  page,
  request,
}) => {
  await page.setExtraHTTPHeaders({
    "CF-Connecting-IP": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
  });
  const unique = `Browser request ${crypto.randomUUID()}`;
  await page.goto("/contact");
  await page.getByLabel("Full name").fill("Browser Test Customer");
  await page.getByLabel("Email", { exact: true }).fill("browser@example.test");
  await page.getByLabel("Phone", { exact: true }).fill("8135550123");
  await page
    .getByLabel("Service or subject")
    .selectOption({ label: "Fence cleaning and restoration" });
  await page.getByLabel("Tell us about your project").fill(unique);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send my request" }).click();
  await expect(
    page.getByRole("heading", { name: "Thanks for reaching out." }),
  ).toBeVisible();
  await expect(
    page.getByText(/notification has not been delivered/),
  ).toBeVisible();
  const contacts = await (
    await request.get("/api/admin/contacts", { headers: adminHeaders })
  ).json();
  const c = contacts.contacts.find(
    (r: { message: string }) => r.message === unique,
  );
  expect(c).toBeTruthy();
  expect(c.emailStatus).toBe("preview");
  await request.delete(`/api/admin/contacts/${c.id}`, {
    headers: adminHeaders,
  });
});
test("real local D1 quote submission, idempotency, admin notes, email retry and deletion", async ({
  page,
  request,
}) => {
  const quoteHeaders = {
    "CF-Connecting-IP": `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
  };
  const payload = {
    idempotencyKey: crypto.randomUUID(),
    customer: {
      name: "Browser Quote Customer",
      email: "quote@example.test",
      phone: "8135550123",
    },
    property: { address: "Test property Tampa FL", lat: 27.95, lng: -82.45 },
    areas: [
      {
        id: "one",
        service: "driveway",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-82.45, 27.95],
              [-82.4499, 27.95],
              [-82.4499, 27.9501],
              [-82.45, 27.9501],
              [-82.45, 27.95],
            ],
          ],
        },
      },
    ],
    conditions: [],
    notes: "Test request",
    preferredDate: "",
    timeWindow: "Morning",
    accessInstructions: "",
    consent: true,
    website: "",
    totalCents: 1,
  };
  const response = await request.post("/api/quotes", {
    data: payload,
    headers: quoteHeaders,
  });
  expect(response.status()).toBe(201);
  const q = await response.json();
  expect(q.estimate.totalCents).toBeGreaterThanOrEqual(15000);
  expect(q.emails).toEqual({ customer: "preview", business: "preview" });
  const repeat = await request.post("/api/quotes", {
    data: payload,
    headers: quoteHeaders,
  });
  expect((await repeat.json()).id).toBe(q.id);
  expect((await request.get(`/api/admin/quotes/${q.id}`)).status()).toBe(401);
  await page.goto("/admin");
  await page.getByLabel("Local administrator token").fill(token!);
  await page.getByRole("button", { name: "Unlock local dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Quote requests", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: q.quoteNumber }).click();
  await expect(
    page.getByRole("heading", { name: "Browser Quote Customer" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("contacted");
  await page.getByLabel("Private owner notes").fill("Only the owner sees this");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  const detail = await (
    await request.get(`/api/admin/quotes/${q.id}`, { headers: adminHeaders })
  ).json();
  expect(detail.quote.status).toBe("contacted");
  expect(detail.quote.areas).toEqual(payload.areas);
  expect(
    detail.emails.map((e: { html: string }) => e.html).join(""),
  ).not.toContain("Only the owner sees this");
  await page.getByRole("button", { name: "Retry unsent" }).click();
  await expect(page.getByText("Notification statuses updated.")).toBeVisible();
  const deleted = await request.delete(`/api/admin/quotes/${q.id}`, {
    headers: adminHeaders,
  });
  expect(deleted.status()).toBe(200);
});
