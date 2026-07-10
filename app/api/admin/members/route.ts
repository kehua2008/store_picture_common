import { NextResponse } from "next/server";
import { toPublicUser } from "../../../../src/domain/auth/users";
import { requireAdminAuth } from "../../../../src/server/auth";
import { rechargeOrderRepository, userRepository } from "../../../../src/server/services";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const [users, billing] = await Promise.all([
    userRepository.all(),
    rechargeOrderRepository.all()
  ]);

  const members = users.map((user) => {
    const account = billing.accounts.find((item) => item.customerId === user.id) ?? {
      customerId: user.id,
      balanceCredits: 0,
      frozenCredits: 0,
      updatedAt: user.createdAt
    };
    const ledgerEntries = billing.ledgerEntries.filter((entry) => entry.customerId === user.id);
    const orders = billing.orders.filter((order) => order.customerId === user.id);
    const totalRechargeCredits = ledgerEntries
      .filter((entry) => entry.type === "recharge_credit")
      .reduce((sum, entry) => sum + entry.deltaBalanceCredits, 0);
    const totalConsumedCredits = Math.abs(ledgerEntries
      .filter((entry) => entry.type === "generation_debit")
      .reduce((sum, entry) => sum + entry.deltaFrozenCredits, 0));
    const taskIds = new Set(ledgerEntries.map((entry) => entry.generationJobId).filter(Boolean));

    return {
      user: toPublicUser(user),
      account,
      totalRechargeCredits,
      totalConsumedCredits,
      rechargeOrderCount: orders.length,
      taskCount: taskIds.size,
      outputCount: Math.floor(totalConsumedCredits / 10),
      recentOrders: orders.slice(0, 5),
      recentLedgerEntries: ledgerEntries.slice(0, 10)
    };
  });

  return NextResponse.json({ members });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_member_update" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  if (!userId) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  if (payload.action === "suspend" || payload.action === "activate") {
    const user = await userRepository.updateStatus(userId, payload.action === "suspend" ? "suspended" : "active");
    if (!user) return NextResponse.json({ error: "member_not_found" }, { status: 404 });
    return NextResponse.json({ user: toPublicUser(user) });
  }

  if (payload.action === "adjust") {
    const deltaCredits = Number(payload.deltaCredits);
    const reason = typeof payload.reason === "string" ? payload.reason : "";
    try {
      const result = await rechargeOrderRepository.adjustCredits({
        customerId: userId,
        deltaCredits,
        reason,
        operatorId: admin.auth.user.id
      });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "adjustment_failed" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "unsupported_member_action" }, { status: 400 });
}
