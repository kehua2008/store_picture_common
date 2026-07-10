import { NextResponse } from "next/server";
import { toPublicUser } from "../../../../src/domain/auth/users";
import { buildSessionCookie } from "../../../../src/server/auth";
import { rechargeOrderRepository, userRepository } from "../../../../src/server/services";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_register_request" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  try {
    const user = await userRepository.register({
      phone: stringValue(payload.phone),
      password: stringValue(payload.password),
      displayName: stringValue(payload.displayName),
      companyName: stringValue(payload.companyName)
    });
    const account = await rechargeOrderRepository.account(user.id);
    const session = await userRepository.createSession(user.id, stringValue(payload.actorName));
    return NextResponse.json(
      { user: toPublicUser(user), account, actor: { actorId: session.actorId, actorName: session.actorName } },
      {
        status: 201,
        headers: { "Set-Cookie": buildSessionCookie(session.id, session.expiresAt) }
      }
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "register_failed";
    const status = code === "phone_already_registered" ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
