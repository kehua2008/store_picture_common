import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../src/server/auth";
import { rechargeOrderRepository } from "../../../../src/server/services";
import type { CreditLedgerEntryType } from "../../../../src/domain/billing/rechargeOrders";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId")?.trim();
  const type = url.searchParams.get("type")?.trim() as CreditLedgerEntryType | null;
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  const exportFormat = url.searchParams.get("export");
  const data = await rechargeOrderRepository.all(customerId || undefined);

  const ledgerEntries = data.ledgerEntries.filter((entry) => {
    const createdAt = new Date(entry.createdAt).getTime();
    if (type && entry.type !== type) return false;
    if (from && createdAt < from.getTime()) return false;
    if (to && createdAt > to.getTime()) return false;
    return true;
  });

  if (exportFormat === "csv") {
    return new Response(toCsv(ledgerEntries), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=credit-ledger.csv"
      }
    });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const summaryEntries = data.ledgerEntries;
  const summary = {
    totalBalanceCredits: data.accounts.reduce((sum, account) => sum + account.balanceCredits, 0),
    totalFrozenCredits: data.accounts.reduce((sum, account) => sum + account.frozenCredits, 0),
    totalRechargeCredits: summaryEntries.filter((entry) => entry.type === "recharge_credit").reduce((sum, entry) => sum + entry.deltaBalanceCredits, 0),
    totalConsumedCredits: Math.abs(summaryEntries.filter((entry) => entry.type === "generation_debit").reduce((sum, entry) => sum + entry.deltaFrozenCredits, 0)),
    todayRechargeCredits: summaryEntries.filter((entry) => entry.type === "recharge_credit" && new Date(entry.createdAt) >= todayStart).reduce((sum, entry) => sum + entry.deltaBalanceCredits, 0),
    todayConsumedCredits: Math.abs(summaryEntries.filter((entry) => entry.type === "generation_debit" && new Date(entry.createdAt) >= todayStart).reduce((sum, entry) => sum + entry.deltaFrozenCredits, 0))
  };

  return NextResponse.json({ summary, ledgerEntries, accounts: data.accounts, orders: data.orders });
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toCsv(entries: Awaited<ReturnType<typeof rechargeOrderRepository.all>>["ledgerEntries"]): string {
  const rows = [
    ["id", "customerId", "actorId", "actorName", "type", "deltaBalanceCredits", "deltaFrozenCredits", "balanceCreditsAfter", "frozenCreditsAfter", "rechargeOrderId", "generationJobId", "reason", "operatorId", "createdAt"],
    ...entries.map((entry) => [
      entry.id,
      entry.customerId,
      entry.actorId ?? "",
      entry.actorName ?? "",
      entry.type,
      String(entry.deltaBalanceCredits),
      String(entry.deltaFrozenCredits),
      String(entry.balanceCreditsAfter),
      String(entry.frozenCreditsAfter),
      entry.rechargeOrderId ?? "",
      entry.generationJobId ?? "",
      entry.reason,
      entry.operatorId ?? "",
      entry.createdAt
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
