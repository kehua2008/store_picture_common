import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "../../../src/server/auth";
import { generationJobRepository } from "../../../src/server/services";

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "mine";
  const jobs = await generationJobRepository.all({
    customerId: auth.user.id,
    actorId: auth.actor.actorId,
    scope
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_generation_job" }, { status: 400 });
  const payload = body as Record<string, unknown>;
  const job = await generationJobRepository.create({
    customerId: auth.user.id,
    actorId: auth.actor.actorId,
    actorName: auth.actor.actorName,
    taskLabel: stringValue(payload.taskLabel),
    categoryLabel: stringValue(payload.categoryLabel),
    promptSummary: stringValue(payload.promptSummary),
    promptBody: stringValue(payload.promptBody),
    total: typeof payload.total === "number" ? payload.total : undefined
  });
  return NextResponse.json({ job }, { status: 201 });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
