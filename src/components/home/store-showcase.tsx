"use client";

import { cn } from "cn";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StoreCard } from "@/components/stores/store-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyDirectoryFilters,
  collectStoreTypeOptions,
  EMPTY_DIRECTORY_FILTERS,
  hasActiveDirectoryFilters,
  orderFeaturedFirst,
  type DirectoryFilters,
  type DirectoryStore,
} from "@/lib/store-directory-model";

/**
 * The mockup's landing: a search box, the category chips and the store cards,
 * which are also the directory preview. The filtering is the same model the
 * directory uses (HU04 CA2), so the text a client types means the same thing
 * in both places, and featured stores keep coming first (HU07 CA3).
 */
export function StoreShowcase({ stores }: { stores: DirectoryStore[] }) {
  const [filters, setFilters] = useState<DirectoryFilters>(
    EMPTY_DIRECTORY_FILTERS,
  );

  const categories = useMemo(() => collectStoreTypeOptions(stores), [stores]);
  const visibleStores = useMemo(
    () => orderFeaturedFirst(applyDirectoryFilters(stores, filters)),
    [stores, filters],
  );
  const filtering = hasActiveDirectoryFilters(filters);

  function selectCategory(storeType: string) {
    setFilters((current) => ({ ...current, storeType }));
  }

  return (
    <section aria-labelledby="showcase-heading" className="flex flex-col gap-6">
      <h2 id="showcase-heading" className="sr-only">
        Tiendas de Kennedy
      </h2>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Buscar tiendas"
            className="h-13 rounded-full border-transparent bg-card pr-4 pl-12 shadow-soft"
            id="home-search"
            onChange={(event) => {
              const query = event.currentTarget.value;
              setFilters((current) => ({ ...current, query }));
            }}
            placeholder="Busca una tienda, barrio o categoría…"
            value={filters.query}
          />
        </div>

        <div
          aria-label="Filtrar por categoría"
          className="flex flex-wrap gap-2"
          role="group"
        >
          <CategoryChip
            active={filters.storeType === ""}
            label="Todas"
            onClick={() => selectCategory("")}
          />
          {categories.map((category) => (
            <CategoryChip
              active={filters.storeType === category}
              key={category}
              label={category}
              onClick={() => selectCategory(category)}
            />
          ))}
        </div>
      </div>

      {visibleStores.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center">
          <p className="text-muted-foreground">
            No encontramos tiendas con esos filtros.
          </p>
          {filtering ? (
            <Button
              onClick={() => setFilters(EMPTY_DIRECTORY_FILTERS)}
              size="sm"
              variant="outline"
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p
            aria-live="polite"
            className="text-sm text-muted-foreground tabular-nums"
          >
            {visibleStores.length}{" "}
            {visibleStores.length === 1 ? "tienda" : "tiendas"}
            {filtering ? " con esos filtros" : " abiertas en Kennedy"}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleStores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "border bg-card text-foreground hover:bg-muted",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
