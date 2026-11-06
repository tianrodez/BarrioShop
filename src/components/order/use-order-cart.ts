"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  addProductToCart,
  clearCart,
  getCartSnapshot,
  getEmptyCartSnapshot,
  setProductQuantity,
  subscribeCart,
} from "@/lib/order-cart-store";
import { computeCartTotal, resolveCartLines } from "@/lib/order-model";
import type { ProductRecord } from "@/lib/product-catalog-model";

/**
 * The pending order of one store (HU06 CA1).
 *
 * Only the quantities live in the browser, under a key per store, so two shops
 * never share a cart and a neighbour can order without an account. Prices are
 * never stored here: they come from the catalog the server just rendered, so a
 * merchant's price change is what the client sees and sends, not a remembered
 * number, and a product that went agotado or was removed stops being part of
 * the order (HU03 CA4, HU06 CA1).
 */
export function useOrderCart(
  storeId: string,
  products: readonly ProductRecord[],
) {
  const quantities = useSyncExternalStore(
    subscribeCart,
    () => getCartSnapshot(storeId),
    getEmptyCartSnapshot,
  );

  const lines = useMemo(
    () => resolveCartLines(products, quantities),
    [products, quantities],
  );
  const total = useMemo(() => computeCartTotal(lines), [lines]);
  const units = useMemo(
    () => lines.reduce((count, line) => count + line.quantity, 0),
    [lines],
  );
  const dropped = useMemo(
    () =>
      Object.keys(quantities).filter(
        (productId) => !lines.some((line) => line.product.id === productId),
      ).length,
    [quantities, lines],
  );

  const add = useCallback(
    (product: ProductRecord) => addProductToCart(storeId, product),
    [storeId],
  );
  const changeQuantity = useCallback(
    (productId: string, quantity: number) =>
      setProductQuantity(storeId, productId, quantity),
    [storeId],
  );
  const clear = useCallback(() => clearCart(storeId), [storeId]);

  return { lines, total, units, dropped, add, changeQuantity, clear };
}
