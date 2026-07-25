import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { persistentUploadSubdir } from "../../../src/server/storagePaths";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const segments = (await context.params).path;
  if (!segments.length || segments.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const root = path.resolve(persistentUploadSubdir("video-sources"));
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(`${root}${path.sep}`)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const contentType = contentTypes[path.extname(target).toLowerCase()];
  if (!contentType) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const file = await readFile(target);
    return new NextResponse(file, {
      headers: {
        "Cache-Control": "public, max-age=604800, immutable",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
