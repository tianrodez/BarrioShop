"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { homePathForRole, type StoreRole } from "@/lib/auth-roles";

/**
 * HU01 CA4: correct credentials take the merchant to the panel and the
 * client to the directory; wrong credentials show an error message.
 */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      {
        email,
        password,
      },
    );

    if (signInError || !data.user) {
      setPending(false);
      setError(
        "Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.",
      );
      return;
    }

    // The role lives in `profiles` (§8), so it is read after signing in.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single<{ role: StoreRole }>();

    setPending(false);
    router.push(homePathForRole(profile?.role ?? "cliente"));
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      data-testid="login-form"
    >
      <div className="flex flex-col gap-2">
        <Label
          className="text-[13px] font-medium tracking-wide"
          htmlFor="email"
        >
          Correo electrónico
        </Label>
        <Input
          autoComplete="email"
          className="h-12 rounded-full border-transparent bg-card px-5 shadow-sm"
          id="email"
          name="email"
          placeholder="Correo"
          required
          type="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          className="text-[13px] font-medium tracking-wide"
          htmlFor="password"
        >
          Contraseña
        </Label>
        <Input
          autoComplete="current-password"
          className="h-12 rounded-full border-transparent bg-card px-5 shadow-sm"
          id="password"
          name="password"
          placeholder="Contraseña"
          required
          type="password"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        className="h-12 w-full rounded-full text-base"
        disabled={pending}
        type="submit"
      >
        {pending ? "Entrando…" : "Ingresar"}
      </Button>
    </form>
  );
}
