"use client";

/* eslint-disable @next/next/no-img-element -- blob: previews are local files, not hosted Storage images. */

import { FileText, ImageUp, UploadCloud, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { Label } from "@/components/ui/label";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;

function describeAccept(accept: string[]): string {
  const labels = accept.map((mime) => EXTENSIONS[mime] ?? mime);
  if (labels.length <= 1) return labels[0] ?? "archivo";
  return `${labels.slice(0, -1).join(", ")} o ${labels[labels.length - 1]}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(file: File | null): boolean {
  return Boolean(file?.type.startsWith("image/"));
}

type FileFieldProps = {
  id: string;
  label: string;
  /** Comma-separated MIME list, the same value the native input accepts. */
  accept: string;
  required?: boolean;
  file: File | null;
  /** A photo already stored, shown until the merchant picks a new one. */
  existingUrl?: string | null;
  hint?: string;
  /** Bytes; the control rejects anything bigger before the form sees it. */
  maxSize?: number;
  onFile: (file: File | null) => void;
};

/**
 * The one control the design system does not draw. It keeps the real
 * `<input type="file">` in the accessibility tree (so `getByLabelText` and
 * Playwright's `setInputFiles` keep working) and wraps it in a drop zone with
 * a preview, the file size and a remove action.
 *
 * The selection is synchronous on purpose: `react-dropzone` resolves the file
 * through an async pipeline, which loses the race against a save that happens
 * right after choosing the photo. Native drag events and `onChange` hand the
 * `File` over in the same tick, so the form can submit immediately.
 */
export function FileField({
  id,
  label,
  accept,
  required,
  file,
  existingUrl = null,
  hint,
  maxSize = DEFAULT_MAX_SIZE,
  onFile,
}: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const accepted = accept
    .split(",")
    .map((mime) => mime.trim())
    .filter(Boolean);
  const acceptLabel = describeAccept(accepted);

  // The object URL is created when the file is selected, not in an effect:
  // an effect that sets state on every prop change re-renders the whole form.
  // The cleanup still runs when the field unmounts.
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function releasePreview() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreview(null);
  }

  function validate(next: File): string | null {
    if (accepted.length > 0 && !accepted.includes(next.type)) {
      return `Ese formato no sirve. Usa ${acceptLabel}.`;
    }
    if (next.size > maxSize) {
      return `El archivo debe pesar máximo ${formatSize(maxSize)}.`;
    }
    return null;
  }

  function select(next: File | null) {
    if (!next) {
      setError(null);
      releasePreview();
      onFile(null);
      return;
    }

    const problem = validate(next);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    releasePreview();
    if (isImage(next) && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(next);
      previewRef.current = url;
      setPreview(url);
    }
    onFile(next);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    select(event.dataTransfer.files?.[0] ?? null);
  }

  const shownPreview = preview ?? (file ? null : existingUrl);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>

      <div
        className={
          dragging
            ? "flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-primary bg-primary/5 px-3.5 py-3 transition-colors"
            : "flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed bg-card px-3.5 py-3 transition-colors hover:border-primary/50 hover:bg-surface/60"
        }
        onClick={openPicker}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        data-testid={`dropzone-${id}`}
      >
        {shownPreview ? (
          <img
            src={shownPreview}
            alt={`Vista previa de ${label.toLowerCase()}`}
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-lg border object-cover"
          />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            {file ? (
              <FileText aria-hidden className="size-5" />
            ) : (
              <ImageUp aria-hidden className="size-5" />
            )}
          </span>
        )}

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {file?.name ??
              (existingUrl ? "Foto actual" : "Arrastra tu archivo aquí")}
          </span>
          <span className="text-xs text-muted-foreground">
            {file
              ? `${formatSize(file.size)} · ${acceptLabel}`
              : existingUrl
                ? "Haz clic para reemplazarla"
                : `o haz clic para elegirlo · ${acceptLabel} · máx. ${formatSize(maxSize)}`}
          </span>
        </span>

        {file ? (
          <button
            aria-label={`Quitar ${label.toLowerCase()}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              select(null);
            }}
            type="button"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : (
          <button
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
            type="button"
          >
            <UploadCloud aria-hidden className="size-4" />
            Elegir archivo
          </button>
        )}

        {/* Native input: no `w-full` class, so `sr-only` is not overridden and
            the hidden control cannot push the card out of the viewport. */}
        <input
          accept={accept}
          className="sr-only"
          id={id}
          onChange={(event) => {
            select(event.currentTarget.files?.[0] ?? null);
            // Allow choosing the same file again after a rejection.
            event.currentTarget.value = "";
          }}
          onClick={(event) => event.stopPropagation()}
          ref={inputRef}
          required={required}
          type="file"
        />
      </div>

      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
