import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import type { StyleVisionAnalyzer, StyleVisionSuggestion } from "./styleVisionAnalyzer";
import { persistentDataDir, persistentUploadSubdir } from "../../server/storagePaths";

export type StyleSampleSourceType = "admin_upload" | "user_replicate" | "link_collect";
export type StyleSampleStatus = "pending_analysis" | "pending_review" | "approved" | "rejected";
export type StyleCandidateBatchStatus = "collecting" | "exported" | "analyzed" | "imported" | "archived";
export type StyleBoardStatus = "draft" | "ready_to_publish" | "published" | "archived";

export interface StyleSampleAnalysis {
  background: string[];
  lighting: string[];
  camera: string[];
  pose: string[];
  palette: string[];
  props: string[];
  composition: string[];
  layout?: string[];
  avoid: string[];
  qualityScore: number;
  summary: string;
}

export interface StyleSample {
  id: string;
  filename: string;
  imageUrl: string;
  mimeType: string;
  imageHash?: string;
  sourceType: StyleSampleSourceType;
  sourceNote?: string;
  platform: string;
  category: string;
  imageType: string;
  styleName: string;
  status: StyleSampleStatus;
  analysis: StyleSampleAnalysis;
  stylePrompt?: string;
  negativePrompt?: string;
  suggestion?: StyleVisionSuggestion;
  analyzer?: string;
  analyzerModel?: string;
  analyzerUsage?: Record<string, unknown>;
  analysisVersion?: string;
  analysisCostCredits?: number;
  customerId?: string;
  billingLedgerEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StyleBoardRules {
  mustUse: string[];
  avoid: string[];
  background: string[];
  lighting: string[];
  camera: string[];
  pose: string[];
  palette: string[];
  prompt: string;
  promptCore?: string;
  promptVariants?: string[];
  negativePrompt?: string;
  productBrief?: string;
  sceneBrief?: string;
  colorRules?: string[];
  compositionRules?: string[];
}

export interface StyleBoard {
  id: string;
  platform: string;
  category: string;
  imageType: string;
  styleName: string;
  sampleCount: number;
  sampleIds: string[];
  rules: StyleBoardRules;
  status: StyleBoardStatus;
  showOnHome: boolean;
  displayOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StyleCandidateBatch {
  id: string;
  name: string;
  sampleIds: string[];
  sourceNote?: string;
  status: StyleCandidateBatchStatus;
  createdAt: string;
  updatedAt: string;
  exportedAt?: string;
  analyzedAt?: string;
  importedAt?: string;
}

interface StyleLibraryData {
  samples: StyleSample[];
  boards: StyleBoard[];
  candidateBatches: StyleCandidateBatch[];
}

export interface CreateStyleSampleInput {
  file: File;
  sourceType: StyleSampleSourceType;
  sourceNote?: string;
  platform?: string;
  category?: string;
  imageType?: string;
  styleName?: string;
  status?: StyleSampleStatus;
  imageHash?: string;
  analysis?: StyleSampleAnalysis;
  stylePrompt?: string;
  negativePrompt?: string;
  suggestion?: StyleVisionSuggestion;
  analyzer?: string;
  analyzerModel?: string;
  analyzerUsage?: Record<string, unknown>;
  analysisVersion?: string;
  analysisCostCredits?: number;
  customerId?: string;
  billingLedgerEntryId?: string;
}

export interface StyleAnalysisResult {
  batchId?: string;
  analyzedAt?: string;
  analyst?: string;
  styleGroups: StyleAnalysisGroup[];
}

export interface StyleAnalysisGroup {
  styleName: string;
  platform?: string;
  category?: string;
  categoryScope?: string[];
  imageType?: string;
  imageTypeScope?: string[];
  productBrief?: string;
  sceneBrief?: string;
  sampleIds: string[];
  promptCore: string;
  promptVariants?: string[];
  negativePrompt?: string;
  rules?: {
    background?: string[];
    lighting?: string[];
    camera?: string[];
    pose?: string[];
    palette?: string[];
    composition?: string[];
    color?: string[];
    avoid?: string[];
    mustUse?: string[];
  };
}

const dataDir = persistentDataDir();
const uploadDir = persistentUploadSubdir("style-samples");
const dataFile = path.join(dataDir, "style-library.json");

export class FileStyleLibraryRepository {
  private readonly analyzer?: StyleVisionAnalyzer;
  private readonly dataDir: string;
  private readonly uploadDir: string;
  private readonly dataFile: string;

  constructor(options: { analyzer?: StyleVisionAnalyzer; dataDir?: string; uploadDir?: string } = {}) {
    this.analyzer = options.analyzer;
    this.dataDir = options.dataDir ?? dataDir;
    this.uploadDir = options.uploadDir ?? uploadDir;
    this.dataFile = path.join(this.dataDir, "style-library.json");
  }

