import { NextResponse } from "next/server";
import { toPublicUser } from "../../../../src/domain/auth/users";
import { buildSessionCookie } from "../../../../src/server/auth";
import { rechargeOrderRepository, userRepository } from "../../../../src/server/services";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_login_request" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const user = await userRepository.verifyLogin({
    phone: typeof payload.phone === "string" ? payload.phone : "",
    password: typeof payload.password === "string" ? payload.password : ""
  });
  if (!user) return NextResponse.json({ error: "invalid_phone_or_password" }, { status: 401 });
  if (user.status !== "active") return NextResponse.json({ error: "account_suspended" }, { status: 403 });

  const account = await rechargeOrderRepository.account(user.id);
  const session = await userRepository.createSession(user.id, typeof payload.actorName === "string" ? payload.actorName : undefined);
  return NextResponse.json(
    { user: toPublicUser(user), account, actor: { actorId: session.actorId, actorName: session.actorName } },
    { headers: { "Set-Cookie": buildSessionCookie(session.id, session.expiresAt) } }
  );
}
