import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The mockup is the visual contract: a cream page, cafe text, a terracotta
 * brand colour and a display serif for headings. jsdom cannot compute colour,
 * so this pins the source tokens that every screen reads from.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("brand theme (mockup)", () => {
  it("uses the cream/terracotta palette instead of the grayscale default", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain("--background: #fdf8ec");
    expect(css).toContain("--foreground: #2b2118");
    expect(css).toContain("--primary: #b8411c");
    expect(css).toContain("--highlight: #f6c667");
    expect(css).not.toContain("--primary: oklch(0.205 0 0)");
  });

  it("wires the display serif to headings and Geist to body text", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain("--font-heading: var(--font-display)");
    expect(css).toContain("--font-sans: var(--font-geist-sans)");
    expect(css).toMatch(/h1,\s*h2,\s*h3\s*\{\s*@apply font-heading/);
  });

  it("loads the display font in the root layout", () => {
    const layout = read("src/app/layout.tsx");

    expect(layout).toContain("Playfair_Display");
    expect(layout).toContain('"--font-display"');
    expect(layout).toContain("playfair.variable");
  });

  it("draws the wordmark in the brand colour", () => {
    const header = read("src/components/site-header.tsx");

    expect(header).toContain("font-heading");
    expect(header).toContain("text-primary");
  });
});
