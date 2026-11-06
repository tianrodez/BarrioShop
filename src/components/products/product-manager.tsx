"use client";

/* eslint-disable @next/next/no-img-element -- hosted Storage domains are project-specific. */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressProductImage } from "@/lib/compress-product-image";
import { formatCOP } from "@/lib/currency";
import {
  formatProductPriceUpdatedAt,
  PRODUCT_COLUMNS,
  productStatusLabel,
  type ProductRecord,
} from "@/lib/product-catalog-model";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  parseProductFields,
  type ProductFieldErrors,
} from "@/lib/product-form-schema";

const PRODUCT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProductManagerProps = {
  ownerId: string;
  storeId: string;
  products: ProductRecord[];
};

function randomImageName(file: File): string {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const extension =
    file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  return `${id}.${extension}`;
}

function FieldMessage({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs font-medium text-destructive" id={id}>
      {message}
    </p>
  );
}

export function ProductManager({
  ownerId,
  storeId,
  products: initialProducts,
}: ProductManagerProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(
    null,
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProductFieldErrors>({});

  function cancelEditing() {
    setEditingProduct(null);
    setPhotoFile(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const parsed = parseProductFields({
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      description: String(formData.get("description") ?? ""),
      price: formData.get("price"),
      status: formData.get("status"),
    });
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      setErrorMessage(parsed.firstMessage);
      return;
    }

    const {
      name,
      description,
      category,
      price,
      status: statusValue,
    } = parsed.values;
    setFieldErrors({});

    if (!editingProduct?.photo_url && !photoFile) {
      setErrorMessage("Agrega una foto del producto.");
      return;
    }
    if (photoFile && !PRODUCT_IMAGE_TYPES.has(photoFile.type)) {
      setErrorMessage("La foto debe estar en formato JPG, PNG o WebP.");
      return;
    }

    setPending(true);
    setErrorMessage(null);
    setStatusMessage(null);
    const supabase = createSupabaseBrowserClient();
    let uploadedPath: string | null = null;

    try {
      let photoUrl = editingProduct?.photo_url ?? null;
      if (photoFile) {
        const compressedPhoto = await compressProductImage(photoFile);
        const path = `${ownerId}/${storeId}/products/${randomImageName(compressedPhoto)}`;
        const { data, error: uploadError } = await supabase.storage
          .from("store-photos")
          .upload(path, compressedPhoto, {
            cacheControl: "3600",
            contentType: compressedPhoto.type,
            upsert: false,
          });
        if (uploadError || !data) {
          throw uploadError ?? new Error("No se pudo cargar la foto.");
        }
        uploadedPath = data.path;
        const { data: publicData } = supabase.storage
          .from("store-photos")
          .getPublicUrl(data.path);
        photoUrl = publicData.publicUrl;
      }

      const productPayload = {
        name,
        description: description || null,
        price,
        category,
        photo_url: photoUrl,
        status: statusValue,
      };

      if (editingProduct) {
        const { data, error } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", editingProduct.id)
          .eq("store_id", storeId)
          .select(PRODUCT_COLUMNS)
          .maybeSingle<ProductRecord>();
        if (error || !data) {
          throw (
            error ?? new Error("No encontramos este producto en tu tienda.")
          );
        }
        setProducts((current) =>
          current.map((product) => (product.id === data.id ? data : product)),
        );
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert({ ...productPayload, store_id: storeId })
          .select(PRODUCT_COLUMNS)
          .single<ProductRecord>();
        if (error || !data) {
          throw error ?? new Error("No se pudo guardar el producto.");
        }
        setProducts((current) => [data, ...current]);
      }

      setEditingProduct(null);
      setPhotoFile(null);
      setStatusMessage("Producto guardado.");
      router.refresh();
    } catch (submitError) {
      if (uploadedPath) {
        try {
          await supabase.storage.from("store-photos").remove([uploadedPath]);
        } catch {
          // Keep the original save error visible if best-effort cleanup fails.
        }
      }
      setErrorMessage(
        submitError instanceof Error
          ? submitError.message
          : "No pudimos guardar el producto. Inténtalo de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  async function removeProduct(product: ProductRecord) {
    if (pending) return;
    setPending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", product.id)
        .eq("store_id", storeId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle<{ id: string }>();
      if (error || !data) {
        throw error ?? new Error("No encontramos este producto en tu tienda.");
      }

      setProducts((current) =>
        current.filter((currentProduct) => currentProduct.id !== product.id),
      );
      if (editingProduct?.id === product.id) cancelEditing();
      setStatusMessage("Producto eliminado. Los reportes se conservan.");
      router.refresh();
    } catch (removeError) {
      setErrorMessage(
        removeError instanceof Error
          ? removeError.message
          : "No pudimos eliminar el producto. Inténtalo de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        key={editingProduct?.id ?? "new"}
        aria-label="Producto"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:p-6"
        noValidate
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-bold">
            {editingProduct ? "Editar producto" : "Agregar producto"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Precio del día, categoría y una foto clara. Lo que cambies se ve en
            la tienda al instante.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-name">Nombre del producto</Label>
            <Input
              aria-describedby={
                fieldErrors.name ? "product-name-error" : undefined
              }
              aria-invalid={fieldErrors.name ? true : undefined}
              defaultValue={editingProduct?.name ?? ""}
              id="product-name"
              maxLength={80}
              minLength={2}
              name="name"
              required
            />
            <FieldMessage id="product-name-error" message={fieldErrors.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-category">Categoría</Label>
            <Input
              aria-describedby={
                fieldErrors.category ? "product-category-error" : undefined
              }
              aria-invalid={fieldErrors.category ? true : undefined}
              defaultValue={editingProduct?.category ?? ""}
              id="product-category"
              maxLength={40}
              minLength={2}
              name="category"
              required
            />
            <FieldMessage
              id="product-category-error"
              message={fieldErrors.category}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-price">Precio</Label>
            <Input
              aria-describedby={
                fieldErrors.price ? "product-price-error" : undefined
              }
              aria-invalid={fieldErrors.price ? true : undefined}
              defaultValue={editingProduct?.price ?? ""}
              id="product-price"
              min="1"
              name="price"
              required
              step="1"
              type="number"
            />
            <FieldMessage
              id="product-price-error"
              message={fieldErrors.price}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-status">Estado</Label>
            <select
              id="product-status"
              name="status"
              defaultValue={editingProduct?.status ?? "available"}
              className="h-11 rounded-xl border bg-background px-3.5 text-base md:text-sm"
            >
              <option value="available">
                {productStatusLabel("available")}
              </option>
              <option value="sold_out">{productStatusLabel("sold_out")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="product-description">Descripción (opcional)</Label>
            <textarea
              aria-describedby={
                fieldErrors.description
                  ? "product-description-error"
                  : undefined
              }
              aria-invalid={fieldErrors.description ? true : undefined}
              className="min-h-24 rounded-xl border bg-background px-3.5 py-2.5 text-base md:text-sm"
              defaultValue={editingProduct?.description ?? ""}
              id="product-description"
              name="description"
              rows={3}
            />
            <FieldMessage
              id="product-description-error"
              message={fieldErrors.description}
            />
          </div>
          <div className="sm:col-span-2">
            <FileField
              accept="image/jpeg,image/png,image/webp"
              existingUrl={editingProduct?.photo_url ?? null}
              file={photoFile}
              hint={
                "Acepta hasta 5 MB; la imagen se optimiza a 500 KB antes de subirla." +
                (editingProduct?.photo_url
                  ? " Elige otra solo si quieres reemplazar la foto actual."
                  : "")
              }
              id="product-photo"
              label="Foto del producto"
              onFile={setPhotoFile}
              required={!editingProduct?.photo_url}
            />
          </div>
        </div>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            className="h-11 rounded-full px-6"
            type="submit"
            disabled={pending}
          >
            {pending
              ? "Guardando…"
              : editingProduct
                ? "Guardar cambios"
                : "Guardar producto"}
          </Button>
          {editingProduct ? (
            <Button
              className="h-11 rounded-full px-5"
              type="button"
              variant="outline"
              disabled={pending}
              onClick={cancelEditing}
            >
              Cancelar edición
            </Button>
          ) : null}
        </div>
      </form>

      <section
        aria-labelledby="products-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="products-heading" className="font-heading text-xl font-bold">
          Productos ({products.length})
        </h2>
        {statusMessage ? (
          <p role="status" className="text-sm text-muted-foreground">
            {statusMessage}
          </p>
        ) : null}
        {products.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Todavía no tienes productos. Agrega el primero a tu catálogo.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {products.map((product) => (
              <li
                key={product.id}
                className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:flex-row sm:p-5"
              >
                {product.photo_url ? (
                  <img
                    src={product.photo_url}
                    alt={`Foto de ${product.name}`}
                    width={112}
                    height={112}
                    className="h-28 w-28 shrink-0 rounded-xl object-cover"
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="break-words font-semibold">
                      {product.name}
                    </h3>
                    <span
                      className={
                        product.status === "sold_out"
                          ? "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                          : "rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      }
                    >
                      {productStatusLabel(product.status)}
                    </span>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCOP(product.price)}
                  </p>
                  <p className="break-words text-sm text-muted-foreground">
                    {product.category}
                    {product.description ? ` · ${product.description}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Última actualización de precio:{" "}
                    {formatProductPriceUpdatedAt(product.price_updated_at)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      aria-label={`Editar ${product.name}`}
                      onClick={() => {
                        setEditingProduct(product);
                        setPhotoFile(null);
                        setErrorMessage(null);
                        setStatusMessage(null);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      aria-label={`Eliminar ${product.name}`}
                      onClick={() => void removeProduct(product)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
