"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/currency";
import type { CartLine } from "@/lib/order-model";

/**
 * The lines of a pending order (HU06 CA1: "cambiar las cantidades antes de
 * enviar"). The store page and the order step show the same thing, so they
 * share one control set instead of inventing two.
 */
export function OrderLines({
  lines,
  onQuantityChange,
}: {
  lines: readonly CartLine[];
  onQuantityChange: (productId: string, quantity: number) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((line) => {
        const { product, quantity, lineTotal } = line;

        return (
          <li
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/60 p-3"
            key={product.id}
          >
            <span className="min-w-0 flex-1 basis-full break-words sm:basis-auto">
              {product.name}
            </span>

            <div className="flex items-center gap-2">
              <Button
                aria-label={`Disminuir cantidad de ${product.name}`}
                onClick={() => onQuantityChange(product.id, quantity - 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                −
              </Button>
              <Input
                aria-label={`Cantidad de ${product.name}`}
                className="h-9 w-16 text-center"
                min={1}
                onChange={(event) => {
                  // Read before updating: React may run the updater later.
                  const value = Number(event.currentTarget.value);
                  onQuantityChange(product.id, value);
                }}
                type="number"
                value={quantity}
              />
              <Button
                aria-label={`Aumentar cantidad de ${product.name}`}
                onClick={() => onQuantityChange(product.id, quantity + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                +
              </Button>
            </div>

            <span className="w-20 text-right font-medium tabular-nums">
              {formatCOP(lineTotal)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
