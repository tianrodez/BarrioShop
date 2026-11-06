"use client";

import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * The browser's native file control is the one widget no design system draws:
 * its label comes in the browser's language and its button ignores the palette.
 * This keeps the visible control in our hands and the real `<input>` in the
 * accessibility tree, so `getByLabelText` and `setInputFiles` keep working.
 */
export function FileField({
  id,
  label,
  accept,
  required,
  fileName,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  required?: boolean;
  fileName: string | null;
  hint?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-card px-3 py-2.5">
        <Button
          className="h-9 rounded-full px-4"
          onClick={() => document.getElementById(id)?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          Elegir archivo
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {fileName ?? "Ningún archivo seleccionado"}
        </span>
        {/* A native input: the shadcn Input adds `w-full`, which wins over
            `sr-only` and pushes the hidden control out of the card. */}
        <input
          accept={accept}
          className="sr-only"
          id={id}
          onChange={onChange}
          required={required}
          type="file"
        />
      </div>
      {hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
