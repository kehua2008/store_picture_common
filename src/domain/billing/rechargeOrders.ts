import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { creditRechargePlanById, creditRechargePlans, defaultCreditRechargePlan, type CreditPlanId, type CreditRechargePlan } from "./creditPlans";
import { persistentDataDir, persistentUploadSubdir } from "../../server/storagePaths";

export type RechargeOrderStatus = "pending" | "approved" | "rejected";
export type RechargePaymentMethod = "wechat" | "alipay";

export interface RechargeAccount {
  customerId: string;
  balanceCredits: number;
  frozenCredits: number;
  updatedAt: string;
}

export type CreditLedgerEntryType =
  | "recharge_credit"
  | "generation_reserve"
  | "generation_debit"
  | "generation_release"
  | "style_analysis_debit"
  | "usage_debit"
  | "admin_adjustment";

export interface CreditLedgerEntry {
  id: string;
  customerId: string;
  actorId?: string;
  actorName?: string;
  type: CreditLedgerEntryType;
  deltaBalanceCredits: number;
  deltaFrozenCredits: number;
  balanceCreditsAfter: number;
  frozenCreditsAfter: number;
  rechargeOrderId?: string;
  generationJobId?: string;
  styleSampleId?: string;
  reason: string;
  operatorId?: string;
  createdAt: string;
}

export interface RechargeOrder {
  id: string;
  customerId: string;
  planId: CreditPlanId;
  planLabel: string;
  credits: number;
  priceCny: number;
  paymentMethod: RechargePaymentMethod;
  proofFilename: string;
  proofImageUrl: string;
  status: RechargeOrderStatus;
  rejectReason?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface RechargeOrderData {
  accounts: RechargeAccount[];
  orders: RechargeOrder[];
  ledgerEntries: CreditLedgerEntry[];
}

const dataDir = persistentDataDir();
const proofDir = persistentUploadSubdir("recharge-proofs");
const dataFile = path.join(dataDir, "recharge-orders.json");

const seedData: RechargeOrderData = {
  accounts: [
    { customerId: "common-u-1008", balanceCredits: 28600, frozenCredits: 1200, updatedAt: "2026-07-09T10:52:00+08:00" },
    { customerId: "common-u-1016", balanceCredits: 18420, frozenCredits: 0, updatedAt: "2026-07-09T09:18:00+08:00" },
    { customerId: "common-u-1022", balanceCredits: 3200, frozenCredits: 0, updatedAt: "2026-07-08T17:42:00+08:00" }
  ],
  orders: [
    { id: "rc-common-2401", customerId: "common-u-1008", planId: "credits-9990", planLabel: "9990 积分", credits: 9990, priceCny: 999, paymentMethod: "wechat", proofFilename: "wechat-proof-common-2401.webp", proofImageUrl: "/homepage-assets/optimized/common-choice-image-420w.webp", status: "pending", createdAt: "2026-07-09T09:42:00+08:00", updatedAt: "2026-07-09T09:42:00+08:00" },
    { id: "rc-common-2402", customerId: "common-u-1016", planId: "credits-29990", planLabel: "29990 积分", credits: 29990, priceCny: 2999, paymentMethod: "alipay", proofFilename: "alipay-proof-common-2402.webp", proofImageUrl: "/homepage-assets/optimized/common-home-entry-poster-480w.webp", status: "pending", createdAt: "2026-07-09T10:18:00+08:00", updatedAt: "2026-07-09T10:18:00+08:00" },
    { id: "rc-common-2398", customerId: "common-u-1022", planId: "credits-2990", planLabel: "2990 积分", credits: 2990, priceCny: 299, paymentMethod: "wechat", proofFilename: "wechat-proof-common-2398.webp", proofImageUrl: "/video-choice-assets/optimized/common-video-choice-reference-blue-420w.webp", status: "approved", reviewedAt: "2026-07-08T16:01:00+08:00", createdAt: "2026-07-08T15:20:00+08:00", updatedAt: "2026-07-08T16:01:00+08:00" }
  ],
  ledgerEntries: [
    { id: "lg-common-9001", customerId: "common-u-1008", actorName: "华南百货运营组", type: "recharge_credit", deltaBalanceCredits: 12000, deltaFrozenCredits: 0, balanceCreditsAfter: 28600, frozenCreditsAfter: 1200, rechargeOrderId: "rc-common-2386", reason: "充值审核通过：企业补充包", operatorId: "admin", createdAt: "2026-07-09T10:35:00+08:00" },
    { id: "lg-common-9002", customerId: "common-u-1008", actorName: "华南百货运营组", type: "generation_reserve", deltaBalanceCredits: -1200, deltaFrozenCredits: 1200, balanceCreditsAfter: 27400, frozenCreditsAfter: 1200, generationJobId: "job-common-7801", reason: "批量生成商品主图预扣", createdAt: "2026-07-09T10:52:00+08:00" },
    { id: "lg-common-9003", customerId: "common-u-1016", actorName: "家居日用品账号", type: "generation_debit", deltaBalanceCredits: 0, deltaFrozenCredits: -800, balanceCreditsAfter: 18420, frozenCreditsAfter: 0, generationJobId: "job-common-7794", reason: "视频生成成功扣费", createdAt: "2026-07-09T09:18:00+08:00" },
    { id: "lg-common-9004", customerId: "common-u-1022", actorName: "小商品直播间", type: "admin_adjustment", deltaBalanceCredits: 500, deltaFrozenCredits: 0, balanceCreditsAfter: 3200, frozenCreditsAfter: 0, reason: "异常任务补偿", operatorId: "admin", createdAt: "2026-07-08T17:42:00+08:00" }
  ]
};

export class FileRechargeOrderRepository {
  private mutationQueue: Promise<void> = Promise.resolve();