  async all(): Promise<StyleLibraryData> {
    return this.readData();
  }

  async findAnalyzedSampleByHash(imageHash: string): Promise<StyleSample | undefined> {
    if (!imageHash.trim()) return undefined;
    const data = await this.readData();
    return data.samples.find((sample) => sample.imageHash === imageHash && Boolean(sample.stylePrompt?.trim()));
  }

  async analyzeReferenceImage(input: {
    file: File;
    bytes?: Buffer;
    platform?: string;
    category?: string;
    imageType?: string;
    styleName?: string;
  }): Promise<{
    imageHash: string;
    analysis: StyleSampleAnalysis;
    stylePrompt: string;
    negativePrompt?: string;
    suggestion?: StyleVisionSuggestion;
    analyzer?: string;
    analyzerModel?: string;
    analyzerUsage?: Record<string, unknown>;
    analysisVersion: string;
  }> {
    const bytes = input.bytes ?? Buffer.from(await input.file.arrayBuffer());
    const filename = safeFilename(input.file.name || "style-reference.jpg");
    const mimeType = input.file.type || "application/octet-stream";
    const platform = input.platform || "taobao";
    const category = input.category || "general";
    const imageType = input.imageType || "scene_main";
    const styleName = input.styleName || inferStyleName(filename);
    const result = this.analyzer
      ? await this.analyzer.analyze({ filename, mimeType, bytes, platform, category, imageType, styleName })
      : {
          analysis: analyzeStyleSample({ filename, platform, category, imageType, styleName }),
          analyzer: "heuristic",
          suggestion: undefined,
          stylePrompt: undefined,
          negativePrompt: undefined,
          model: undefined,
          usage: undefined
        };
    return {
      imageHash: imageHashForBytes(bytes),
      analysis: result.analysis,
      stylePrompt: result.stylePrompt || buildStylePromptFromAnalysis(result.analysis, styleName),
      negativePrompt: result.negativePrompt,
      suggestion: result.suggestion,
      analyzer: result.analyzer,
      analyzerModel: result.model,
      analyzerUsage: result.usage,
      analysisVersion: "style-reference-analysis.v1"
    };
  }

  async createSamples(inputs: CreateStyleSampleInput[]): Promise<StyleSample[]> {
    const data = await this.readData();
    const now = new Date().toISOString();
    await mkdir(this.uploadDir, { recursive: true });

    const samples: StyleSample[] = [];
    for (const input of inputs) {
      const id = `style-sample-${crypto.randomUUID()}`;
      const filename = safeFilename(input.file.name || `${id}.jpg`);
      const storedName = `${id}-${filename}`;
      const bytes = Buffer.from(await input.file.arrayBuffer());
      await writeFile(path.join(this.uploadDir, storedName), bytes);
      const baseSample = {
        id,
        filename,
        imageUrl: `/style-samples/${storedName}`,
        mimeType: input.file.type || "application/octet-stream",
        imageHash: input.imageHash || imageHashForBytes(bytes),
        sourceType: input.sourceType,
        sourceNote: input.sourceNote,
        platform: input.platform || "taobao",
        category: input.category || "general",
        imageType: input.imageType || "scene_main",
        styleName: input.styleName || inferStyleName(filename),
        status: input.status || (input.sourceType === "user_replicate" ? "pending_review" : "approved"),
        analysis: input.analysis,
        stylePrompt: input.stylePrompt,
        negativePrompt: input.negativePrompt,
        suggestion: input.suggestion,
        analyzer: input.analyzer,
        analyzerModel: input.analyzerModel,
        analyzerUsage: input.analyzerUsage,
        analysisVersion: input.analysisVersion,
        analysisCostCredits: input.analysisCostCredits,
        customerId: input.customerId,
        billingLedgerEntryId: input.billingLedgerEntryId,
        createdAt: now,
        updatedAt: now
      };
      const sample = await this.normalizeStyleSample(baseSample, bytes);
      if (!sample.stylePrompt) {
        sample.stylePrompt = buildStylePromptFromAnalysis(sample.analysis, sample.styleName);
      }
      samples.push(sample);
    }

    data.samples = [...samples, ...data.samples];
    await this.writeData(data);
    return samples;
  }

