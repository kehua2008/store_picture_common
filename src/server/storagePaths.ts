import path from "path";

export function persistentDataDir(): string {
  const target = process.env.STORE_COMMON_DATA_DIR?.trim();
  if (!target || target === ".data-common") return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data-common");
  if (path.isAbsolute(target)) return target;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data-common", target);
}

export function persistentUploadDir(): string {
  const target = process.env.STORE_COMMON_UPLOAD_DIR?.trim();
  if (!target || target === "public") return path.join(/*turbopackIgnore: true*/ process.cwd(), "public");
  if (path.isAbsolute(target)) return target;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "public", target);
}

export function persistentUploadSubdir(name: string): string {
  return path.join(persistentUploadDir(), name);
}
