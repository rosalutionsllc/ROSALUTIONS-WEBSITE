import { z } from "zod";
import type { Env } from "./env";
import type { PricingConfig, PublicConfig } from "../shared/types";
export const DEFAULT_PRICING: PricingConfig = {
  version: "2026-11-02",
  ratesCents: { driveway: 21, sidewalk: 21, patio: 21 },
  minimumCents: 15000,
  reviewThresholdSqFt: 5000,
  taxBasisPoints: 0,
  enabledServices: ["driveway", "sidewalk", "patio"],
};
export const pricingSchema = z.object({
  version: z.string().min(1).max(80),
  ratesCents: z.object({
    driveway: z.number().int().min(1).max(10000),
    sidewalk: z.number().int().min(1).max(10000),
    patio: z.number().int().min(1).max(10000),
  }),
  minimumCents: z.number().int().min(0).max(10000000),
  reviewThresholdSqFt: z.number().min(1).max(100000),
  taxBasisPoints: z.number().int().min(0).max(10000),
  enabledServices: z.array(z.enum(["driveway", "sidewalk", "patio"])).max(3),
});
export function getPricing(env: Env): PricingConfig {
  return env.PRICING_JSON
    ? pricingSchema.parse(JSON.parse(env.PRICING_JSON))
    : structuredClone(DEFAULT_PRICING);
}
export function getPublicConfig(env: Env): PublicConfig {
  return {
    business: {
      name: env.BUSINESS_NAME || "Rosalutions Pressure Washing",
      email: env.BUSINESS_EMAIL || "rosalutionsllc@gmail.com",
      phone: env.BUSINESS_PHONE || "(813) 898-4392",
      serviceArea:
        env.BUSINESS_SERVICE_AREA || "Tampa Bay, Brandon & Hillsborough County",
      description:
        env.BUSINESS_DESCRIPTION ||
        "Thoughtful exterior cleaning, clear communication, and a fresh start for your property.",
      logoUrl: env.BUSINESS_LOGO_URL || "/brand/rosalutions-logo.png",
      googleBusinessUrl: env.BUSINESS_GOOGLE_PROFILE_URL || "",
      socialUrls: (env.BUSINESS_SOCIAL_URLS || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^https:\/\//.test(s)),
    },
    pricing: getPricing(env),
    mapsApiKey: env.GOOGLE_MAPS_API_KEY || "",
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
    emailMode: env.EMAIL_MODE === "live" ? "live" : "preview",
    production: env.APP_ENV !== "local",
  };
}
