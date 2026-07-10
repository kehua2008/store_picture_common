import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { persistentDataDir } from "../../server/storagePaths";

export type GenerationJobStatus = "running" | "succeeded" | "partial_failed" | "failed" | "canceled";

export interface GenerationJobResult {
  id: string;
  base64?: string;
  url?: string;
  mimeType: string;
  imageTypeLabel?: string;
}

export interface GenerationJob {
  id: string;
  customerId: string;
  createdByActorId?: string;
  createdByActorName?: string;
  taskLabel?: string;
  categoryLabel?: string;
  promptSummary?: string;
  promptBody?: string;
  reservedCredits: number;
  chargedCredits: number;
  createdAt: string;
  updatedAt: string;
  status: GenerationJobStatus;
  progress: { completed: number; total: number };
  results: GenerationJobResult[];
  error?: { code: string; message: string; retryable: boolean };
}

interface GenerationJobData {
  jobs: GenerationJob[];
}

const dataDir = persistentDataDir();
const dataFile = path.join(dataDir, "generation-jobs.json");

export class FileGenerationJobRepository {
  private mutationQueue: Promise<void> = Promise.resolve();

  async all(input: { customerId: string; actorId?: string; scope?: "mine" | "all" }): Promise<GenerationJob[]> {
    const data = await this.readData();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return data.jobs
      .filter((job) => job.customerId === input.customerId)
      .filter((job) => input.scope === "all" || !input.actorId || job.createdByActorId === input.actorId)
      .filter((job) => new Date(job.createdAt).getTime() >= cutoff)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  async create(input: {
    customerId: string;
    actorId?: string;
    actorName?: string;
    taskLabel?: string;
    categoryLabel?: string;
    promptSummary?: string;
    promptBody?: string;
    total?: number;
  }): Promise<GenerationJob> {
    return this.runExclusive(async () => {
      const data = await this.readData();
      const now = new Date().toISOString();
      const job: GenerationJob = {
        id: `image-job-${crypto.randomUUID()}`,
        customerId: input.customerId,
        createdByActorId: input.actorId,
        createdByActorName: input.actorName,
        taskLabel: cleanText(input.taskLabel),
        categoryLabel: cleanText(input.categoryLabel),
        promptSummary: cleanText(input.promptSummary),
        promptBody: cleanText(input.promptBody),
        reservedCredits: 0,
        chargedCredits: 0,
        createdAt: now,
        updatedAt: now,
        status: "running",
        progress: { completed: 0, total: Math.max(1, Math.min(24, Math.trunc(input.total ?? 1))) },
        results: []
      };
      data.jobs = [job, ...data.jobs].slice(0, 500);
      await this.writeData(data);
      return job;
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

  private async readData(): Promise<GenerationJobData> {
    try {
      return JSON.parse(await readFile(dataFile, "utf8")) as GenerationJobData;
    } catch {
      return { jobs: [] };
    }
  }

  private async writeData(data: GenerationJobData): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const tempFile = `${dataFile}.${crypto.randomUUID()}.tmp`;
    await writeFile(tempFile, JSON.stringify(data, null, 2));
    await rename(tempFile, dataFile);
  }
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text.slice(0, 4000) : undefined;
}
