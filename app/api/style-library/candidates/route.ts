import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../src/server/auth";
import { styleLibraryRepository } from "../../../../src/server/services";
import type { StyleCandidateBatchStatus } from "../../../../src/domain/styleLibrary/styleLibrary";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const data = await styleLibraryRepository.all();
  return NextResponse.json({ batches: data.candidateBatches });
}

export async function POST(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_candidate_batch_request" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  if (payload.action === "create") {
    const batch = await styleLibraryRepository.createCandidateBatch({
      name: stringValue(payload.name),
      sampleIds: stringArray(payload.sampleIds),
      sourceNote: stringValue(payload.sourceNote)
    });
    return NextResponse.json({ batch }, { status: 201 });
  }

  if (payload.action === "update") {
    const id = stringValue(payload.id);
    if (!id) return NextResponse.json({ error: "missing_candidate_batch_id" }, { status: 400 });
    const batch = await styleLibraryRepository.updateCandidateBatch({
      id,
      name: stringValue(payload.name),
      sampleIds: Array.isArray(payload.sampleIds) ? stringArray(payload.sampleIds) : undefined,
      appendSampleIds: stringArray(payload.appendSampleIds),
      sourceNote: stringValue(payload.sourceNote),
      status: normalizeStatus(payload.status)
    });
    if (!batch) return NextResponse.json({ error: "candidate_batch_not_found" }, { status: 404 });
    return NextResponse.json({ batch });
  }

  return NextResponse.json({ error: "unknown_candidate_batch_action" }, { status: 400 });
}

function stringValue(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

function stringArray(input: unknown): string[] | undefined {
  return Array.isArray(input) ? input.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : undefined;
}

function normalizeStatus(input: unknown): StyleCandidateBatchStatus | undefined {
  if (input === "collecting" || input === "exported" || input === "analyzed" || input === "imported" || input === "archived") return input;
  return undefined;
}
