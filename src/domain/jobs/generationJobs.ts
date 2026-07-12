import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { persistentDataDir, persistentUploadSubdir } from "../../server/storagePaths";

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "partial_failed" | "failed" | "canceled";

export interface GenerationJobResult {
  id: string;
  url: string;
  mimeType: string;
  imageTypeLabel?: string;
}

export interface GenerationSourceImage {
  id: string;
  filename: string;
  mimeType: string;
  filePath: string;
}

export interface GenerationJob {
  id: string;
  customerId: string;
  createdByActorId?: string;
  createdByActorName?: string;
  taskLabel?: string;
  categoryLabel?: string;
  promptSummary?: string;
  promptBody: string;
  targetWidth: number;
  targetHeight: number;
  reservedCredits: number;
  chargedCredits: number;
  createdAt: string;
  updatedAt: string;
  status: GenerationJobStatus;
  progress: { completed: number; total: number };
  results: GenerationJobResult[];
  sourceImages: GenerationSourceImage[];
  attemptCount: number;
  nextAttemptAt?: string;
  error?: { code: string; message: string; retryable: boolean };
}

interface GenerationJobData {
  jobs: GenerationJob[];
}

export interface CreateGenerationJobInput {
  customerId: string;
  actorId?: string;
  actorName?: string;
  taskLabel?: string;
  categoryLabel?: string;
  promptSummary?: string;
  promptBody: string;
  targetWidth?: number;
  targetHeight?: number;
  total?: number;
  reservedCredits: number;
  sourceImages: GenerationSourceImage[];
}

export interface ImageProviderResult {
  base64?: string;
  url?: string;
  mimeType?: string;
}

export interface ImageGenerationProvider {
  generate(input: {
    prompt: string;
    sourceImages: GenerationSourceImage[];
    width: number;
    height: number;
  }): Promise<{ ok: true; images: ImageProviderResult[] } | { ok: false; error: GenerationJob["error"] }>;
}

export class FileGenerationJobRepository {
  private readonly dataFile: string;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(options: { dataDir?: string } = {}) {
    this.dataFile = path.join(options.dataDir ?? persistentDataDir(), "generation-jobs.json");
  }

  async all(input: { customerId: string; actorId?: string; scope?: "mine" | "all" }): Promise<GenerationJob[]> {
    const data = await this.readData();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return data.jobs
      .filter((job) => job.customerId === input.customerId)
      .filter((job) => input.scope === "all" || !input.actorId || job.createdByActorId === input.actorId)
      .filter((job) => new Date(job.createdAt).getTime() >= cutoff)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  async findById(id: string): Promise<GenerationJob | undefined> {
    return (await this.readData()).jobs.find((job) => job.id === id);
  }

  async allJobs(): Promise<GenerationJob[]> {
    return (await this.readData()).jobs.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }

  async create(input: CreateGenerationJobInput): Promise<GenerationJob> {
    return this.mutate(async (data) => {
      const now = new Date().toISOString();
      const job: GenerationJob = {
        id: `image-job-${crypto.randomUUID()}`,
        customerId: input.customerId,
        createdByActorId: input.actorId,
        createdByActorName: input.actorName,
        taskLabel: cleanText(input.taskLabel),
        categoryLabel: cleanText(input.categoryLabel),
        promptSummary: cleanText(input.promptSummary),
        promptBody: cleanText(input.promptBody) ?? "",
        targetWidth: clampDimension(input.targetWidth, 1024),
        targetHeight: clampDimension(input.targetHeight, 1024),
        reservedCredits: input.reservedCredits,
        chargedCredits: 0,
        createdAt: now,
        updatedAt: now,
        status: "queued",
        progress: { completed: 0, total: clampCount(input.total) },
        results: [],
        sourceImages: input.sourceImages,
        attemptCount: 0
      };
      data.jobs = [job, ...data.jobs].slice(0, 500);
      return job;
    });
  }

  async update(id: string, update: (job: GenerationJob) => GenerationJob): Promise<GenerationJob | undefined> {
    return this.mutate(async (data) => {
      const index = data.jobs.findIndex((job) => job.id === id);
      if (index < 0) return undefined;
      const current = data.jobs[index];
      const next = { ...update(current), updatedAt: new Date().toISOString() };
      data.jobs[index] = next;
      return next;
    });
  }

  private async mutate<T>(operation: (data: GenerationJobData) => Promise<T> | T): Promise<T> {
    const previous = this.mutationQueue;
    let release: () => void = () => undefined;
    this.mutationQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const data = await this.readData();
      const result = await operation(data);
      await this.writeData(data);
      return result;
    } finally {
      release();
    }
  }

