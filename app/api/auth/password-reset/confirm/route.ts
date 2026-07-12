import { NextResponse } from "next/server";
import { normalizePhone } from "../../../../../src/domain/auth/passwordRecovery";
import { toPublicUser } from "../../../../../src/domain/auth/users";
import { buildSessionCookie } from "../../../../../src/server/auth";
import { passwordRecoveryRepository, rechargeOrderRepository, userRepository } from "../../../../../src/server/services";
import { stringField } from "../../../../../src/server/recoveryRequest";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined) as Record<string, unknown> | undefined;
  const phone = normalizePhone(stringField(body?.phone));
  const code = stringField(body?.code);
  const password = stringField(body?.password);
  const manual = body?.manual === true;
  const contactPhone = normalizePhone(stringField(body?.contactPhone)) || phone;
  try {
    const user = await userRepository.findByPhone(phone);
    if (!user || user.status !== "active") return NextResponse.json({ error: "invalid_reset_request" }, { status: 400 });
    const verified = await passwordRecoveryRepository.verifyCode({
      purpose: manual ? "manual_recovery_reset" : "password_reset",
      originalPhone: phone,
      deliveryPhone: contactPhone,
      code
    });
    const updated = await userRepository.resetPassword(user.id, password);
    if (!updated) return NextResponse.json({ error: "invalid_reset_request" }, { status: 400 });
    if (manual && verified.applicationId) await passwordRecoveryRepository.markApplicationCompleted(verified.applicationId, phone, contactPhone);
    else await passwordRecoveryRepository.recordPasswordReset({ purpose: "password_reset", originalPhone: phone, contactPhone: phone });
    const session = await userRepository.createSession(updated.id);
    const account = await rechargeOrderRepository.account(updated.id);
    return NextResponse.json(
      { user: toPublicUser(updated), account, actor: { actorId: session.actorId, actorName: session.actorName } },
      { headers: { "Set-Cookie": buildSessionCookie(session.id, session.expiresAt) } }
    );
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "password_reset_failed";
    return NextResponse.json({ error: errorCode }, { status: ["too_many_attempts", "invalid_code", "code_expired"].includes(errorCode) ? 400 : 400 });
  }
}
