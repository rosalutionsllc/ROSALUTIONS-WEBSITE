import type { D1Database } from "@cloudflare/workers-types";
export interface Env {
  DB: D1Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  APP_ENV?: string;
  APP_URL?: string;
  GOOGLE_MAPS_API_KEY?: string;
  GOOGLE_MAPS_SERVER_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_MODE?: string;
  EMAIL_FROM?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAIL?: string;
  LOCAL_ADMIN_TOKEN?: string;
  BUSINESS_NAME?: string;
  BUSINESS_EMAIL?: string;
  BUSINESS_PHONE?: string;
  BUSINESS_SERVICE_AREA?: string;
  BUSINESS_DESCRIPTION?: string;
  BUSINESS_LOGO_URL?: string;
  BUSINESS_GOOGLE_PROFILE_URL?: string;
  BUSINESS_SOCIAL_URLS?: string;
  PRICING_JSON?: string;
}
