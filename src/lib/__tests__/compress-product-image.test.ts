import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compressProductImage,
  PRODUCT_IMAGE_LIMIT_BYTES,
} from "@/lib/compress-product-image";

const drawImage = vi.fn();
const closeBitmap = vi.fn();
const createBitmap = vi.fn();

describe("compressProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("createImageBitmap", createBitmap);
    createBitmap.mockResolvedValue({
      width: 4000,
      height: 2000,
      close: closeBitmap,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback, type) {
        callback(new Blob(["compressed"], { type }));
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns files already within the 500 KB bucket limit unchanged", async () => {
    const file = new File(["small image"], "photo.jpg", { type: "image/jpeg" });

    await expect(compressProductImage(file)).resolves.toBe(file);
    expect(createBitmap).not.toHaveBeenCalled();
  });

  it("treats exactly 500 KB as within the bucket limit", async () => {
    const file = new File(
      [new Uint8Array(PRODUCT_IMAGE_LIMIT_BYTES)],
      "edge.jpg",
      { type: "image/jpeg" },
    );

    await expect(compressProductImage(file)).resolves.toBe(file);
    expect(createBitmap).not.toHaveBeenCalled();
  });

  it("rejects an unsupported format before looking at its size", async () => {
    const gif = new File([new Uint8Array(1)], "sticker.gif", {
      type: "image/gif",
    });

    await expect(compressProductImage(gif)).rejects.toThrow(/JPG, PNG o WebP/);
    expect(createBitmap).not.toHaveBeenCalled();
  });

  it("rejects a canvas that cannot emit a supported format", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback) {
        callback(new Blob(["<svg/>"], { type: "image/svg+xml" }));
      },
    );
    const file = new File(
      [new Uint8Array(PRODUCT_IMAGE_LIMIT_BYTES + 1)],
      "photo.jpg",
      { type: "image/jpeg" },
    );

    await expect(compressProductImage(file)).rejects.toThrow(
      /No pudimos generar una imagen compatible/,
    );
    expect(closeBitmap).toHaveBeenCalledOnce();
  });

  it("compresses large accepted images below the Storage limit", async () => {
    const sizes: number[][] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (this: HTMLCanvasElement, callback, type) {
        sizes.push([this.width, this.height]);
        callback(new Blob(["compressed image"], { type }));
      },
    );
    const file = new File(
      [new Uint8Array(PRODUCT_IMAGE_LIMIT_BYTES + 1)],
      "photo.png",
      {
        type: "image/png",
      },
    );

    const compressed = await compressProductImage(file);

    expect(compressed.size).toBeLessThanOrEqual(PRODUCT_IMAGE_LIMIT_BYTES);
    expect(compressed.type).toBe("image/webp");
    expect(compressed.name).toBe("photo.webp");
    expect(sizes[0]).toEqual([1600, 800]);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(closeBitmap).toHaveBeenCalledOnce();
  });

  it("rejects unsupported or uncompressible images", async () => {
    const pdf = new File(
      [new Uint8Array(PRODUCT_IMAGE_LIMIT_BYTES + 1)],
      "proof.pdf",
      {
        type: "application/pdf",
      },
    );
    await expect(compressProductImage(pdf)).rejects.toThrow(/JPG, PNG o WebP/);

    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback, type) {
        callback(
          new Blob([new Uint8Array(PRODUCT_IMAGE_LIMIT_BYTES + 1)], { type }),
        );
      },
    );
    const largeImage = new File(
      [new Uint8Array(PRODUCT_IMAGE_LIMIT_BYTES + 1)],
      "large.jpg",
      { type: "image/jpeg" },
    );
    await expect(compressProductImage(largeImage)).rejects.toThrow(/500 KB/);
    expect(closeBitmap).toHaveBeenCalledOnce();
  });
});
