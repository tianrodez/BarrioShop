import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const command = process.argv[2];
if (!command) {
  console.error("Usage: node scripts/next-with-hosted-env.mjs <next-command>");
  process.exit(2);
}

const hostedEnvFile = resolve(process.cwd(), ".env.hosted.local");
const hasHostedEnvFile = existsSync(hostedEnvFile);
const environment = { ...process.env };

if (hasHostedEnvFile) {
  const allowedKeys = new Set([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);
  for (const line of readFileSync(hostedEnvFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || !allowedKeys.has(match[1])) continue;
    const rawValue = match[2];
    const quote = rawValue[0];
    environment[match[1]] =
      (quote === '"' || quote === "'") && rawValue.at(-1) === quote
        ? rawValue.slice(1, -1)
        : rawValue.replace(/\s+#.*$/, "");
  }
}

const validation = spawnSync(
  process.execPath,
  [resolve(process.cwd(), "scripts/verify-hosted-env.mjs")],
  { stdio: "inherit", env: environment },
);
if (validation.error) throw validation.error;
if (validation.status !== 0) process.exit(validation.status ?? 1);

const args = [
  resolve(process.cwd(), "node_modules/next/dist/bin/next"),
  ...process.argv.slice(2),
];

const child = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: environment,
});

if (child.error) throw child.error;
process.exit(child.status ?? 1);
