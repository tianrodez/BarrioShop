import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without `globals: true`, so Testing Library cannot register its
// auto-cleanup. Without this, every render leaks into the next test.
afterEach(() => {
  cleanup();
});
