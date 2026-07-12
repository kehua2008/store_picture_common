import { rmSync } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { FileVideoJobRepository, VideoJobService } from "../../src/domain/jobs/videoJobs";

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
});
