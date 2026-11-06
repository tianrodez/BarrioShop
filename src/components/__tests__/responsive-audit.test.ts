import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HU08 CA2: a control a phone focuses must not be smaller than 16px, or the
 * browser zooms the whole page. jsdom does not compute layout, so this audit
 * pins the source contract instead: the pattern is what `Input` already uses
 * (`text-base` with `md:text-sm` for the desktop density).
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const filesWithControls = [
  "src/components/stores/store-form.tsx",
  "src/components/products/product-manager.tsx",
  "src/components/directory/store-directory.tsx",
  "src/components/reports/report-dialog.tsx",
  "src/components/admin/admin-console.tsx",
];

describe("HU08 CA2 responsive audit", () => {
  it("every native select/textarea uses 16px text on the smallest viewport", () => {
    for (const file of filesWithControls) {
      const source = read(file);

      for (const match of source.matchAll(
        /<(select|textarea)\b[\s\S]*?className="([^"]*)"/g,
      )) {
        expect(match[2], `${file} ${match[1]}`).toContain("text-base");
        expect(match[2], `${file} ${match[1]}`).toContain("md:text-sm");
      }
    }
  });

  it("the formalization select is 40px high like the other selects", () => {
    expect(read("src/components/stores/store-form.tsx")).toMatch(
      /<select[\s\S]*?className="h-10[^"]*text-base md:text-sm"/,
    );
  });

  it("the session header can wrap and never fixes h-14", () => {
    const header = read("src/components/site-header.tsx");

    expect(header).toContain("min-h-14");
    expect(header).toContain("flex-wrap");
    expect(header).toMatch(/<nav className="flex flex-wrap/);
    // `min-h-14` is allowed; a fixed `h-14` is what would clip the second row.
    expect(header).not.toMatch(/(?<![\w-])h-14(?![0-9])/);
  });

  it("user text on public surfaces can break long tokens", () => {
    for (const file of [
      "src/components/stores/store-profile.tsx",
      "src/components/order/store-catalog.tsx",
      "src/components/stores/store-card.tsx",
      "src/components/admin/admin-console.tsx",
      "src/components/products/product-manager.tsx",
    ]) {
      expect(read(file), file).toContain("break-words");
    }
  });
});
