import { mkdir, readFile, writeFile } from "fs/promises";
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import path from "path";
import { persistentDataDir } from "../../server/storagePaths";

export type UserStatus = "active" | "suspended";

export interface User {
  id: string;
  phone: string;
  passwordHash: string;
  displayName?: string;
  companyName?: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  createdAt: string;
  expiresAt: string;
}

export interface SessionActor {
  actorId: string;
  actorName: string;
}

interface UserData {
  users: User[];
  sessions: AuthSession[];
}

export interface PublicUser {
  id: string;
  phone: string;
  displayName?: string;
  companyName?: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

const dataDir = persistentDataDir();
const dataFile = path.join(dataDir, "users.json");
const passwordIterations = 120000;
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 30;

export class FileUserRepository {
  async all(): Promise<User[]> {
    const data = await this.readData();
    return data.users;
  }

  async findById(id: string): Promise<User | undefined> {
    const data = await this.readData();
    return data.users.find((user) => user.id === id);
  }

  async findByPhone(phone: string): Promise<User | undefined> {
    const data = await this.readData();
    return data.users.find((user) => user.phone === normalizePhone(phone));
  }

  async register(input: { phone: string; password: string; displayName?: string; companyName?: string }): Promise<User> {
    const phone = normalizePhone(input.phone);
    if (!isValidPhone(phone)) throw new Error("invalid_phone");
    validatePassword(input.password);

    const data = await this.readData();
    if (data.users.some((user) => user.phone === phone)) throw new Error("phone_already_registered");

    const now = new Date().toISOString();
    const user: User = {
      id: `user-${crypto.randomUUID()}`,
      phone,
      passwordHash: hashPassword(input.password),
      displayName: cleanText(input.displayName),
      companyName: cleanText(input.companyName),
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    data.users = [user, ...data.users];
    await this.writeData(data);
    return user;
  }

  async verifyLogin(input: { phone: string; password: string }): Promise<User | undefined> {
    const user = await this.findByPhone(input.phone);
    if (!user) return undefined;
    if (!verifyPassword(input.password, user.passwordHash)) return undefined;
    return user;
  }

  async updateStatus(userId: string, status: UserStatus): Promise<User | undefined> {
    const data = await this.readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) return undefined;

    const updated = { ...user, status, updatedAt: new Date().toISOString() };
    data.users = data.users.map((item) => item.id === userId ? updated : item);
    await this.writeData(data);
    return updated;
  }

  async resetPassword(userId: string, password: string): Promise<User | undefined> {
    validatePassword(password);
    const data = await this.readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) return undefined;

    const updated: User = {
      ...user,
      passwordHash: hashPassword(password),
      updatedAt: new Date().toISOString()
    };
    data.users = data.users.map((item) => item.id === userId ? updated : item);
    // A password reset ends every prior login. The route creates exactly one fresh session afterwards.
    data.sessions = data.sessions.filter((session) => session.userId !== userId);
    await this.writeData(data);
    return updated;
  }

  async createSession(userId: string, actorName?: string): Promise<AuthSession> {
    const data = await this.readData();
    const now = Date.now();
    const actor = buildSessionActor(userId, actorName, data.users.find((user) => user.id === userId));
    const session: AuthSession = {
      id: `session-${randomBytes(32).toString("hex")}`,
      userId,
      actorId: actor.actorId,
      actorName: actor.actorName,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + sessionMaxAgeMs).toISOString()
    };
    data.sessions = [session, ...data.sessions.filter((item) => new Date(item.expiresAt).getTime() > now)];
    await this.writeData(data);
    return session;
  }

  async findSession(sessionId: string): Promise<{ session: AuthSession; user: User } | undefined> {
    if (!sessionId) return undefined;
    const data = await this.readData();
    const now = Date.now();
    const session = data.sessions.find((item) => item.id === sessionId && new Date(item.expiresAt).getTime() > now);
    if (!session) return undefined;
    const user = data.users.find((item) => item.id === session.userId);
    if (!user) return undefined;
    return { session, user };
  }

  async deleteSession(sessionId: string): Promise<void> {
    const data = await this.readData();
    data.sessions = data.sessions.filter((item) => item.id !== sessionId);
    await this.writeData(data);
  }

  private async readData(): Promise<UserData> {
    try {
      const raw = await readFile(dataFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<UserData>;
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
      };
    } catch {
      return { users: [], sessions: [] };
    }
  }

  private async writeData(data: UserData): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFile, JSON.stringify(data, null, 2));
  }
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s-]+/g, "");
}

export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export function toPublicUser(user: User): PublicUser {
  const { id, phone, displayName, companyName, status, createdAt, updatedAt } = user;
  return { id, phone, displayName, companyName, status, createdAt, updatedAt };
}

function validatePassword(password: string): void {
  if (password.length < 8 || password.length > 72) throw new Error("invalid_password");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, passwordIterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${passwordIterations}$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, iterationsRaw, salt, hash] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsRaw || !salt || !hash) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  const calculated = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const expected = Buffer.from(hash, "hex");
  return expected.length === calculated.length && timingSafeEqual(expected, calculated);
}

function cleanText(value?: string): string | undefined {
  const text = value?.trim();
  return text ? text.slice(0, 80) : undefined;
}

function buildSessionActor(userId: string, actorName: string | undefined, user: User | undefined): SessionActor {
  const fallbackName = cleanText(user?.displayName) ?? (user?.phone ? `同事${user.phone.slice(-4)}` : "默认同事");
  const name = cleanText(actorName) ?? fallbackName;
  const digest = createHash("sha256").update(`${userId}:${name}`).digest("hex").slice(0, 16);
  return {
    actorId: `actor-${digest}`,
    actorName: name
  };
}
