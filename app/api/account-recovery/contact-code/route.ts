import { NextResponse } from "next/server";
import { normalizePhone } from "../../../../src/domain/auth/passwordRecovery";
import { passwordRecoveryRepository } from "../../../../src/server/services";
import { sendRecoverySms, SmsServiceError } from "../../../../src/server/aliyunSms";
import { requestIp, stringField } from "../../../../src/server/recoveryRequest";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined) as Record<string, unknown> | undefined;
  const phone = normalizePhone(stringField(body?.phone));
  try {
    const issued = await passwordRecoveryRepository.issueCode({ purpose: "recovery_contact", deliveryPhone: phone, ip: requestIp(request) });
    await sendRecoverySms({ purpose: "recovery_contact", phone, code: issued.code });
    return NextResponse.json({ accepted: true, message: "验证码已发送至当前联系手机号。" });
  } catch (error) {
    if (error instanceof SmsServiceError) return NextResponse.json({ error: error.code }, { status: error.code === "sms_not_configured" ? 503 : 502 });
    const code = error instanceof Error ? error.message : "contact_code_send_failed";
    return NextResponse.json({ error: code }, { status: code === "too_many_requests" ? 429 : 400 });
  }
}
