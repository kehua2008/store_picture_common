import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("password recovery", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "store-common-recovery-"));
    process.env.STORE_COMMON_DATA_DIR = dataDir;
    process.env.STORE_COMMON_UPLOAD_DIR = path.join(dataDir, "uploads");
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.STORE_COMMON_DATA_DIR;
    delete process.env.STORE_COMMON_UPLOAD_DIR;
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("limits, verifies and consumes password-reset codes without storing plaintext", async () => {
    const { FilePasswordRecoveryRepository } = await import("./passwordRecovery");
    const repository = new FilePasswordRecoveryRepository();
    const issued = await repository.issueCode({ purpose: "password_reset", originalPhone: "13800000001", deliveryPhone: "13800000001", ip: "203.0.113.1" });

    const persisted = await readFile(path.join(dataDir, "password-recovery.json"), "utf8");
    expect(persisted).not.toContain(issued.code);

    await expect(repository.verifyCode({ purpose: "password_reset", originalPhone: "13800000001", deliveryPhone: "13800000001", code: "000000" })).rejects.toMatchObject({ code: "invalid_code" });
    await expect(repository.verifyCode({ purpose: "password_reset", originalPhone: "13800000001", deliveryPhone: "13800000001", code: issued.code })).resolves.toMatchObject({ id: issued.id, consumedAt: expect.any(String) });
    await expect(repository.verifyCode({ purpose: "password_reset", originalPhone: "13800000001", deliveryPhone: "13800000001", code: issued.code })).rejects.toMatchObject({ code: "invalid_code" });
    await expect(repository.issueCode({ purpose: "password_reset", originalPhone: "13800000001", deliveryPhone: "13800000001", ip: "203.0.113.1" })).rejects.toMatchObject({ code: "too_many_requests" });
  });

  it("requires contact verification and completes a manual reset with session invalidation", async () => {
    const { FilePasswordRecoveryRepository } = await import("./passwordRecovery");
    const { FileUserRepository } = await import("./users");
    const recovery = new FilePasswordRecoveryRepository();
    const users = new FileUserRepository();
    const user = await users.register({ phone: "13800000002", password: "old-password" });
    const oldSession = await users.createSession(user.id);

    const contact = await recovery.issueCode({ purpose: "recovery_contact", deliveryPhone: "13900000002", ip: "203.0.113.2" });
    await expect(recovery.createApplication({ originalPhone: user.phone, contactPhone: "13900000002", verificationId: contact.id, description: "原手机号无法使用", proofs: [] })).rejects.toMatchObject({ code: "verification_required" });
    await recovery.verifyCode({ id: contact.id, purpose: "recovery_contact", deliveryPhone: "13900000002", code: contact.code, verificationOnly: true });
    const application = await recovery.createApplication({ originalPhone: user.phone, contactPhone: "13900000002", verificationId: contact.id, description: "原手机号无法使用", proofs: [] });

    const manual = await recovery.issueCode({ purpose: "manual_recovery_reset", originalPhone: user.phone, deliveryPhone: "13900000002", applicationId: application.id, ip: "203.0.113.2" });
    await recovery.reviewApplication({ id: application.id, action: "approve", actorId: "user-admin", resetCode: manual });
    await recovery.verifyCode({ purpose: "manual_recovery_reset", originalPhone: user.phone, deliveryPhone: "13900000002", applicationId: application.id, code: manual.code });
    await users.resetPassword(user.id, "new-password");
    await recovery.markApplicationCompleted(application.id, user.phone, "13900000002");

    expect(await users.findSession(oldSession.id)).toBeUndefined();
    await expect(users.verifyLogin({ phone: user.phone, password: "old-password" })).resolves.toBeUndefined();
    await expect(users.verifyLogin({ phone: user.phone, password: "new-password" })).resolves.toMatchObject({ id: user.id });
    expect((await recovery.applications()).find((item) => item.id === application.id)?.status).toBe("completed");
    expect((await recovery.auditEvents()).map((item) => item.type)).toContain("password_reset");
  });
});
