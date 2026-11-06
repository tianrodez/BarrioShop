import { cn } from "cn";
import { Clock, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  formatDistanceLabel,
  type DirectoryStore,
} from "@/lib/store-directory-model";
import { storeTypeIcon } from "@/lib/store-type-icon";

/**
 * One store, one card — the landing and the directory used to draw the same
 * object twice with different markup. The link is stretched over the whole
 * card, so the target a neighbour aims at is the card, not the words.
 */
export function StoreCard({
  store,
  className,
}: {
  store: DirectoryStore;
  className?: string;
}) {
  const place = store.reference_place?.trim() || store.address;
  const meta = [store.store_type, store.barrio].filter(Boolean).join(" · ");
  const distance =
    store.distance_m != null ? formatDistanceLabel(store.distance_m) : null;

  return (
    <li
      className={cn(
        "group relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft transition duration-200",
        "hover:-translate-y-0.5 hover:shadow-lift focus-within:ring-3 focus-within:ring-ring/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl leading-none"
        >
          {storeTypeIcon(store.store_type)}
        </span>
        {store.is_featured ? (
          <Badge className="gap-1 rounded-full bg-highlight px-2.5 py-1 text-highlight-foreground">
            <Star aria-hidden className="size-3 fill-current" />
            Destacada
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg leading-snug font-bold">
          <Link
            className="outline-none after:absolute after:inset-0 after:content-['']"
            href={`/tienda/${store.id}`}
          >
            {store.name}
          </Link>
        </h3>
        <p className="break-words text-sm text-muted-foreground">
          {meta}
          {distance ? (
            <>
              {" · "}
              <span className="tabular-nums">{distance}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-1.5 text-sm text-muted-foreground">
        <p className="flex items-start gap-1.5 break-words">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{place}</span>
        </p>
        <p className="flex items-start gap-1.5 break-words">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{store.opening_hours}</span>
        </p>
      </div>
    </li>
  );
}