  async rebuildBoard(input: { platform: string; category: string; imageType: string; styleName: string; publish?: boolean }): Promise<StyleBoard> {
    const data = await this.readData();
    const samples = data.samples.filter((sample) =>
      sample.status === "approved" &&
      sample.platform === input.platform &&
      sample.category === input.category &&
      sample.imageType === input.imageType &&
      sample.styleName === input.styleName
    );
    const now = new Date().toISOString();
    const existing = data.boards.find((board) =>
      board.platform === input.platform &&
      board.category === input.category &&
      board.imageType === input.imageType &&
      board.styleName === input.styleName
    );
    const board: StyleBoard = {
      id: existing?.id ?? `style-board-${crypto.randomUUID()}`,
      platform: input.platform,
      category: input.category,
      imageType: input.imageType,
      styleName: input.styleName,
      sampleCount: samples.length,
      sampleIds: samples.map((sample) => sample.id),
      rules: buildStyleBoardRules(input, samples),
      status: input.publish ? "published" : existing?.status ?? "draft",
      showOnHome: input.publish ? true : existing?.showOnHome ?? false,
      displayOrder: existing?.displayOrder ?? nextDisplayOrder(data.boards),
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    data.boards = [board, ...data.boards.filter((item) => item.id !== board.id)];
    await this.writeData(data);
    return board;
  }

  async updateBoard(input: { id: string; status?: StyleBoardStatus; showOnHome?: boolean; displayOrder?: number }): Promise<StyleBoard | undefined> {
    const data = await this.readData();
    const target = data.boards.find((board) => board.id === input.id);
    if (!target) return undefined;
    const updated = {
      ...target,
      status: input.status ?? target.status,
      showOnHome: input.showOnHome ?? target.showOnHome,
      displayOrder: input.displayOrder ?? target.displayOrder,
      version: input.status && input.status !== target.status ? target.version + 1 : target.version,
      updatedAt: new Date().toISOString()
    };
    data.boards = data.boards.map((board) => board.id === input.id ? updated : board);
    await this.writeData(data);
    return updated;
  }

  async updateBoardStatus(id: string, status: StyleBoardStatus): Promise<StyleBoard | undefined> {
    return this.updateBoard({ id, status });
  }

  async createCandidateBatch(input: { name?: string; sampleIds?: string[]; sourceNote?: string }): Promise<StyleCandidateBatch> {
    const data = await this.readData();
    const now = new Date().toISOString();
    const sampleIds = uniqueExistingSampleIds(input.sampleIds ?? [], data.samples);
    const batch: StyleCandidateBatch = {
      id: `style-candidate-batch-${crypto.randomUUID()}`,
      name: input.name?.trim() || `风格候选批次 ${data.candidateBatches.length + 1}`,
      sampleIds,
      sourceNote: input.sourceNote?.trim() || undefined,
      status: "collecting",
      createdAt: now,
      updatedAt: now
    };
    data.candidateBatches = [batch, ...data.candidateBatches];
    await this.writeData(data);
    return batch;
  }

  async updateCandidateBatch(input: {
    id: string;
    name?: string;
    sampleIds?: string[];
    appendSampleIds?: string[];
    sourceNote?: string;
    status?: StyleCandidateBatchStatus;
  }): Promise<StyleCandidateBatch | undefined> {
    const data = await this.readData();
    const target = data.candidateBatches.find((batch) => batch.id === input.id);
    if (!target) return undefined;
    const sampleIds = input.sampleIds
      ? uniqueExistingSampleIds(input.sampleIds, data.samples)
      : uniqueExistingSampleIds([...(target.sampleIds ?? []), ...(input.appendSampleIds ?? [])], data.samples);
    const now = new Date().toISOString();
    const updated: StyleCandidateBatch = {
      ...target,
      name: input.name?.trim() || target.name,
      sampleIds,
      sourceNote: input.sourceNote?.trim() || target.sourceNote,
      status: input.status ?? target.status,
      updatedAt: now,
      exportedAt: input.status === "exported" ? now : target.exportedAt,
      analyzedAt: input.status === "analyzed" ? now : target.analyzedAt,
      importedAt: input.status === "imported" ? now : target.importedAt
    };
    data.candidateBatches = data.candidateBatches.map((batch) => batch.id === input.id ? updated : batch);
    await this.writeData(data);
    return updated;
  }

  async buildExportManifest(input: {
    batchId?: string;
    sampleIds?: string[];
    status?: StyleSampleStatus;
    category?: string;
    imageType?: string;
  }): Promise<{ manifest: StyleExportManifest; samples: Array<StyleSample & { exportFilename: string; absolutePath: string }> }> {
    const data = await this.readData();
    const batch = input.batchId ? data.candidateBatches.find((item) => item.id === input.batchId) : undefined;
    const requestedIds = input.sampleIds?.length ? new Set(input.sampleIds) : batch ? new Set(batch.sampleIds) : undefined;
    const samples = data.samples.filter((sample) =>
      (!requestedIds || requestedIds.has(sample.id)) &&
      (!input.status || sample.status === input.status) &&
      (!input.category || sample.category === input.category) &&
      (!input.imageType || sample.imageType === input.imageType)
    );
    const exportedSamples = samples.map((sample, index) => ({
      ...sample,
      exportFilename: `${String(index + 1).padStart(3, "0")}-${sample.id}${extnameForSample(sample)}`,
      absolutePath: path.join(this.uploadDir, path.basename(sample.imageUrl))
    }));
    const manifest: StyleExportManifest = {
      schemaVersion: "style-export-manifest.v1",
      batchId: batch?.id ?? input.batchId,
      batchName: batch?.name,
      exportedAt: new Date().toISOString(),
      sampleIds: exportedSamples.map((sample) => sample.id),
      samples: exportedSamples.map((sample) => ({
        sampleId: sample.id,
        fileName: sample.exportFilename,
        sourceType: sample.sourceType,
        sourceNote: sample.sourceNote,
        platform: sample.platform,
        category: sample.category,
        imageType: sample.imageType,
        styleName: sample.styleName,
        status: sample.status,
        analysis: sample.analysis,
        stylePrompt: sample.stylePrompt,
        negativePrompt: sample.negativePrompt,
        imageUrl: sample.imageUrl,
        originalFilename: sample.filename,
        createdAt: sample.createdAt
      }))
    };
    return { manifest, samples: exportedSamples };
  }

  async importStyleAnalysisResult(result: StyleAnalysisResult): Promise<StyleBoard[]> {
    if (!Array.isArray(result.styleGroups) || result.styleGroups.length === 0) {
      throw new Error("missing_style_groups");
    }
    const data = await this.readData();
    const now = new Date().toISOString();
    const boards = result.styleGroups.map((group, index) => {
      const sampleIds = uniqueExistingSampleIds(group.sampleIds, data.samples);
      if (!sampleIds.length) throw new Error(`style_group_without_valid_samples:${group.styleName}`);
      const firstSample = data.samples.find((sample) => sample.id === sampleIds[0]);
      const platform = group.platform || firstSample?.platform || "taobao";
      const category = group.category || group.categoryScope?.[0] || firstSample?.category || "general";
      const imageType = group.imageType || group.imageTypeScope?.[0] || firstSample?.imageType || "scene_main";
      const existing = data.boards.find((board) =>
        board.platform === platform &&
        board.category === category &&
        board.imageType === imageType &&
        board.styleName === group.styleName
      );
      const promptVariants = (group.promptVariants ?? []).map((item) => item.trim()).filter(Boolean);
      const board: StyleBoard = {
        id: existing?.id ?? `style-board-${crypto.randomUUID()}`,
        platform,
        category,
        imageType,
        styleName: group.styleName,
        sampleCount: sampleIds.length,
        sampleIds,
        rules: {
          mustUse: group.rules?.mustUse ?? [
            `style name: ${group.styleName}`,
            group.productBrief ? `product/category brief: ${group.productBrief}` : "",
            group.sceneBrief ? `scene brief: ${group.sceneBrief}` : ""
          ].filter(Boolean),
          avoid: group.rules?.avoid ?? (group.negativePrompt ? [group.negativePrompt] : []),
          background: group.rules?.background ?? [],
          lighting: group.rules?.lighting ?? [],
          camera: group.rules?.camera ?? [],
          pose: group.rules?.pose ?? [],
          palette: group.rules?.palette ?? group.rules?.color ?? [],
          compositionRules: group.rules?.composition ?? [],
          colorRules: group.rules?.color ?? [],
          promptCore: group.promptCore,
          promptVariants,
          negativePrompt: group.negativePrompt,
          productBrief: group.productBrief,
          sceneBrief: group.sceneBrief,
          prompt: [
            `IMPORTED STYLEBOARD: ${group.styleName}.`,
            group.productBrief ? `Product/category scope: ${group.productBrief}.` : undefined,
            group.sceneBrief ? `Scene scope: ${group.sceneBrief}.` : undefined,
            `Prompt core: ${group.promptCore}.`,
            promptVariants.length ? `Prompt variants: ${promptVariants.join(" | ")}.` : undefined,
            group.negativePrompt ? `Negative prompt: ${group.negativePrompt}.` : undefined,
            "Use these rules as art direction. Do not copy source images, exact layouts, logos, text, faces, or merchant identity."
          ].filter(Boolean).join(" ")
        },
        status: "ready_to_publish",
        showOnHome: false,
        displayOrder: existing?.displayOrder ?? nextDisplayOrder(data.boards) + index,
        version: (existing?.version ?? 0) + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      return board;
    });
    const boardIds = new Set(boards.map((board) => board.id));
    data.boards = [...boards, ...data.boards.filter((board) => !boardIds.has(board.id))];
    if (result.batchId) {
      data.candidateBatches = data.candidateBatches.map((batch) =>
        batch.id === result.batchId
          ? { ...batch, status: "imported", importedAt: now, updatedAt: now }
          : batch
      );
    }
    await this.writeData(data);
    return boards;
  }

  async updateSample(input: {
    id: string;
    status?: StyleSampleStatus;
    platform?: string;
    category?: string;
    imageType?: string;
    styleName?: string;
    sourceNote?: string;
  }): Promise<StyleSample | undefined> {
    const data = await this.readData();
    const target = data.samples.find((sample) => sample.id === input.id);
    if (!target) return undefined;
    const updatedBase = {
      ...target,
      platform: input.platform ?? target.platform,
      category: input.category ?? target.category,
      imageType: input.imageType ?? target.imageType,
      styleName: input.styleName ?? target.styleName,
      status: input.status ?? target.status,
      sourceNote: input.sourceNote ?? target.sourceNote,
      updatedAt: new Date().toISOString()
    };
    const updated = await this.normalizeStyleSample(updatedBase);
    data.samples = data.samples.map((sample) => sample.id === input.id ? updated : sample);
    await this.writeData(data);
    return updated;
  }

  async approveSampleForCandidatePool(id: string): Promise<{ sample: StyleSample; batch: StyleCandidateBatch } | undefined> {
    const data = await this.readData();
    const target = data.samples.find((sample) => sample.id === id);
    if (!target) return undefined;

    const now = new Date().toISOString();
    const updatedBase = {
      ...target,
      status: "approved" as const,
      updatedAt: now
    };
    const sample = await this.normalizeStyleSample(updatedBase);
    data.samples = data.samples.map((item) => item.id === id ? sample : item);

    const poolName = "用户参考图候选池";
    const existing = data.candidateBatches.find((batch) => batch.name === poolName && batch.status === "collecting");
    const batch: StyleCandidateBatch = existing
      ? {
          ...existing,
          sampleIds: uniqueExistingSampleIds([...(existing.sampleIds ?? []), sample.id], data.samples),
          sourceNote: existing.sourceNote ?? "用户上传参考图审核通过后长期保留，用于 Codex 分析和系统迭代",
          updatedAt: now
        }
      : {
          id: `style-candidate-batch-${crypto.randomUUID()}`,
          name: poolName,
          sampleIds: [sample.id],
          sourceNote: "用户上传参考图审核通过后长期保留，用于 Codex 分析和系统迭代",
          status: "collecting",
          createdAt: now,
          updatedAt: now
        };
    data.candidateBatches = existing
      ? data.candidateBatches.map((item) => item.id === batch.id ? batch : item)
      : [batch, ...data.candidateBatches];

    await this.writeData(data);
    return { sample, batch };
  }

  async rejectSampleAndDelete(id: string): Promise<{ sample: StyleSample } | undefined> {
    const data = await this.readData();
    const target = data.samples.find((sample) => sample.id === id);
    if (!target) return undefined;

    data.samples = data.samples.filter((sample) => sample.id !== id);
    data.candidateBatches = data.candidateBatches.map((batch) => ({
      ...batch,
      sampleIds: (batch.sampleIds ?? []).filter((sampleId) => sampleId !== id),
      updatedAt: batch.sampleIds.includes(id) ? new Date().toISOString() : batch.updatedAt
    }));
    await unlink(path.join(this.uploadDir, path.basename(target.imageUrl))).catch(() => undefined);
    await this.writeData(data);
    return { sample: { ...target, status: "rejected", updatedAt: new Date().toISOString() } };
  }

  private async normalizeStyleSample(input: Omit<StyleSample, "analysis"> & Partial<Pick<StyleSample, "analysis">>, bytes?: Buffer): Promise<StyleSample> {
    if (input.analysis) {
      return {
        ...input,
        analysis: input.analysis,
        stylePrompt: input.stylePrompt,
        negativePrompt: input.negativePrompt,
        analyzer: input.analyzer,
        analyzerModel: input.analyzerModel,
        analyzerUsage: input.analyzerUsage,
        analysisVersion: input.analysisVersion,
        analysisCostCredits: input.analysisCostCredits,
        customerId: input.customerId,
        billingLedgerEntryId: input.billingLedgerEntryId
      };
    }
    if (this.analyzer && bytes) {
      const result = await this.analyzer.analyze({
        filename: input.filename,
        mimeType: input.mimeType,
        bytes,
        platform: input.platform,
        category: input.category,
        imageType: input.imageType,
        styleName: input.styleName
      });
      return {
        ...input,
        analysis: result.analysis,
        suggestion: result.suggestion,
        analyzer: result.analyzer,
        stylePrompt: result.stylePrompt,
        negativePrompt: result.negativePrompt,
        analyzerModel: result.model,
        analyzerUsage: result.usage,
        analysisVersion: "style-reference-analysis.v1"
      };
    }
    return normalizeStyleSample(input);
  }

  private async readData(): Promise<StyleLibraryData> {
    try {
      const raw = await readFile(this.dataFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<StyleLibraryData>;
      return {
        samples: Array.isArray(parsed.samples) ? parsed.samples.map(normalizePersistedStyleSample) : [],
        boards: Array.isArray(parsed.boards) ? parsed.boards.map(normalizeStyleBoard) : [],
        candidateBatches: Array.isArray(parsed.candidateBatches) ? parsed.candidateBatches : []
      };
    } catch {
      return { samples: [], boards: [], candidateBatches: [] };
    }
  }

  private async writeData(data: StyleLibraryData): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.dataFile, JSON.stringify(data, null, 2));
  }
}

export interface StyleExportManifest {
  schemaVersion: "style-export-manifest.v1";
  batchId?: string;
  batchName?: string;
  exportedAt: string;
  sampleIds: string[];
  samples: Array<{
    sampleId: string;
    fileName: string;
    sourceType: StyleSampleSourceType;
    sourceNote?: string;
    platform: string;
    category: string;
    imageType: string;
    styleName: string;
    status: StyleSampleStatus;
    analysis: StyleSampleAnalysis;
    stylePrompt?: string;
    negativePrompt?: string;
    imageUrl: string;
    originalFilename: string;
    createdAt: string;
  }>;
}

function normalizeStyleSample(input: Omit<StyleSample, "analysis">): StyleSample {
  return {
    ...input,
    analysis: analyzeStyleSample({
      filename: input.filename,
      platform: input.platform,
      category: input.category,
      imageType: input.imageType,
      styleName: input.styleName
    })
  };
}

function normalizePersistedStyleSample(sample: StyleSample): StyleSample {
  return {
    ...sample,
    analysis: sample.analysis ?? analyzeStyleSample({
      filename: sample.filename,
      platform: sample.platform,
      category: sample.category,
      imageType: sample.imageType,
      styleName: sample.styleName
    })
  };
}

export function imageHashForBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function buildStylePromptFromAnalysis(analysis: StyleSampleAnalysis, styleName: string): string {
  const layout = analysis.layout?.slice(0, 4).join(", ");
  return [
    `Reference style "${styleName}" controls the reusable scene structure, especially layout, background, environment, lighting, tone, lens and composition.`,
    layout ? `Layout and visual hierarchy: ${layout}.` : undefined,
    `Background: ${analysis.background.slice(0, 5).join(", ")}.`,
    `Lighting: ${analysis.lighting.slice(0, 4).join(", ")}.`,
    `Camera and composition: ${[...analysis.camera.slice(0, 4), ...analysis.composition.slice(0, 4)].join(", ")}.`,
    analysis.pose.length ? `Pose or subject placement: ${analysis.pose.slice(0, 4).join(", ")}.` : undefined,
    `Palette and retouching mood: ${analysis.palette.slice(0, 5).join(", ")}.`,
    "Highest priority: preserve the uploaded product identity exactly, including logo, material, texture, pattern, silhouette, shape, construction and color blocking. Do not copy unrelated objects, people, text, logos or product identity from the reference style image."
  ].join(" ");
}

export function analyzeStyleSample(input: { filename: string; platform: string; category: string; imageType: string; styleName: string }): StyleSampleAnalysis {
  const profile = styleProfile(input.styleName);
  const categoryText = categoryLabel(input.category);
  const imageTypeText = imageTypeLabel(input.imageType);
  return {
    background: profile.background,
    lighting: profile.lighting,
    camera: profile.camera,
    pose: profile.pose,
    palette: profile.palette,
    props: profile.props,
    composition: profile.composition,
    layout: inferStyleLayout(input),
    avoid: profile.avoid,
    qualityScore: 82,
    summary: `${categoryText} / ${imageTypeText} / ${input.styleName}: ${profile.summary}`
  };
}

export function inferStyleLayout(input: { filename: string; platform: string; category: string; imageType: string; styleName: string }): string[] {
  const fingerprint = `${input.filename} ${input.styleName} ${input.imageType}`.toLowerCase();
  if (/(hero|poster|cover|banner|页头|海报)/.test(fingerprint)) {
    return [
      "editorial poster composition",
      "one dominant subject on the right or center-right",
      "left-side copy-safe negative space",
      "geometric accent blocks or clean shape framing",
      "soft top-left light with crisp product readability"
    ];
  }

  if (/(lifestyle|scene|window|street|lookbook|outdoor|interior)/.test(fingerprint)) {
    return [
      "balanced commercial lifestyle layout",
      "single dominant subject",
      "stable negative space for product readability",
      "clear depth separation between subject and background"
    ];
  }

  return [
    "clean ecommerce layout",
    "single dominant subject",
    "product-first framing",
    "clear visual hierarchy"
  ];
}

function buildStyleBoardRules(input: { platform: string; category: string; imageType: string; styleName: string }, samples: StyleSample[]): StyleBoardRules {
  const fallback = analyzeStyleSample({ filename: "", ...input });
  const background = uniqueFlat(samples.map((sample) => sample.analysis.background));
  const lighting = uniqueFlat(samples.map((sample) => sample.analysis.lighting));
  const camera = uniqueFlat(samples.map((sample) => sample.analysis.camera));
  const pose = uniqueFlat(samples.map((sample) => sample.analysis.pose));
  const palette = uniqueFlat(samples.map((sample) => sample.analysis.palette));
  const avoid = uniqueFlat(samples.map((sample) => sample.analysis.avoid));
  const rules = {
    background: background.length ? background : fallback.background,
    lighting: lighting.length ? lighting : fallback.lighting,
    camera: camera.length ? camera : fallback.camera,
    pose: pose.length ? pose : fallback.pose,
    palette: palette.length ? palette : fallback.palette,
    avoid: avoid.length ? avoid : fallback.avoid
  };
  const mustUse = [
    `style name: ${input.styleName}`,
    `category: ${categoryLabel(input.category)}`,
    `image type: ${imageTypeLabel(input.imageType)}`,
    `use background family: ${rules.background.slice(0, 5).join(", ")}`,
    `use lighting: ${rules.lighting.slice(0, 4).join(", ")}`,
    `use camera/composition: ${rules.camera.slice(0, 4).join(", ")}`,
    `use pose/product angle: ${rules.pose.slice(0, 5).join(", ")}`
  ];
  return {
    ...rules,
    mustUse,
    prompt: [
      `PLATFORM STYLEBOARD: ${input.styleName} for ${categoryLabel(input.category)} / ${imageTypeLabel(input.imageType)}.`,
      `Learned from ${samples.length} approved style samples.`,
      `Must use: ${mustUse.join("; ")}.`,
      `Palette: ${rules.palette.slice(0, 6).join(", ")}.`,
      `Avoid: ${rules.avoid.slice(0, 8).join(", ")}.`,
      "Use these as style structure rules only. Do not copy any source image, brand logo, exact layout, face, text, or merchant identity."
    ].join(" ")
  };
}

function styleProfile(styleName: string) {
  const normalized = styleName.toLowerCase();
  if (/极简|minimal|白场|高级/.test(styleName) || normalized.includes("minimal")) {
    return {
      background: ["seamless white sweep", "light gray studio", "matte plinth", "paper texture set"],
      lighting: ["large softbox", "controlled shadow", "clean high-key light"],
      camera: ["70mm catalog lens", "straight-on composition", "centered product crop"],
      pose: ["neutral front pose", "slight side turn", "arms away from product", "product-first angle"],
      palette: ["white", "off-white", "light gray", "charcoal accent"],
      props: ["matte plinth", "minimal paper surface"],
      composition: ["large centered subject", "clean negative space", "inspection-first layout"],
      avoid: ["street wall", "building facade", "busy props", "lifestyle sidewalk"],
      summary: "clean minimal premium ecommerce image with strict product readability"
    };
  }
  if (/韩|松弛|korean|cafe|咖啡/.test(styleName) || normalized.includes("korean")) {
    return {
      background: ["cafe window", "sunlit apartment", "white curtain", "pale wood floor"],
      lighting: ["soft window light", "low contrast", "hazy morning daylight"],
      camera: ["50mm eye-level", "natural negative space", "medium full-body crop"],
      pose: ["relaxed standing", "looking down", "gentle walking", "seated edge of chair"],
      palette: ["cream", "pale gray", "washed denim", "butter yellow"],
      props: ["book", "canvas bag", "wood chair", "small table"],
      composition: ["airy lifestyle frame", "quiet margin", "soft crop"],
      avoid: ["marble corridor", "parking garage", "hard contrast", "ordinary stone wall"],
      summary: "soft relaxed Korean lifestyle look with natural window light"
    };
  }
  if (/老钱|quiet|luxury|old/.test(styleName) || normalized.includes("luxury")) {
    return {
      background: ["marble corridor", "quiet club lounge", "arched doorway", "warm stone interior"],
      lighting: ["soft window light", "gentle shadow falloff", "low-contrast premium light"],
      camera: ["70-85mm editorial lens", "straight verticals", "waist-to-full-body crop"],
      pose: ["calm contrapposto", "one hand lightly in pocket", "holding lapel", "slow half-turn"],
      palette: ["ivory", "oatmeal", "camel", "charcoal", "deep navy"],
      props: ["tailored layer", "loafers", "linen curtain"],
      composition: ["restrained luxury frame", "architectural verticals", "quiet negative space"],
      avoid: ["neon street", "metal shutter", "random beige wall", "busy props"],
      summary: "restrained high-ticket quiet luxury ecommerce art direction"
    };
  }
  if (/高街|street|潮/.test(styleName) || normalized.includes("street")) {
    return {
      background: ["metal shutter", "parking garage", "underpass", "city crosswalk", "neon storefront"],
      lighting: ["harder side light", "late afternoon contrast", "urban accent light"],
      camera: ["low 28-35mm angle", "wide perspective", "dynamic full-body frame"],
      pose: ["wide stance", "stride toward camera", "one shoulder turned", "leaning against rail"],
      palette: ["black", "cement gray", "denim blue", "accent red", "electric blue"],
      props: ["rail", "street texture", "clean concrete"],
      composition: ["dynamic diagonal", "strong foreground depth", "streetwear silhouette"],
      avoid: ["marble lounge", "cafe softness", "plain beige wall", "quiet catalog pose"],
      summary: "high-street energetic visual with dynamic camera and stronger attitude"
    };
  }
  if (/山|户外|机能|gorp|outdoor/.test(styleName) || normalized.includes("outdoor")) {
    return {
      background: ["trail entrance", "rocky path", "wet pavement", "grass slope", "campsite texture"],
      lighting: ["real outdoor daylight", "practical shadows", "overcast functional light"],
      camera: ["35-50mm field-test framing", "three-quarter product view", "full-body outdoor crop"],
      pose: ["stepping over rock", "tightening drawcord", "holding backpack strap", "walking on trail"],
      palette: ["moss green", "sand", "stone gray", "black", "muted orange"],
      props: ["backpack", "trail ground", "camp texture"],
      composition: ["utility-first frame", "field-tested context", "product details visible"],
      avoid: ["office facade", "luxury stone corridor", "cafe window", "generic street wall"],
      summary: "outdoor utility style with field-tested product function"
    };
  }
  return {
    background: ["merchant-grade lifestyle context", "clean ecommerce set", "category-specific product scene"],
    lighting: ["professional ecommerce lighting", "controlled shadows", "clean retouching"],
    camera: ["product-first commercial framing", "clear front or three-quarter view", "straight verticals"],
    pose: ["product-first composition", "scale-revealing use case", "inspection-friendly angle"],
    palette: ["clean white", "warm gray", "category color accent"],
    props: ["minimal scale cue", "category-relevant prop"],
    composition: ["single dominant product", "clean background hierarchy", "stable crop"],
    avoid: ["price badge", "watermark", "messy props", "generic repeated template"],
    summary: "clean merchant-ready ecommerce style awaiting richer sample clustering"
  };
}

export function inferStyleName(filename: string): string {
  if (/极简|minimal|white|studio/i.test(filename)) return "极简高级";
  if (/韩|korean|cafe|relax/i.test(filename)) return "韩系松弛";
  if (/老钱|luxury|old|quiet/i.test(filename)) return "老钱质感";
  if (/街|street|trend/i.test(filename)) return "高街潮流";
  if (/山|outdoor|gorp/i.test(filename)) return "山系机能";
  return "待归类风格";
}

function safeFilename(filename: string): string {
  return filename.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "style-sample.jpg";
}

function uniqueFlat(items: string[][]): string[] {
  return Array.from(new Set(items.flat().map((item) => item.trim()).filter(Boolean))).slice(0, 12);
}

function normalizeStyleBoard(board: StyleBoard): StyleBoard {
  return {
    ...board,
    status: board.status ?? "draft",
    showOnHome: board.showOnHome ?? board.status === "published",
    displayOrder: Number.isFinite(board.displayOrder) ? board.displayOrder : 0,
    version: board.version ?? 1
  };
}

function uniqueExistingSampleIds(sampleIds: string[], samples: StyleSample[]): string[] {
  const existing = new Set(samples.map((sample) => sample.id));
  return Array.from(new Set(sampleIds.map((id) => id.trim()).filter((id) => id && existing.has(id))));
}

function nextDisplayOrder(boards: StyleBoard[]): number {
  return boards.reduce((max, board) => Math.max(max, Number.isFinite(board.displayOrder) ? board.displayOrder : 0), 0) + 10;
}

function extnameForSample(sample: StyleSample): string {
  const ext = path.extname(sample.filename || sample.imageUrl).toLowerCase();
  if (ext) return ext;
  if (sample.mimeType === "image/png") return ".png";
  if (sample.mimeType === "image/webp") return ".webp";
  return ".jpg";
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    general_merchandise: "通用百货",
    home_textile: "家纺家居",
    kitchenware: "厨房水杯",
    small_appliance: "日用小家电",
    storage_cleaning: "收纳清洁",
    personal_gift: "个护礼品",
    shoes: "鞋子",
    bags: "箱包",
    beauty: "美妆个护",
    baby: "母婴",
    home: "家居",
    digital: "数码家电",
    food: "食品",
    sports: "运动户外",
    jewelry: "珠宝配饰",
    auto: "汽车用品",
    general: "通用商品"
  };
  return labels[category] ?? category;
}

function imageTypeLabel(imageType: string): string {
  const labels: Record<string, string> = {
    style_candidate: "风格候选图",
    scene_main: "场景主图",
    white_main: "白底主图",
    studio_main: "棚拍主图",
    detail_header_poster: "详情页海报",
    detail_texture: "材质细节",
    detail_model_fit: "穿着展示",
    detail_scene_lifestyle: "场景搭配",
    feed_card: "信息流图",
    live_cover: "直播封面"
  };
  return labels[imageType] ?? imageType;
}
