"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * HU01 CA1/CA2/CA3: anyone registers with e-mail + password, and the signup
 * cannot continue without accepting the data-processing policy. The new
 * account is always a `cliente` (the database trigger creates the profile),
 * which is exactly HU09 CA4 — there is no self-service administrator.
 */
export function SignupForm() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    // HU01 CA3 — block before calling the API at all.
    if (!consent) {
      setError(
        "Debes aceptar la política de tratamiento de datos para continuar.",
      );
      return;
    }

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      setPending(false);
      setError(signUpError.message);
      return;
    }

    setPending(false);

    if (!data.session) {
      // Hosted projects may require e-mail confirmation before a session exists.
      setNeedsConfirmation(true);
      return;
    }

    // A brand-new account is a client: it browses and orders (HU01 CA2),
    // and registers its store afterwards (HU01 CA1, U3).
    router.push("/");
    router.refresh();
  }

  if (needsConfirmation) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm">
          Revisa tu correo electrónico para confirmar la cuenta y luego{" "}
          <Link href="/login" className="underline underline-offset-4">
            inicia sesión
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      data-testid="signup-form"
    >
      <div className="flex flex-col gap-2">
        <Label
          className="text-[13px] font-medium tracking-wide"
          htmlFor="full_name"
        >
          Nombre completo
        </Label>
        <Input
          autoComplete="name"
          className="h-12 rounded-full border-transparent bg-card px-5 shadow-sm"
          id="full_name"
          name="full_name"
          placeholder="Nombre completo"
          required
        />
      </div>

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
          autoComplete="new-password"
          className="h-12 rounded-full border-transparent bg-card px-5 shadow-sm"
          id="password"
          minLength={8}
          name="password"
          placeholder="Contraseña (mínimo 8 caracteres)"
          required
          type="password"
        />
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="consent"
          checked={consent}
          onCheckedChange={(value) => {
            setConsent(value === true);
            if (value === true) setError(null);
          }}
        />
        <Label htmlFor="consent" className="text-sm font-normal leading-snug">
          Acepto la política de tratamiento de datos personales de BarrioShop.
        </Label>
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
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
