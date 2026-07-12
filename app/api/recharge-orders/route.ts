import { NextResponse } from "next/server";
import { normalizeCreditPlanId, normalizeRechargePaymentMethod } from "../../../src/domain/billing/rechargeOrders";
import { rechargeOrderRepository } from "../../../src/server/services";
import { getAuthContextFromRequest, requireAdminAuth } from "../../../src/server/auth";
import { validateImageUpload } from "../../../src/server/uploadValidation";

const maxProofBytes = 8 * 1024 * 1024;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminView = url.searchParams.get("admin") === "1";
  if (adminView) {
    const admin = await requireAdminAuth(request);
    if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });
    const customerId = url.searchParams.get("customerId")?.trim() || undefined;
    const data = await rechargeOrderRepository.all(customerId);
    return NextResponse.json(data);
  }

  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const data = await rechargeOrderRepository.all(auth.user.id);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const formData = await request.formData().catch(() => undefined);
  if (!formData) return NextResponse.json({ error: "invalid_multipart_request" }, { status: 400 });

  const planId = normalizeCreditPlanId(formData.get("planId"));
  if (!planId) return NextResponse.json({ error: "unknown_credit_plan" }, { status: 400 });

  const proofValidation = await validateImageUpload(formData.get("proof"), {
    maxBytes: maxProofBytes,
    missingError: "missing_payment_proof",
    invalidTypeError: "invalid_payment_proof_type",
    tooLargeError: "payment_proof_too_large",
    invalidContentError: "invalid_payment_proof_content"
  });
  if (!proofValidation.file) return NextResponse.json({ error: proofValidation.error }, { status: 400 });

  const result = await rechargeOrderRepository.create({
    customerId: auth.user.id,
    planId,
    paymentMethod: normalizeRechargePaymentMethod(formData.get("paymentMethod")),
    proof: proofValidation.file
  });

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_recharge_review" }, { status: 400 });

  const payload = body as Record<string, unknown>;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const status = payload.status === "approved" || payload.status === "rejected" ? payload.status : undefined;
  if (!id) return NextResponse.json({ error: "missing_recharge_order_id" }, { status: 400 });
  if (!status) return NextResponse.json({ error: "invalid_recharge_order_status" }, { status: 400 });

  const result = await rechargeOrderRepository.review({
    id,
    status,
    rejectReason: typeof payload.rejectReason === "string" ? payload.rejectReason : undefined
  });
  if (!result) return NextResponse.json({ error: "recharge_order_not_found" }, { status: 404 });
  return NextResponse.json(result);
}
