import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { persistentDataDir, persistentUploadSubdir } from "../../server/storagePaths";

export type RecoveryCodePurpose = "password_reset" | "recovery_contact" | "manual_recovery_reset";
export type AccountRecoveryStatus = "pending" | "approved" | "rejected" | "completed";

export interface RecoveryProof {
  filename: string;
  imageUrl: string;
}

export interface AccountRecoveryApplication {
  id: string;
  originalPhone: string;
  contactPhone: string;
  contactVerificationId: string;
  description: string;
  proofs: RecoveryProof[];
  status: AccountRecoveryStatus;
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  resetCodeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordRecoveryAuditEvent {
  id: string;
  type: "code_sent" | "code_verified" | "password_reset" | "application_submitted" | "application_approved" | "application_rejected";
  purpose?: RecoveryCodePurpose;
  originalPhone?: string;
  contactPhone?: string;
  applicationId?: string;
  actorId?: string;
  createdAt: string;
}

interface RecoveryCode {
  id: string;
  purpose: RecoveryCodePurpose;
  originalPhone?: string;
  deliveryPhone: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  consumedAt?: string;
  applicationId?: string;
  createdAt: string;
}

interface SendRecord {
  id: string;
  purpose: RecoveryCodePurpose;
  deliveryPhone: string;
  ip: string;
  createdAt: string;
}

interface PasswordRecoveryData {
  codes: RecoveryCode[];
  sendRecords: SendRecord[];
  applications: AccountRecoveryApplication[];
  auditEvents: PasswordRecoveryAuditEvent[];
}

export class PasswordRecoveryError extends Error {
  constructor(
    public readonly code: "invalid_phone" | "code_expired" | "invalid_code" | "too_many_attempts" | "too_many_requests" | "verification_required" | "recovery_application_not_found" | "invalid_recovery_status",
  ) {
    super(code);
  }
}

const dataDir = persistentDataDir();
const dataFile = path.join(dataDir, "password-recovery.json");
const proofDir = persistentUploadSubdir("account-recovery-proofs");
const codeTtlMs = 10 * 60 * 1000;
const verificationTtlMs = 30 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const dailyWindowMs = 24 * 60 * 60 * 1000;
const maxPhoneSendsPerDay = 5;
const maxIpSendsPerDay = 10;
const maxAttempts = 5;

export class FilePasswordRecoveryRepository {
  private mutationQueue: Promise<void> = Promise.resolve();

  async issueCode(input: { purpose: RecoveryCodePurpose; originalPhone?: string; deliveryPhone: string; ip: string; applicationId?: string }): Promise<{ id: string; code: string; expiresAt: string }> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const now = Date.now();
      const deliveryPhone = normalizePhone(input.deliveryPhone);
      if (!isValidPhone(deliveryPhone)) throw new PasswordRecoveryError("invalid_phone");
      this.consumeSendAllowance(data, input.purpose, deliveryPhone, input.ip, now);

