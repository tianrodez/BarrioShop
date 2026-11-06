import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoreCard } from "@/components/stores/store-card";
import type { DirectoryStore } from "@/lib/store-directory-model";

function makeStore(overrides: Partial<DirectoryStore> = {}): DirectoryStore {
  return {
    id: "store-1",
    name: "Panadería La Espiga",
    store_type: "Panadería",
    barrio: "Castilla",
    address: "Cra 72 #15-20",
    reference_place: "Frente al parque de Castilla",
    opening_hours: "Lun a Sáb 6:00-13:00",
    photo_url: null,
    is_featured: false,
    distance_m: null,
    latitude: 4.5996,
    longitude: -74.1377,
    ...overrides,
  };
}

describe("StoreCard", () => {
  it("reads the same in the landing and the directory", () => {
    render(
      <ul>
        <StoreCard store={makeStore({ is_featured: true, distance_m: 350 })} />
      </ul>,
    );

    expect(screen.getByText("🥖")).toBeVisible();
    expect(screen.getByText(/Panadería · Castilla/)).toBeVisible();
    expect(screen.getByText("a 350 m")).toBeVisible();
    expect(screen.getByText("Frente al parque de Castilla")).toBeVisible();
    expect(screen.getByText("Lun a Sáb 6:00-13:00")).toBeVisible();
    expect(screen.getByText("Destacada")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Panadería La Espiga/ }),
    ).toHaveAttribute("href", "/tienda/store-1");
  });

  it("falls back to the address when the merchant left no reference", () => {
    render(
      <ul>
        <StoreCard store={makeStore({ reference_place: null })} />
      </ul>,
    );

    expect(screen.getByText("Cra 72 #15-20")).toBeVisible();
  });

  it("omits the distance and the badge when the data does not carry them", () => {
    render(
      <ul>
        <StoreCard store={makeStore()} />
      </ul>,
    );

    expect(screen.getByText("Panadería · Castilla")).toBeVisible();
    expect(screen.queryByText("Destacada")).not.toBeInTheDocument();
  });
});
