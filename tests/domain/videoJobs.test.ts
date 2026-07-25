import { rmSync } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { FileVideoJobRepository, VideoJobService } from "../../src/domain/jobs/videoJobs";
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

  it("persists each visual scene before composing a multi-scene final video", async () => {
    const dataDir = path.join(os.tmpdir(), `common-video-${crypto.randomUUID()}`);
    const submitted: string[] = [];
    const plan = buildFallbackVideoCreativePlan({ durationSeconds: 15, imageCount: 3, brief: "出租车投放视频" });
    try {
      const service = new VideoJobService(new FileVideoJobRepository({ dataDir }), {
        async create(input) { submitted.push(input.images[0]); return { ok: true as const, task: { id: `task-${submitted.length}`, model: "kling" } }; },
        async get(input) { return { ok: true as const, status: "succeed", outputUrl: `https://example.test/${input.id}.mp4` }; }
      }, {}, { async compose(job) { return { ok: true as const, url: `https://example.test/${job.id}-final.mp4` }; } });
      const job = await service.createJob({ customerId: "customer-4", prompt: "video", images: ["one", "two", "three"], aspectRatio: "9:16", durationSeconds: 15, outputResolution: "480p", reservedCredits: 900, creativePlan: plan, scenes: plan.scenes.map((scene) => ({ sceneId: scene.id, index: scene.index, prompt: videoScenePrompt(scene, plan.productProfile), anchorImageIndex: scene.anchorImageIndex, status: "queued" })) });
      for (let index = 0; index < 7; index += 1) await service.run(job.id);
      const completed = await service.get(job.id);
      expect(submitted).toEqual(["one", "two", "three"]);
      expect(completed).toMatchObject({ status: "succeeded", progress: { completed: 3, total: 3 }, result: { url: `https://example.test/${job.id}-final.mp4` } });
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
