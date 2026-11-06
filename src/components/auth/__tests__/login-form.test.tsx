import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const { fnPush, fnRefresh, signInWithPassword, profileSingle } = vi.hoisted(
  () => ({
    fnPush: vi.fn(),
    fnRefresh: vi.fn(),
    signInWithPassword: vi.fn(),
    profileSingle: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: fnPush, refresh: fnRefresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword },
    from: () => ({ select: () => ({ eq: () => ({ single: profileSingle }) }) }),
  }),
}));

async function submitWith(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  await user.type(screen.getByLabelText("Correo electrónico"), email);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

describe("LoginForm (HU01 CA4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an error and stays put with wrong credentials", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error("Invalid login credentials"),
    });

    render(<LoginForm />);
    await submitWith(user, "vecina@barrioshop.demo", "equivocada123");

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Correo o contraseña incorrectos",
    );
    expect(fnPush).not.toHaveBeenCalled();
  });

  it("takes a merchant to the panel", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    profileSingle.mockResolvedValue({
      data: { role: "comerciante" },
      error: null,
    });

    render(<LoginForm />);
    await submitWith(user, "panadera@barrioshop.demo", "BarrioShop2026!");

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "panadera@barrioshop.demo",
      password: "BarrioShop2026!",
    });
    await vi.waitFor(() => expect(fnPush).toHaveBeenCalledWith("/panel"));
    expect(fnRefresh).toHaveBeenCalled();
  });

  it("takes a client to the directory", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u2" } },
      error: null,
    });
    profileSingle.mockResolvedValue({ data: { role: "cliente" }, error: null });

    render(<LoginForm />);
    await submitWith(user, "vecina@barrioshop.demo", "BarrioShop2026!");

    await vi.waitFor(() => expect(fnPush).toHaveBeenCalledWith("/"));
  });
});
