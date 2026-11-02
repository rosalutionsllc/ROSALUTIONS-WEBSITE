import { readFileSync } from "node:fs";
import { parse } from "jsonc-parser";
const parseErrors = [];
const config = parse(readFileSync("wrangler.jsonc", "utf8"), parseErrors, {
  allowTrailingComma: true,
});
if (parseErrors.length || !config || typeof config !== "object") {
  console.error("Fix the JSONC syntax in wrangler.jsonc before deploying.");
  process.exit(1);
}
const problems = [];
if (
  !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
    config.d1_databases?.[0]?.database_id || "",
  )
)
  problems.push(
    "Replace the D1 database ID in wrangler.jsonc with the real target database ID.",
  );
if (config.vars?.APP_ENV !== "production")
  problems.push("APP_ENV must be production in wrangler.jsonc.");
if (!/^https:\/\/[^/]+\/?$/.test(config.vars?.APP_URL || ""))
  problems.push(
    "APP_URL must be the HTTPS production site origin in wrangler.jsonc.",
  );
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  "Deployment target configuration passed. Confirm phone number, legal policies, Access, Turnstile, Maps restrictions and live email setup using DEPLOYMENT.md before publishing.",
);
