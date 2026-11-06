"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";

type AuthTab = "login" | "signup";

const HEADINGS: Record<AuthTab, string> = {
  login: "Ingresar",
  signup: "Crear cuenta",
};

/**
 * The mockup puts both ways in on one screen behind a segmented control, so
 * `/login` and `/registro` stay as entry points but share this panel: a
 * client who lands on either one can switch without losing the page.
 */
export function AuthPanel({ defaultTab = "login" }: { defaultTab?: AuthTab }) {
  const [tab, setTab] = useState<AuthTab>(defaultTab);

  return (
    <div className="flex flex-col gap-6 rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-4xl font-extrabold tracking-tight">
          {HEADINGS[tab]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Entra para gestionar tu tienda o hacer pedidos en el barrio.
        </p>
      </div>

      <div
        aria-label="Ingresar o registrarme"
        className="flex rounded-full bg-muted p-1"
        role="tablist"
      >
        <AuthTabButton
          active={tab === "login"}
          label="Ingresar"
          onClick={() => setTab("login")}
        />
        <AuthTabButton
          active={tab === "signup"}
          label="Registrarme"
          onClick={() => setTab("signup")}
        />
      </div>

      <div role="tabpanel">
        {tab === "login" ? <LoginForm /> : <SignupForm />}
      </div>
    </div>
  );
}

function AuthTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={
        active
          ? "flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft"
          : "flex-1 rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      }
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}
