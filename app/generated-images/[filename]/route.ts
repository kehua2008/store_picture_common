import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { persistentUploadSubdir } from "../../../src/server/storagePaths";

interface RouteContext {
  params: Promise<{ filename: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { filename } = await context.params;
  if (!/^[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/i.test(filename)) {
    return NextResponse.json({ error: "invalid_generated_image" }, { status: 400 });
  }
  try {
    const body = await readFile(path.join(persistentUploadSubdir("generated-images"), filename));
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType(filename),
        "Cache-Control": "private, max-age=86400"
      }
    });
  } catch {
    return NextResponse.json({ error: "generated_image_not_found" }, { status: 404 });
  }
}

function contentType(filename: string): string {
  if (/\.jpe?g$/i.test(filename)) return "image/jpeg";
  if (/\.webp$/i.test(filename)) return "image/webp";
  return "image/png";
}
