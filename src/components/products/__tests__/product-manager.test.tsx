import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductManager } from "@/components/products/product-manager";
import type { ProductRecord } from "@/lib/product-catalog-model";

const {
  routerRefresh,
  productInsert,
  productSingle,
  productUpdate,
  productMaybeSingle,
  storageUpload,
  storagePublicUrl,
  storageRemove,
} = vi.hoisted(() => ({
  routerRefresh: vi.fn(),
  productInsert: vi.fn(),
  productSingle: vi.fn(),
  productUpdate: vi.fn(),
  productMaybeSingle: vi.fn(),
  storageUpload: vi.fn(),
  storagePublicUrl: vi.fn(),
  storageRemove: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({ insert: productInsert, update: productUpdate }),
    storage: {
      from: () => ({
        upload: storageUpload,
        getPublicUrl: storagePublicUrl,
        remove: storageRemove,
      }),
    },
  }),
}));

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "product-1",
    store_id: "store-1",
    name: "Aguacate",
    description: null,
    price: 2500,
    category: "Verduras",
    photo_url: "https://project.supabase.co/aguacate.webp",
    status: "available",
    price_updated_at: "2026-11-04T12:00:00.000Z",
    created_at: "2026-11-04T12:00:00.000Z",
    updated_at: "2026-11-04T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeUpdateQuery() {
  const query = {
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: productMaybeSingle,
  };
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

describe("ProductManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productInsert.mockReturnValue({
      select: () => ({ single: productSingle }),
    });
    productUpdate.mockImplementation(() => makeUpdateQuery());
    productSingle.mockResolvedValue({ data: makeProduct(), error: null });
    productMaybeSingle.mockResolvedValue({ data: makeProduct(), error: null });
    storageUpload.mockImplementation(async (path: string) => ({
      data: { path },
      error: null,
    }));
    storagePublicUrl.mockReturnValue({
      data: { publicUrl: "https://project.supabase.co/new-product.webp" },
    });
  });

  it("creates a categorized product with an uploaded photo and optional description", async () => {
    const user = userEvent.setup();
    render(
      <ProductManager ownerId="owner-1" storeId="store-1" products={[]} />,
    );

    await user.type(screen.getByLabelText("Nombre del producto"), "Pepino");
    await user.type(screen.getByLabelText("Categoría"), "Verduras");
    await user.type(screen.getByLabelText("Precio"), "1200");
    await user.upload(
      screen.getByLabelText("Foto del producto"),
      new File(["image"], "pepino.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    await waitFor(() => expect(productInsert).toHaveBeenCalledOnce());
    expect(productInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store-1",
        name: "Pepino",
        description: null,
        price: 1200,
        category: "Verduras",
        photo_url: "https://project.supabase.co/new-product.webp",
        status: "available",
      }),
    );
    expect(storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^owner-1\/store-1\/products\//),
      expect.any(File),
      expect.objectContaining({ upsert: false, contentType: "image/png" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Producto guardado.",
    );
    expect(routerRefresh).toHaveBeenCalledOnce();
  });

  it("edits price and stock status and displays the price-change notice", async () => {
    const user = userEvent.setup();
    const original = makeProduct();
    productMaybeSingle.mockResolvedValue({
      data: makeProduct({ price: 3200, status: "sold_out" }),
      error: null,
    });
    render(
      <ProductManager
        ownerId="owner-1"
        storeId="store-1"
        products={[original]}
      />,
    );

    expect(screen.getByText(/Última actualización de precio:/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Editar Aguacate" }));
    await user.clear(screen.getByLabelText("Precio"));
    await user.type(screen.getByLabelText("Precio"), "3200");
    await user.selectOptions(screen.getByLabelText("Estado"), "sold_out");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(productUpdate).toHaveBeenCalled());
    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ price: 3200, status: "sold_out" }),
    );
    expect(productUpdate.mock.calls[0][0]).not.toHaveProperty(
      "price_updated_at",
    );
    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ photo_url: original.photo_url }),
    );
    expect(
      within(screen.getByRole("listitem")).getByText("Agotado"),
    ).toBeVisible();
    expect(screen.getByText("$3.200")).toBeVisible();
    expect(routerRefresh).toHaveBeenCalledOnce();
  });

  it("requires a photo before creating a product", async () => {
    const user = userEvent.setup();
    render(
      <ProductManager ownerId="owner-1" storeId="store-1" products={[]} />,
    );
    await user.type(screen.getByLabelText("Nombre del producto"), "Pepino");
    await user.type(screen.getByLabelText("Categoría"), "Verduras");
    await user.type(screen.getByLabelText("Precio"), "1200");
    fireEvent.submit(screen.getByRole("form", { name: "Producto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Agrega una foto del producto.",
    );
    expect(productInsert).not.toHaveBeenCalled();
  });

  it("removes an uploaded photo when product insertion fails", async () => {
    productSingle.mockResolvedValue({
      data: null,
      error: new Error("Product insert failed"),
    });
    const user = userEvent.setup();
    render(
      <ProductManager ownerId="owner-1" storeId="store-1" products={[]} />,
    );

    await user.type(screen.getByLabelText("Nombre del producto"), "Pepino");
    await user.type(screen.getByLabelText("Categoría"), "Verduras");
    await user.type(screen.getByLabelText("Precio"), "1200");
    await user.upload(
      screen.getByLabelText("Foto del producto"),
      new File(["image"], "pepino.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Product insert failed",
    );
    const uploadedPath = storageUpload.mock.calls[0][0];
    expect(storageRemove).toHaveBeenCalledExactlyOnceWith([uploadedPath]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("removes products logically and keeps the report relationship", async () => {
    const user = userEvent.setup();
    render(
      <ProductManager
        ownerId="owner-1"
        storeId="store-1"
        products={[makeProduct()]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Eliminar Aguacate" }));

    await waitFor(() =>
      expect(productUpdate).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Producto eliminado. Los reportes se conservan.",
    );
    expect(screen.queryByText("Aguacate")).not.toBeInTheDocument();
    expect(storageRemove).not.toHaveBeenCalled();
    expect(routerRefresh).toHaveBeenCalledOnce();
  });
});
