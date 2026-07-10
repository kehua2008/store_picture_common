import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../src/server/auth";
import { styleLibraryRepository } from "../../../../src/server/services";
import type { StyleSampleSourceType, StyleSampleStatus } from "../../../../src/domain/styleLibrary/styleLibrary";

export async function POST(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const formData = await request.formData().catch(() => undefined);
  if (!formData) {
    return NextResponse.json({ error: "invalid_multipart_request" }, { status: 400 });
  }

  const files = formData.getAll("images").filter(isImageFileLike);
  if (!files.length) {
    return NextResponse.json({ error: "missing_style_sample_images" }, { status: 400 });
  }
  if (files.length > 60) {
    return NextResponse.json({ error: "too_many_style_sample_images", max: 60 }, { status: 400 });
  }

  const sourceType = normalizeSourceType(formData.get("sourceType"));
  const status = normalizeStatus(formData.get("status")) ?? (sourceType === "user_replicate" ? "pending_review" : "approved");
  const samples = await styleLibraryRepository.createSamples(files.map((file) => ({
    file,
    sourceType,
    status,
    sourceNote: value(formData.get("sourceNote")),
    platform: value(formData.get("platform")),
    category: value(formData.get("category")),
    imageType: value(formData.get("imageType")),
    styleName: value(formData.get("styleName"))
  })));

  return NextResponse.json({ samples }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_style_sample_update" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) return NextResponse.json({ error: "missing_style_sample_id" }, { status: 400 });

  if (payload.action === "approve" || payload.status === "approved") {
    const result = await styleLibraryRepository.approveSampleForCandidatePool(id);
    if (!result) return NextResponse.json({ error: "style_sample_not_found" }, { status: 404 });
    return NextResponse.json(result);
  }

  if (payload.action === "reject" || payload.status === "rejected") {
    const result = await styleLibraryRepository.rejectSampleAndDelete(id);
    if (!result) return NextResponse.json({ error: "style_sample_not_found" }, { status: 404 });
    return NextResponse.json(result);
  }

  const sample = await styleLibraryRepository.updateSample({
    id,
    status: normalizeStatusFromUnknown(payload.status),
    platform: stringValue(payload.platform),
    category: stringValue(payload.category),
    imageType: stringValue(payload.imageType),
    styleName: stringValue(payload.styleName),
    sourceNote: stringValue(payload.sourceNote)
  });
  if (!sample) return NextResponse.json({ error: "style_sample_not_found" }, { status: 404 });
  return NextResponse.json({ sample });
}

function isImageFileLike(value: FormDataEntryValue): value is File {
  return typeof value === "object" && "type" in value && typeof value.type === "string" && value.type.startsWith("image/");
}

function value(input: FormDataEntryValue | null): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

function normalizeSourceType(input: FormDataEntryValue | null): StyleSampleSourceType {
  const raw = value(input);
  if (raw === "user_replicate" || raw === "link_collect") return raw;
  return "admin_upload";
}

function normalizeStatus(input: FormDataEntryValue | null): StyleSampleStatus | undefined {
  const raw = value(input);
  if (raw === "pending_analysis" || raw === "pending_review" || raw === "approved" || raw === "rejected") return raw;
  return undefined;
}

function stringValue(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

function normalizeStatusFromUnknown(input: unknown): StyleSampleStatus | undefined {
  if (input === "pending_analysis" || input === "pending_review" || input === "approved" || input === "rejected") return input;
  return undefined;
}
