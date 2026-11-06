import {
  addToCart,
  cartStorageKey,
  parseCartQuantities,
  removeProductFromCart,
  serializeCartQuantities,
  setCartQuantity,
  type CartQuantities,
} from "@/lib/order-model";
import type { ProductRecord } from "@/lib/product-catalog-model";

/**
 * The pending order lives in the browser (HU06), keyed per store so a shop
 * never sees a neighbour's cart. localStorage is the single source of truth:
 * React reads it through `useSyncExternalStore`, which is how a value that only
 * exists in the browser reaches the screen without a hydration mismatch — the
 * server snapshot is always the empty cart, and the real one arrives with the
 * first client snapshot.
 *
 * The parsed value is cached against the raw string so repeated reads return the
 * same object identity, which is what `useSyncExternalStore` requires.
 */

const EMPTY_CART: CartQuantities = {};
const cache = new Map<string, { raw: string | null; value: CartQuantities }>();
const listeners = new Set<() => void>();

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEmptyCartSnapshot(): CartQuantities {
  return EMPTY_CART;
}

export function getCartSnapshot(storeId: string): CartQuantities {
  if (typeof window === "undefined") return EMPTY_CART;

  const raw = window.localStorage.getItem(cartStorageKey(storeId));
  const cached = cache.get(storeId);
  if (cached && cached.raw === raw) return cached.value;

  const value = parseCartQuantities(raw);
  cache.set(storeId, { raw, value });
  return value;
}

function commit(storeId: string, next: CartQuantities): void {
  window.localStorage.setItem(
    cartStorageKey(storeId),
    serializeCartQuantities(next),
  );
  for (const listener of listeners) listener();
}

export function addProductToCart(
  storeId: string,
  product: Pick<ProductRecord, "id" | "status">,
): void {
  commit(storeId, addToCart(getCartSnapshot(storeId), product));
}

export function setProductQuantity(
  storeId: string,
  productId: string,
  quantity: number,
): void {
  commit(
    storeId,
    setCartQuantity(getCartSnapshot(storeId), productId, quantity),
  );
}

export function removeProduct(storeId: string, productId: string): void {
  commit(storeId, removeProductFromCart(getCartSnapshot(storeId), productId));
}

export function clearCart(storeId: string): void {
  commit(storeId, {});
}
