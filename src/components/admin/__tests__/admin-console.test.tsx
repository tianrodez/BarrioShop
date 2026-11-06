import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminConsole,
  type FeatureableStoreRow,
  type OpenReportRow,
  type PendingStoreRow,
} from "@/components/admin/admin-console";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ rpc }),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const pendingStores: PendingStoreRow[] = [
  {
    id: "store-pending",
    name: "Miscelánea La Esquina",
    store_type: "Tienda",
    barrio: "Tintal",
    address: "Cra 86 #42-10",
    reference_place: "Al lado de la panadería",
    whatsapp: "573001112233",
    opening_hours: "Lun a Sáb 7:00-20:00",
  },
];

const openReports: OpenReportRow[] = [
  {
    id: "report-store",
    target: "store",
    reason: "La dirección no existe",
    store_id: "store-2",
    product_id: null,
    store_name: "Fruver El Campo",
    product_name: null,
  },
  {
    id: "report-product",
    target: "product",
    reason: "El precio que muestra es falso",
    store_id: null,
    product_id: "product-9",
    store_name: "Panadería La Espiga",
    product_name: "Pan campesino 500 g",
  },
];

const publishedStores: FeatureableStoreRow[] = [
  {
    id: "store-1",
    name: "Panadería La Espiga",
    barrio: "Castilla",
    is_featured: false,
  },
  {
    id: "store-2",
    name: "Fruver El Campo",
    barrio: "Tintal",
    is_featured: true,
  },
];

function renderConsole() {
  return render(
    <AdminConsole
      openReports={openReports}
      pendingStores={pendingStores}
      publishedStores={publishedStores}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null });
});

describe("AdminConsole", () => {
  it("shows the stores waiting for review with the data the admin checks (HU09 CA3)", () => {
    renderConsole();

    const section = screen.getByRole("region", { name: "Tiendas en revisión" });
    expect(within(section).getByText("Miscelánea La Esquina")).toBeVisible();
    expect(within(section).getByText(/Cra 86 #42-10/)).toBeVisible();
    expect(
      within(section).getByRole("button", {
        name: "Aprobar Miscelánea La Esquina",
      }),
    ).toBeVisible();
  });

  it("publishes a store when the admin approves it (HU09 CA3)", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(
      screen.getByRole("button", { name: "Aprobar Miscelánea La Esquina" }),
    );

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_review_store", {
        p_store_id: "store-pending",
        p_approve: true,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText("Miscelánea La Esquina"),
      ).not.toBeInTheDocument(),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("asks what the merchant must fix before rejecting a store (HU09 CA3)", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(
      screen.getByRole("button", { name: "Rechazar Miscelánea La Esquina" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/qué debe corregir/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("approves without sending a note (HU09 CA3)", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(
      screen.getByRole("button", { name: "Aprobar Miscelánea La Esquina" }),
    );

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect("p_note" in (rpc.mock.calls[0][1] as Record<string, unknown>)).toBe(
      false,
    );
  });

  it("sends the correction note, trimmed, with the rejection (HU09 CA3)", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.type(
      screen.getByLabelText("Motivo del rechazo para Miscelánea La Esquina"),
      "   La dirección no coincide con el recibo   ",
    );
    await user.click(
      screen.getByRole("button", { name: "Rechazar Miscelánea La Esquina" }),
    );

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_review_store", {
        p_store_id: "store-pending",
        p_approve: false,
        p_note: "La dirección no coincide con el recibo",
      }),
    );
  });

  it("lists the open reports with what was reported (HU11 CA2)", () => {
    renderConsole();

    const section = screen.getByRole("region", { name: "Reportes abiertos" });
    expect(within(section).getByText(/Fruver El Campo/)).toBeVisible();
    expect(within(section).getByText(/Pan campesino 500 g/)).toBeVisible();
    expect(within(section).getByText("La dirección no existe")).toBeVisible();
  });

  it("resolves a report the admin confirmed (HU11 CA2)", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(
      screen.getByRole("button", {
        name: "Resolver reporte de Fruver El Campo",
      }),
    );

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_resolve_report", {
        p_report_id: "report-store",
        p_status: "resolved",
      }),
    );
  });

  it("rejects a report that does not hold up (HU11 CA2)", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(
      screen.getByRole("button", {
        name: "Rechazar reporte de Fruver El Campo",
      }),
    );

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_resolve_report", {
        p_report_id: "report-store",
        p_status: "rejected",
      }),
    );
  });

  it("can hide a reported product without losing the report (HU11 CA2)", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(
      screen.getByRole("button", {
        name: "Quitar producto reportado: Pan campesino 500 g",
      }),
    );

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_remove_product", {
        p_product_id: "product-9",
      }),
    );
    // The report row stays readable: the product was removed logically.
    expect(
      screen.getByText("El precio que muestra es falso"),
    ).toBeInTheDocument();
  });

  it("can unpublish a store with repeated confirmed reports (HU11 CA3)", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(
      screen.getByRole("button", {
        name: "Retirar tienda reportada: Fruver El Campo",
      }),
    );

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_retire_store", {
        p_store_id: "store-2",
      }),
    );
  });

  it("marks a published store as featured (HU07 CA3)", async () => {
    const user = userEvent.setup();
    renderConsole();

    const featured = screen.getByRole("checkbox", {
      name: "Destacar Panadería La Espiga",
    });
    expect(featured).not.toBeChecked();

    await user.click(featured);

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_set_featured", {
        p_store_id: "store-1",
        p_featured: true,
      }),
    );
    expect(featured).toBeChecked();
  });

  it("keeps the store under review when the approval fails (HU09 CA4)", async () => {
    rpc.mockResolvedValue({ error: new Error("administrator role required") });
    const user = userEvent.setup();
    renderConsole();

    await user.click(
      screen.getByRole("button", { name: "Aprobar Miscelánea La Esquina" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /No pudimos completar la acción/,
    );
    expect(screen.getByText("Miscelánea La Esquina")).toBeVisible();
  });
});
