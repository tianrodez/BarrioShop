import { describe, expect, it } from "vitest";
import { homePathForRole, panelPathForRole, roleLabel } from "@/lib/auth-roles";

describe("homePathForRole (HU01 CA4)", () => {
  it("sends merchants to the panel", () => {
    expect(homePathForRole("comerciante")).toBe("/panel");
  });

  it("sends administrators to the panel", () => {
    expect(homePathForRole("administrador")).toBe("/panel");
  });

  it("sends clients to the public directory", () => {
    expect(homePathForRole("cliente")).toBe("/");
  });
});

describe("roleLabel", () => {
  it("labels every role in Spanish", () => {
    expect(roleLabel("cliente")).toBe("Cliente");
    expect(roleLabel("comerciante")).toBe("Comerciante");
    expect(roleLabel("administrador")).toBe("Administrador");
  });
});

describe("panelPathForRole (HU01 CA4)", () => {
  it("keeps merchants and administrators in the panel", () => {
    expect(panelPathForRole("comerciante")).toBe("/panel");
    expect(panelPathForRole("administrador")).toBe("/panel");
  });

  it("sends clients away from the merchant panel", () => {
    expect(panelPathForRole("cliente")).toBe("/");
  });
});
