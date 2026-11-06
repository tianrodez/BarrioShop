import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/components/auth/signup-form";

const { fnPush, fnRefresh, signUp } = vi.hoisted(() => ({
  fnPush: vi.fn(),
  fnRefresh: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: fnPush, refresh: fnRefresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signUp } }),
}));

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre completo"), "María Vecina");
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "vecina@barrioshop.demo",
  );
  await user.type(screen.getByLabelText("Contraseña"), "BarrioShop2026!");
}

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks continuing without accepting the data policy (HU01 CA3)", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ data: { session: {} }, error: null });

    render(<SignupForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Debes aceptar la política de tratamiento de datos",
    );
    expect(signUp).not.toHaveBeenCalled();
    expect(fnPush).not.toHaveBeenCalled();
  });

  it("creates a client account and lands on the directory (HU01 CA2)", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u1" } },
      error: null,
    });

    render(<SignupForm />);
    await fillForm(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "vecina@barrioshop.demo" }),
    );
    await vi.waitFor(() => expect(fnPush).toHaveBeenCalledWith("/"));
  });

  it("asks for confirmation when the project requires it", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({
      data: { session: null, user: { id: "u1" } },
      error: null,
    });

    render(<SignupForm />);
    await fillForm(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect((await screen.findByRole("status")).textContent).toContain(
      "Revisa tu correo",
    );
    expect(fnPush).not.toHaveBeenCalled();
  });
});