      const code = randomCode();
      const id = `recovery-code-${crypto.randomUUID()}`;
      const expiresAt = new Date(now + codeTtlMs).toISOString();
      data.codes = [{
        id,
        purpose: input.purpose,
        originalPhone: input.originalPhone ? normalizePhone(input.originalPhone) : undefined,
        deliveryPhone,
        codeHash: hashCode(code),
        attempts: 0,
        maxAttempts,
        expiresAt,
        applicationId: input.applicationId,
        createdAt: new Date(now).toISOString()
      }, ...data.codes.filter((item) => !(item.purpose === input.purpose && item.deliveryPhone === deliveryPhone && !item.consumedAt))];
      this.record(data, { type: "code_sent", purpose: input.purpose, originalPhone: input.originalPhone, contactPhone: deliveryPhone, applicationId: input.applicationId, createdAt: new Date(now).toISOString() });
      this.trim(data, now);
      await this.writeData(data);
      return { id, code, expiresAt };
    });
  }

  async recordSendAttempt(input: { purpose: RecoveryCodePurpose; deliveryPhone: string; ip: string }): Promise<void> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const now = Date.now();
      const deliveryPhone = normalizePhone(input.deliveryPhone);
      if (!isValidPhone(deliveryPhone)) throw new PasswordRecoveryError("invalid_phone");
      this.consumeSendAllowance(data, input.purpose, deliveryPhone, input.ip, now);
      this.trim(data, now);
      await this.writeData(data);
    });
  }

  async verifyCode(input: { id?: string; purpose: RecoveryCodePurpose; originalPhone?: string; deliveryPhone: string; code: string; applicationId?: string; verificationOnly?: boolean }): Promise<RecoveryCode> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const now = Date.now();
      const deliveryPhone = normalizePhone(input.deliveryPhone);
      const code = data.codes.find((item) =>
        !item.consumedAt && item.purpose === input.purpose && item.deliveryPhone === deliveryPhone &&
        (!input.id || item.id === input.id) &&
        (!input.originalPhone || item.originalPhone === normalizePhone(input.originalPhone)) &&
        (!input.applicationId || item.applicationId === input.applicationId)
      );
      if (!code) throw new PasswordRecoveryError("invalid_code");
      if (new Date(code.expiresAt).getTime() <= now) throw new PasswordRecoveryError("code_expired");
      if (code.attempts >= code.maxAttempts) throw new PasswordRecoveryError("too_many_attempts");

      const valid = verifyCodeHash(input.code, code.codeHash);
      const updated = {
        ...code,
        attempts: code.attempts + 1,
        consumedAt: valid ? new Date(now).toISOString() : undefined,
        expiresAt: input.verificationOnly && valid ? new Date(now + verificationTtlMs).toISOString() : code.expiresAt
      };
      data.codes = data.codes.map((item) => item.id === code.id ? updated : item);
      if (!valid) {
        await this.writeData(data);
        throw new PasswordRecoveryError(updated.attempts >= updated.maxAttempts ? "too_many_attempts" : "invalid_code");
      }
      this.record(data, { type: "code_verified", purpose: input.purpose, originalPhone: updated.originalPhone, contactPhone: updated.deliveryPhone, applicationId: updated.applicationId, createdAt: new Date(now).toISOString() });
      await this.writeData(data);
      return updated;
    });
  }

  async createApplication(input: { originalPhone: string; contactPhone: string; verificationId: string; description: string; proofs: File[] }): Promise<AccountRecoveryApplication> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const now = new Date().toISOString();
      const originalPhone = normalizePhone(input.originalPhone);
      const contactPhone = normalizePhone(input.contactPhone);
      const verification = data.codes.find((item) => item.id === input.verificationId && item.purpose === "recovery_contact" && item.deliveryPhone === contactPhone && item.consumedAt && new Date(item.expiresAt).getTime() > Date.now());
      if (!verification) throw new PasswordRecoveryError("verification_required");
      if (!isValidPhone(originalPhone) || !isValidPhone(contactPhone)) throw new PasswordRecoveryError("invalid_phone");

      const id = `account-recovery-${crypto.randomUUID()}`;
      const proofs = await this.storeProofs(id, input.proofs);
      const application: AccountRecoveryApplication = { id, originalPhone, contactPhone, contactVerificationId: verification.id, description: input.description.trim(), proofs, status: "pending", createdAt: now, updatedAt: now };
      data.applications = [application, ...data.applications];
      this.record(data, { type: "application_submitted", originalPhone, contactPhone, applicationId: id, createdAt: now });
      await this.writeData(data);
      return application;
    });
  }

  async applications(): Promise<AccountRecoveryApplication[]> {
    return (await this.readData()).applications;
  }

  async reviewApplication(input: { id: string; action: "approve" | "reject"; adminNote?: string; actorId: string; resetCode?: { id: string; expiresAt: string } }): Promise<AccountRecoveryApplication> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const current = data.applications.find((item) => item.id === input.id);
      if (!current) throw new PasswordRecoveryError("recovery_application_not_found");
      if (current.status !== "pending") throw new PasswordRecoveryError("invalid_recovery_status");
      const now = new Date().toISOString();
      const status: AccountRecoveryStatus = input.action === "approve" ? "approved" : "rejected";
      const updated: AccountRecoveryApplication = { ...current, status, adminNote: input.adminNote?.trim() || undefined, reviewedBy: input.actorId, reviewedAt: now, resetCodeId: input.resetCode?.id, updatedAt: now };
      data.applications = data.applications.map((item) => item.id === current.id ? updated : item);
      this.record(data, { type: input.action === "approve" ? "application_approved" : "application_rejected", originalPhone: updated.originalPhone, contactPhone: updated.contactPhone, applicationId: updated.id, actorId: input.actorId, createdAt: now });
      await this.writeData(data);
      return updated;
    });
  }

  async markApplicationCompleted(applicationId: string, originalPhone: string, contactPhone: string): Promise<void> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const current = data.applications.find((item) => item.id === applicationId);
      if (!current || current.status !== "approved" || current.originalPhone !== normalizePhone(originalPhone) || current.contactPhone !== normalizePhone(contactPhone)) throw new PasswordRecoveryError("invalid_recovery_status");
      const now = new Date().toISOString();
      data.applications = data.applications.map((item) => item.id === current.id ? { ...item, status: "completed", updatedAt: now } : item);
      this.record(data, { type: "password_reset", purpose: "manual_recovery_reset", originalPhone: current.originalPhone, contactPhone: current.contactPhone, applicationId, createdAt: now });
      await this.writeData(data);
    });
  }

  async recordPasswordReset(input: { purpose: RecoveryCodePurpose; originalPhone: string; contactPhone: string; applicationId?: string }): Promise<void> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      this.record(data, { type: "password_reset", ...input, createdAt: new Date().toISOString() });
      await this.writeData(data);
    });
  }

  async auditEvents(): Promise<PasswordRecoveryAuditEvent[]> {
    return (await this.readData()).auditEvents;
  }

  private assertSendAllowed(data: PasswordRecoveryData, purpose: RecoveryCodePurpose, deliveryPhone: string, ip: string, now: number): void {
    const recent = data.sendRecords.filter((item) => now - new Date(item.createdAt).getTime() < dailyWindowMs);
    const phoneRecords = recent.filter((item) => item.purpose === purpose && item.deliveryPhone === deliveryPhone);
    if (phoneRecords.some((item) => now - new Date(item.createdAt).getTime() < resendCooldownMs) || phoneRecords.length >= maxPhoneSendsPerDay || recent.filter((item) => item.ip === normalizedIp(ip)).length >= maxIpSendsPerDay) {
      throw new PasswordRecoveryError("too_many_requests");
    }
  }

  private consumeSendAllowance(data: PasswordRecoveryData, purpose: RecoveryCodePurpose, deliveryPhone: string, ip: string, now: number): void {
    this.assertSendAllowed(data, purpose, deliveryPhone, ip, now);
    data.sendRecords = [{ id: `recovery-send-${crypto.randomUUID()}`, purpose, deliveryPhone, ip: normalizedIp(ip), createdAt: new Date(now).toISOString() }, ...data.sendRecords];
  }

  private record(data: PasswordRecoveryData, event: Omit<PasswordRecoveryAuditEvent, "id">): void {
    data.auditEvents = [{ id: `recovery-audit-${crypto.randomUUID()}`, ...event }, ...data.auditEvents];
  }

  private trim(data: PasswordRecoveryData, now: number): void {
    data.codes = data.codes.filter((item) => new Date(item.expiresAt).getTime() > now - dailyWindowMs);
    data.sendRecords = data.sendRecords.filter((item) => now - new Date(item.createdAt).getTime() < dailyWindowMs);
    data.auditEvents = data.auditEvents.slice(0, 5000);
  }

  private async storeProofs(applicationId: string, files: File[]): Promise<RecoveryProof[]> {
    await mkdir(proofDir, { recursive: true });
    const proofs: RecoveryProof[] = [];
    for (const file of files.slice(0, 3)) {
      const filename = safeFilename(file.name || "proof.png");
      const storedName = `${applicationId}-${proofs.length + 1}-${filename}`;
      await writeFile(path.join(proofDir, storedName), Buffer.from(await file.arrayBuffer()));
      proofs.push({ filename, imageUrl: `/account-recovery-proofs/${storedName}` });
    }
    return proofs;
  }

  private async readData(): Promise<PasswordRecoveryData> {
    try {
      const raw = await readFile(dataFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<PasswordRecoveryData>;
      return {
        codes: Array.isArray(parsed.codes) ? parsed.codes : [],
        sendRecords: Array.isArray(parsed.sendRecords) ? parsed.sendRecords : [],
        applications: Array.isArray(parsed.applications) ? parsed.applications : [],
        auditEvents: Array.isArray(parsed.auditEvents) ? parsed.auditEvents : []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { codes: [], sendRecords: [], applications: [], auditEvents: [] };
    }
  }

  private async writeData(data: PasswordRecoveryData): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const temporary = `${dataFile}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2));
    await rename(temporary, dataFile);
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationQueue;
    let release: () => void = () => undefined;
    this.mutationQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
}

function randomCode(): string {
  return String(randomInt(100000, 1000000));
}

function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}$${createHash("sha256").update(`${salt}:${code}`).digest("hex")}`;
}

function verifyCodeHash(code: string, stored: string): boolean {
  const [salt, expected] = stored.split("$");
  if (!salt || !expected) return false;
  const actual = createHash("sha256").update(`${salt}:${code}`).digest("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s-]+/g, "");
}

export function isValidPhone(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(normalizePhone(value));
}

function normalizedIp(value: string): string {
  return value.trim().slice(0, 64) || "unknown";
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "proof.png";
}
