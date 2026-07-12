import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { persistentDataDir } from "../../server/storagePaths";

export type VideoJobStatus = "queued" | "submitted" | "succeeded" | "failed" | "canceled";
export type VideoError = { code: string; message: string; retryable: boolean };

export interface VideoJob {
  id: string;
  customerId: string;
  createdByActorId?: string;
  createdByActorName?: string;
  prompt: string;
  images: string[];
  aspectRatio: string;
  durationSeconds: number;
  outputResolution: "480p" | "720p";
  reservedCredits: number;
  chargedCredits: number;
  status: VideoJobStatus;
  progress: { completed: number; total: number };
  createdAt: string;
  updatedAt: string;
  providerTaskId?: string;
  providerModel?: string;
  attemptCount?: number;
  nextAttemptAt?: string;
  result?: { url: string; createdAt: string };
  error?: VideoError;
}

type VideoProvider = {
  create(input: Pick<VideoJob, "prompt" | "images" | "aspectRatio" | "durationSeconds">): Promise<{ ok: true; task: { id: string; model: string } } | { ok: false; error: VideoError }>;
  get(input: { id: string; model?: string }): Promise<{ ok: true; status: string; outputUrl?: string } | { ok: false; error: VideoError }>;
};

interface VideoData { jobs: VideoJob[] }

export class FileVideoJobRepository {
  private readonly file: string;
  private queue: Promise<void> = Promise.resolve();
  constructor(options: { dataDir?: string } = {}) { this.file = path.join(options.dataDir ?? persistentDataDir(), "video-jobs.json"); }
  async allForCustomer(customerId: string): Promise<VideoJob[]> { return (await this.read()).jobs.filter((job) => job.customerId === customerId).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)); }
  async all(): Promise<VideoJob[]> { return (await this.read()).jobs; }
  async create(input: Omit<VideoJob, "id" | "createdAt" | "updatedAt" | "status" | "progress" | "chargedCredits">): Promise<VideoJob> {
    return this.mutate((data) => {
      const now = new Date().toISOString();
      const job: VideoJob = { ...input, id: `video-job-${crypto.randomUUID()}`, chargedCredits: 0, status: "queued", progress: { completed: 0, total: 1 }, createdAt: now, updatedAt: now };
      data.jobs = [job, ...data.jobs].slice(0, 500); return job;
    });
  }
  async find(id: string): Promise<VideoJob | undefined> { return (await this.read()).jobs.find((job) => job.id === id); }
  async update(id: string, callback: (job: VideoJob) => VideoJob): Promise<VideoJob | undefined> { return this.mutate((data) => { const index = data.jobs.findIndex((job) => job.id === id); if (index < 0) return undefined; const next = { ...callback(data.jobs[index]), updatedAt: new Date().toISOString() }; data.jobs[index] = next; return next; }); }
  private async mutate<T>(callback: (data: VideoData) => T | Promise<T>): Promise<T> { const previous = this.queue; let release: () => void = () => undefined; this.queue = new Promise<void>((resolve) => { release = resolve; }); await previous; try { const data = await this.read(); const output = await callback(data); await mkdir(path.dirname(this.file), { recursive: true }); const temporary = `${this.file}.${crypto.randomUUID()}.tmp`; await writeFile(temporary, JSON.stringify(data, null, 2)); await rename(temporary, this.file); return output; } finally { release(); } }
  private async read(): Promise<VideoData> { try { const data = JSON.parse(await readFile(this.file, "utf8")) as Partial<VideoData>; return { jobs: Array.isArray(data.jobs) ? data.jobs : [] }; } catch { return { jobs: [] }; } }
}

export class VideoJobService {
  private readonly active = new Set<string>();
  constructor(private readonly repository: FileVideoJobRepository, private readonly provider: VideoProvider, private readonly settlement: { onSubmitted?: (job: VideoJob) => Promise<void>; onFailed?: (job: VideoJob) => Promise<void>; onCanceled?: (job: VideoJob) => Promise<void> } = {}) {}
  createJob(input: Omit<VideoJob, "id" | "createdAt" | "updatedAt" | "status" | "progress" | "chargedCredits">) { return this.repository.create(input); }
  list(customerId: string) { return this.repository.allForCustomer(customerId); }
  get(id: string) { return this.repository.find(id); }
  async cancel(id: string) { const job = await this.repository.update(id, (current) => ["succeeded", "failed", "canceled"].includes(current.status) ? current : { ...current, status: "canceled" }); if (job?.status === "canceled") await this.settlement.onCanceled?.(job); return job; }
  async runDueJobs(): Promise<void> { for (const job of await this.repository.all()) { const nextAttempt = job.nextAttemptAt ? new Date(job.nextAttemptAt).getTime() : 0; if (["queued", "submitted"].includes(job.status) && !this.active.has(job.id) && (!nextAttempt || nextAttempt <= Date.now())) { await this.run(job.id); return; } } }
  async run(id: string): Promise<VideoJob | undefined> {
    if (this.active.has(id)) return this.get(id); this.active.add(id);
    try {
      const job = await this.repository.find(id); if (!job || ["succeeded", "failed", "canceled"].includes(job.status)) return job;
      if (job.status === "queued") {
        const created = await this.provider.create(job);
        const current = await this.repository.find(id); if (!current || current.status === "canceled") return current;
        if (!created.ok) return this.failOrRetry(current, created.error);
        const submitted = await this.repository.update(id, (item) => ({ ...item, status: "submitted", providerTaskId: created.task.id, providerModel: created.task.model, chargedCredits: item.reservedCredits }));
        if (submitted) await this.settlement.onSubmitted?.(submitted);
        return submitted;
      }
      if (!job.providerTaskId) return this.fail(job, { code: "provider_unknown", message: "视频任务缺少供应商任务编号。", retryable: false });
      const status = await this.provider.get({ id: job.providerTaskId, model: job.providerModel });
      if (!status.ok) return status.error.retryable ? job : this.fail(job, status.error);
      if (isSuccess(status.status) && status.outputUrl) return this.repository.update(id, (item) => ({ ...item, status: "succeeded", progress: { completed: 1, total: 1 }, result: { url: status.outputUrl!, createdAt: new Date().toISOString() }, error: undefined }));
      if (isFailure(status.status)) return this.fail(job, { code: "provider_unknown", message: "视频模型未能完成本次任务。", retryable: false });
      return job;
    } finally { this.active.delete(id); }
  }
  private async failOrRetry(job: VideoJob, error: VideoError) {
    const attemptCount = (job.attemptCount ?? 0) + 1;
    if (error.retryable && attemptCount <= 3) {
      return this.repository.update(job.id, (item) => ({ ...item, status: "queued", attemptCount, nextAttemptAt: new Date(Date.now() + attemptCount * 20_000).toISOString(), error }));
    }
    return this.fail(job, error);
  }
  private async fail(job: VideoJob, error: VideoError) { const failed = await this.repository.update(job.id, (item) => ({ ...item, status: "failed", error })); if (failed) await this.settlement.onFailed?.(failed); return failed; }
}

function isSuccess(status: string) { return ["succeeded", "success", "completed", "done", "finished"].some((word) => status.toLowerCase().includes(word)); }
function isFailure(status: string) { return ["failed", "error", "canceled", "cancelled"].some((word) => status.toLowerCase().includes(word)); }
