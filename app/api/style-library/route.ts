import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../src/server/auth";
import { styleLibraryRepository } from "../../../src/server/services";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const data = await styleLibraryRepository.all();
  return NextResponse.json(data);
}
