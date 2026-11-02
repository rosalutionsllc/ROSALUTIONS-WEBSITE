import { describe, expect, it, vi } from "vitest";
import {
  renderContactEmail,
  renderQuoteEmail,
  sendEmail,
  type EmailDeliveryInput,
} from "../worker/email";
import {
  DISCLAIMER,
  type PublicConfig,
  type QuoteRecord,
} from "../shared/types";

const config: PublicConfig = {
  business: {
    name: "Rosalutions Pressure Washing",
    email: "rosalutionsllc@gmail.com",
    phone: "(813) 898-4392",
    serviceArea: "Tampa Bay, Florida",
    description: "",
    logoUrl: "",
    googleBusinessUrl: "",
    socialUrls: [],
  },
  pricing: {
    version: "2026-01",
    ratesCents: { driveway: 21, sidewalk: 21, patio: 21 },
    minimumCents: 15000,
    reviewThresholdSqFt: 5000,
    taxBasisPoints: 0,
    enabledServices: ["driveway", "sidewalk", "patio"],
  },
  mapsApiKey: "",
  turnstileSiteKey: "",
  emailMode: "preview",
  production: false,
};
const quote: QuoteRecord = {
  id: "f98dcaa4-f765-415f-bc9b-4ac62bc80158",
  quoteNumber: "ROS-20261102-1234",
  status: "needs_review",
  customer: {
    name: "Alex <script>alert(1)</script>",
    email: "alex@example.com",
    phone: "813-555-0123",
  },
  property: { address: "123 Sample Lane, Tampa, FL", lat: 27.95, lng: -82.45 },
  areas: [],
  conditions: ["Oil stains"],
  notes: "Please call before arriving.",
  preferredDate: "2026-11-10",
  timeWindow: "Morning",
  accessInstructions: "Use the side gate.",
  privateNotes: "PRIVATE OWNER NOTE NEVER EXPOSE",
  createdAt: "2026-11-02T14:00:00.000Z",
  updatedAt: "2026-11-02T14:00:00.000Z",
  pricing: config.pricing,
  emails: { customer: "pending", business: "pending" },
  estimate: {
    lines: [
      {
        service: "driveway",
        areaCount: 1,
        squareFeet: 1000,
        rateCents: 21,
        amountCents: 21000,
      },
      {
        service: "sidewalk",
        areaCount: 1,
        squareFeet: 200,
        rateCents: 21,
        amountCents: 4200,
      },
    ],
    totalSquareFeet: 1200,
    subtotalCents: 25200,
    minimumAdjustmentCents: 0,
    taxCents: 0,
    totalCents: 25200,
    needsReview: true,
    reviewReasons: ["Oil stains require review"],
    warnings: [],
    pricingVersion: "2026-01",
  },
};
const input: EmailDeliveryInput = {
  to: "alex@example.com",
  subject: "Your estimate",
  html: "<p>$252.00</p>",
  text: "$252.00",
  replyTo: "rosalutionsllc@gmail.com",
  idempotencyKey: "quote-12345678-customer",
};
const live = {
  APP_ENV: "production",
  EMAIL_MODE: "live",
  EMAIL_FROM: "Rosalutions <quotes@example.com>",
  RESEND_API_KEY: "test-placeholder",
};

