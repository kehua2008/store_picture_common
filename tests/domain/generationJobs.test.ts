import { mkdirSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { FileGenerationJobRepository, GenerationJobService, type ImageGenerationProvider } from "../../src/domain/jobs/generationJobs";

describe("GenerationJobService", () => {
  it("persists a real provider image result and settles only the completed output", async () => {
    const dataDir = path.join(os.tmpdir(), `common-generation-${crypto.randomUUID()}`);
    const sourcePath = path.join(dataDir, "source.png");
    const previousUploadDir = process.env.STORE_COMMON_UPLOAD_DIR;
    process.env.STORE_COMMON_UPLOAD_DIR = path.join(dataDir, "uploads");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(sourcePath, "source");
    const settled: string[] = [];
    const provider: ImageGenerationProvider = {
      async generate() {
        return { ok: true, images: [{ base64: Buffer.from("png").toString("base64"), mimeType: "image/png" }] };
      }
    };
    const service = new GenerationJobService(new FileGenerationJobRepository({ dataDir }), provider, { onSucceeded: async (job) => { settled.push(`${job.status}:${job.chargedCredits}`); } });
    const job = await service.createJob({ customerId: "customer-1", promptBody: "product prompt", reservedCredits: 30, total: 1, sourceImages: [{ id: "source-1", filename: "source.png", mimeType: "image/png", filePath: sourcePath }] });
    const completed = await service.runJob(job.id);

    expect(completed?.status).toBe("succeeded");
    expect(completed?.progress).toEqual({ completed: 1, total: 1 });
    expect(completed?.results[0]?.url).toContain("/generated-images/");
    expect(settled).toEqual(["succeeded:30"]);
    if (previousUploadDir === undefined) delete process.env.STORE_COMMON_UPLOAD_DIR;
    else process.env.STORE_COMMON_UPLOAD_DIR = previousUploadDir;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("keeps retryable provider failures queued before releasing credits", async () => {
    const dataDir = path.join(os.tmpdir(), `common-generation-${crypto.randomUUID()}`);
    const sourcePath = path.join(dataDir, "source.png");
    const previousUploadDir = process.env.STORE_COMMON_UPLOAD_DIR;
    process.env.STORE_COMMON_UPLOAD_DIR = path.join(dataDir, "uploads");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(sourcePath, "source");
    const provider: ImageGenerationProvider = { async generate() { return { ok: false, error: { code: "provider_timeout", message: "busy", retryable: true } }; } };
    const service = new GenerationJobService(new FileGenerationJobRepository({ dataDir }), provider);
    const job = await service.createJob({ customerId: "customer-1", promptBody: "product prompt", reservedCredits: 30, total: 1, sourceImages: [{ id: "source-1", filename: "source.png", mimeType: "image/png", filePath: sourcePath }] });
    const queued = await service.runJob(job.id);

    expect(queued?.status).toBe("queued");
    expect(queued?.attemptCount).toBe(1);
    expect(queued?.nextAttemptAt).toBeTruthy();
    if (previousUploadDir === undefined) delete process.env.STORE_COMMON_UPLOAD_DIR;
    else process.env.STORE_COMMON_UPLOAD_DIR = previousUploadDir;
    rmSync(dataDir, { recursive: true, force: true });
  });
});
