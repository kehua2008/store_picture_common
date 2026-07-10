import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../src/server/auth";
import { rechargeOrderRepository } from "../../../../src/server/services";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId")?.trim() || undefined;
  return NextResponse.json(await rechargeOrderRepository.all(customerId));
}

export async function POST(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_recharge_review" }, { status: 400 });

  const payload = body as Record<string, unknown>;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const status = payload.status === "approved" || payload.status === "rejected" ? payload.status : undefined;
  if (!id) return NextResponse.json({ error: "missing_recharge_order_id" }, { status: 400 });
  if (status !== "approved" && status !== "rejected") return NextResponse.json({ error: "invalid_recharge_order_status" }, { status: 400 });

  const result = await rechargeOrderRepository.review({
    id,
    status,
    rejectReason: typeof payload.rejectReason === "string" ? payload.rejectReason : undefined
  });
  if (!result) return NextResponse.json({ error: "recharge_order_not_found" }, { status: 404 });
  return NextResponse.json(result);
}
