export type Service = "driveway" | "sidewalk" | "patio";
export type Position = [number, number];
export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}
export interface CleaningArea {
  id: string;
  service: Service;
  geometry: PolygonGeometry;
}
export interface Property {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}
export interface PricingConfig {
  version: string;
  ratesCents: Record<Service, number>;
  minimumCents: number;
  reviewThresholdSqFt: number;
  taxBasisPoints: number;
  enabledServices: Service[];
}
export interface EstimateLine {
  service: Service;
  areaCount: number;
  squareFeet: number;
  rateCents: number;
  amountCents: number;
}
export interface Estimate {
  lines: EstimateLine[];
  totalSquareFeet: number;
  subtotalCents: number;
  minimumAdjustmentCents: number;
  taxCents: number;
  totalCents: number;
  needsReview: boolean;
  reviewReasons: string[];
  warnings: string[];
  pricingVersion: string;
}
export interface PublicConfig {
  business: {
    name: string;
    email: string;
    phone: string;
    serviceArea: string;
    description: string;
    logoUrl: string;
    googleBusinessUrl: string;
    socialUrls: string[];
  };
  pricing: PricingConfig;
  mapsApiKey: string;
  turnstileSiteKey: string;
  emailMode: "preview" | "live";
  production: boolean;
}
export interface QuoteInput {
  idempotencyKey: string;
  customer: { name: string; email: string; phone: string };
  property: Property;
  areas: CleaningArea[];
  conditions: string[];
  notes: string;
  preferredDate: string;
  timeWindow: string;
  accessInstructions: string;
  consent: boolean;
  website: string;
  turnstileToken?: string;
}
export type QuoteStatus =
  | "new"
  | "needs_review"
  | "contacted"
  | "approved"
  | "scheduled"
  | "completed"
  | "declined"
  | "cancelled";
export type EmailStatus = "pending" | "sent" | "failed" | "preview";
export interface QuoteReceipt {
  id: string;
  quoteNumber: string;
  estimate: Estimate;
  status: QuoteStatus;
  emails: { customer: EmailStatus; business: EmailStatus };
}
export interface QuoteRecord extends QuoteReceipt {
  customer: QuoteInput["customer"];
  property: Property;
  areas: CleaningArea[];
  conditions: string[];
  notes: string;
  preferredDate: string;
  timeWindow: string;
  accessInstructions: string;
  privateNotes: string;
  createdAt: string;
  updatedAt: string;
  pricing: PricingConfig;
}
export interface EmailRecord {
  id: string;
  kind: "customer" | "business" | "contact";
  status: EmailStatus;
  attempts: number;
  subject: string;
  html?: string;
  lastError?: string;
  updatedAt: string;
}
export const SERVICES: Service[] = ["driveway", "sidewalk", "patio"];
export const SERVICE_LABELS: Record<Service, string> = {
  driveway: "Driveway",
  sidewalk: "Sidewalk",
  patio: "Patio",
};
export const SERVICE_COLORS: Record<Service, string> = {
  driveway: "#3b82f6",
  sidewalk: "#16a34a",
  patio: "#f97316",
};
export const SPECIAL_CONDITIONS = [
  "Oil stains",
  "Rust stains",
  "Paint or difficult staining",
  "Heavy algae or mildew",
  "Other unusual conditions",
];
export const DISCLAIMER =
  "This is an estimated price based on the areas selected. Final pricing is subject to confirmation by Rosalutions Pressure Washing. Additional charges may apply for heavy staining, unusual conditions, or special treatments.";