describe("quote emails", () => {
  it("renders a complete business quote with owner link and customer reply-to", () => {
    const email = renderQuoteEmail(
      quote,
      "business",
      config,
      "https://example.workers.dev",
    );
    expect(email.subject).toContain(quote.quoteNumber);
    expect(email.replyTo).toBe("alex@example.com");
    for (const value of [
      "$252.00",
      "$210.00",
      "$42.00",
      "Driveway",
      "Sidewalk",
      "1,200",
      "$0.21",
      "Oil stains",
      "Please call before arriving.",
      "Use the side gate.",
      "2026-11-10",
      "Morning",
      quote.quoteNumber,
    ]) {
      expect(email.html).toContain(value);
      expect(email.text).toContain(value);
    }
    expect(email.html).toContain(
      `https://example.workers.dev/admin/quotes/${quote.id}`,
    );
    expect(email.text).toContain("Eastern");
  });

  it("escapes HTML and never includes private owner notes", () => {
    for (const kind of ["customer", "business"] as const) {
      const email = renderQuoteEmail(
        quote,
        kind,
        config,
        "https://example.workers.dev",
      );
      expect(email.html).not.toContain("<script>");
      expect(email.html).toContain("&lt;script&gt;");
      expect(email.html).not.toContain(quote.privateNotes);
      expect(email.text).not.toContain(quote.privateNotes);
    }
  });

  it("customer confirmation clearly distinguishes an estimate from a booking", () => {
    const email = renderQuoteEmail(
      quote,
      "customer",
      config,
      "https://example.workers.dev",
    );
    expect(email.replyTo).toBe(config.business.email);
    expect(email.text).toContain(DISCLAIMER);
    expect(email.text).toContain("No appointment has been booked.");
    expect(email.html).toContain("Your request is received");
    expect(email.text).not.toContain("/admin");
    expect(email.text).not.toContain(quote.accessInstructions);
  });

  it("shows one minimum visit adjustment and configurable tax", () => {
    const small: QuoteRecord = {
      ...quote,
      estimate: {
        ...quote.estimate,
        lines: [
          {
            service: "driveway",
            areaCount: 1,
            squareFeet: 400,
            rateCents: 21,
            amountCents: 8400,
          },
        ],
        totalSquareFeet: 400,
        subtotalCents: 8400,
        minimumAdjustmentCents: 6600,
        taxCents: 1050,
        totalCents: 16050,
      },
    };
    const email = renderQuoteEmail(
      small,
      "customer",
      config,
      "https://example.com",
    );
    expect(email.text).toContain("Minimum visit adjustment: $66.00");
    expect(email.text).toContain("Tax: $10.50");
    expect(email.text).toContain("Preliminary estimate: $160.50");
  });

  it("rejects unsafe admin URLs", () => {
    expect(() =>
      renderQuoteEmail(quote, "business", config, "javascript:alert(1)"),
    ).toThrow();
    expect(() =>
      renderQuoteEmail(quote, "business", config, "http://example.com"),
    ).toThrow();
    expect(
      renderQuoteEmail(quote, "business", config, "http://localhost:5173").html,
    ).toContain("http://localhost:5173/admin");
  });

  it("renders contact messages with escaped content and no header newlines", () => {
    const email = renderContactEmail(
      {
        name: "Chris",
        email: "chris@example.com",
        phone: "8135550123",
        subject: "Fence\r\nInjected header",
        message: "<img src=x onerror=alert(1)>\nPlease call.",
      },
      config,
      "https://example.com",
    );
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img");
    expect(email.replyTo).toBe("chris@example.com");
  });
});

describe("safe provider delivery", () => {
  it("does not send any network request in local preview mode", async () => {
    const fetcher = vi.fn();
    expect(
      await sendEmail(
        { APP_ENV: "local", EMAIL_MODE: "preview" },
        input,
        fetcher,
      ),
    ).toEqual({ status: "preview" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed in production without verified sender configuration", async () => {
    const fetcher = vi.fn();
    expect(
      (
        await sendEmail(
          { APP_ENV: "production", EMAIL_MODE: "preview" },
          input,
          fetcher,
        )
      ).status,
    ).toBe("failed");
    expect(
      (
        await sendEmail(
          { ...live, EMAIL_FROM: "rosalutionsllc@gmail.com" },
          input,
          fetcher,
        )
      ).status,
    ).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends stable provider idempotency keys and uses an authenticated API", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "provider-id" }), { status: 200 }),
      );
    expect(await sendEmail(live, input, fetcher)).toEqual({
      status: "sent",
      providerId: "provider-id",
    });
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(request.headers["Idempotency-Key"]).toBe(input.idempotencyKey);
    expect(request.headers.Authorization).toBe("Bearer test-placeholder");
    expect(JSON.parse(request.body)).toEqual({
      from: live.EMAIL_FROM,
      to: [input.to],
      reply_to: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  });

  it("records provider failures without exposing response bodies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("private provider diagnostic", { status: 503 }),
      );
    const result = await sendEmail(live, input, fetcher);
    expect(result.status).toBe("failed");
    expect(result.error).not.toContain("private");
  });

  it("handles ambiguous network failure and incomplete provider response", async () => {
    expect(
      (
        await sendEmail(
          live,
          input,
          vi.fn().mockRejectedValue(new Error("secret test error")),
        )
      ).error,
    ).not.toContain("secret");
    expect(
      (
        await sendEmail(
          live,
          input,
          vi.fn().mockResolvedValue(new Response("{}")),
        )
      ).status,
    ).toBe("failed");
  });

  it("rejects envelope injection before making a network request", async () => {
    const fetcher = vi.fn();
    expect(
      (
        await sendEmail(
          live,
          { ...input, to: "alex@example.com\r\nBcc:other@example.com" },
          fetcher,
        )
      ).status,
    ).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
