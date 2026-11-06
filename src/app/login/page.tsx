import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Ingresar — BarrioShop",
};

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <AuthPanel defaultTab="login" />
      <div className="mt-8 rounded-2xl border border-dashed bg-surface/60 p-4">
        <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
          Cuentas de demostración
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          panadera@barrioshop.demo · fruver@barrioshop.demo ·{" "}
          tienda@barrioshop.demo · vecina@barrioshop.demo
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Contraseña:{" "}
          <code className="rounded-md bg-card px-1.5 py-0.5 font-medium">
            BarrioShop2026!
          </code>
        </p>
      </div>
    </main>
  );
}
