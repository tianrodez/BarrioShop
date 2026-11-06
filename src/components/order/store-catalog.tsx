"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { OrderLines } from "@/components/order/order-lines";
import { useOrderCart } from "@/components/order/use-order-cart";
import { ReportDialog } from "@/components/reports/report-dialog";
import { formatCOP } from "@/lib/currency";
import {
  formatProductPriceUpdatedAt,
  productStatusLabel,
  type ProductRecord,
} from "@/lib/product-catalog-model";

/* eslint-disable @next/next/no-img-element -- hosted Storage domains are project-specific. */

const EMPTY_ORDER_MESSAGE = "Aún no has agregado productos.";

/**
 * The catalog a neighbour browses, now with the order controls HU06 asks for.
 *
 * Adding is what makes the "agotado" state meaningful for a client: a sold-out
 * product stays visible with its label and offers no way into the order
 * (HU03 CA4, HU06 CA1). The pending total is calculated here and on the order
 * step, always from the prices this page is showing (HU06 CA2).
 */
export function StoreCatalog({
  storeId,
  products,
  reporterId,
}: {
  storeId: string;
  products: ProductRecord[];
  /** The signed-in visitor, or null when browsing without an account (HU11). */
  reporterId: string | null;
}) {
  const { lines, total, units, add, changeQuantity, clear } = useOrderCart(
    storeId,
    products,
  );

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {products.map((product) => (
          <li
            className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:flex-row sm:items-start"
            key={product.id}
          >
            {product.photo_url ? (
              <img
                alt={`Foto de ${product.name}`}
                className="h-24 w-24 shrink-0 rounded-xl object-cover"
                height={96}
                src={product.photo_url}
                width={96}
              />
            ) : null}
            <div
              className="flex min-w-0 flex-1 flex-col gap-1.5"
              role="group"
              aria-label={product.name}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="break-words text-lg leading-snug font-bold">
                  {product.name}
                </h3>
                <Badge
                  className={
                    product.status === "sold_out"
                      ? "rounded-full bg-muted text-muted-foreground"
                      : "rounded-full bg-primary/10 text-primary"
                  }
                >
                  {productStatusLabel(product.status)}
                </Badge>
              </div>

              <p className="text-xl font-semibold tabular-nums">
                {formatCOP(product.price)}
              </p>
              <p className="text-sm text-muted-foreground">
                {product.category}
              </p>
              {product.description ? (
                <p className="break-words text-sm">{product.description}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Última actualización de precio:{" "}
                {formatProductPriceUpdatedAt(product.price_updated_at)}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                {product.status === "available" ? (
                  <Button
                    aria-label={`Agregar ${product.name} al pedido`}
                    className="h-9 rounded-full px-4"
                    onClick={() => add(product)}
                    size="sm"
                  >
                    Agregar al pedido
                  </Button>
                ) : null}

                {/* HU11 CA1: every product offers the visible Reportar option. */}
                <ReportDialog
                  reporterId={reporterId}
                  target="product"
                  targetId={product.id}
                  targetName={product.name}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section
        aria-label="Tu pedido"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft"
      >
        <h3 className="text-lg font-bold">
          Tu pedido {units > 0 ? `(${units})` : ""}
        </h3>

        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{EMPTY_ORDER_MESSAGE}</p>
        ) : (
          <>
            <OrderLines lines={lines} onQuantityChange={changeQuantity} />
            <p className="border-t pt-3 text-lg font-semibold tabular-nums">
              Total: {formatCOP(total)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className={buttonVariants({
                  className: "h-11 rounded-full px-6",
                })}
                href={`/pedido/${storeId}`}
              >
                Continuar pedido
              </Link>
              <Button
                className="rounded-full"
                onClick={clear}
                size="sm"
                type="button"
                variant="ghost"
              >
                Vaciar pedido
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
