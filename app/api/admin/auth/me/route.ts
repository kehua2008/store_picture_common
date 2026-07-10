import { NextResponse } from "next/server";
import { toPublicUser } from "../../../../../src/domain/auth/users";
import { requireAdminAuth } from "../../../../../src/server/auth";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });
  return NextResponse.json({ user: toPublicUser(admin.auth.user), actor: admin.auth.actor });
}
