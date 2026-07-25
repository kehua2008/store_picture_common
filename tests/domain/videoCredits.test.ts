import { describe, expect, it } from "vitest";
import { creditRechargePlans, estimateVideoTaskCredits } from "../../src/domain/billing/creditPlans";

describe("common video credit pricing", () => {
  it("matches the clothing-station rule of one video task plus extra reference images", () => {
    const plan = creditRechargePlans[0]!;
    expect(estimateVideoTaskCredits(plan, 1)).toBe(300);
    expect(estimateVideoTaskCredits(plan, 6)).toBe(450);
  });
});
