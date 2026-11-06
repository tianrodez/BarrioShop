import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreDirectory } from "@/components/directory/store-directory";
import type { DirectoryStore } from "@/lib/store-directory-model";

const { rpc, from } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ rpc, from }),
}));

// The map itself is Leaflet behind a dynamic import; here we only assert that
// the markers it receives are the stores the client is currently looking at.
vi.mock("@/components/stores/store-markers-map", () => ({
  StoreMarkersMap: ({ stores }: { stores: unknown[] }) => (
    <div data-testid="markers-map" data-count={stores.length} />
  ),
}));

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
    distance_m: 350,
    latitude: 4.5996,
    longitude: -74.1377,
    ...overrides,
  };
}

const initialStores: DirectoryStore[] = [
  makeStore(),
  makeStore({
    id: "store-2",
    name: "Fruver El Campo",
    store_type: "Fruver",
    barrio: "Tintal",
    reference_place: null,
    distance_m: 1200,
  }),
];

function mockGeolocation(getCurrentPosition: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
    writable: true,
  });
}

describe("StoreDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: initialStores, error: null });
    from.mockImplementation(() => ({
      upsert: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }));
  });

  afterEach(() => {
    delete (navigator as { geolocation?: unknown }).geolocation;
    window.localStorage.clear();
  });

  it("shows the published stores the server already sent, with distances", () => {
    render(
      <StoreDirectory
        barrios={["Castilla", "Tintal"]}
        initialStores={initialStores}
      />,
    );

    expect(screen.getByText("Panadería La Espiga")).toBeVisible();
    expect(screen.getByText("Fruver El Campo")).toBeVisible();
    // HU10 CA2: the distance is a backup of the order, on every card.
    expect(screen.getByText("a 350 m")).toBeVisible();
    expect(screen.getByText("a 1,2 km")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Panadería La Espiga/ }),
    ).toHaveAttribute("href", "/tienda/store-1");
    // RNF-04: the first paint must not wait for a client round trip.
    expect(rpc).not.toHaveBeenCalled();
  });

  it("shows featured stores first with the Destacada badge (HU07 CA3)", () => {
    render(
      <StoreDirectory
        barrios={["Castilla", "Tintal"]}
        initialStores={[
          makeStore({ id: "plain", name: "Tienda del barrio" }),
          makeStore({
            id: "star",
            name: "Tienda destacada",
            is_featured: true,
          }),
        ]}
      />,
    );

    const cards = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/tienda/"))
      .map((link) => link.textContent);

    expect(cards).toEqual(["Tienda destacada", "Tienda del barrio"]);
    expect(screen.getByText("Destacada")).toBeVisible();
  });

  it("does not read the client location until it asks for it (HU10 CA1)", () => {
    const getCurrentPosition = vi.fn();
    mockGeolocation(getCurrentPosition);

    render(
      <StoreDirectory barrios={["Castilla"]} initialStores={initialStores} />,
    );

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("re-searches by proximity when the client shares the browser location", async () => {
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 4.5996, longitude: -74.1377 } });
    });
    mockGeolocation(getCurrentPosition);

    const user = userEvent.setup();
    render(
      <StoreDirectory barrios={["Castilla"]} initialStores={initialStores} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Buscar tiendas cerca" }),
    );

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("search_stores", {
        p_lat: 4.5996,
        p_lng: -74.1377,
      }),
    );
    // HU10 CA5: the position is only an argument of one read; nothing about it
    // is written to the database, and no alphabetical mode argument is mixed in.
    expect(from).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map((call) => call[1])).toEqual([
      { p_lat: 4.5996, p_lng: -74.1377 },
    ]);
  });

  it("asks for a barrio instead when the client denies the permission (HU10 CA3)", async () => {
    const getCurrentPosition = vi.fn((_ok, error) => {
      error({ code: 1 });
    });
    mockGeolocation(getCurrentPosition);

    const user = userEvent.setup();
    render(
      <StoreDirectory barrios={["Castilla"]} initialStores={initialStores} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Buscar tiendas cerca" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no pudimos obtener tu ubicaci[oó]n/i);
    expect(alert).toHaveTextContent(/elige tu barrio/i);
    expect(rpc).not.toHaveBeenCalled();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("orders by the chosen barrio reference when there is no location (HU10 CA3)", async () => {
    const user = userEvent.setup();
    render(
      <StoreDirectory
        barrios={["Castilla", "Tintal"]}
        initialStores={initialStores}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Barrio"), "Tintal");

    expect(rpc).toHaveBeenCalledWith("search_stores", { p_barrio: "Tintal" });
    expect(screen.getByText("Fruver El Campo")).toBeVisible();
    // HU04 CA2: the barrio filter keeps only the stores that match.
    expect(screen.queryByText("Panadería La Espiga")).not.toBeInTheDocument();
  });

  it("searches by text without another round trip and clears the filters (HU04 CA2-CA3)", async () => {
    const user = userEvent.setup();
    render(
      <StoreDirectory barrios={["Castilla"]} initialStores={initialStores} />,
    );

    await user.type(screen.getByLabelText("Buscar"), "espiga");
    expect(screen.getByText("Panadería La Espiga")).toBeVisible();
    expect(screen.queryByText("Fruver El Campo")).not.toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Buscar"));
    await user.type(screen.getByLabelText("Buscar"), "nada por aqui");
    expect(
      await screen.findByText(/no encontramos tiendas con esos filtros/i),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByText("Panadería La Espiga")).toBeVisible();
    expect(screen.getByText("Fruver El Campo")).toBeVisible();
  });

  it("filters by category (HU04 CA2)", async () => {
    const user = userEvent.setup();
    render(
      <StoreDirectory barrios={["Castilla"]} initialStores={initialStores} />,
    );

    expect(screen.getByTestId("markers-map")).toHaveAttribute(
      "data-count",
      "2",
    );

    await user.selectOptions(screen.getByLabelText("Categoría"), "Fruver");

    expect(screen.getByText("Fruver El Campo")).toBeVisible();
    expect(screen.queryByText("Panadería La Espiga")).not.toBeInTheDocument();
    // HU05 CA1: one marker per store the client is actually looking at.
    expect(screen.getByTestId("markers-map")).toHaveAttribute(
      "data-count",
      "1",
    );
  });

  it("keeps the whole Kennedy barrio list available and shows it alphabetically", () => {
    render(
      <StoreDirectory
        barrios={["Tintal", "Castilla", "Bavaria"]}
        initialStores={[]}
      />,
    );

    const barrioSelect = screen.getByLabelText("Barrio");
    expect(
      within(barrioSelect)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Todos los barrios", "Bavaria", "Castilla", "Tintal"]);
    expect(screen.getByText(/no hay tiendas publicadas/i)).toBeVisible();
  });

  it("surfaces a failed proximity search without losing the current list", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("rls") });
    mockGeolocation(
      vi.fn((success) =>
        success({ coords: { latitude: 4.6, longitude: -74.15 } }),
      ),
    );

    const user = userEvent.setup();
    render(
      <StoreDirectory barrios={["Castilla"]} initialStores={initialStores} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Buscar tiendas cerca" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no pudimos buscar tiendas cerca/i,
    );
    // The list the client could already read stays on screen.
    expect(screen.getByText("Panadería La Espiga")).toBeVisible();
  });
});
