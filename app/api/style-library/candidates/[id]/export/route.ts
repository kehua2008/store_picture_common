import { readFile } from "fs/promises";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../../../src/server/auth";
import { styleLibraryRepository } from "../../../../../../src/server/services";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { id } = await context.params;
  const { manifest, samples } = await styleLibraryRepository.buildExportManifest({ batchId: id });
  if (!samples.length) {
    return NextResponse.json({ error: "candidate_batch_has_no_samples" }, { status: 404 });
  }

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const images = zip.folder("images");
  if (!images) return NextResponse.json({ error: "zip_folder_error" }, { status: 500 });

  for (const sample of samples) {
    const bytes = await readFile(sample.absolutePath);
    images.file(sample.exportFilename, bytes);
  }

  await styleLibraryRepository.updateCandidateBatch({ id, status: "exported" });
  const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const body = new Blob([new Uint8Array(content)], { type: "application/zip" });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${id}.zip"`
    }
  });
}
