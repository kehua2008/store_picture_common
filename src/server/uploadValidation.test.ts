import { describe, expect, it } from "vitest";
import { validateImageUpload, validateImageUploads } from "./uploadValidation";

const options = {
  maxBytes: 1024,
  missingError: "missing",
  invalidTypeError: "invalid_type",
  tooLargeError: "too_large",
  invalidContentError: "invalid_content"
};

describe("validateImageUpload", () => {
  it("accepts an image with a matching mime type and file signature", async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], "proof.png", { type: "image/png" });

    await expect(validateImageUpload(file, options)).resolves.toMatchObject({ file });
  });

  it("rejects a spoofed image mime type", async () => {
    const file = new File(["not actually a png"], "proof.png", { type: "image/png" });

    await expect(validateImageUpload(file, options)).resolves.toMatchObject({ error: "invalid_content" });
  });

  it("rejects oversized files before reading content", async () => {
    const file = new File([new Uint8Array(2048)], "large.webp", { type: "image/webp" });

    await expect(validateImageUpload(file, options)).resolves.toMatchObject({ error: "too_large" });
  });
});

describe("validateImageUploads", () => {
  it("rejects too many uploaded images", async () => {
    const files = [
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "one.jpg", { type: "image/jpeg" }),
      new File([new Uint8Array([0xff, 0xd8, 0xff])], "two.jpg", { type: "image/jpeg" })
    ];

    await expect(validateImageUploads(files, {
      maxBytes: 1024,
      maxCount: 1,
      tooManyError: "too_many",
      invalidTypeError: "invalid_type",
      tooLargeError: "too_large",
      invalidContentError: "invalid_content"
    })).resolves.toMatchObject({ error: "too_many" });
  });
});
