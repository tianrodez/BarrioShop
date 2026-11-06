import { afterEach, describe, expect, it } from "vitest";
import { readSupabaseEnv } from "@/lib/supabase/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("readSupabaseEnv", () => {
  it("prefers the current publishable key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "legacy-anon-key";

    expect(readSupabaseEnv()).toEqual({
      url: "https://project.supabase.co",
      publicKey: "sb_publishable_example",
    });
  });

  it("supports the legacy anon key used by the local stack", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-anon-key";

    expect(readSupabaseEnv()).toEqual({
      url: "http://127.0.0.1:54321",
      publicKey: "local-anon-key",
    });
  });

  it("rejects a missing URL or public key", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => readSupabaseEnv()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});
