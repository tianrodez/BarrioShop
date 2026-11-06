export type ProductStatus = "available" | "sold_out";

/**
 * The columns every catalog read needs. Kept here so the merchant panel and
 * the public profile cannot drift apart on what a product is.
 */
export const PRODUCT_COLUMNS =
  "id, store_id, name, description, price, category, photo_url, status, price_updated_at, created_at, updated_at, deleted_at";

export type ProductRecord = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  photo_url: string | null;
  status: ProductStatus;
  price_updated_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/**
 * How the availability of a product is named to a client (HU03 CA4). Both the
 * merchant panel and the public catalog must use the same words.
 */
export function productStatusLabel(status: ProductStatus): string {
  return status === "sold_out" ? "Agotado" : "Disponible";
}

export function formatProductPriceUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}
