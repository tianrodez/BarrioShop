"use client";

import { Flag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  buildReportRow,
  REPORT_REASON_MAX_LENGTH,
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
 *
 * The form lives in a dialog portalled to `document.body`: the cards that host
 * the trigger use transforms on hover, which would turn a nested `fixed`
 * overlay into a box confined to the card.
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
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const targetLabel = reportTargetLabel(target);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (textareaRef.current) {
      textareaRef.current.focus();
    } else {
      panelRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setError(null);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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

  const dialog = open ? (
    // Leaflet panes and its controls reach z-index 800; the dialog has to sit
    // above the map that the store profile renders behind it.
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        className="report-backdrop absolute inset-0 bg-foreground/45 backdrop-blur-sm"
        onClick={close}
      />

      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="report-panel relative z-10 flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border bg-card p-5 shadow-lift sm:rounded-3xl sm:p-6"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              Reportar {targetLabel}
            </p>
            <h2
              className="font-heading text-xl leading-tight font-bold"
              id={titleId}
            >
              ¿Qué está mal en {targetName}?
            </h2>
          </div>
          <button
            aria-label="Cerrar"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            onClick={close}
            type="button"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {!reporterId ? (
          <div className="flex flex-col gap-4">
            <p
              className="text-sm leading-relaxed text-muted-foreground"
              id={descriptionId}
            >
              Inicia sesión para reportar esta {targetLabel}. Así podemos
              revisar el caso y avisarte:{" "}
              <Link
                className="font-medium text-primary underline"
                href="/login"
              >
                Iniciar sesión
              </Link>
              .
            </p>
            <Button
              className="h-11 rounded-full"
              onClick={close}
              type="button"
              variant="outline"
            >
              Entendido
            </Button>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <p
              className="text-sm leading-relaxed text-muted-foreground"
              id={descriptionId}
            >
              Cuéntanos qué información es falsa o engañosa. El equipo la revisa
              y puede retirar el contenido.
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`report-reason-${targetId}`}>Motivo</Label>
              <textarea
                className="min-h-28 rounded-xl border bg-background px-3.5 py-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 md:text-sm"
                id={`report-reason-${targetId}`}
                maxLength={REPORT_REASON_MAX_LENGTH}
                onChange={(event) => {
                  setReason(event.currentTarget.value);
                  if (error) setError(null);
                }}
                placeholder={`¿Qué información de esta ${targetLabel} es falsa o engañosa?`}
                ref={textareaRef}
                value={reason}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Mínimo 5 caracteres.
                </p>
                <p
                  className={
                    reason.length > REPORT_REASON_MAX_LENGTH - 50
                      ? "text-xs font-medium text-primary tabular-nums"
                      : "text-xs text-muted-foreground tabular-nums"
                  }
                >
                  {reason.length}/{REPORT_REASON_MAX_LENGTH}
                </p>
              </div>
            </div>

            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                className="h-11 rounded-full px-5"
                onClick={close}
                type="button"
                variant="ghost"
              >
                Cancelar
              </Button>
              <Button
                className="h-11 rounded-full px-6"
                disabled={pending}
                type="submit"
              >
                {pending ? "Enviando…" : "Enviar reporte"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <Button
        aria-label={`Reportar ${targetName}`}
        className="w-fit text-muted-foreground hover:text-destructive"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Flag aria-hidden className="size-4" />
        Reportar
      </Button>

      {sent ? (
        <p role="status" className="text-sm text-muted-foreground">
          Gracias. Tu reporte quedó registrado y el equipo lo revisará.
        </p>
      ) : null}

      {dialog && typeof document !== "undefined"
        ? createPortal(dialog, document.body)
        : null}
    </div>
  );
}
