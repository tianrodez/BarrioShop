import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileField } from "@/components/ui/file-field";

function Harness({ maxSize }: { maxSize?: number }) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div>
      <FileField
        accept="image/jpeg,image/png,image/webp"
        file={file}
        id="photo"
        label="Foto de la tienda"
        maxSize={maxSize}
        onFile={setFile}
      />
      <output data-testid="selected">{file?.name ?? "none"}</output>
    </div>
  );
}

function imageFile(name = "fachada.png", size = 8, type = "image/png") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("FileField", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("keeps the real input labelled and selects a file (HU02)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByLabelText("Foto de la tienda"), imageFile());

    expect(screen.getByTestId("selected")).toHaveTextContent("fachada.png");
    expect(
      within(screen.getByTestId("dropzone-photo")).getByText("fachada.png"),
    ).toBeVisible();
  });

  it("shows a preview of the selected image", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByLabelText("Foto de la tienda"), imageFile());

    expect(screen.getByAltText(/Vista previa/)).toHaveAttribute(
      "src",
      "blob:preview",
    );
  });

  it("accepts a file dropped on the zone", () => {
    render(<Harness />);

    fireEvent.drop(screen.getByTestId("dropzone-photo"), {
      dataTransfer: {
        files: [imageFile("arrastrada.webp", 8, "image/webp")],
      },
    });

    expect(screen.getByTestId("selected")).toHaveTextContent("arrastrada.webp");
  });

  it("rejects a format the field does not accept", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Foto de la tienda"), {
      target: {
        files: [
          new File(["pdf"], "documento.pdf", { type: "application/pdf" }),
        ],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/formato no sirve/);
    expect(screen.getByTestId("selected")).toHaveTextContent("none");
  });

  it("rejects a file over the size limit before the form sees it", () => {
    render(<Harness maxSize={10} />);

    fireEvent.change(screen.getByLabelText("Foto de la tienda"), {
      target: { files: [imageFile("grande.png", 40)] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/10 B/);
    expect(screen.getByTestId("selected")).toHaveTextContent("none");
  });

  it("lets the merchant remove the selected file before saving", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(screen.getByLabelText("Foto de la tienda"), imageFile());
    await user.click(
      screen.getByRole("button", { name: "Quitar foto de la tienda" }),
    );

    expect(screen.getByTestId("selected")).toHaveTextContent("none");
    expect(screen.queryByAltText(/Vista previa/)).not.toBeInTheDocument();
  });
});
