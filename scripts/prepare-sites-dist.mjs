import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const serverDir = path.join(distDir, "server");
const openaiDir = path.join(distDir, ".openai");

await mkdir(serverDir, { recursive: true });
await mkdir(openaiDir, { recursive: true });

await copyFile(path.join(root, ".openai", "hosting.json"), path.join(openaiDir, "hosting.json"));

await writeFile(path.join(serverDir, "index.js"), [
  "require('../standalone/server.js');",
  ""
].join("\n"));
