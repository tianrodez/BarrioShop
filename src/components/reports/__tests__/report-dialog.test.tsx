import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportDialog } from "@/components/reports/report-dialog";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ from }),
}));

let inserted: { table: string; row: unknown }[] = [];
let insertError: Error | null = null;

beforeEach(() => {
  inserted = [];
  insertError = null;
  from.mockImplementation((table: string) => ({
    insert: async (row: unknown) => {
      inserted.push({ table, row });
      return { error: insertError };
    },
  }));
});

function renderDialog(
  overrides: Partial<{
    target: "store" | "product";
    targetId: string;
    targetName: string;
    reporterId: string | null;
  }> = {},
) {
  return render(
    <ReportDialog
      reporterId="user-1"
      target="store"
      targetId="store-1"
      targetName="Panadería La Espiga"
      {...overrides}
    />,
  );
}

describe("ReportDialog (HU11 CA1)", () => {
  it("always shows a Reportar option for the thing being viewed", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: "Reportar Panadería La Espiga" }),
    ).toBeVisible();
  });

  it("asks an anonymous visitor to sign in instead of writing a report", async () => {
    const user = userEvent.setup();
    renderDialog({ reporterId: null });

    await user.click(
      screen.getByRole("button", { name: "Reportar Panadería La Espiga" }),
    );

    expect(screen.getByText(/Inicia sesión para reportar/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Iniciar sesión/ }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.queryByRole("button", { name: "Enviar reporte" }),
    ).not.toBeInTheDocument();
    expect(inserted).toHaveLength(0);
  });

  it.each([
    [4, false],
    [5, true],
    [1000, true],
    [1001, false],
  ])(
    "matches the column CHECK for a %i-character reason",
    async (length, allowed) => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(
        screen.getByRole("button", { name: "Reportar Panadería La Espiga" }),
      );
      fireEvent.change(screen.getByLabelText("Motivo"), {
        target: { value: "a".repeat(length) },
      });
      await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

      if (allowed) {
        await vi.waitFor(() => expect(inserted).toHaveLength(1));
      } else {
        expect(inserted).toHaveLength(0);
        expect(screen.getByRole("alert")).toBeVisible();
      }
    },
  );

  it("does not send a reason that cannot describe the problem", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Reportar Panadería La Espiga" }),
    );
    await user.type(screen.getByLabelText("Motivo"), "fals");
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/5 caracteres/);
    expect(inserted).toHaveLength(0);
  });

  it("writes the store report with the signed-in client as its author", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Reportar Panadería La Espiga" }),
    );
    await user.type(
      screen.getByLabelText("Motivo"),
      "  La dirección no existe  ",
    );
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(inserted).toEqual([
      {
        table: "store_reports",
        row: {
          reporter_id: "user-1",
          target: "store",
          store_id: "store-1",
          product_id: null,
          reason: "La dirección no existe",
        },
      },
    ]);
    expect(screen.getByRole("status")).toHaveTextContent(/quedó registrado/);
  });

  it("writes a product report against the product, not the store", async () => {
    const user = userEvent.setup();
    renderDialog({
      target: "product",
      targetId: "product-1",
      targetName: "Pan campesino 500 g",
      reporterId: "user-2",
    });

    await user.click(
      screen.getByRole("button", { name: "Reportar Pan campesino 500 g" }),
    );
    await user.type(
      screen.getByLabelText("Motivo"),
      "El precio que muestra es falso",
    );
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(inserted[0]).toEqual({
      table: "store_reports",
      row: {
        reporter_id: "user-2",
        target: "product",
        store_id: null,
        product_id: "product-1",
        reason: "El precio que muestra es falso",
      },
    });
  });

  it("tells the client when the report could not be sent", async () => {
    insertError = new Error("row-level security");
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Reportar Panadería La Espiga" }),
    );
    await user.type(
      screen.getByLabelText("Motivo"),
      "La foto no es de la tienda",
    );
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/No pudimos enviar/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
