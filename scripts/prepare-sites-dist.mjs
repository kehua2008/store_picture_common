import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const serverDir = path.join(distDir, "server");
const openaiDir = path.join(distDir, ".openai");

await mkdir(serverDir, { recursive: true });
await mkdir(openaiDir, { recursive: true });

await copyFile(path.join(root, ".openai", "hosting.json"), path.join(openaiDir, "hosting.json"));
const standaloneServer = await readFile(path.join(distDir, "standalone", "server.js"), "utf8");
await writeFile(
  path.join(serverDir, "standalone-server.cjs"),
  standaloneServer
    .replace("const dir = path.join(__dirname)", "const dir = path.join(__dirname, '..', 'standalone')")
    .replace("process.chdir(__dirname)", "process.chdir(dir)")
);

await writeFile(path.join(serverDir, "index.js"), [
  "import { createRequire } from 'node:module';",
  "const require = createRequire(import.meta.url);",
  "require('./standalone-server.cjs');",
  ""
].join("\n"));
