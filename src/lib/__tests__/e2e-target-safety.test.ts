import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The E2E suite writes to a database. It must therefore be impossible for it
 * to reach the hosted project: the server and the Supabase URL are pinned to
 * loopback in the config, and the specs carry no project reference or secret.
 */
const root = process.cwd();

describe("E2E harness target safety", () => {
  it("pins the server and database to loopback", () => {
    const config = readFileSync(join(root, "playwright.config.ts"), "utf8");

    expect(config).toContain('url: "http://127.0.0.1:54321"');
    expect(config).toContain("baseURL: `http://127.0.0.1:${PORT}`");
    expect(config).not.toMatch(
      /\.supabase\.co|service_role|sb_secret_|eyJhbGci/,
    );
  });

  it("keeps specs and helper free of hosted references or secrets", () => {
    const dir = join(root, "e2e");

    for (const file of readdirSync(dir).filter((name) =>
      name.endsWith(".ts"),
    )) {
      expect(readFileSync(join(dir, file), "utf8"), file).not.toMatch(
        /\.supabase\.co|service_role|sb_secret_|eyJhbGci/,
      );
    }
  });
});
