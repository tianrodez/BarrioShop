import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Crear cuenta — BarrioShop",
};

export default function SignupPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <AuthPanel defaultTab="signup" />
    </main>
  );
}
