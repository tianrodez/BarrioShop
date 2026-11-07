"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setStoreVisibility } from "@/app/panel/actions";
import { Button } from "@/components/ui/button";
import {
  nextStoreVisibilityStatus,
  storeStatusLabel,
  type StoreStatus,
} from "@/lib/store-form-model";

type StoreVisibilityControlProps = {
  storeId: string;
  status: StoreStatus;
};

export function StoreVisibilityControl({
  storeId,
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

    const result = await setStoreVisibility(storeId, status);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(result.status);
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
