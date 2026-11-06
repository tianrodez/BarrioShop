import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const validationScript = resolve(
  process.cwd(),
  "scripts/verify-hosted-env.mjs",
);

function runValidation(environment: Record<string, string>) {
  return spawnSync(process.execPath, [validationScript], {
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

describe("hosted Supabase environment", () => {
  it("accepts a hosted HTTPS endpoint with a public key", () => {
    const result = runValidation({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });

    expect(result.status).toBe(0);
  });

  it("rejects the local Supabase endpoint", () => {
    const result = runValidation({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-public-key",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("local Supabase endpoints are unsupported");
  });

  it("requires a public key", () => {
    const result = runValidation({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });

    expect(result.status).toBe(2);
  });
});
