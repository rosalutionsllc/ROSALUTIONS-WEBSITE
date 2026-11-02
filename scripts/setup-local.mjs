import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".dev.vars")) {
  console.log(
    ".dev.vars already exists; existing local settings were preserved.",
  );
} else {
  const template = readFileSync(".dev.vars.example", "utf8");
  writeFileSync(
    ".dev.vars",
    template.replace(
      /^LOCAL_ADMIN_TOKEN=$/m,
      `LOCAL_ADMIN_TOKEN=${randomBytes(32).toString("hex")}`,
    ),
    { mode: 0o600 },
  );
  console.log(
    "Created .dev.vars with a random local administrator token and safe email-preview mode.",
  );
  console.log(
    "Open .dev.vars locally to use the token at /admin. Do not share or commit this file.",
  );
}