  async all(customerId?: string): Promise<RechargeOrderData> {
    const data = await this.readData();
    return {
      accounts: customerId ? data.accounts.filter((account) => account.customerId === customerId) : data.accounts,
      orders: customerId ? data.orders.filter((order) => order.customerId === customerId) : data.orders,
      ledgerEntries: customerId ? data.ledgerEntries.filter((entry) => entry.customerId === customerId) : data.ledgerEntries
    };
  }

  async account(customerId: string): Promise<RechargeAccount> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const now = new Date().toISOString();
      const account = findOrCreateAccount(data, customerId, now);
      await this.writeData(data);
      return account;
    });
  }

  async pricingPlanForCustomer(customerId: string): Promise<CreditRechargePlan> {
    const data = await this.readData();
    const approvedOrders = data.orders.filter((order) => order.customerId === customerId && order.status === "approved");
    const highestOrder = approvedOrders.sort((left, right) => right.priceCny - left.priceCny)[0];
    return highestOrder ? creditRechargePlanById(highestOrder.planId) : defaultCreditRechargePlan();
  }

  async create(input: { customerId: string; planId: CreditPlanId; paymentMethod: RechargePaymentMethod; proof: File }): Promise<{ account: RechargeAccount; order: RechargeOrder }> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const plan = creditRechargePlans.find((item) => item.id === input.planId);
      if (!plan) throw new Error("unknown_credit_plan");

      const now = new Date().toISOString();
      const account = findOrCreateAccount(data, input.customerId, now);
      await mkdir(proofDir, { recursive: true });
      const id = `recharge-${crypto.randomUUID()}`;
      const proofFilename = safeFilename(input.proof.name || `${id}.jpg`);
      const storedName = `${id}-${proofFilename}`;
      const bytes = Buffer.from(await input.proof.arrayBuffer());
      await writeFile(path.join(proofDir, storedName), bytes);

      const order: RechargeOrder = {
        id,
        customerId: input.customerId,
        planId: plan.id,
        planLabel: plan.label,
        credits: plan.credits,
        priceCny: plan.priceCny,
        paymentMethod: input.paymentMethod,
        proofFilename,
        proofImageUrl: `/recharge-proofs/${storedName}`,
        status: "pending",
        createdAt: now,
        updatedAt: now
      };

      data.orders = [order, ...data.orders];
      await this.writeData(data);
      return { account, order };
    });
  }

  async review(input: { id: string; status: "approved" | "rejected"; rejectReason?: string }): Promise<{ account: RechargeAccount; order: RechargeOrder } | undefined> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const target = data.orders.find((order) => order.id === input.id);
      if (!target) return undefined;

      const now = new Date().toISOString();
      const account = findOrCreateAccount(data, target.customerId, now);
      if (target.status !== "pending") return { account, order: target };

      const updated: RechargeOrder = {
        ...target,
        status: input.status,
        rejectReason: input.status === "rejected" ? input.rejectReason?.trim() || "付款信息无法核验，请补充截图或流水。" : undefined,
        reviewedAt: now,
        updatedAt: now
      };

      if (input.status === "approved") {
        appendLedgerEntry(data, account, {
          type: "recharge_credit",
          deltaBalanceCredits: target.credits,
          deltaFrozenCredits: 0,
          rechargeOrderId: target.id,
          reason: `充值审核通过：${target.planLabel}`,
          operatorId: "admin"
        }, now);
      }

      data.accounts = data.accounts.map((item) => item.customerId === account.customerId ? account : item);
      data.orders = data.orders.map((order) => order.id === input.id ? updated : order);
      await this.writeData(data);
      return { account, order: updated };
    });
  }

  async adjustCredits(input: { customerId: string; deltaCredits: number; reason: string; operatorId?: string }): Promise<{ account: RechargeAccount; ledgerEntry: CreditLedgerEntry }> {
    const deltaCredits = Math.trunc(input.deltaCredits);
    if (deltaCredits === 0) throw new Error("invalid_credit_amount");
    if (!input.reason.trim()) throw new Error("missing_adjustment_reason");

    return this.runExclusive(async () => {
      const data = await this.readData();
      const now = new Date().toISOString();
      const account = findOrCreateAccount(data, input.customerId, now);
      if (account.balanceCredits + deltaCredits < 0) throw new Error("insufficient_credits");
      const ledgerEntry = appendLedgerEntry(data, account, {
        type: "admin_adjustment",
        deltaBalanceCredits: deltaCredits,
        deltaFrozenCredits: 0,
        reason: input.reason.trim(),
        operatorId: input.operatorId ?? "admin"
      }, now);
      data.accounts = data.accounts.map((item) => item.customerId === account.customerId ? account : item);
      await this.writeData(data);
      return { account, ledgerEntry };
    });
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationQueue;
    let release: () => void = () => undefined;
    this.mutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async readData(): Promise<RechargeOrderData> {
    try {
      const raw = await readFile(dataFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<RechargeOrderData>;
      return {
        accounts: Array.isArray(parsed.accounts) && parsed.accounts.length ? parsed.accounts.map(normalizeAccount) : seedData.accounts,
        orders: Array.isArray(parsed.orders) && parsed.orders.length ? parsed.orders : seedData.orders,
        ledgerEntries: Array.isArray(parsed.ledgerEntries) && parsed.ledgerEntries.length ? parsed.ledgerEntries : seedData.ledgerEntries
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return seedData;
    }
  }

  private async writeData(data: RechargeOrderData): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const tempFile = `${dataFile}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempFile, JSON.stringify(data, null, 2));
    await rename(tempFile, dataFile);
  }
}

export function normalizeRechargePaymentMethod(input: unknown): RechargePaymentMethod {
  return input === "alipay" ? "alipay" : "wechat";
}

export function normalizeCreditPlanId(input: unknown): CreditPlanId | undefined {
  return typeof input === "string" && creditRechargePlans.some((plan) => plan.id === input) ? input as CreditPlanId : undefined;
}

function findOrCreateAccount(data: RechargeOrderData, customerId: string, now: string): RechargeAccount {
  const existing = data.accounts.find((account) => account.customerId === customerId);
  if (existing) return normalizeAccount(existing);
  const account = { customerId, balanceCredits: 0, frozenCredits: 0, updatedAt: now };
  data.accounts = [account, ...data.accounts];
  return account;
}

function appendLedgerEntry(
  data: RechargeOrderData,
  account: RechargeAccount,
  input: Omit<CreditLedgerEntry, "id" | "customerId" | "balanceCreditsAfter" | "frozenCreditsAfter" | "createdAt">,
  now: string
): CreditLedgerEntry {
  account.balanceCredits += input.deltaBalanceCredits;
  account.frozenCredits += input.deltaFrozenCredits;
  account.updatedAt = now;
  if (account.balanceCredits < 0 || account.frozenCredits < 0) throw new Error("negative_credit_account");

  const entry: CreditLedgerEntry = {
    id: `ledger-${crypto.randomUUID()}`,
    customerId: account.customerId,
    ...input,
    balanceCreditsAfter: account.balanceCredits,
    frozenCreditsAfter: account.frozenCredits,
    createdAt: now
  };
  data.ledgerEntries = [entry, ...data.ledgerEntries];
  return entry;
}

function normalizeAccount(account: RechargeAccount): RechargeAccount {
  return {
    customerId: account.customerId,
    balanceCredits: Number.isFinite(account.balanceCredits) ? account.balanceCredits : 0,
    frozenCredits: Number.isFinite(account.frozenCredits) ? account.frozenCredits : 0,
    updatedAt: account.updatedAt
  };
}

function safeFilename(filename: string): string {
  return filename.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "payment-proof.jpg";
}
