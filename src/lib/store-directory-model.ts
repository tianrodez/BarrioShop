import type { StorePoint } from "@/lib/store-form-model";

/**
 * Data contract for the client-facing directory (HU04, HU05, HU10).
 *
 * `search_stores` is the only source of ordering: the database computes the
 * distances (formulación §9) and falls back to the barrio reference point or
 * the alphabetical order when the client shared no location. Text, barrio and
 * category narrow that result in memory so the list reacts while typing, and
 * the client location never leaves the request that answers it (HU10 CA5).
 */
export type DirectoryStore = {
  id: string;
  name: string;
  store_type: string;
  barrio: string;
  address: string;
  reference_place: string | null;
  opening_hours: string;
  photo_url: string | null;
  is_featured: boolean;
  /** Rounded metres from the proximity reference, or null in alphabetical mode. */
  distance_m: number | null;
  latitude: number;
  longitude: number;
};

export type DirectoryFilters = {
  query: string;
  barrio: string;
  storeType: string;
};

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = {
  query: "",
  barrio: "",
  storeType: "",
};

export type ProximityMode = "location" | "barrio" | "alphabetical";

/**
 * HU10 CA1-CA4: a shared browser location always wins, an explicit barrio is
 * the documented fallback, and neither one leaves the list alphabetical.
 */
export function resolveProximityMode(args: {
  location: StorePoint | null;
  barrio: string;
}): ProximityMode {
  if (args.location) return "location";
  if (args.barrio.trim()) return "barrio";
  return "alphabetical";
}

/**
 * Arguments for the `search_stores` RPC. Coordinates are sent only when the
 * browser actually granted them: the client position is never persisted, it
 * only orders one response (HU10 CA5).
 */
export function buildSearchStoresParams(args: {
  location: StorePoint | null;
  barrio: string;
}): { p_lat?: number; p_lng?: number; p_barrio?: string } {
  const mode = resolveProximityMode(args);

  if (mode === "location" && args.location) {
    return { p_lat: args.location.latitude, p_lng: args.location.longitude };
  }
  if (mode === "barrio") {
    return { p_barrio: args.barrio.trim() };
  }
  return {};
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * HU04 CA2: the category filter, the barrio filter and the free-text search
 * keep only the stores that match all of them. The order sent by the database
 * is preserved, so the closest store stays first.
 */
export function applyDirectoryFilters(
  stores: readonly DirectoryStore[],
  filters: DirectoryFilters,
): DirectoryStore[] {
  const query = normalize(filters.query);
  const barrio = normalize(filters.barrio);
  const storeType = normalize(filters.storeType);

  return stores.filter((store) => {
    if (barrio && normalize(store.barrio) !== barrio) return false;
    if (storeType && normalize(store.store_type) !== storeType) return false;
    if (!query) return true;

    return [
      store.name,
      store.store_type,
      store.barrio,
      store.reference_place ?? "",
    ].some((field) => normalize(field).includes(query));
  });
}

/**
 * HU07 CA3: featured stores come first in the directory. This is a stable
 * partition — `search_stores` still owns the order inside each group, so the
 * closest store stays first among the featured ones and among the rest.
 */
export function orderFeaturedFirst(
  stores: readonly DirectoryStore[],
): DirectoryStore[] {
  const featured = stores.filter((store) => store.is_featured);
  const rest = stores.filter((store) => !store.is_featured);

  return [...featured, ...rest];
}

/** HU04 CA3: the empty state only offers to clear filters when some are set. */
export function hasActiveDirectoryFilters(filters: DirectoryFilters): boolean {
  return Boolean(
    filters.query.trim() || filters.barrio.trim() || filters.storeType.trim(),
  );
}

/**
 * HU10 CA2: the distance badge on every card. Below a kilometre the metres are
 * what a neighbour reads; under 100 m a rounded "a 0,0 km" would say nothing,
 * so it keeps the short form.
 */
export function formatDistanceLabel(distanceM: number | null): string | null {
  if (distanceM === null || !Number.isFinite(distanceM)) return null;
  if (distanceM < 100) return "a menos de 100 m";

  if (distanceM < 1000) {
    return `a ${Math.round(distanceM)} m`;
  }

  const kilometres = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(distanceM / 1000);
  return `a ${kilometres} km`;
}

/** Options for the filter bar, derived from what is actually open for sale. */
export function collectStoreTypeOptions(
  stores: readonly DirectoryStore[],
): string[] {
  return [...new Set(stores.map((store) => store.store_type))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
}
