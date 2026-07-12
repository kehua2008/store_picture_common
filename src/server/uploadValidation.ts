const defaultImageMimeTypes = ["image/png", "image/jpeg", "image/webp"];

export interface ImageUploadValidationOptions {
  allowedMimeTypes?: string[];
  maxBytes: number;
  missingError: string;
  invalidTypeError: string;
  tooLargeError: string;
  invalidContentError: string;
}

export function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "size" in value &&
    typeof value.size === "number" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function";
}

export async function validateImageUpload(
  file: FormDataEntryValue | null,
  options: ImageUploadValidationOptions
): Promise<{ file?: File; error?: string }> {
  if (!isUploadedFile(file)) return { error: options.missingError };

  const allowedMimeTypes = options.allowedMimeTypes ?? defaultImageMimeTypes;
  if (!allowedMimeTypes.includes(file.type)) return { error: options.invalidTypeError };
  if (file.size <= 0 || file.size > options.maxBytes) return { error: options.tooLargeError };

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasMatchingImageSignature(bytes, file.type)) return { error: options.invalidContentError };

  return { file };
}

export async function validateImageUploads(
  files: FormDataEntryValue[],
  options: Omit<ImageUploadValidationOptions, "missingError"> & { maxCount: number; tooManyError: string }
): Promise<{ files?: File[]; error?: string }> {
  const imageFiles = files.filter(isUploadedFile);
  if (imageFiles.length > options.maxCount) return { error: options.tooManyError };

  const validFiles: File[] = [];
  for (const file of imageFiles) {
    const result = await validateImageUpload(file, { ...options, missingError: "missing_image" });
    if (result.error) return { error: result.error };
    if (!result.file) return { error: "missing_image" };
    validFiles.push(result.file);
  }
  return { files: validFiles };
}

function hasMatchingImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
