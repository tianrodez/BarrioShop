import { describe, expect, it } from "vitest";
import {
  buildStoreInsertPayload,
  isValidStorePoint,
  nextStoreVisibilityStatus,
  parseStorePoint,
  requiredVerificationDocuments,
} from "@/lib/store-form-model";

describe("store form model", () => {
  it("persists the selected map point as longitude then latitude", () => {
    expect(
      buildStoreInsertPayload(
        "owner-1",
        {
          name: "La Tiendita",
          storeType: "Tienda",
          address: "Calle 1 #2-3",
          barrio: "Castilla",
          upz: "Castilla",
          referencePlace: "Frente al parque",
          whatsapp: "573001112233",
          openingHours: "Lunes a sábado, 8:00 a. m. a 7:00 p. m.",
        },
        { latitude: 4.625, longitude: -74.151 },
      ),
    ).toEqual({
      owner_id: "owner-1",
      name: "La Tiendita",
      store_type: "Tienda",
      address: "Calle 1 #2-3",
      barrio: "Castilla",
      upz: "Castilla",
      reference_place: "Frente al parque",
      whatsapp: "573001112233",
      opening_hours: "Lunes a sábado, 8:00 a. m. a 7:00 p. m.",
      location: "SRID=4326;POINT(-74.151 4.625)",
    });
  });

  it("accepts inclusive geographic coordinate limits and rejects out-of-range points", () => {
    expect(isValidStorePoint({ latitude: -90, longitude: -180 })).toBe(true);
    expect(isValidStorePoint({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidStorePoint({ latitude: -90.0001, longitude: 0 })).toBe(false);
    expect(isValidStorePoint({ latitude: 90.0001, longitude: 0 })).toBe(false);
    expect(isValidStorePoint({ latitude: 0, longitude: -180.0001 })).toBe(
      false,
    );
    expect(isValidStorePoint({ latitude: 0, longitude: 180.0001 })).toBe(false);
  });

  it("requires the formalization document or both informal business proofs", () => {
    expect(requiredVerificationDocuments(true, "rut")).toEqual(["rut"]);
    expect(requiredVerificationDocuments(true, "camara_comercio")).toEqual([
      "camara_comercio",
    ]);
    expect(requiredVerificationDocuments(false)).toEqual([
      "recibo_servicio",
      "fachada",
    ]);
  });

  it("allows owners to toggle only published and hidden stores", () => {
    expect(nextStoreVisibilityStatus("published")).toBe("hidden");
    expect(nextStoreVisibilityStatus("hidden")).toBe("published");
    expect(nextStoreVisibilityStatus("pending")).toBeNull();
    expect(nextStoreVisibilityStatus("retired")).toBeNull();
  });
});

describe("parseStorePoint (HU05 CA4)", () => {
  // The exact bytes PostgREST returns for a `geography` column with no cast.
  const EWKB = "0101000020E610000046B6F3FDD48852C0840D4FAF94651240";

  it("reads the EWKB hex PostgREST sends for a geography column", () => {
    const point = parseStorePoint(EWKB);

    expect(point).not.toBeNull();
    expect(point?.longitude).toBeCloseTo(-74.138, 6);
    expect(point?.latitude).toBeCloseTo(4.5992, 6);
  });

  it("still reads WKT with its SRID prefix", () => {
    const point = parseStorePoint("SRID=4326;POINT(-74.138 4.5992)");

    expect(point?.longitude).toBeCloseTo(-74.138, 6);
    expect(point?.latitude).toBeCloseTo(4.5992, 6);
  });

  it("still reads the GeoJSON object", () => {
    const point = parseStorePoint({ coordinates: [-74.138, 4.5992] });

    expect(point?.longitude).toBeCloseTo(-74.138, 6);
    expect(point?.latitude).toBeCloseTo(4.5992, 6);
  });

  it("refuses a value that is not a point instead of guessing", () => {
    expect(parseStorePoint("no-es-un-punto")).toBeNull();
    expect(parseStorePoint("0101000020E6100000")).toBeNull();
    expect(parseStorePoint(null)).toBeNull();
  });
});
