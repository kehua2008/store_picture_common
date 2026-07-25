import { describe, expect, it } from "vitest";
import { captionEventsFor, narrationFor } from "../../src/server/videoComposer";
import { buildFallbackVideoCreativePlan } from "../../src/domain/video/videoCreativePlan";

describe("video composer director timeline", () => {
  it("uses director beat timing for captions and chronological narration", () => {
    const basePlan = buildFallbackVideoCreativePlan({ durationSeconds: 10, imageCount: 1 });
    const creativePlan = {
      ...basePlan,
      directorBeats: [
        { id: "beat-1", index: 0, startSeconds: 0, endSeconds: 2.5, visualSubject: "商品", cameraMovement: "推近", action: "展示", narration: "先看整体", caption: "整体" },
        { id: "beat-2", index: 1, startSeconds: 2.5, endSeconds: 10, visualSubject: "细节", cameraMovement: "横移", action: "扫过结构", narration: "再看细节", caption: "细节" }
      ]
    };
    const job = { creativePlan } as Parameters<typeof narrationFor>[0];
    expect(narrationFor(job)).toBe("先看整体。再看细节");
    expect(captionEventsFor(job)).toEqual(expect.arrayContaining([expect.stringContaining("0:00:00.00,0:00:02.50"), expect.stringContaining("0:00:02.50,0:00:10.00")]));
  });
});
