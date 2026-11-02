import { z } from "zod";
import { SPECIAL_CONDITIONS } from "../shared/types";
export const propertySchema = z.object({
  address: z.string().trim().min(5).max(350),
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
  placeId: z.string().trim().min(1).max(300).optional(),
});
export const areaSchema = z.object({
  id: z.string().min(1).max(80),
  service: z.enum(["driveway", "sidewalk", "patio"]),
  geometry: z.object({
    type: z.literal("Polygon"),
    coordinates: z
      .array(
        z
          .array(z.tuple([z.number().finite(), z.number().finite()]))
          .min(4)
          .max(151),
      )
      .length(1),
  }),
});
export const conditionsSchema = z
  .array(
    z
      .string()
      .refine(
        (s) => SPECIAL_CONDITIONS.includes(s),
        "Select a supported cleaning condition.",
      ),
  )
  .max(5)
  .default([]);
export const estimateSchema = z.object({
  areas: z.array(areaSchema).min(1).max(30),
  property: propertySchema,
  conditions: conditionsSchema,
});
const name = z.string().trim().min(2).max(120);
const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const phone = z
  .string()
  .trim()
  .min(7)
  .max(30)
  .regex(/^[+\d\s().-]+$/, "Enter a valid phone number.")
  .refine(
    (s) => s.replace(/\D/g, "").length >= 7,
    "Enter a valid phone number.",
  );
const date = z
  .string()
  .max(10)
  .refine(
    (s) =>
      !s ||
      (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s),
    "Enter a valid date.",
  );
export const quoteSchema = estimateSchema.extend({
  idempotencyKey: z.string().uuid(),
  customer: z.object({ name, email, phone }),
  notes: z.string().trim().max(3000).default(""),
  preferredDate: date.default(""),
  timeWindow: z.string().trim().max(100).default(""),
  accessInstructions: z.string().trim().max(1500).default(""),
  consent: z.literal(true),
  website: z.string().max(0).default(""),
  turnstileToken: z.string().max(2048).optional(),
});
export const contactSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name,
  email,
  phone,
  subject: z.string().trim().min(2).max(150),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal(true),
  website: z.string().max(0).default(""),
  turnstileToken: z.string().max(2048).optional(),
});
export const statusSchema = z.enum([
  "new",
  "needs_review",
  "contacted",
  "approved",
  "scheduled",
  "completed",
  "declined",
  "cancelled",
]);
export const updateSchema = z
  .object({
    status: statusSchema.optional(),
    privateNotes: z.string().max(10000).optional(),
  })
  .refine(
    (s) => s.status !== undefined || s.privateNotes !== undefined,
    "Provide a status or note.",
  );
