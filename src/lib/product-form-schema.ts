import { z } from "zod";

/**
 * One schema for everything a merchant types in the catalog (HU03): the name,
 * the category, the price of the day and the availability. The price arrives as
 * a string from FormData, so it is coerced once here instead of in the
 * component, and `Number.isSafeInteger` becomes a real integer check.
 */
const price = z.preprocess(
  (value) => (typeof value === "string" ? Number(value.trim() || NaN) : value),
  z
    .number({ error: "Escribe un precio válido en pesos." })
    .int("El precio debe ser un número entero de pesos.")
    .min(1, "El precio debe ser mayor que cero."),
);

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe el nombre del producto (mínimo 2 caracteres).")
    .max(80, "El nombre no puede pasar de 80 caracteres."),
  category: z
    .string()
    .trim()
    .min(2, "Escribe la categoría (mínimo 2 caracteres).")
    .max(40, "La categoría no puede pasar de 40 caracteres."),
  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede pasar de 500 caracteres."),
  price,
  status: z.enum(["available", "sold_out"], {
    error: "Selecciona la disponibilidad del producto.",
  }),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export type ProductFieldErrors = Partial<
  Record<"name" | "category" | "description" | "price" | "status", string>
>;

export type ProductFieldsResult =
  | { success: true; values: ProductFormValues }
  | { success: false; errors: ProductFieldErrors; firstMessage: string };

export function parseProductFields(
  input: Record<string, unknown>,
): ProductFieldsResult {
  const parsed = productFormSchema.safeParse(input);
  if (parsed.success) return { success: true, values: parsed.data };

  const errors: ProductFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key as keyof ProductFieldErrors] = issue.message;
    }
  }

  return {
    success: false,
    errors,
    firstMessage:
      parsed.error.issues[0]?.message ??
      "Revisa el nombre, la categoría y el precio del producto.",
  };
}
