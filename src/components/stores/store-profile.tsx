import { Clock, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StoreCatalog } from "@/components/order/store-catalog";
import { ReportDialog } from "@/components/reports/report-dialog";
import { StoreMarkersMap } from "@/components/stores/store-markers-map";
import type { ProductRecord } from "@/lib/product-catalog-model";
import type { StorePoint } from "@/lib/store-form-model";
import { storeTypeIcon } from "@/lib/store-type-icon";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

/* eslint-disable @next/next/no-img-element -- hosted Storage domains are project-specific. */

/**
 * The public view of a store (HU02 CA3): everything a neighbour needs to walk
 * there. It only ever exists for a published store, which the route enforces.
 */
export type PublicStoreProfile = {
  id: string;
  name: string;
  store_type: string;
  description: string | null;
  photo_url: string | null;
  address: string;
  barrio: string;
  upz: string | null;
  reference_place: string | null;
  whatsapp: string;
  opening_hours: string;
  /** The point the merchant marked (HU02 CA2); null only if it cannot be read. */
  point: StorePoint | null;
};

type StoreProfileProps = {
  store: PublicStoreProfile;
  products: ProductRecord[];
  /** The signed-in visitor, or null when browsing without an account (HU11). */
  reporterId: string | null;
};

export function StoreProfile({
  store,
  products,
  reporterId,
}: StoreProfileProps) {
  // HU05 CA4: the profile shows its own marker and the registered address.
  const markers = store.point
    ? [
        {
          id: store.id,
          name: store.name,
          address: store.address,
          latitude: store.point.latitude,
          longitude: store.point.longitude,
          photo_url: store.photo_url,
          store_type: store.store_type,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:flex-row sm:items-start">
        {store.photo_url ? (
          <img
            src={store.photo_url}
            alt={`Foto de ${store.name}`}
            width={112}
            height={112}
            className="h-28 w-28 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-muted text-4xl leading-none"
          >
            {storeTypeIcon(store.store_type)}
          </span>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="break-words text-3xl font-bold tracking-tight">
            {store.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {store.store_type} · {store.barrio}
          </p>
          {store.description ? (
            <p className="max-w-prose break-words text-sm">
              {store.description}
            </p>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Ubicación"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MapPin aria-hidden className="size-5 text-primary" />
          Ubicación y horario
        </h2>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <MapPin
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            <div>
              <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                Dirección
              </dt>
              <dd className="break-words">{store.address}</dd>
            </div>
          </div>

          {store.reference_place ? (
            <div className="flex gap-2">
              <MapPin
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div>
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                  Referencia
                </dt>
                <dd className="break-words">{store.reference_place}</dd>
              </div>
            </div>
          ) : null}

          {store.upz ? (
            <div className="flex gap-2">
              <MapPin
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div>
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                  UPZ
                </dt>
                <dd className="break-words">{store.upz}</dd>
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Clock
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div>
              <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                Horario
              </dt>
              <dd className="break-words">{store.opening_hours}</dd>
            </div>
          </div>
        </dl>

        <div className="overflow-hidden rounded-xl border">
          <StoreMarkersMap stores={markers} showProfileLink={false} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={buildWhatsAppUrl(store.whatsapp)}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ className: "h-11 rounded-full px-6" })}
        >
          <MessageCircle aria-hidden className="size-4" />
          Escribir por WhatsApp
        </a>
        <Link
          href="/directorio"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 rounded-full px-6",
          })}
        >
          Ver más tiendas del barrio
        </Link>
        {/* HU11 CA1: reporting a store is as visible as writing to it. */}
        <ReportDialog
          reporterId={reporterId}
          target="store"
          targetId={store.id}
          targetName={store.name}
        />
      </div>

      <section
        aria-labelledby="catalog-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="catalog-heading" className="text-xl font-bold">
          Catálogo ({products.length})
        </h2>

        {products.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-sm text-muted-foreground">
            Esta tienda todavía no tiene productos publicados.
          </p>
        ) : (
          // HU06 CA1: the same catalog is where the order is built, so the
          // quantity controls live here instead of on a page of their own.
          <StoreCatalog
            products={products}
            reporterId={reporterId}
            storeId={store.id}
          />
        )}
      </section>
    </div>
  );
}
