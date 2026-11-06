import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient, getUser } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { proxy } from "@/proxy";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const originalInternalUrl = process.env.SUPABASE_INTERNAL_URL;

describe("hosted Supabase proxy configuration", () => {
  beforeEach(() => {
    createServerClient.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: null } });
    createServerClient.mockReturnValue({ auth: { getUser } });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.SUPABASE_INTERNAL_URL = "http://127.0.0.1:54321";
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalPublishableKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalPublishableKey;
    if (originalAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    if (originalInternalUrl === undefined)
      delete process.env.SUPABASE_INTERNAL_URL;
    else process.env.SUPABASE_INTERNAL_URL = originalInternalUrl;
  });

  it("uses the hosted URL even when a legacy internal URL is present", async () => {
    await proxy(new NextRequest("https://barrioshop.test/"));

    expect(createServerClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "sb_publishable_test",
      expect.any(Object),
    );
  });

  it("redirects anonymous requests to protected store setup", async () => {
    const response = await proxy(
      new NextRequest("https://barrioshop.test/panel/tienda"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
