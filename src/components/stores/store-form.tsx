"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationPicker } from "@/components/stores/location-picker";
import { FileField } from "@/components/ui/file-field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  parseStoreFields,
  type StoreFieldErrors,
} from "@/lib/store-form-schema";
import {
  buildStoreInsertPayload,
  requiredVerificationDocuments,
  type FormalizationDocumentType,
  type StoreFormFields,
  type StorePoint,
  type StoreStatus,
  type VerificationDocumentType,
} from "@/lib/store-form-model";

const STORE_PHOTO_LIMIT = 500 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_TYPES = new Set(["application/pdf", ...IMAGE_TYPES]);

export type StoreEditorRecord = StoreFormFields & {
  id: string;
  status: StoreStatus;
  photoUrl: string | null;
  point: StorePoint | null;
};

type StoreFormProps = {
  ownerId: string;
  initialStore?: StoreEditorRecord | null;
  verificationDocuments?: VerificationDocumentType[];
};

function fileExtension(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "pdf";
}

function randomObjectName(file: File): string {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${id}.${fileExtension(file)}`;
}

function getFormFields(formData: FormData): StoreFormFields {
  return {
    name: String(formData.get("name") ?? "").trim(),
    storeType: String(formData.get("store_type") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    barrio: String(formData.get("barrio") ?? "").trim(),
    upz: String(formData.get("upz") ?? "").trim(),
    referencePlace: String(formData.get("reference_place") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    openingHours: String(formData.get("opening_hours") ?? "").trim(),
  };
}

function FieldMessage({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs font-medium text-destructive" id={id}>
      {message}
    </p>
  );
}

export function StoreForm({
  ownerId,
  initialStore = null,
  verificationDocuments = [],
}: StoreFormProps) {
  const router = useRouter();
  const [point, setPoint] = useState<StorePoint | null>(
    initialStore?.point ?? null,
  );
  const [formalized, setFormalized] = useState(
    verificationDocuments.some(
      (type) => type === "rut" || type === "camara_comercio",
    ),
  );
  const [formalizationDocument, setFormalizationDocument] =
    useState<FormalizationDocumentType>(
      verificationDocuments.includes("camara_comercio")
        ? "camara_comercio"
        : "rut",
    );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [verificationFiles, setVerificationFiles] = useState<
    Partial<Record<VerificationDocumentType, File>>
  >({});
  const [savedDocumentTypes, setSavedDocumentTypes] = useState<
    VerificationDocumentType[]
  >(verificationDocuments);
  const [photoUrl, setPhotoUrl] = useState(initialStore?.photoUrl ?? null);
  const [createdStoreId, setCreatedStoreId] = useState(
    initialStore?.id ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<StoreFieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requiredDocuments = requiredVerificationDocuments(
    formalized,
    formalizationDocument,
  );

  function setVerificationFile(type: VerificationDocumentType, file?: File) {
    setVerificationFiles((current) => ({ ...current, [type]: file }));
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const missingDocument = requiredDocuments.find(
      (type) => !savedDocumentTypes.includes(type) && !verificationFiles[type],
    );
    if (!point) {
      setErrorMessage("Marca la ubicación de tu tienda en el mapa.");
      return;
    }
    if (!photoUrl && !photoFile) {
      setErrorMessage("Agrega una foto de la tienda para continuar.");
      return;
    }
    if (photoFile && !IMAGE_TYPES.has(photoFile.type)) {
      setErrorMessage("La foto debe estar en formato JPG, PNG o WebP.");
      return;
    }
    if (photoFile && photoFile.size > STORE_PHOTO_LIMIT) {
      setErrorMessage("La foto debe pesar máximo 500 KB.");
      return;
    }
    if (missingDocument) {
      setErrorMessage("Carga todos los soportes solicitados para tu negocio.");
      return;
    }
    const invalidDocument = requiredDocuments
      .map((type) => verificationFiles[type])
      .find((file) => file && !DOCUMENT_TYPES.has(file.type));
    if (invalidDocument) {
      setErrorMessage("Los soportes deben ser PDF, JPG, PNG o WebP.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const parsed = parseStoreFields(getFormFields(formData));
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      setErrorMessage(parsed.firstMessage);
      return;
    }

    const fields = parsed.fields;
    setFieldErrors({});
    setPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    const supabase = createSupabaseBrowserClient();
    let storeId = createdStoreId;

    try {
      const storePayload = buildStoreInsertPayload(ownerId, fields, point);
      if (!storeId) {
        const { data, error } = await supabase
          .from("stores")
          .insert(storePayload)
          .select("id, status")
          .single<{ id: string; status: StoreStatus }>();
        if (error || !data)
          throw error ?? new Error("No se pudo crear la tienda.");
        storeId = data.id;
        setCreatedStoreId(storeId);
      } else {
        const { data, error } = await supabase
          .from("stores")
          .update(storePayload)
          .eq("id", storeId)
          .eq("owner_id", ownerId)
          .select("id")
          .maybeSingle<{ id: string }>();
        if (error || !data) {
          throw (
            error ??
            new Error("No encontramos una tienda tuya para actualizar.")
          );
        }
      }

      if (photoFile && storeId) {
        const photoPath = `${ownerId}/${storeId}/photo/${randomObjectName(photoFile)}`;
        const { error: uploadError } = await supabase.storage
          .from("store-photos")
          .upload(photoPath, photoFile, {
            cacheControl: "3600",
            contentType: photoFile.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("store-photos")
          .getPublicUrl(photoPath);
        const { data: updatedStore, error: photoUpdateError } = await supabase
          .from("stores")
          .update({ photo_url: data.publicUrl })
          .eq("id", storeId)
          .eq("owner_id", ownerId)
          .select("id")
          .maybeSingle<{ id: string }>();
        if (photoUpdateError || !updatedStore) {
          await supabase.storage.from("store-photos").remove([photoPath]);
          throw (
            photoUpdateError ??
            new Error("No se pudo asociar la foto a la tienda.")
          );
        }
        setPhotoUrl(data.publicUrl);
        setPhotoFile(null);
      }

      const newDocuments = requiredDocuments.filter(
        (type) => !savedDocumentTypes.includes(type) && verificationFiles[type],
      );
      if (newDocuments.length > 0 && storeId) {
        const uploadedPaths: string[] = [];
        try {
          const rows = [];
          for (const docType of newDocuments) {
            const file = verificationFiles[docType];
            if (!file) continue;
            const storagePath = `${ownerId}/${storeId}/${docType}/${randomObjectName(file)}`;
            const { data, error: uploadError } = await supabase.storage
              .from("store-verifications")
              .upload(storagePath, file, {
                cacheControl: "3600",
                contentType: file.type,
                upsert: false,
              });
            if (uploadError || !data)
              throw uploadError ?? new Error("No se pudo cargar un soporte.");
            uploadedPaths.push(data.path);
            rows.push({
              store_id: storeId,
              doc_type: docType,
              storage_path: data.path,
            });
          }
          const { error: metadataError } = await supabase
            .from("store_verifications")
            .insert(rows);
          if (metadataError) throw metadataError;
          setSavedDocumentTypes((current) => [...current, ...newDocuments]);
        } catch (documentError) {
          if (uploadedPaths.length > 0) {
            await supabase.storage
              .from("store-verifications")
              .remove(uploadedPaths);
          }
          throw documentError;
        }
      }

      setSuccessMessage(
        initialStore && initialStore.status !== "pending"
          ? "Cambios guardados en el perfil de tu tienda."
          : "Tienda guardada. Quedó En revisión.",
      );
      router.push("/panel");
      router.refresh();
    } catch (submitError) {
      setErrorMessage(
        submitError instanceof Error
          ? submitError.message
          : "No pudimos guardar la tienda. Inténtalo de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <section className="grid gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:grid-cols-2 sm:p-6">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <h2 className="font-heading text-xl font-bold">Datos del negocio</h2>
          <p className="text-sm text-muted-foreground">
            Así te encuentran los vecinos: el nombre, dónde estás y cómo te
            escriben.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-name">Nombre de la tienda</Label>
          <Input
            aria-describedby={fieldErrors.name ? "store-name-error" : undefined}
            aria-invalid={fieldErrors.name ? true : undefined}
            defaultValue={initialStore?.name ?? ""}
            id="store-name"
            maxLength={80}
            minLength={2}
            name="name"
            required
          />
          <FieldMessage id="store-name-error" message={fieldErrors.name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-type">Tipo de comercio</Label>
          <Input
            aria-describedby={
              fieldErrors.storeType ? "store-type-error" : undefined
            }
            aria-invalid={fieldErrors.storeType ? true : undefined}
            defaultValue={initialStore?.storeType ?? ""}
            id="store-type"
            maxLength={40}
            minLength={2}
            name="store_type"
            placeholder="Panadería, tienda, fruver…"
            required
          />
          <FieldMessage id="store-type-error" message={fieldErrors.storeType} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="store-address">Dirección</Label>
          <Input
            aria-describedby={
              fieldErrors.address ? "store-address-error" : undefined
            }
            aria-invalid={fieldErrors.address ? true : undefined}
            defaultValue={initialStore?.address ?? ""}
            id="store-address"
            name="address"
            required
          />
          <FieldMessage
            id="store-address-error"
            message={fieldErrors.address}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-barrio">Barrio</Label>
          <Input
            aria-describedby={
              fieldErrors.barrio ? "store-barrio-error" : undefined
            }
            aria-invalid={fieldErrors.barrio ? true : undefined}
            defaultValue={initialStore?.barrio ?? ""}
            id="store-barrio"
            name="barrio"
            required
          />
          <FieldMessage id="store-barrio-error" message={fieldErrors.barrio} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-upz">UPZ</Label>
          <Input
            aria-describedby={fieldErrors.upz ? "store-upz-error" : undefined}
            aria-invalid={fieldErrors.upz ? true : undefined}
            defaultValue={initialStore?.upz ?? ""}
            id="store-upz"
            name="upz"
            required
          />
          <FieldMessage id="store-upz-error" message={fieldErrors.upz} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="store-reference">
            Punto de referencia (opcional)
          </Label>
          <Input
            aria-describedby={
              fieldErrors.referencePlace ? "store-reference-error" : undefined
            }
            aria-invalid={fieldErrors.referencePlace ? true : undefined}
            defaultValue={initialStore?.referencePlace ?? ""}
            id="store-reference"
            name="reference_place"
          />
          <FieldMessage
            id="store-reference-error"
            message={fieldErrors.referencePlace}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-whatsapp">WhatsApp</Label>
          <Input
            aria-describedby={
              fieldErrors.whatsapp
                ? "store-whatsapp-error"
                : "store-whatsapp-hint"
            }
            aria-invalid={fieldErrors.whatsapp ? true : undefined}
            autoComplete="tel"
            defaultValue={initialStore?.whatsapp ?? ""}
            id="store-whatsapp"
            inputMode="numeric"
            name="whatsapp"
            placeholder="573001112233"
            required
            type="tel"
          />
          <FieldMessage
            id="store-whatsapp-error"
            message={fieldErrors.whatsapp}
          />
          <p className="text-sm text-muted-foreground" id="store-whatsapp-hint">
            Incluye el indicativo del país; por ejemplo, 573001112233.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="store-hours">Horario de atención</Label>
          <Input
            aria-describedby={
              fieldErrors.openingHours ? "store-hours-error" : undefined
            }
            aria-invalid={fieldErrors.openingHours ? true : undefined}
            defaultValue={initialStore?.openingHours ?? ""}
            id="store-hours"
            name="opening_hours"
            required
          />
          <FieldMessage
            id="store-hours-error"
            message={fieldErrors.openingHours}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-bold">Ubicación</h2>
          <p className="text-sm text-muted-foreground">
            Marca el punto exacto de tu local. Solo se puede marcar dentro de
            Kennedy.
          </p>
        </div>
        <LocationPicker point={point} onChange={setPoint} />
        {point ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p aria-live="polite">
              Punto marcado: {point.latitude.toFixed(5)},{" "}
              {point.longitude.toFixed(5)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPoint(null)}
            >
              Quitar ubicación
            </Button>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-bold">
            Foto y verificación
          </h2>
          <p className="text-sm text-muted-foreground">
            Una foto clara de la fachada y el soporte que demuestre que el local
            existe. Solo lo ve el equipo que revisa la tienda.
          </p>
        </div>
        <FileField
          accept="image/jpeg,image/png,image/webp"
          existingUrl={photoUrl}
          file={photoFile}
          hint={
            photoUrl && !photoFile
              ? "La tienda ya tiene una foto. Elige otra solo si quieres reemplazarla."
              : undefined
          }
          id="store-photo"
          label="Foto de la tienda"
          maxSize={STORE_PHOTO_LIMIT}
          onFile={setPhotoFile}
          required={!photoUrl}
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">
            ¿Tu negocio está formalizado?
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={
                formalized
                  ? "flex cursor-pointer items-start gap-3 rounded-xl border border-primary bg-primary/5 p-3.5 text-sm"
                  : "flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3.5 text-sm transition-colors hover:border-primary/40"
              }
            >
              <input
                aria-label="Sí, está formalizado"
                type="radio"
                name="formalized"
                checked={formalized}
                className="mt-0.5"
                onChange={() => setFormalized(true)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Sí, está formalizado</span>
                <span className="text-xs text-muted-foreground">
                  RUT o Cámara de Comercio.
                </span>
              </span>
            </label>
            <label
              className={
                !formalized
                  ? "flex cursor-pointer items-start gap-3 rounded-xl border border-primary bg-primary/5 p-3.5 text-sm"
                  : "flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3.5 text-sm transition-colors hover:border-primary/40"
              }
            >
              <input
                aria-label="No está formalizado"
                type="radio"
                name="formalized"
                checked={!formalized}
                className="mt-0.5"
                onChange={() => setFormalized(false)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">No está formalizado</span>
                <span className="text-xs text-muted-foreground">
                  Recibo de servicio público y foto de la fachada.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {formalized ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="formalization-type">Tipo de soporte</Label>
              <select
                id="formalization-type"
                value={formalizationDocument}
                onChange={(event) =>
                  setFormalizationDocument(
                    event.currentTarget.value as FormalizationDocumentType,
                  )
                }
                className="h-11 rounded-xl border bg-background px-3.5 text-base md:text-sm"
              >
                <option value="rut">RUT</option>
                <option value="camara_comercio">Cámara de Comercio</option>
              </select>
            </div>
            {!savedDocumentTypes.includes(formalizationDocument) ? (
              <FileField
                accept="application/pdf,image/jpeg,image/png,image/webp"
                file={verificationFiles[formalizationDocument] ?? null}
                id="formalization-file"
                label="Documento de formalización"
                onFile={(file) =>
                  setVerificationFile(formalizationDocument, file ?? undefined)
                }
                required
              />
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                El soporte de formalización ya está cargado.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["recibo_servicio", "Recibo de servicio público"],
                ["fachada", "Foto de la fachada con la dirección visible"],
              ] as const
            ).map(([docType, label]) =>
              savedDocumentTypes.includes(docType) ? (
                <p
                  key={docType}
                  role="status"
                  className="text-sm text-muted-foreground"
                >
                  {label}: soporte ya cargado.
                </p>
              ) : (
                <FileField
                  key={docType}
                  accept={
                    docType === "fachada"
                      ? "image/jpeg,image/png,image/webp"
                      : "application/pdf,image/jpeg,image/png,image/webp"
                  }
                  file={verificationFiles[docType] ?? null}
                  id={`verification-${docType}`}
                  label={label}
                  onFile={(file) =>
                    setVerificationFile(docType, file ?? undefined)
                  }
                  required
                />
              ),
            )}
          </div>
        )}
      </section>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p role="status" className="text-sm text-green-700">
          {successMessage}
        </p>
      ) : null}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-lift backdrop-blur">
        <p className="text-sm text-muted-foreground">
          Al guardar, tu tienda queda en revisión.
        </p>
        <Button
          className="h-11 rounded-full px-7"
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando tienda…" : "Guardar tienda"}
        </Button>
      </div>
    </form>
  );
}
