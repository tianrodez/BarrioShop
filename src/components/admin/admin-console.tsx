"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { revalidateStoreViews } from "@/app/panel/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { reportTargetLabel } from "@/lib/report-model";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PendingStoreRow = {
  id: string;
  name: string;
  store_type: string;
  barrio: string;
  address: string;
  reference_place: string | null;
  whatsapp: string;
  opening_hours: string;
};

export type OpenReportRow = {
  id: string;
  target: "store" | "product";
  reason: string;
  store_id: string | null;
  product_id: string | null;
  store_name: string | null;
  product_name: string | null;
};

export type FeatureableStoreRow = {
  id: string;
  name: string;
  barrio: string;
  is_featured: boolean;
};

/**
 * The minimal admin console HU09 CA3 and HU11 CA2-CA3 need: publish or send
 * back a store with what must be corrected, read the reported cases and act on
 * them, and mark a published store as featured (HU07 CA3). Every action goes
 * through the SECURITY DEFINER RPCs the harness pins (§11), never a direct
 * table write.
 */
export function AdminConsole({
  pendingStores,
  openReports,
  publishedStores,
}: {
  pendingStores: PendingStoreRow[];
  openReports: OpenReportRow[];
  publishedStores: FeatureableStoreRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(pendingStores);
  const [reports, setReports] = useState(openReports);
  const [stores, setStores] = useState(publishedStores);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function run(
    action: () => PromiseLike<{ error: unknown }>,
    onSuccess: () => void,
  ) {
    setError(null);
    try {
      const { error: rpcError } = await action();
      if (rpcError) throw rpcError;
      onSuccess();
      // The directory, the home and the store profile cache the old status;
      // one server action call invalidates all of them for the next visit.
      await revalidateStoreViews();
      router.refresh();
    } catch {
      setError("No pudimos completar la acción. Intenta de nuevo.");
    }
  }

  function reviewStore(store: PendingStoreRow, approve: boolean) {
    const note = (rejectNotes[store.id] ?? "").trim();
    if (!approve && !note) {
      setError("Escribe qué debe corregir el comerciante antes de rechazar.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    void run(
      () =>
        supabase.rpc("admin_review_store", {
          p_store_id: store.id,
          p_approve: approve,
          ...(approve ? {} : { p_note: note }),
        }),
      () =>
        setPending((current) => current.filter((row) => row.id !== store.id)),
    );
  }

  function resolveReport(
    report: OpenReportRow,
    status: "resolved" | "rejected",
  ) {
    const supabase = createSupabaseBrowserClient();
    void run(
      () =>
        supabase.rpc("admin_resolve_report", {
          p_report_id: report.id,
          p_status: status,
        }),
      () =>
        setReports((current) => current.filter((row) => row.id !== report.id)),
    );
  }

  function removeReportedProduct(report: OpenReportRow) {
    if (!report.product_id) return;
    const supabase = createSupabaseBrowserClient();
    // HU03/HU11: the product is removed logically, so the report keeps the
    // context it needs and the row stays readable here.
    void run(
      () =>
        supabase.rpc("admin_remove_product", {
          p_product_id: report.product_id,
        }),
      () => undefined,
    );
  }

  function retireReportedStore(report: OpenReportRow) {
    if (!report.store_id) return;
    const supabase = createSupabaseBrowserClient();
    void run(
      () => supabase.rpc("admin_retire_store", { p_store_id: report.store_id }),
      () => undefined,
    );
  }

  function toggleFeatured(store: FeatureableStoreRow) {
    const next = !store.is_featured;
    const supabase = createSupabaseBrowserClient();
    void run(
      () =>
        supabase.rpc("admin_set_featured", {
          p_store_id: store.id,
          p_featured: next,
        }),
      () =>
        setStores((current) =>
          current.map((row) =>
            row.id === store.id ? { ...row, is_featured: next } : row,
          ),
        ),
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section aria-label="Tiendas en revisión" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Tiendas en revisión</h2>
          <p className="text-sm text-muted-foreground">
            Apruébalas para publicarlas, o devuélvelas con lo que falta
            corregir.
          </p>
        </div>

        {pending.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No hay tiendas esperando revisión.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((store) => (
              <li
                key={store.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{store.name}</h3>
                  <Badge variant="outline">En revisión</Badge>
                </div>
                <div className="flex flex-col gap-1 break-words text-sm">
                  <p className="text-muted-foreground">
                    {store.store_type} · {store.barrio}
                  </p>
                  <p>
                    {store.address}
                    {store.reference_place ? ` · ${store.reference_place}` : ""}
                  </p>
                  <p>{store.opening_hours}</p>
                  <p className="text-muted-foreground">
                    WhatsApp: {store.whatsapp}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    aria-label={`Aprobar ${store.name}`}
                    onClick={() => reviewStore(store, true)}
                    size="sm"
                  >
                    Aprobar
                  </Button>
                  <Button
                    aria-label={`Rechazar ${store.name}`}
                    onClick={() => reviewStore(store, false)}
                    size="sm"
                    variant="outline"
                  >
                    Rechazar
                  </Button>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor={`reject-note-${store.id}`}>
                    Motivo del rechazo para {store.name}
                  </Label>
                  <textarea
                    className="min-h-16 rounded-md border bg-background p-2 text-base md:text-sm"
                    id={`reject-note-${store.id}`}
                    onChange={(event) => {
                      // Read before updating: React may run the updater later.
                      const value = event.currentTarget.value;
                      setRejectNotes((current) => ({
                        ...current,
                        [store.id]: value,
                      }));
                    }}
                    placeholder="Qué falta o no coincide, para que el comerciante lo corrija"
                    value={rejectNotes[store.id] ?? ""}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Reportes abiertos" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Reportes abiertos</h2>
          <p className="text-sm text-muted-foreground">
            Revisa el caso y oculta el contenido engañoso si hace falta.
          </p>
        </div>

        {reports.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No hay reportes abiertos.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((report) => {
              const subject =
                report.target === "store"
                  ? (report.store_name ?? "tienda desconocida")
                  : (report.product_name ?? "producto desconocido");
              const label = reportTargetLabel(report.target);

              return (
                <li
                  key={report.id}
                  className="flex flex-col gap-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words font-semibold">
                      {label === "tienda" ? "Tienda" : "Producto"}: {subject}
                    </h3>
                  </div>
                  {report.target === "product" && report.store_name ? (
                    <p className="break-words text-xs text-muted-foreground">
                      Tienda: {report.store_name}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {report.reason}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      aria-label={`Resolver reporte de ${subject}`}
                      onClick={() => resolveReport(report, "resolved")}
                      size="sm"
                    >
                      Resolver reporte
                    </Button>
                    <Button
                      aria-label={`Rechazar reporte de ${subject}`}
                      onClick={() => resolveReport(report, "rejected")}
                      size="sm"
                      variant="outline"
                    >
                      Rechazar reporte
                    </Button>

                    {report.target === "product" && report.product_id ? (
                      <Button
                        aria-label={`Quitar producto reportado: ${subject}`}
                        onClick={() => removeReportedProduct(report)}
                        size="sm"
                        variant="destructive"
                      >
                        Quitar producto
                      </Button>
                    ) : null}

                    {report.target === "store" && report.store_id ? (
                      <Button
                        aria-label={`Retirar tienda reportada: ${subject}`}
                        onClick={() => retireReportedStore(report)}
                        size="sm"
                        variant="destructive"
                      >
                        Retirar tienda
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Tiendas publicadas" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Tiendas publicadas</h2>
          <p className="text-sm text-muted-foreground">
            Marca las que quieres que aparezcan primero y con la etiqueta
            Destacada.
          </p>
        </div>

        {stores.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Todavía no hay tiendas publicadas.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stores.map((store) => (
              <li
                key={store.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <span className="break-words text-sm">
                  <span className="font-medium">{store.name}</span> ·{" "}
                  {store.barrio}
                </span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    aria-label={`Destacar ${store.name}`}
                    checked={store.is_featured}
                    onChange={() => toggleFeatured(store)}
                    type="checkbox"
                  />
                  Destacada
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
