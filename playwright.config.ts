import { defineConfig } from "@playwright/test";

/**
 * E2E against a throwaway Supabase stack running on the developer machine
 * (`npx supabase start` + `npx supabase db reset`), never against the hosted
 * project: T1-T3 create stores and products, so they need a database that can
 * be discarded. The secrets below are the local defaults every local Supabase
 * stack ships with, not project credentials.
 */
const PORT = 3100;

export const LOCAL_SUPABASE = {
  url: "http://127.0.0.1:54321",
  publishableKey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    locale: "es-CO",
  },
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL_SUPABASE.publishableKey,
    },
  },
});
