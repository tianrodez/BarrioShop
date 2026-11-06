export type StoreStatus = "pending" | "published" | "hidden" | "retired";

export type VerificationDocumentType =
  "rut" | "camara_comercio" | "recibo_servicio" | "fachada";

export type FormalizationDocumentType = "rut" | "camara_comercio";

export type StorePoint = {
  latitude: number;
  longitude: number;
};

export type StoreFormFields = {
  name: string;
  storeType: string;
  address: string;
  barrio: string;
  upz: string;
  referencePlace: string;
  whatsapp: string;
  openingHours: string;
};

export type StoreInsertPayload = {
  owner_id: string;
  name: string;
  store_type: string;
  address: string;
  barrio: string;
  upz: string;
  reference_place: string | null;
  whatsapp: string;
  opening_hours: string;
  location: string;
};

export function requiredVerificationDocuments(
  isFormalized: boolean,
  formalizationDocument: FormalizationDocumentType = "rut",
): VerificationDocumentType[] {
  return isFormalized
    ? [formalizationDocument]
    : ["recibo_servicio", "fachada"];
}

export function isValidStorePoint(
  point: StorePoint | null,
): point is StorePoint {
  return Boolean(
    point &&
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180,
  );
}

export function buildStoreInsertPayload(
  ownerId: string,
  fields: StoreFormFields,
  point: StorePoint,
): StoreInsertPayload {
  if (!isValidStorePoint(point)) {
    throw new Error("La ubicación de la tienda no es válida.");
  }

  const latitude = Number(point.latitude.toFixed(6));
  const longitude = Number(point.longitude.toFixed(6));

  return {
    owner_id: ownerId,
    name: fields.name.trim(),
    store_type: fields.storeType.trim(),
    address: fields.address.trim(),
    barrio: fields.barrio.trim(),
    upz: fields.upz.trim(),
    reference_place: fields.referencePlace.trim() || null,
    whatsapp: fields.whatsapp.replace(/\D/g, ""),
    opening_hours: fields.openingHours.trim(),
    location: `SRID=4326;POINT(${longitude} ${latitude})`,
  };
}

export function nextStoreVisibilityStatus(
  status: StoreStatus,
): "published" | "hidden" | null {
  if (status === "published") return "hidden";
  if (status === "hidden") return "published";
  return null;
}

export function storeStatusLabel(status: StoreStatus): string {
  switch (status) {
    case "pending":
      return "En revisión";
    case "published":
      return "Publicada";
    case "hidden":
      return "Oculta";
    case "retired":
      return "Retirada";
  }
}

/**
 * PostgREST serialises a `geography` column as hex EWKB, not as GeoJSON, and
 * the public profile reads the column directly. Layout: byte order, the uint32
 * type (with the SRID flag), the SRID when present, then two float64 —
 * longitude first, because PostGIS stores X then Y.
 */
function parseHexPoint(value: string): StorePoint | null {
  const hex = value.trim();
  if (hex.length < 42 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const littleEndian = view.getUint8(0) === 1;
  const type = view.getUint32(1, littleEndian);
  const hasSrid = (type & 0x20000000) !== 0;
  const baseType = type & 0x0fffffff;
  const offset = 5 + (hasSrid ? 4 : 0);

  if (baseType !== 1 || bytes.length < offset + 16) return null;

  const point = {
    longitude: view.getFloat64(offset, littleEndian),
    latitude: view.getFloat64(offset + 8, littleEndian),
  };

  return isValidStorePoint(point) ? point : null;
}

export function parseStorePoint(value: unknown): StorePoint | null {
  if (typeof value === "string") {
    const match = value.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
    if (match) {
      const point = {
        longitude: Number(match[1]),
        latitude: Number(match[2]),
      };
      return isValidStorePoint(point) ? point : null;
    }

    return parseHexPoint(value);
  }

  if (value && typeof value === "object" && "coordinates" in value) {
    const coordinates = (value as { coordinates?: unknown }).coordinates;
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      const point = {
        longitude: coordinates[0],
        latitude: coordinates[1],
      };
      return isValidStorePoint(point) ? point : null;
    }
  }

  return null;
}
