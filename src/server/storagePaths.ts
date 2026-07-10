import path from "path";

export function persistentDataDir(): string {
  return process.env.STORE_COMMON_DATA_DIR?.trim() || ".data-common";
}

export function persistentUploadDir(): string {
  return process.env.STORE_COMMON_UPLOAD_DIR?.trim() || "public";
}

export function persistentUploadSubdir(name: string): string {
  return path.join(persistentUploadDir(), name);
}
