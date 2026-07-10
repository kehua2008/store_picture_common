import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../src/server/auth";
import { styleLibraryRepository } from "../../../../src/server/services";
import type { StyleBoardStatus } from "../../../../src/domain/styleLibrary/styleLibrary";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const imageType = url.searchParams.get("imageType");
  const data = await styleLibraryRepository.all();
  const boards = data.boards.filter((board) =>
    (!status || board.status === status) &&
    (url.searchParams.get("showOnHome") !== "true" || board.showOnHome) &&
    (!category || board.category === category) &&
    (!imageType || board.imageType === imageType)
  ).sort((a, b) => a.displayOrder - b.displayOrder || b.updatedAt.localeCompare(a.updatedAt));
  return NextResponse.json({ boards });
}

export async function POST(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_styleboard_request" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  if (payload.action === "status") {
    const id = typeof payload.id === "string" ? payload.id : "";
    const status = normalizeStatus(payload.status);
    if (!id || !status) return NextResponse.json({ error: "invalid_styleboard_status_request" }, { status: 400 });
    const board = await styleLibraryRepository.updateBoard({
      id,
      status,
      showOnHome: typeof payload.showOnHome === "boolean" ? payload.showOnHome : undefined,
      displayOrder: typeof payload.displayOrder === "number" ? payload.displayOrder : undefined
    });
    if (!board) return NextResponse.json({ error: "styleboard_not_found" }, { status: 404 });
    return NextResponse.json({ board });
  }

  const platform = stringValue(payload.platform) || "taobao";
  const category = stringValue(payload.category);
  const imageType = stringValue(payload.imageType);
  const styleName = stringValue(payload.styleName);
  if (!category || !imageType || !styleName) {
    return NextResponse.json({ error: "missing_styleboard_group" }, { status: 400 });
  }

  const board = await styleLibraryRepository.rebuildBoard({
    platform,
    category,
    imageType,
    styleName,
    publish: payload.publish !== false
  });
  return NextResponse.json({ board }, { status: 201 });
}

function stringValue(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

function normalizeStatus(input: unknown): StyleBoardStatus | undefined {
  if (input === "draft" || input === "ready_to_publish" || input === "published" || input === "archived") return input;
  return undefined;
}
