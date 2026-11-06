"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  buildReportRow,
  reportTargetLabel,
  validateReportReason,
  type ReportTarget,
} from "@/lib/report-model";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * HU11 CA1: the visible "Reportar" option a client or a merchant finds on a
 * store profile and on each product. Reporting needs an account because the
 * table records who reported (and who may later read it); an anonymous visitor
 * is told that instead of being given a form that would only fail.
 */
export function ReportDialog({
  target,
  targetId,
  targetName,
  reporterId,
}: {
  target: ReportTarget;
  targetId: string;
  targetName: string;
  reporterId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const targetLabel = reportTargetLabel(target);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const validation = validateReportReason(reason);
    if (validation) {
      setError(validation);
      return;
    }
    if (!reporterId) return;

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: insertError } = await supabase
        .from("store_reports")
        .insert(buildReportRow({ target, targetId, reason, reporterId }));
      if (insertError) throw insertError;

      setSent(true);
      setReason("");
      setOpen(false);
    } catch {
      setError("No pudimos enviar tu reporte. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        aria-label={`Reportar ${targetName}`}
        className="w-fit"
        onClick={() => {
          setOpen((current) => !current);
          setError(null);
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        Reportar
      </Button>

      {sent ? (
        <p role="status" className="text-sm text-muted-foreground">
          Gracias. Tu reporte quedó registrado y el equipo lo revisará.
        </p>
      ) : null}

      {open && !reporterId ? (
        <p className="text-sm text-muted-foreground">
          Inicia sesión para reportar esta {targetLabel}. Así podemos revisar el
          caso y avisarte:{" "}
          <Link className="underline" href="/login">
            Iniciar sesión
          </Link>
          .
        </p>
      ) : null}

      {open && reporterId ? (
        <form
          className="flex flex-col gap-3 rounded-2xl border bg-surface/60 p-4"
          onSubmit={handleSubmit}
        >
          <Label htmlFor={`report-reason-${targetId}`}>Motivo</Label>
          <textarea
            className="min-h-24 rounded-xl border bg-card px-3.5 py-2.5 text-base md:text-sm"
            id={`report-reason-${targetId}`}
            onChange={(event) => setReason(event.currentTarget.value)}
            placeholder={`¿Qué información de esta ${targetLabel} es falsa o engañosa?`}
            value={reason}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} size="sm" type="submit">
              Enviar reporte
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
