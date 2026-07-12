import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../src/server/auth";
import { passwordRecoveryRepository, userRepository } from "../../../../src/server/services";
import { sendRecoverySms, SmsServiceError } from "../../../../src/server/aliyunSms";
import { requestIp, stringField } from "../../../../src/server/recoveryRequest";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const applications = await passwordRecoveryRepository.applications();
  const hydrated = await Promise.all(applications.map(async (application) => {
    const user = await userRepository.findByPhone(application.originalPhone);
    return { ...application, account: user ? { id: user.id, status: user.status, createdAt: user.createdAt } : undefined };
  }));
  return NextResponse.json({ applications: hydrated });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const body = await request.json().catch(() => undefined) as Record<string, unknown> | undefined;
  const id = stringField(body?.id);
  const action = stringField(body?.action);
  const adminNote = stringField(body?.adminNote);
  if (!id || (action !== "approve" && action !== "reject")) return NextResponse.json({ error: "invalid_recovery_review" }, { status: 400 });
  try {
    if (action === "reject") {
      if (!adminNote) return NextResponse.json({ error: "missing_admin_note" }, { status: 400 });
      return NextResponse.json({ application: await passwordRecoveryRepository.reviewApplication({ id, action, adminNote, actorId: admin.auth.user.id }) });
    }
    const application = (await passwordRecoveryRepository.applications()).find((item) => item.id === id);
    if (!application) return NextResponse.json({ error: "recovery_application_not_found" }, { status: 404 });
    const user = await userRepository.findByPhone(application.originalPhone);
    if (!user || user.status !== "active") return NextResponse.json({ error: "recovery_account_unavailable" }, { status: 400 });
    const issued = await passwordRecoveryRepository.issueCode({ purpose: "manual_recovery_reset", originalPhone: application.originalPhone, deliveryPhone: application.contactPhone, applicationId: application.id, ip: requestIp(request) });
    await sendRecoverySms({ purpose: "manual_recovery_reset", phone: application.contactPhone, code: issued.code });
    const reviewed = await passwordRecoveryRepository.reviewApplication({ id, action, adminNote, actorId: admin.auth.user.id, resetCode: issued });
    return NextResponse.json({ application: reviewed });
  } catch (error) {
    if (error instanceof SmsServiceError) return NextResponse.json({ error: error.code }, { status: error.code === "sms_not_configured" ? 503 : 502 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "account_recovery_review_failed" }, { status: 400 });
  }
}
