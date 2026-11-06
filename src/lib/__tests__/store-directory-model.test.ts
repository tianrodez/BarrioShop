import { describe, expect, it } from "vitest";
import {
  applyDirectoryFilters,
  buildSearchStoresParams,
  collectStoreTypeOptions,
  EMPTY_DIRECTORY_FILTERS,
  formatDistanceLabel,
  hasActiveDirectoryFilters,
  orderFeaturedFirst,
  resolveProximityMode,
  type DirectoryStore,
} from "@/lib/store-directory-model";

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
    distance_m: 120,
    latitude: 4.5996,
    longitude: -74.1377,
    ...overrides,
  };
}

describe("resolveProximityMode (HU10 CA1-CA4)", () => {
  it("orders by browser location only once the client shared it", () => {
    expect(
      resolveProximityMode({
        location: { latitude: 4.6, longitude: -74.15 },
        barrio: "Tintal",
      }),
    ).toBe("location");
  });

  it("falls back to the chosen barrio reference point", () => {
    expect(resolveProximityMode({ location: null, barrio: "Tintal" })).toBe(
      "barrio",
    );
  });

  it("stays alphabetical with neither location nor barrio", () => {
    expect(resolveProximityMode({ location: null, barrio: "" })).toBe(
      "alphabetical",
    );
  });
});

describe("buildSearchStoresParams", () => {
  it("never sends coordinates the client did not share", () => {
    expect(
      buildSearchStoresParams({ location: null, barrio: "Tintal" }),
    ).toEqual({ p_barrio: "Tintal" });
  });

  it("sends coordinates when the client granted the browser permission", () => {
    expect(
      buildSearchStoresParams({
        location: { latitude: 4.5996, longitude: -74.1377 },
        barrio: "Tintal",
      }),
    ).toEqual({ p_lat: 4.5996, p_lng: -74.1377 });
  });

  it("sends no proximity argument in alphabetical mode", () => {
    expect(buildSearchStoresParams({ location: null, barrio: "" })).toEqual({});
  });
});

describe("formatDistanceLabel (HU10 CA2)", () => {
  it("shows metres below one kilometre", () => {
    expect(formatDistanceLabel(350)).toBe("a 350 m");
  });

  it("never renders a zero kilometre distance", () => {
    expect(formatDistanceLabel(0)).toBe("a menos de 100 m");
    expect(formatDistanceLabel(40)).toBe("a menos de 100 m");
  });

  it("shows one decimal kilometres from one kilometre up", () => {
    expect(formatDistanceLabel(1200)).toBe("a 1,2 km");
    expect(formatDistanceLabel(9800)).toBe("a 9,8 km");
  });

  it("returns no label when the search had no reference point", () => {
    expect(formatDistanceLabel(null)).toBeNull();
  });
});

describe("applyDirectoryFilters (HU04 CA2-CA3)", () => {
  const rows = [
    makeStore(),
    makeStore({
      id: "store-2",
      name: "Fruver El Campo",
      store_type: "Fruver",
      barrio: "Tintal",
      reference_place: null,
    }),
    makeStore({
      id: "store-3",
      name: "Droguería Vital",
      store_type: "Droguería",
      barrio: "Bavaria",
      reference_place: null,
    }),
  ];

  it("keeps every published store with no filters", () => {
    expect(
      applyDirectoryFilters(rows, EMPTY_DIRECTORY_FILTERS).map((row) => row.id),
    ).toEqual(["store-1", "store-2", "store-3"]);
  });

  it("filters by barrio and keeps the proximity order it received", () => {
    const filtered = applyDirectoryFilters(rows, {
      ...EMPTY_DIRECTORY_FILTERS,
      barrio: "Tintal",
    });
    expect(filtered.map((row) => row.id)).toEqual(["store-2"]);
  });

  it("filters by free text over name, type, barrio and reference place", () => {
    expect(
      applyDirectoryFilters(rows, {
        ...EMPTY_DIRECTORY_FILTERS,
        query: "parque",
      }).map((row) => row.id),
    ).toEqual(["store-1"]);
    expect(
      applyDirectoryFilters(rows, {
        ...EMPTY_DIRECTORY_FILTERS,
        query: "  FRUVER  ",
      }).map((row) => row.id),
    ).toEqual(["store-2"]);
  });

  it("combines the category filter with text without losing the order", () => {
    expect(
      applyDirectoryFilters(
        [makeStore({ id: "a" }), makeStore({ id: "b", name: "Otra Espiga" })],
        { query: "espiga", barrio: "", storeType: "Panadería" },
      ).map((row) => row.id),
    ).toEqual(["a", "b"]);
  });

  it("returns nothing when no store matches, so the empty state can show", () => {
    expect(
      applyDirectoryFilters(rows, {
        query: "no existe",
        barrio: "Castilla",
        storeType: "",
      }),
    ).toEqual([]);
  });

  it("treats accents and case the way a neighbour types them", () => {
    expect(
      applyDirectoryFilters(rows, {
        ...EMPTY_DIRECTORY_FILTERS,
        query: "panaderia",
      }).map((row) => row.id),
    ).toEqual(["store-1"]);
  });
});

describe("hasActiveDirectoryFilters", () => {
  it("is false for the untouched filter bar", () => {
    expect(hasActiveDirectoryFilters(EMPTY_DIRECTORY_FILTERS)).toBe(false);
  });

  it("is true as soon as one filter narrows the list", () => {
    expect(
      hasActiveDirectoryFilters({
        ...EMPTY_DIRECTORY_FILTERS,
        barrio: "Tintal",
      }),
    ).toBe(true);
  });
});

