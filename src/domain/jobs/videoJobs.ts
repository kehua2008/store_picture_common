import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { persistentDataDir } from "../../server/storagePaths";
import { type VideoCreativePlan, type VideoScene, videoScenePrompt } from "../video/videoCreativePlan";

export type VideoJobStatus = "queued" | "submitted" | "composing" | "succeeded" | "failed" | "canceled";
export type VideoError = { code: string; message: string; retryable: boolean };
const videoRetryDelaysMs = [15_000, 30_000, 60_000, 120_000, 300_000, 600_000] as const;
const defaultVideoProcessingTimeoutMs = 20 * 60_000;

export type VideoSceneJob = {
  sceneId: string;
  index: number;
  prompt: string;
  anchorImageIndex: number;
  status: "queued" | "submitted" | "succeeded" | "failed";
  providerTaskId?: string;
  providerModel?: string;
  submittedAt?: string;
  resultUrl?: string;
  error?: VideoError;
};

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
  submittedAt?: string;
  attemptCount?: number;
  nextAttemptAt?: string;
  result?: { url: string; createdAt: string };
  error?: VideoError;
  creativePlan?: VideoCreativePlan;
  scenes?: VideoSceneJob[];
  pipelineStage?: "visual" | "audio" | "captions" | "compose";
}

type VideoProvider = {
  create(input: Pick<VideoJob, "prompt" | "images" | "aspectRatio" | "durationSeconds">): Promise<{ ok: true; task: { id: string; model: string } } | { ok: false; error: VideoError }>;
  get(input: { id: string; model?: string }): Promise<{ ok: true; status: string; outputUrl?: string } | { ok: false; error: VideoError }>;
};

export type VideoComposer = {
  compose(job: VideoJob): Promise<{ ok: true; url: string } | { ok: false; error: VideoError }>;
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
      const scenes = input.scenes?.length ? input.scenes : undefined;
      const job: VideoJob = { ...input, scenes, id: `video-job-${crypto.randomUUID()}`, chargedCredits: 0, status: "queued", progress: { completed: 0, total: scenes?.length ?? 1 }, createdAt: now, updatedAt: now };
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
  constructor(private readonly repository: FileVideoJobRepository, private readonly provider: VideoProvider, private readonly settlement: { onSubmitted?: (job: VideoJob) => Promise<void>; onSucceeded?: (job: VideoJob) => Promise<void>; onFailed?: (job: VideoJob) => Promise<void>; onCanceled?: (job: VideoJob) => Promise<void> } = {}, private composer?: VideoComposer) {}
  useComposer(composer: VideoComposer) { this.composer = composer; }
  createJob(input: Omit<VideoJob, "id" | "createdAt" | "updatedAt" | "status" | "progress" | "chargedCredits">) { return this.repository.create(input); }
  list(customerId: string) { return this.repository.allForCustomer(customerId); }
  get(id: string) { return this.repository.find(id); }
  async cancel(id: string) {
    let canceled = false;
    const job = await this.repository.update(id, (current) => {
      if (["succeeded", "failed", "canceled"].includes(current.status)) return current;
      canceled = true;
      return { ...current, status: "canceled", error: undefined, nextAttemptAt: undefined, pipelineStage: undefined };
    });
    if (canceled && job) await this.settlement.onCanceled?.(job);
    return job;
  }
  async runDueJobs(): Promise<void> { for (const job of await this.repository.all()) { const nextAttempt = job.nextAttemptAt ? new Date(job.nextAttemptAt).getTime() : 0; if (["queued", "submitted", "composing"].includes(job.status) && !this.active.has(job.id) && (!nextAttempt || nextAttempt <= Date.now())) { await this.run(job.id); return; } } }
  async run(id: string): Promise<VideoJob | undefined> {
    if (this.active.has(id)) return this.get(id); this.active.add(id);
    try {
      const job = await this.repository.find(id); if (!job || ["succeeded", "failed", "canceled"].includes(job.status)) return job;
      if (job.status === "composing") return this.compose(job);
      const scenes = ensureScenes(job);
      const activeScene = scenes.find((scene) => scene.status === "queued" || scene.status === "submitted");
      if (!activeScene) return this.beginComposition(job, scenes);
      if (activeScene.status === "queued") {
        const created = await this.provider.create({ ...job, prompt: activeScene.prompt, images: [job.images[activeScene.anchorImageIndex] ?? job.images[0]], durationSeconds: 5 });
        const current = await this.repository.find(id); if (!current || current.status === "canceled") return current;
        if (!created.ok) return this.failOrRetry(current, created.error);
        return this.repository.update(id, (item) => ({ ...item, status: "submitted", pipelineStage: "visual", scenes: markScene(item, activeScene.index, (scene) => ({ ...scene, status: "submitted", providerTaskId: created.task.id, providerModel: created.task.model, submittedAt: new Date().toISOString(), error: undefined })), providerTaskId: created.task.id, providerModel: created.task.model, submittedAt: new Date().toISOString() }));
      }
      if (!activeScene.providerTaskId) return this.fail(job, { code: "provider_unknown", message: "视频分镜缺少供应商任务编号。", retryable: false });
      const status = await this.provider.get({ id: activeScene.providerTaskId, model: activeScene.providerModel });
      if (!status.ok) return status.error.retryable && !hasTimedOut(job) ? job : this.fail(job, hasTimedOut(job) ? timeoutError() : status.error);
      if (isSuccess(status.status) && status.outputUrl) {
        const completed = await this.repository.update(id, (item) => {
          if (item.status === "canceled") return item;
          const nextScenes = markScene(item, activeScene.index, (scene) => ({ ...scene, status: "succeeded", resultUrl: status.outputUrl!, error: undefined }));
          const completedCount = nextScenes.filter((scene) => scene.status === "succeeded").length;
          return { ...item, scenes: nextScenes, progress: { completed: completedCount, total: nextScenes.length }, error: undefined };
        });
        if (completed?.scenes?.every((scene) => scene.status === "succeeded" && scene.resultUrl)) return this.beginComposition(completed, completed.scenes);
        return completed;
      }
      if (isFailure(status.status)) return this.fail(job, { code: "provider_unknown", message: "视频模型未能完成本次任务。", retryable: false });
      if (hasTimedOut(job)) return this.fail(job, timeoutError());
      return job;
    } finally { this.active.delete(id); }
  }
  private async beginComposition(job: VideoJob, scenes: VideoSceneJob[]) {
    if (scenes.some((scene) => scene.status !== "succeeded" || !scene.resultUrl)) return this.fail(job, { code: "scene_incomplete", message: "视频分镜未完成，无法进入合成。", retryable: false });
    const composing = await this.repository.update(job.id, (item) => item.status === "canceled" ? item : ({ ...item, status: "composing", pipelineStage: "audio", chargedCredits: item.reservedCredits, nextAttemptAt: undefined }));
    if (composing?.status === "canceled") return composing;
    if (composing) await this.settlement.onSubmitted?.(composing);
    return composing && !this.composer ? this.compose(composing) : composing;
  }
  private async compose(job: VideoJob) {
    if (!this.composer) {
      const url = job.scenes?.find((scene) => scene.resultUrl)?.resultUrl;
      if (!url) return this.fail(job, { code: "composition_missing_source", message: "视频合成缺少已完成分镜。", retryable: false });
      return this.succeed(job, url);
    }
    const composed = await this.composer.compose(job);
    if (composed.ok) return this.succeed(job, composed.url);
    const attempts = (job.attemptCount ?? 0) + 1;
    if (composed.error.retryable && attempts <= videoRetryDelaysMs.length) {
      const delay = videoRetryDelaysMs[attempts - 1] ?? 60_000;
      return this.repository.update(job.id, (item) => ({ ...item, attemptCount: attempts, nextAttemptAt: new Date(Date.now() + delay).toISOString(), error: composed.error }));
    }
    return this.fail(job, composed.error);
  }
  private async succeed(job: VideoJob, url: string) {
    const succeeded = await this.repository.update(job.id, (item) => item.status === "canceled" ? item : ({ ...item, status: "succeeded", pipelineStage: "compose", progress: { completed: item.scenes?.length ?? 1, total: item.scenes?.length ?? 1 }, result: { url, createdAt: new Date().toISOString() }, error: undefined, nextAttemptAt: undefined }));
    if (succeeded) await this.settlement.onSucceeded?.(succeeded);
    return succeeded;
  }
  private async failOrRetry(job: VideoJob, error: VideoError) {
    const attemptCount = (job.attemptCount ?? 0) + 1;
    if (error.retryable && attemptCount <= videoRetryDelaysMs.length) {
      const delay = videoRetryDelaysMs[attemptCount - 1] ?? videoRetryDelaysMs.at(-1) ?? 60_000;
      return this.repository.update(job.id, (item) => ({ ...item, status: "queued", attemptCount, nextAttemptAt: new Date(Date.now() + delay).toISOString(), error }));
    }
    return this.fail(job, error);
  }
  private async fail(job: VideoJob, error: VideoError) { const failed = await this.repository.update(job.id, (item) => ({ ...item, status: "failed", error })); if (failed) await this.settlement.onFailed?.(failed); return failed; }
}

