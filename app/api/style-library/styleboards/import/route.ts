import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../../src/server/auth";
import { styleLibraryRepository } from "../../../../../src/server/services";
import type { StyleAnalysisResult } from "../../../../../src/domain/styleLibrary/styleLibrary";

export async function POST(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("multipart/form-data")
    ? await readMultipartJson(request)
    : await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_style_analysis_result" }, { status: 400 });
  }

  try {
    const boards = await styleLibraryRepository.importStyleAnalysisResult(body as StyleAnalysisResult);
    return NextResponse.json({ boards }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "style_analysis_import_failed" }, { status: 400 });
  }
}

async function readMultipartJson(request: Request): Promise<unknown> {
  const formData = await request.formData().catch(() => undefined);
  const file = formData?.get("analysisFile");
  if (typeof file === "object" && file && "text" in file && typeof file.text === "function") {
    return JSON.parse(await file.text());
  }
  const text = formData?.get("analysisJson");
  if (typeof text === "string") return JSON.parse(text);
  return undefined;
}