  private async readData(): Promise<GenerationJobData> {
    try {
      const parsed = JSON.parse(await readFile(this.dataFile, "utf8")) as Partial<GenerationJobData>;
      return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs.map(normalizeJob) : [] };
    } catch {
      return { jobs: [] };
    }
  }

  private async writeData(data: GenerationJobData): Promise<void> {
    await mkdir(path.dirname(this.dataFile), { recursive: true });
    const temporary = `${this.dataFile}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2));
    await rename(temporary, this.dataFile);
  }
}

export class GenerationJobService {
  private readonly activeRuns = new Set<string>();

  constructor(
    private readonly repository: FileGenerationJobRepository,
    private readonly provider: ImageGenerationProvider,
    private readonly settlement: {
      onSucceeded?: (job: GenerationJob) => Promise<void>;
      onFailed?: (job: GenerationJob) => Promise<void>;
      onCanceled?: (job: GenerationJob) => Promise<void>;
    } = {}
  ) {}

  async listJobsForCustomer(customerId: string): Promise<GenerationJob[]> {
    return this.repository.all({ customerId, scope: "all" });
  }

  async getJob(id: string): Promise<GenerationJob | undefined> {
    return this.repository.findById(id);
  }

  async createJob(input: CreateGenerationJobInput): Promise<GenerationJob> {
    return this.repository.create(input);
  }

  async cancelJob(id: string): Promise<GenerationJob | undefined> {
    const job = await this.repository.update(id, (current) => {
      if (["succeeded", "partial_failed", "failed", "canceled"].includes(current.status)) return current;
      return { ...current, status: "canceled", nextAttemptAt: undefined };
    });
    if (job?.status === "canceled") await this.settlement.onCanceled?.(job);
    return job;
  }

  async runDueJobs(): Promise<void> {
    const all = await this.repository.allJobs();
    const now = Date.now();
    for (const job of all) {
      if (!["queued", "running"].includes(job.status) || this.activeRuns.has(job.id)) continue;
      const next = job.nextAttemptAt ? new Date(job.nextAttemptAt).getTime() : 0;
      if (!next || next <= now) {
        await this.runJob(job.id);
        return;
      }
    }
  }

  async runJob(id: string): Promise<GenerationJob | undefined> {
    if (this.activeRuns.has(id)) return this.getJob(id);
    const current = await this.repository.findById(id);
    if (!current || !["queued", "running"].includes(current.status)) return current;
    this.activeRuns.add(id);
    try {
      const started = await this.repository.update(id, (job) => ({ ...job, status: "running", nextAttemptAt: undefined }));
      if (!started) return undefined;
      const generated = await this.provider.generate({
        prompt: started.promptBody,
        sourceImages: started.sourceImages,
        width: started.targetWidth,
        height: started.targetHeight
      });
      const latest = await this.repository.findById(id);
      if (!latest || latest.status === "canceled") return latest;
      if (!generated.ok) return this.failOrRetry(latest, generated.error!);

      const results = await persistGeneratedImages(latest.id, generated.images.slice(0, latest.progress.total));
      if (!results.length) {
        return this.failOrRetry(latest, { code: "provider_unknown", message: "模型未返回可用图片。", retryable: true });
      }
      const finished = await this.repository.update(id, (job) => ({
        ...job,
        status: results.length === job.progress.total ? "succeeded" : "partial_failed",
        chargedCredits: Math.ceil(job.reservedCredits * results.length / job.progress.total),
        progress: { completed: results.length, total: job.progress.total },
        results,
        error: results.length === job.progress.total ? undefined : { code: "partial_result", message: "部分图片生成失败，未完成部分已释放积分。", retryable: false }
      }));
      if (finished) await this.settlement.onSucceeded?.(finished);
      return finished;
    } catch (error) {
      const latest = await this.repository.findById(id);
      if (!latest || latest.status === "canceled") return latest;
      return this.failOrRetry(latest, { code: "provider_unknown", message: errorMessage(error), retryable: true });
    } finally {
      this.activeRuns.delete(id);
    }
  }

  private async failOrRetry(job: GenerationJob, error: NonNullable<GenerationJob["error"]>): Promise<GenerationJob | undefined> {
    const attemptCount = job.attemptCount + 1;
    if (error.retryable && attemptCount <= 2) {
      return this.repository.update(job.id, (current) => ({
        ...current,
        status: "queued",
        attemptCount,
        nextAttemptAt: new Date(Date.now() + attemptCount * 15_000).toISOString(),
        error
      }));
    }
    const failed = await this.repository.update(job.id, (current) => ({ ...current, status: "failed", attemptCount, error, nextAttemptAt: undefined }));
    if (failed) await this.settlement.onFailed?.(failed);
    return failed;
  }
}

async function persistGeneratedImages(jobId: string, images: ImageProviderResult[]): Promise<GenerationJobResult[]> {
  const directory = persistentUploadSubdir("generated-images");
  await mkdir(directory, { recursive: true });
  const results: GenerationJobResult[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const buffer = image.base64 ? Buffer.from(stripDataPrefix(image.base64), "base64") : image.url ? await downloadImage(image.url) : undefined;
    if (!buffer?.length) continue;
    const mimeType = image.mimeType ?? "image/png";
    const filename = `${safeSegment(jobId)}-${index + 1}.${extensionForMimeType(mimeType)}`;
    await writeFile(path.join(directory, filename), buffer);
    results.push({ id: `image-${crypto.randomUUID()}`, url: `/generated-images/${filename}`, mimeType });
  }
  return results;
}

async function downloadImage(url: string): Promise<Buffer | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return undefined;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return undefined;
  }
}

function normalizeJob(job: GenerationJob): GenerationJob {
  return {
    ...job,
    status: job.status ?? "failed",
    promptBody: job.promptBody ?? "",
    targetWidth: clampDimension(job.targetWidth, 1024),
    targetHeight: clampDimension(job.targetHeight, 1024),
    reservedCredits: Math.max(0, job.reservedCredits ?? 0),
    chargedCredits: Math.max(0, job.chargedCredits ?? 0),
    progress: job.progress ?? { completed: 0, total: 1 },
    results: Array.isArray(job.results) ? job.results : [],
    sourceImages: Array.isArray(job.sourceImages) ? job.sourceImages : [],
    attemptCount: job.attemptCount ?? 0
  };
}

function clampDimension(value: number | undefined, fallback: number): number {
  const normalized = Math.trunc(Number(value));
  return Number.isFinite(normalized) ? Math.max(512, Math.min(2048, normalized)) : fallback;
}

function clampCount(value: number | undefined): number {
  const normalized = Math.trunc(Number(value));
  return Number.isFinite(normalized) ? Math.max(1, Math.min(12, normalized)) : 1;
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text.slice(0, 8_000) : undefined;
}

function stripDataPrefix(value: string): string {
  return value.includes(",") ? value.split(",", 2)[1] ?? "" : value;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message.slice(0, 500) : "图片生成服务暂时不可用。";
}
