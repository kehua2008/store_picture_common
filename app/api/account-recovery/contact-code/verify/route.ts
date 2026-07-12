import { NextResponse } from "next/server";
import { normalizePhone } from "../../../../../src/domain/auth/passwordRecovery";
import { passwordRecoveryRepository } from "../../../../../src/server/services";
import { stringField } from "../../../../../src/server/recoveryRequest";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined) as Record<string, unknown> | undefined;
  const phone = normalizePhone(stringField(body?.phone));
  try {
    const verified = await passwordRecoveryRepository.verifyCode({ purpose: "recovery_contact", deliveryPhone: phone, code: stringField(body?.code), verificationOnly: true });
    return NextResponse.json({ verificationId: verified.id, verified: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "contact_code_verify_failed" }, { status: 400 });
  }
}
