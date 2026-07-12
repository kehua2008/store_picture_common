import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("FileRechargeOrderRepository credit ledger", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "store-common-billing-"));
    process.env.STORE_COMMON_DATA_DIR = dataDir;
    delete process.env.STORE_COMMON_DEMO_DATA;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.STORE_COMMON_DATA_DIR;
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("adjusts, reserves, debits and releases generation credits", async () => {
    const { FileRechargeOrderRepository } = await import("./rechargeOrders");
    const repository = new FileRechargeOrderRepository();

    const seeded = await repository.adjustCredits({ customerId: "user-1", deltaCredits: 100, reason: "seed credits" });
    expect(seeded.account).toMatchObject({ balanceCredits: 100, frozenCredits: 0 });

    const reserved = await repository.reserveGenerationCredits({
      customerId: "user-1",
      generationJobId: "job-success",
      credits: 30,
      actorId: "actor-1",
      actorName: "测试运营"
    });
    expect(reserved.account).toMatchObject({ balanceCredits: 70, frozenCredits: 30 });
    expect(reserved.ledgerEntry.type).toBe("generation_reserve");

    const debited = await repository.debitReservedGenerationCredits({
      customerId: "user-1",
      generationJobId: "job-success",
      credits: 30
    });
    expect(debited?.account).toMatchObject({ balanceCredits: 70, frozenCredits: 0 });
    expect(debited?.ledgerEntry.type).toBe("generation_debit");

    const duplicateDebit = await repository.debitReservedGenerationCredits({
      customerId: "user-1",
      generationJobId: "job-success",
      credits: 30
    });
    expect(duplicateDebit).toBeUndefined();

    await repository.reserveGenerationCredits({ customerId: "user-1", generationJobId: "job-failed", credits: 20 });
    const released = await repository.releaseReservedGenerationCredits({
      customerId: "user-1",
      generationJobId: "job-failed",
      credits: 20
    });
    expect(released?.account).toMatchObject({ balanceCredits: 70, frozenCredits: 0 });
    expect(released?.ledgerEntry.type).toBe("generation_release");

    const data = await repository.all("user-1");
    expect(data.ledgerEntries.map((entry) => entry.type)).toEqual([
      "generation_release",
      "generation_reserve",
      "generation_debit",
      "generation_reserve",
      "admin_adjustment"
    ]);
  });

  it("rejects generation reservations when balance is insufficient", async () => {
    const { FileRechargeOrderRepository } = await import("./rechargeOrders");
    const repository = new FileRechargeOrderRepository();

    await repository.adjustCredits({ customerId: "user-2", deltaCredits: 10, reason: "seed credits" });
    await expect(
      repository.reserveGenerationCredits({ customerId: "user-2", generationJobId: "job-too-large", credits: 30 })
    ).rejects.toThrow("insufficient_credits");

    const { accounts, ledgerEntries } = await repository.all("user-2");
    expect(accounts[0]).toMatchObject({ balanceCredits: 10, frozenCredits: 0 });
    expect(ledgerEntries).toHaveLength(1);
  });
});
