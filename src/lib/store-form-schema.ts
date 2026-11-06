import { z } from "zod";
import type { StoreFormFields } from "@/lib/store-form-model";

/**
 * The store profile is the one form a merchant fills without help (HU02), so
 * every rule lives in one schema instead of a chain of `if`s in the component:
 * the same messages reach the field that failed, and the tests can exercise the
 * contract without rendering the form.
 *
 * Lengths mirror the column contract and the input attributes; the WhatsApp
 * rule is the one from HU02 CA1 (country code plus digits, separators allowed).
 */
export const storeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de la tienda (mínimo 2 caracteres).")
    .max(80, "El nombre no puede pasar de 80 caracteres."),
  storeType: z
    .string()
    .trim()
    .min(2, "Dinos qué tipo de comercio es (mínimo 2 caracteres).")
    .max(40, "El tipo de comercio no puede pasar de 40 caracteres."),
  address: z
    .string()
    .trim()
    .min(5, "Escribe la dirección del local (calle, número y barrio)."),
  barrio: z.string().trim().min(2, "Indica el barrio donde está la tienda."),
  upz: z.string().trim().min(2, "Indica la UPZ de la tienda."),
  referencePlace: z
    .string()
    .trim()
    .max(120, "El punto de referencia no puede pasar de 120 caracteres."),
  whatsapp: z
    .string()
    .trim()
    .refine(
      (value) => /^[0-9]{8,15}$/.test(value.replace(/\D/g, "")),
      "Escribe un WhatsApp con indicativo de país y solo dígitos.",
    ),
  openingHours: z.string().trim().min(3, "Escribe el horario de atención."),
});

export type StoreFieldErrors = Partial<Record<keyof StoreFormFields, string>>;

export type StoreFieldsResult =
  | { success: true; fields: StoreFormFields }
  | { success: false; errors: StoreFieldErrors; firstMessage: string };

/** Parse the FormData shape into field errors, never throwing. */
export function parseStoreFields(input: StoreFormFields): StoreFieldsResult {
  const parsed = storeFormSchema.safeParse(input);
  if (parsed.success) return { success: true, fields: parsed.data };

  const errors: StoreFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key as keyof StoreFormFields] = issue.message;
    }
  }

  return {
    success: false,
    errors,
    firstMessage:
      parsed.error.issues[0]?.message ??
      "Completa todos los campos obligatorios del perfil.",
  };
}
