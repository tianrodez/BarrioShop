import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthPanel } from "@/components/auth/auth-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("AuthPanel (mockup auth)", () => {
  it("opens on Ingresar and offers the signup tab", () => {
    render(<AuthPanel />);

    expect(screen.getByRole("heading", { name: "Ingresar" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Ingresar" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Registrarme" })).toBeVisible();
    expect(screen.getByTestId("login-form")).toBeVisible();
    expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
  });

  it("switches to the signup form without leaving the page", async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);

    await user.click(screen.getByRole("tab", { name: "Registrarme" }));

    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
    expect(screen.getByTestId("signup-form")).toBeVisible();
    expect(screen.getByLabelText("Nombre completo")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Registrarme" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("lets /registro open directly on the signup tab", () => {
    render(<AuthPanel defaultTab="signup" />);

    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
    expect(screen.getByLabelText("Nombre completo")).toBeVisible();
  });

  it("keeps the consent required by HU01 CA3 on the signup tab", async () => {
    const user = userEvent.setup();
    render(<AuthPanel defaultTab="signup" />);

    await user.type(screen.getByLabelText("Nombre completo"), "María Vecina");
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "maria@barrioshop.demo",
    );
    await user.type(screen.getByLabelText("Contraseña"), "BarrioShop2026!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /política de tratamiento de datos/i,
    );
  });
});
