import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StoreShowcase } from "@/components/home/store-showcase";
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

function cardLinks() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("/tienda/"));
}

describe("StoreShowcase (mockup landing)", () => {
  it("shows a card per store with its icon, type, barrio, reference and hours", () => {
    render(
      <StoreShowcase
        stores={[
          makeStore(),
          makeStore({
            id: "store-2",
            name: "Fruver El Campo",
            store_type: "Fruver",
            barrio: "Tintal",
            reference_place: "Cerca a la estación Banderas",
            opening_hours: "Lun-Dom · 6:30 a.m. – 7:30 p.m.",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Panadería La Espiga")).toBeVisible();
    expect(screen.getByText("🥖")).toBeVisible();
    expect(screen.getByText("🍊")).toBeVisible();
    expect(screen.getByText(/Panadería · Castilla/)).toBeVisible();
    expect(screen.getByText("Frente al parque de Castilla")).toBeVisible();
    expect(screen.getByText("Lun a Sáb 6:00-13:00")).toBeVisible();
  });

  it("takes each card to the public profile", () => {
    render(<StoreShowcase stores={[makeStore()]} />);

    expect(cardLinks()[0]).toHaveAttribute("href", "/tienda/store-1");
  });

  it("puts the featured stores first and labels them Destacada", () => {
    render(
      <StoreShowcase
        stores={[
          makeStore({ id: "plain", name: "Tienda del barrio" }),
          makeStore({
            id: "star",
            name: "Tienda destacada",
            is_featured: true,
          }),
        ]}
      />,
    );

    expect(cardLinks().map((link) => link.textContent)).toEqual([
      "Tienda destacada",
      "Tienda del barrio",
    ]);
    expect(screen.getByText("Destacada")).toBeVisible();
  });

  it("shows the distance only when the database computed one", () => {
    render(
      <StoreShowcase
        stores={[
          makeStore({ id: "near", name: "Cerca", distance_m: 400 }),
          makeStore({ id: "unknown", name: "Sin dato", distance_m: null }),
        ]}
      />,
    );

    const near = screen.getByText("Cerca").closest("li");
    const unknown = screen.getByText("Sin dato").closest("li");

    expect(near).not.toBeNull();
    expect(unknown).not.toBeNull();
    expect(within(near as HTMLElement).getByText(/a 400 m/)).toBeVisible();
    expect(
      within(unknown as HTMLElement).queryByText(/^a /),
    ).not.toBeInTheDocument();
  });

  it("narrows the list as the client types", async () => {
    const user = userEvent.setup();
    render(
      <StoreShowcase
        stores={[
          makeStore(),
          makeStore({
            id: "store-2",
            name: "Fruver El Campo",
            store_type: "Fruver",
          }),
        ]}
      />,
    );

    await user.type(screen.getByLabelText("Buscar tiendas"), "fruver");

    expect(cardLinks()).toHaveLength(1);
    expect(cardLinks()[0]).toHaveTextContent("Fruver El Campo");
  });

  it("filters with the category chips", async () => {
    const user = userEvent.setup();
    render(
      <StoreShowcase
        stores={[
          makeStore(),
          makeStore({
            id: "store-2",
            name: "Fruver El Campo",
            store_type: "Fruver",
          }),
        ]}
      />,
    );

    const chips = screen.getByRole("group", { name: "Filtrar por categoría" });
    await user.click(within(chips).getByRole("button", { name: "Fruver" }));

    expect(cardLinks()).toHaveLength(1);
    expect(cardLinks()[0]).toHaveTextContent("Fruver El Campo");
    expect(
      within(chips).getByRole("button", { name: "Fruver" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("offers to clear the filters when nothing matches", async () => {
    const user = userEvent.setup();
    render(<StoreShowcase stores={[makeStore()]} />);

    await user.type(screen.getByLabelText("Buscar tiendas"), "droguería");

    expect(screen.getByText(/No encontramos tiendas/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(cardLinks()).toHaveLength(1);
  });
});
