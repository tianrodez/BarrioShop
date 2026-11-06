import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Ingresar — BarrioShop",
};

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <AuthPanel defaultTab="login" />
      <p className="mt-10 text-xs text-muted-foreground">
        Cuentas de demostración locales: <code>panadera@barrioshop.demo</code>,{" "}
        <code>fruver@barrioshop.demo</code>, <code>tienda@barrioshop.demo</code>
        , <code>vecina@barrioshop.demo</code> — contraseña{" "}
        <code>BarrioShop2026!</code>
      </p>
    </main>
  );
}
