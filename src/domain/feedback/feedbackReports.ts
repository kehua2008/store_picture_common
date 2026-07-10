import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { persistentDataDir, persistentUploadSubdir } from "../../server/storagePaths";

export type FeedbackReportStatus = "pending" | "valid" | "invalid" | "resolved";

export interface FeedbackScreenshot {
  filename: string;
  imageUrl: string;
}

export interface FeedbackReport {
  id: string;
  customerId: string;
  customerPhone: string;
  actorId?: string;
  actorName?: string;
  title: string;
  description: string;
  contact?: string;
  screenshots: FeedbackScreenshot[];
  status: FeedbackReportStatus;
  adminNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackReportData {
  reports: FeedbackReport[];
}

interface CreateFeedbackReportInput {
  customerId: string;
  customerPhone: string;
  actorId?: string;
  actorName?: string;
  title: string;
  description: string;
  contact?: string;
  screenshots: File[];
}

const dataDir = persistentDataDir();
const screenshotDir = persistentUploadSubdir("feedback-screenshots");
const dataFile = path.join(dataDir, "feedback-reports.json");
const maxScreenshotCount = 3;
const maxScreenshotBytes = 8 * 1024 * 1024;

export class FileFeedbackReportRepository {
  private mutationQueue: Promise<void> = Promise.resolve();

  async all(customerId?: string): Promise<FeedbackReportData> {
    const data = await this.readData();
    return {
      reports: customerId ? data.reports.filter((report) => report.customerId === customerId) : data.reports
    };
  }

  async create(input: CreateFeedbackReportInput): Promise<FeedbackReport> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const now = new Date().toISOString();
      const id = `feedback-${crypto.randomUUID()}`;
      await mkdir(screenshotDir, { recursive: true });

      const screenshots: FeedbackScreenshot[] = [];
      for (const file of input.screenshots.slice(0, maxScreenshotCount)) {
        const originalName = safeFilename(file.name || "screenshot.png");
        const storedName = `${id}-${screenshots.length + 1}-${originalName}`;
        const bytes = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(screenshotDir, storedName), bytes);
        screenshots.push({
          filename: originalName,
          imageUrl: `/feedback-screenshots/${storedName}`
        });
      }

      const report: FeedbackReport = {
        id,
        customerId: input.customerId,
        customerPhone: input.customerPhone,
        actorId: input.actorId,
        actorName: input.actorName,
        title: input.title.trim(),
        description: input.description.trim(),
        contact: input.contact?.trim() || undefined,
        screenshots,
        status: "pending",
        createdAt: now,
        updatedAt: now
      };

      data.reports = [report, ...data.reports];
      await this.writeData(data);
      return report;
    });
  }

  async review(input: { id: string; status: FeedbackReportStatus; adminNote?: string }): Promise<FeedbackReport | undefined> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const target = data.reports.find((report) => report.id === input.id);
      if (!target) return undefined;

      const now = new Date().toISOString();
      const updated: FeedbackReport = {
        ...target,
        status: input.status,
        adminNote: input.adminNote?.trim() || undefined,
        reviewedAt: now,
        updatedAt: now
      };

      data.reports = data.reports.map((report) => report.id === input.id ? updated : report);
      await this.writeData(data);
      return updated;
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

  private async readData(): Promise<FeedbackReportData> {
    try {
      const raw = await readFile(dataFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<FeedbackReportData>;
      return { reports: Array.isArray(parsed.reports) ? parsed.reports.map(normalizeReport) : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { reports: [] };
    }
  }

  private async writeData(data: FeedbackReportData): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const tempFile = `${dataFile}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempFile, JSON.stringify(data, null, 2));
    await rename(tempFile, dataFile);
  }
}

export function normalizeFeedbackReportStatus(input: unknown): FeedbackReportStatus | undefined {
  return input === "pending" || input === "valid" || input === "invalid" || input === "resolved" ? input : undefined;
}

export function validateFeedbackScreenshots(files: File[]): string | undefined {
  if (files.length > maxScreenshotCount) return "too_many_feedback_screenshots";
  const invalidType = files.find((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type));
  if (invalidType) return "invalid_feedback_screenshot_type";
  const oversized = files.find((file) => file.size > maxScreenshotBytes);
  if (oversized) return "feedback_screenshot_too_large";
  return undefined;
}

function normalizeReport(input: FeedbackReport): FeedbackReport {
  return {
    ...input,
    title: input.title ?? "未命名反馈",
    description: input.description ?? "",
    screenshots: Array.isArray(input.screenshots) ? input.screenshots : [],
    status: normalizeFeedbackReportStatus(input.status) ?? "pending"
  };
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "screenshot.png";
}
