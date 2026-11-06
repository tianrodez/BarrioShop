import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoreVisibilityControl } from "@/components/stores/store-visibility-control";

const { update, eqId, eqOwner, maybeSingle, refresh } = vi.hoisted(() => ({
  update: vi.fn(),
  eqId: vi.fn(),
  eqOwner: vi.fn(),
  maybeSingle: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({
      update: (...args: unknown[]) => {
        update(...args);
        return {
          eq: (column: string, value: string) => {
            if (column === "id") eqId(column, value);
            if (column === "owner_id") eqOwner(column, value);
            return {
              eq: (secondColumn: string, secondValue: string) => {
                if (secondColumn === "owner_id")
                  eqOwner(secondColumn, secondValue);
                return {
                  select: () => ({ maybeSingle }),
                };
              },
              select: () => ({ maybeSingle }),
            };
          },
        };
      },
    }),
  }),
}));

describe("StoreVisibilityControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: { id: "store-1" }, error: null });
  });

  it("hides a published store through an owner-scoped update", async () => {
    const user = userEvent.setup();
    render(
      <StoreVisibilityControl
        storeId="store-1"
        ownerId="owner-1"
        status="published"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ocultar tienda" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ status: "hidden" }),
    );
    expect(eqId).toHaveBeenCalledWith("id", "store-1");
    expect(eqOwner).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(
      await screen.findByRole("button", { name: "Volver a mostrar" }),
    ).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not offer owner visibility controls while a store is under review", () => {
    render(
      <StoreVisibilityControl
        storeId="store-1"
        ownerId="owner-1"
        status="pending"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("En revisión");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