describe("directory edge probes (HU04, HU05, HU10)", () => {
  const rows = [
    makeStore({
      id: "espiga",
      name: "Panadería La Espiga",
      store_type: "Panadería",
      barrio: "Kennedy Central",
    }),
    makeStore({
      id: "nearbuy",
      name: "NEARBUY",
      store_type: "Tienda",
      barrio: "Tintal",
      reference_place: null,
    }),
  ];

  it("matches a typed barrio without accents or capitals", () => {
    expect(
      applyDirectoryFilters(rows, {
        query: "",
        barrio: "kennedy central",
        storeType: "",
      }).map((row) => row.id),
    ).toEqual(["espiga"]);
  });

  it("matches a whole category and never a fragment of it", () => {
    expect(
      applyDirectoryFilters(rows, {
        query: "",
        barrio: "",
        storeType: "panaderia",
      }).map((row) => row.id),
    ).toEqual(["espiga"]);
    expect(
      applyDirectoryFilters(rows, {
        query: "",
        barrio: "",
        storeType: "Panader",
      }),
    ).toEqual([]);
  });

  it("requires every active filter to match, not just one", () => {
    expect(
      applyDirectoryFilters(rows, {
        query: "nearbuy",
        barrio: "Kennedy Central",
        storeType: "",
      }),
    ).toEqual([]);
    expect(
      applyDirectoryFilters(rows, {
        query: "nearbuy",
        barrio: "Tintal",
        storeType: "Tienda",
      }).map((row) => row.id),
    ).toEqual(["nearbuy"]);
  });

  it("treats a filter bar of only spaces as no filter at all", () => {
    expect(
      hasActiveDirectoryFilters({ query: "   ", barrio: "", storeType: "" }),
    ).toBe(false);
    expect(
      applyDirectoryFilters(rows, { query: "   ", barrio: "", storeType: "" }),
    ).toHaveLength(2);
  });

  it("sends the client coordinates and nothing else (HU10 CA5)", () => {
    expect(
      Object.keys(
        buildSearchStoresParams({
          location: { latitude: 4.5996, longitude: -74.1377 },
          barrio: "Tintal",
        }),
      ).sort(),
    ).toEqual(["p_lat", "p_lng"]);
  });

  it("labels the distance boundaries a neighbour reads (HU10 CA2)", () => {
    expect(formatDistanceLabel(99)).toBe("a menos de 100 m");
    expect(formatDistanceLabel(100)).toBe("a 100 m");
    expect(formatDistanceLabel(999)).toBe("a 999 m");
    expect(formatDistanceLabel(1000)).toBe("a 1,0 km");
    expect(formatDistanceLabel(Number.NaN)).toBeNull();
  });

  it("keeps the order the database produced when a filter narrows the list", () => {
    expect(
      applyDirectoryFilters(
        [
          makeStore({ id: "far", name: "Far Espiga", distance_m: 5000 }),
          makeStore({ id: "middle", name: "Middle Espiga", distance_m: 2000 }),
          makeStore({ id: "other", name: "Otra tienda", distance_m: 100 }),
        ],
        { query: "espiga", barrio: "", storeType: "" },
      ).map((row) => row.id),
    ).toEqual(["far", "middle"]);
  });

  it("lists only the categories the client can actually buy", () => {
    expect(collectStoreTypeOptions(rows)).toEqual(["Panadería", "Tienda"]);
  });
});

describe("orderFeaturedFirst (HU07 CA3)", () => {
  it("puts the featured stores above the rest", () => {
    expect(
      orderFeaturedFirst([
        makeStore({ id: "plain-a", name: "A" }),
        makeStore({ id: "star-b", name: "B", is_featured: true }),
        makeStore({ id: "plain-c", name: "C" }),
        makeStore({ id: "star-d", name: "D", is_featured: true }),
      ]).map((store) => store.id),
    ).toEqual(["star-b", "star-d", "plain-a", "plain-c"]);
  });

  it("keeps the proximity order inside each group", () => {
    // This is the order `search_stores` returns: nearest first.
    expect(
      orderFeaturedFirst([
        makeStore({ id: "near", name: "Cerca", distance_m: 100 }),
        makeStore({
          id: "star-nearer",
          name: "Destacada cerca",
          is_featured: true,
          distance_m: 500,
        }),
        makeStore({ id: "farther", name: "Lejos", distance_m: 2000 }),
        makeStore({
          id: "star-far",
          name: "Destacada lejos",
          is_featured: true,
          distance_m: 4000,
        }),
      ]).map((store) => store.id),
    ).toEqual(["star-nearer", "star-far", "near", "farther"]);
  });

  it("leaves the list untouched when nothing is featured", () => {
    const plain = [
      makeStore({ id: "a" }),
      makeStore({ id: "b" }),
      makeStore({ id: "c" }),
    ];

    expect(orderFeaturedFirst(plain)).toEqual(plain);
  });

  it("does not mutate the list the database sent", () => {
    const rows = [
      makeStore({ id: "plain" }),
      makeStore({ id: "star", is_featured: true }),
    ];
    const before = rows.map((store) => store.id);

    orderFeaturedFirst(rows);

    expect(rows.map((store) => store.id)).toEqual(before);
  });

  it("filters before partitioning, so a dropped featured store cannot resurface", () => {
    const rows = [
      makeStore({ id: "star-tintal", barrio: "Tintal", is_featured: true }),
      makeStore({ id: "plain-castilla", barrio: "Castilla" }),
    ];
    const filtered = applyDirectoryFilters(rows, {
      ...EMPTY_DIRECTORY_FILTERS,
      barrio: "Castilla",
    });

    expect(orderFeaturedFirst(filtered).map((store) => store.id)).toEqual([
      "plain-castilla",
    ]);
  });
});
