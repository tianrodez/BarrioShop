import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoreVisibilityControl } from "@/components/stores/store-visibility-control";

const { setStoreVisibility, refresh } = vi.hoisted(() => ({
  setStoreVisibility: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/panel/actions", () => ({ setStoreVisibility }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("StoreVisibilityControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStoreVisibility.mockResolvedValue({ ok: true, status: "hidden" });
  });

  it("hides a published store through the server action", async () => {
    const user = userEvent.setup();
    render(<StoreVisibilityControl storeId="store-1" status="published" />);

    await user.click(screen.getByRole("button", { name: "Ocultar tienda" }));

    await waitFor(() =>
      expect(setStoreVisibility).toHaveBeenCalledWith(
        "store-1",
        "published",
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Volver a mostrar" }),
    ).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a hidden store again", async () => {
    setStoreVisibility.mockResolvedValue({ ok: true, status: "published" });
    const user = userEvent.setup();
    render(<StoreVisibilityControl storeId="store-1" status="hidden" />);

    await user.click(screen.getByRole("button", { name: "Volver a mostrar" }));

    expect(setStoreVisibility).toHaveBeenCalledWith("store-1", "hidden");
    expect(
      await screen.findByRole("button", { name: "Ocultar tienda" }),
    ).toBeTruthy();
  });

  it("keeps the current status and explains when the update fails", async () => {
    setStoreVisibility.mockResolvedValue({
      ok: false,
      error: "No pudimos actualizar la visibilidad de la tienda.",
    });
    const user = userEvent.setup();
    render(<StoreVisibilityControl storeId="store-1" status="published" />);

    await user.click(screen.getByRole("button", { name: "Ocultar tienda" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /No pudimos actualizar/,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Publicada");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not offer owner visibility controls while a store is under review", () => {
    render(<StoreVisibilityControl storeId="store-1" status="pending" />);

    expect(screen.getByRole("status")).toHaveTextContent("En revisión");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
