export const PRODUCT_IMAGE_LIMIT_BYTES = 500 * 1024;

const MAX_IMAGE_DIMENSION = 1600;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function imageExtension(type: string): string {
  if (type === "image/jpeg") return "jpg";
  return type.split("/")[1] ?? "webp";
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No pudimos procesar la imagen."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

export async function compressProductImage(file: File): Promise<File> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("La foto debe estar en formato JPG, PNG o WebP.");
  }
  if (file.size <= PRODUCT_IMAGE_LIMIT_BYTES) return file;

  if (typeof createImageBitmap !== "function") {
    throw new Error("Este navegador no puede comprimir la imagen.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("No pudimos abrir la imagen. Elige otro archivo.");
  }

  try {
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new Error("La imagen no tiene dimensiones válidas.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Este navegador no puede procesar la imagen.");

    let scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const baseName = file.name.replace(/\.[^.]+$/, "") || "producto";

    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const quality = Math.max(0.35, 0.86 - attempt * 0.08);
      const blob = await canvasBlob(canvas, quality);
      if (!SUPPORTED_IMAGE_TYPES.has(blob.type)) {
        throw new Error("No pudimos generar una imagen compatible.");
      }
      if (blob.size <= PRODUCT_IMAGE_LIMIT_BYTES) {
        const extension = imageExtension(blob.type);
        return new File([blob], `${baseName}.${extension}`, {
          type: blob.type,
          lastModified: file.lastModified,
        });
      }

      scale *= 0.82;
    }

    throw new Error(
      "No pudimos comprimir la imagen por debajo de 500 KB. Elige otra imagen.",
    );
  } finally {
    bitmap.close();
  }
}
