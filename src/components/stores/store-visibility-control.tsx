"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  nextStoreVisibilityStatus,
  storeStatusLabel,
  type StoreStatus,
} from "@/lib/store-form-model";

type StoreVisibilityControlProps = {
  storeId: string;
  ownerId: string;
  status: StoreStatus;
};

export function StoreVisibilityControl({
  storeId,
  ownerId,
  status: initialStatus,
}: StoreVisibilityControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStatus = nextStoreVisibilityStatus(status);

  async function toggleVisibility() {
    if (!nextStatus || pending) return;
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: updateError } = await supabase
      .from("stores")
      .update({ status: nextStatus })
      .eq("id", storeId)
      .eq("owner_id", ownerId)
      .select("id")
      .maybeSingle<{ id: string }>();

    setPending(false);
    if (updateError || !data) {
      setError(
        updateError?.message ??
          "No pudimos actualizar la visibilidad de la tienda.",
      );
      return;
    }

    setStatus(nextStatus);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span role="status" className="rounded-full bg-muted px-3 py-1 text-sm">
        {storeStatusLabel(status)}
      </span>
      {nextStatus ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleVisibility}
          disabled={pending}
        >
          {pending
            ? "Actualizando…"
            : status === "published"
              ? "Ocultar tienda"
              : "Volver a mostrar"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
