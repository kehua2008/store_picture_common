import { rmSync } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildVideoRenderScenes, FileVideoJobRepository, VideoJobService } from "../../src/domain/jobs/videoJobs";
import { buildFallbackVideoCreativePlan, videoScenePrompt } from "../../src/domain/video/videoCreativePlan";

describe("VideoJobService", () => {
  it("queues a retryable provider submission failure instead of charging or failing immediately", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    const service = new VideoJobService(new FileVideoJobRepository({ dataDir }), {
      async create() { return { ok: false as const, error: { code: "provider_rate_limited", message: "busy", retryable: true } }; },
      async get() { return { ok: true as const, status: "processing" }; }
    });
    const job = await service.createJob({ customerId: "customer-1", prompt: "video", images: ["https://example.test/source.png"], aspectRatio: "9:16", durationSeconds: 5, outputResolution: "480p", reservedCredits: 300 });
    const queued = await service.run(job.id);

    expect(queued?.status).toBe("queued");
    expect(queued?.attemptCount).toBe(1);
    expect(queued?.nextAttemptAt).toBeTruthy();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("notifies consumption settlement only after a video result succeeds", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    const callbacks: number[] = [];
    try {
      const service = new VideoJobService(new FileVideoJobRepository({ dataDir }), {
        async create() { return { ok: true as const, task: { id: "provider-task-1", model: "yunwu-video" } }; },
        async get() { return { ok: true as const, status: "succeeded", outputUrl: "https://example.test/video.mp4" }; }
      }, {
        async onSucceeded(job) { callbacks.push(job.chargedCredits); }
      });
      const job = await service.createJob({ customerId: "customer-1", prompt: "video", images: ["https://example.test/source.png"], aspectRatio: "9:16", durationSeconds: 5, outputResolution: "480p", reservedCredits: 300 });

      await service.run(job.id);
      expect(callbacks).toEqual([]);
      const completed = await service.run(job.id);

      expect(completed?.status).toBe("succeeded");
      expect(callbacks).toEqual([300]);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("recognizes the provider's succeed status as a completed video", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    try {
      const service = new VideoJobService(new FileVideoJobRepository({ dataDir }), {
        async create() { return { ok: true as const, task: { id: "provider-task-2", model: "kling" } }; },
        async get() { return { ok: true as const, status: "succeed", outputUrl: "https://example.test/video.mp4" }; }
      });
      const job = await service.createJob({ customerId: "customer-2", prompt: "video", images: ["https://example.test/source.png"], aspectRatio: "9:16", durationSeconds: 5, outputResolution: "480p", reservedCredits: 300 });
      await service.run(job.id);
      const completed = await service.run(job.id);
      expect(completed).toMatchObject({ status: "succeeded", progress: { completed: 1, total: 1 } });
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("fails and settles a submitted task after its processing timeout", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    const previousTimeout = process.env.VIDEO_JOB_TIMEOUT_MS;
    process.env.VIDEO_JOB_TIMEOUT_MS = "60000";
    const failed: string[] = [];
    try {
      const service = new VideoJobService(new FileVideoJobRepository({ dataDir }), {
        async create() { return { ok: true as const, task: { id: "provider-task-3", model: "kling" } }; },
        async get() { return { ok: true as const, status: "processing" }; }
      }, { async onFailed(job) { failed.push(job.id); } });
      const job = await service.createJob({ customerId: "customer-3", prompt: "video", images: ["https://example.test/source.png"], aspectRatio: "9:16", durationSeconds: 5, outputResolution: "480p", reservedCredits: 300 });
      await service.run(job.id);
      await new FileVideoJobRepository({ dataDir }).update(job.id, (item) => ({ ...item, submittedAt: new Date(Date.now() - 61_000).toISOString() }));
      const expired = await service.run(job.id);
      expect(expired).toMatchObject({ status: "failed", error: { code: "provider_timeout" } });
      expect(failed).toEqual([job.id]);
    } finally {
      if (previousTimeout === undefined) delete process.env.VIDEO_JOB_TIMEOUT_MS;
      else process.env.VIDEO_JOB_TIMEOUT_MS = previousTimeout;
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("allows a submitted task to be canceled and prevents a late provider result from reviving it", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    const canceled: string[] = [];
    try {
      const service = new VideoJobService(new FileVideoJobRepository({ dataDir }), {
        async create() { return { ok: true as const, task: { id: "provider-task-cancel", model: "kling" } }; },
        async get() { return { ok: true as const, status: "succeed", outputUrl: "https://example.test/video.mp4" }; }
      }, { async onCanceled(job) { canceled.push(job.id); } });
      const job = await service.createJob({ customerId: "customer-cancel", prompt: "video", images: ["https://example.test/source.png"], aspectRatio: "9:16", durationSeconds: 5, outputResolution: "480p", reservedCredits: 300 });
      await service.run(job.id);
      const stopped = await service.cancel(job.id);
      const afterLateProviderResult = await service.run(job.id);
      expect(stopped?.status).toBe("canceled");
      expect(afterLateProviderResult?.status).toBe("canceled");
      expect(canceled).toEqual([job.id]);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("runs a composing task once when route bundles create separate service instances", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    let composeCalls = 0;
    let releaseComposition: () => void = () => undefined;
    const compositionStarted = new Promise<void>((resolve) => {
      releaseComposition = resolve;
    });
    let started!: () => void;
    const startedComposition = new Promise<void>((resolve) => { started = resolve; });
    const repository = new FileVideoJobRepository({ dataDir });
    const provider = {
      async create() { return { ok: true as const, task: { id: "unused", model: "ark" } }; },
      async get() { return { ok: true as const, status: "succeeded", outputUrl: "https://example.test/video.mp4" }; }
    };
    const composer = {
      async compose(job: { id: string }) {
        composeCalls += 1;
        started();
        await compositionStarted;
        return { ok: true as const, url: `https://example.test/${job.id}.mp4` };
      }
    };
    try {
      const firstService = new VideoJobService(repository, provider, {}, composer);
      const secondService = new VideoJobService(repository, provider, {}, composer);
      const job = await firstService.createJob({ customerId: "customer-compose", prompt: "video", images: ["https://example.test/source.png"], aspectRatio: "9:16", durationSeconds: 5, outputResolution: "480p", reservedCredits: 300 });
      await repository.update(job.id, (item) => ({ ...item, status: "composing", scenes: [{ sceneId: "scene-1", index: 0, prompt: "video", status: "succeeded", resultUrl: "https://example.test/video.mp4" }] }));

      const firstRun = firstService.run(job.id);
      await startedComposition;
      const secondRun = secondService.run(job.id);
      await Promise.resolve();
      expect(composeCalls).toBe(1);
      releaseComposition();
      await Promise.all([firstRun, secondRun]);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("submits a 15-second Ark video once with the complete multi-angle fact package", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    const submitted: string[][] = [];
    const durations: number[] = [];
    const plan = buildFallbackVideoCreativePlan({ durationSeconds: 15, imageCount: 3, brief: "出租车投放视频" });
    try {
      const service = new VideoJobService(new FileVideoJobRepository({ dataDir }), {
        async create(input) { submitted.push(input.images); durations.push(input.durationSeconds); return { ok: true as const, task: { id: `task-${submitted.length}`, model: "ark" } }; },
        async get(input) { return { ok: true as const, status: "succeed", outputUrl: `https://example.test/${input.id}.mp4` }; }
      }, {}, { async compose(job) { return { ok: true as const, url: `https://example.test/${job.id}-final.mp4` }; } });
      const job = await service.createJob({ customerId: "customer-4", prompt: "video", images: ["one", "two", "three"], aspectRatio: "9:16", durationSeconds: 15, outputResolution: "480p", reservedCredits: 360, creativePlan: plan, renderMode: "native_full", scenes: buildVideoRenderScenes(plan, "native_full") });
      for (let index = 0; index < 3; index += 1) await service.run(job.id);
      const completed = await service.get(job.id);
      expect(submitted).toEqual([["one", "two", "three"]]);
      expect(durations).toEqual([15]);
      expect(completed).toMatchObject({ status: "succeeded", progress: { completed: 1, total: 1 }, result: { url: `https://example.test/${job.id}-final.mp4` } });
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("uses an internal scene-specific fallback only when multi-image support is unavailable", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    const submitted: string[] = [];
    const plan = buildFallbackVideoCreativePlan({ durationSeconds: 15, imageCount: 3, brief: "商品短片" });
    const scenes = plan.scenes.map((scene, index) => ({ ...scene, fallbackReferenceIndex: [2, 0, 1][index] }));
    try {
      const service = new VideoJobService(new FileVideoJobRepository({ dataDir }), {
        supportsMultiImage() { return false; },
        async create(input) { submitted.push(input.images[0]); return { ok: true as const, task: { id: `task-${submitted.length}`, model: "kling" } }; },
        async get(input) { return { ok: true as const, status: "succeed", outputUrl: `https://example.test/${input.id}.mp4` }; }
      }, {}, { async compose(job) { return { ok: true as const, url: `https://example.test/${job.id}-final.mp4` }; } });
      const job = await service.createJob({ customerId: "customer-fallback", prompt: "video", images: ["front", "detail", "package"], aspectRatio: "9:16", durationSeconds: 15, outputResolution: "480p", reservedCredits: 900, creativePlan: { ...plan, scenes }, renderMode: "segmented_fallback", scenes: scenes.map((scene) => ({ sceneId: scene.id, index: scene.index, prompt: videoScenePrompt(scene, plan.productProfile), fallbackReferenceIndex: scene.fallbackReferenceIndex, status: "queued" })) });
      for (let index = 0; index < 7; index += 1) await service.run(job.id);
      expect(submitted).toEqual(["package", "front", "detail"]);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