function ensureScenes(job: VideoJob): VideoSceneJob[] {
  if (job.scenes?.length) return job.scenes;
  const scene: VideoScene = { id: "scene-1", index: 0, startSeconds: 0, endSeconds: job.durationSeconds, purpose: "完成视频生成", anchorImageIndex: 0, visualPrompt: job.prompt, narration: "", caption: "" };
  return [{ sceneId: scene.id, index: 0, prompt: job.creativePlan ? videoScenePrompt(scene, job.creativePlan.productProfile) : job.prompt, anchorImageIndex: 0, status: job.status === "submitted" ? "submitted" : "queued", providerTaskId: job.providerTaskId, providerModel: job.providerModel, submittedAt: job.submittedAt }];
}
function markScene(job: VideoJob, index: number, callback: (scene: VideoSceneJob) => VideoSceneJob): VideoSceneJob[] {
  const scenes = ensureScenes(job);
  return scenes.map((scene) => scene.index === index ? callback(scene) : scene);
}

function isSuccess(status: string) { return ["succeed", "success", "completed", "done", "finished"].some((word) => status.toLowerCase().includes(word)); }
function isFailure(status: string) { return ["failed", "error", "canceled", "cancelled"].some((word) => status.toLowerCase().includes(word)); }
function hasTimedOut(job: VideoJob) {
  const startedAt = new Date(job.submittedAt ?? job.createdAt).getTime();
  return Number.isFinite(startedAt) && Date.now() - startedAt >= videoProcessingTimeoutMs();
}
function videoProcessingTimeoutMs() {
  const configured = Number(process.env.VIDEO_JOB_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 60_000 ? Math.trunc(configured) : defaultVideoProcessingTimeoutMs;
}
function timeoutError(): VideoError { return { code: "provider_timeout", message: "视频生成超过 20 分钟仍未完成，任务已自动取消并退回积分。", retryable: false }; }
