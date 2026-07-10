import { NextResponse } from "next/server";
import { toPublicUser } from "../../../../../src/domain/auth/users";
import { buildSessionCookie, isAdminUser } from "../../../../../src/server/auth";
import { userRepository } from "../../../../../src/server/services";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_admin_login_request" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const user = await userRepository.verifyLogin({
    phone: typeof payload.phone === "string" ? payload.phone : "",
    password: typeof payload.password === "string" ? payload.password : ""
  });
  if (!user) return NextResponse.json({ error: "invalid_phone_or_password" }, { status: 401 });
  if (user.status !== "active") return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  if (!isAdminUser(user)) return NextResponse.json({ error: "admin_required" }, { status: 403 });

  const session = await userRepository.createSession(user.id, "管理员");
  return NextResponse.json(
    { user: toPublicUser(user), actor: { actorId: session.actorId, actorName: session.actorName } },
    { headers: { "Set-Cookie": buildSessionCookie(session.id, session.expiresAt) } }
  );
}
