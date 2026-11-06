import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoreForm } from "@/components/stores/store-form";

const {
  fnPush,
  fnRefresh,
  storeInsert,
  storeSingle,
  storeUpdate,
  verificationInsert,
  storageUpload,
  storageRemove,
  publicUrl,
} = vi.hoisted(() => ({
  fnPush: vi.fn(),
  fnRefresh: vi.fn(),
  storeInsert: vi.fn(),
  storeSingle: vi.fn(),
  storeUpdate: vi.fn(),
  verificationInsert: vi.fn(),
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
  publicUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: fnPush, refresh: fnRefresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    from: (table: string) =>
      table === "stores"
        ? {
            insert: storeInsert,
            update: storeUpdate,
          }
        : { insert: verificationInsert },
    storage: {
      from: (bucket: string) => ({
        upload: storageUpload,
        getPublicUrl: publicUrl,
        remove: (paths: string[]) => storageRemove(bucket, paths),
      }),
    },
  }),
}));

vi.mock("@/components/stores/location-picker", () => ({
  LocationPicker: ({
    onChange,
  }: {
    onChange: (point: { latitude: number; longitude: number }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange({ latitude: 4.625, longitude: -74.151 })}
    >
      Marcar ubicación de prueba
    </button>
  ),
}));

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre de la tienda"), "La Tiendita");
  await user.type(screen.getByLabelText("Tipo de comercio"), "Tienda");
  await user.type(screen.getByLabelText("Dirección"), "Calle 1 #2-3");
  await user.type(screen.getByLabelText("Barrio"), "Castilla");
  await user.type(screen.getByLabelText("UPZ"), "Castilla");
  await user.type(screen.getByLabelText("WhatsApp"), "573001112233");
  await user.type(
    screen.getByLabelText("Horario de atención"),
    "Lunes a sábado, 8:00 a. m. a 7:00 p. m.",
  );
  await user.upload(
    screen.getByLabelText("Foto de la tienda"),
    new File(["photo"], "tienda.png", { type: "image/png" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Marcar ubicación de prueba" }),
  );
}

describe("StoreForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeSingle.mockResolvedValue({
      data: { id: "store-1", status: "pending" },
      error: null,
    });
    storeInsert.mockReturnValue({
      select: () => ({ single: storeSingle }),
    });
    storeUpdate.mockReturnValue({
      eq: () => ({
        eq: () => ({ select: () => ({ maybeSingle: storeSingle }) }),
        select: () => ({ maybeSingle: storeSingle }),
      }),
    });
    storageUpload.mockImplementation((path: string) => ({
      data: { path },
      error: null,
    }));
    publicUrl.mockReturnValue({
      data: { publicUrl: "https://project.supabase.co/store-photo.png" },
    });
    verificationInsert.mockResolvedValue({ data: null, error: null });
  });

  it("creates a pending store with its selected point and private proof", async () => {
    const user = userEvent.setup();
    render(<StoreForm ownerId="owner-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByLabelText("Sí, está formalizado"));
    await user.selectOptions(screen.getByLabelText("Tipo de soporte"), "rut");
    await user.upload(
      screen.getByLabelText("Documento de formalización"),
      new File(["rut"], "rut.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar tienda" }));

    await waitFor(() => expect(storeInsert).toHaveBeenCalledTimes(1));
    expect(storeInsert).toHaveBeenCalledWith({
      owner_id: "owner-1",
      name: "La Tiendita",
      store_type: "Tienda",
      address: "Calle 1 #2-3",
      barrio: "Castilla",
      upz: "Castilla",
      reference_place: null,
      whatsapp: "573001112233",
      opening_hours: "Lunes a sábado, 8:00 a. m. a 7:00 p. m.",
      location: "SRID=4326;POINT(-74.151 4.625)",
    });
    expect(storeInsert.mock.calls[0][0]).not.toHaveProperty("status");
    expect(storageUpload).toHaveBeenCalledTimes(2);
    expect(storeUpdate).toHaveBeenCalledWith({
      photo_url: "https://project.supabase.co/store-photo.png",
    });
    expect(verificationInsert).toHaveBeenCalledWith([
      expect.objectContaining({ store_id: "store-1", doc_type: "rut" }),
    ]);
    expect(
      await screen.findByText("Tienda guardada. Quedó En revisión."),
    ).toHaveAttribute("role", "status");
    expect(fnPush).toHaveBeenCalledWith("/panel");
    expect(fnRefresh).toHaveBeenCalledOnce();
  });

  it("does not submit without a map point", async () => {
    const user = userEvent.setup();
    render(<StoreForm ownerId="owner-1" />);
    await fillRequiredFields(user);

    fireEvent.click(screen.getByRole("button", { name: "Quitar ubicación" }));
    await user.click(screen.getByRole("button", { name: "Guardar tienda" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Marca la ubicación de tu tienda en el mapa.",
    );
    expect(storeInsert).not.toHaveBeenCalled();
  });

  it("requires both utility-bill and facade proofs for an informal business", async () => {
    const user = userEvent.setup();
    render(<StoreForm ownerId="owner-1" />);
    await fillRequiredFields(user);
    await user.upload(
      screen.getByLabelText("Recibo de servicio público"),
      new File(["bill"], "recibo.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar tienda" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Carga todos los soportes solicitados",
    );
    expect(storeInsert).not.toHaveBeenCalled();

    await user.upload(
      screen.getByLabelText("Foto de la fachada con la dirección visible"),
      new File(["facade"], "fachada.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar tienda" }));

    await waitFor(() => expect(verificationInsert).toHaveBeenCalledTimes(1));
    expect(verificationInsert).toHaveBeenCalledWith([
      expect.objectContaining({ doc_type: "recibo_servicio" }),
      expect.objectContaining({ doc_type: "fachada" }),
    ]);
  });

  it("removes uploaded verification files when metadata insertion fails", async () => {
    verificationInsert.mockResolvedValue({
      data: null,
      error: new Error("Metadata insert failed"),
    });
    const user = userEvent.setup();
    render(<StoreForm ownerId="owner-1" />);

    await fillRequiredFields(user);
    await user.click(screen.getByLabelText("Sí, está formalizado"));
    await user.selectOptions(screen.getByLabelText("Tipo de soporte"), "rut");
    await user.upload(
      screen.getByLabelText("Documento de formalización"),
      new File(["rut"], "rut.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar tienda" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Metadata insert failed",
    );
    const uploadedDocumentPath =
      verificationInsert.mock.calls[0][0][0].storage_path;
    expect(storageUpload).toHaveBeenCalledWith(
      uploadedDocumentPath,
      expect.any(File),
      expect.objectContaining({ upsert: false }),
    );
    expect(storageRemove).toHaveBeenCalledExactlyOnceWith(
      "store-verifications",
      [uploadedDocumentPath],
    );
    expect(uploadedDocumentPath).toMatch(/^owner-1\/store-1\/rut\//);
    expect(fnPush).not.toHaveBeenCalled();
    expect(fnRefresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
