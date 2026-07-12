#!/usr/bin/env node
import { execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const projectRoot = process.cwd();
const dataDir = process.env.STORE_COMMON_DATA_DIR || path.join(projectRoot, ".data-common");
const pm2AppName = process.env.PM2_APP_NAME;

if (!pm2AppName) {
  throw new Error("PM2_APP_NAME is required for the common merchandise site.");
}

console.log(`[health] cwd=${projectRoot}`);
console.log(`[health] dataDir=${dataDir}`);
printSystemMemory();
printPm2Status(pm2AppName);
printDataSizes(dataDir);
printRecentNginxErrors();

function printSystemMemory() {
  const free = runCommand("free", ["-h"]);
  if (free) {
    console.log("[health] system memory:");
    console.log(free.trim());
  }
}

function printPm2Status(appName) {
  const output = runCommand("pm2", ["jlist"]);
  if (!output) {
    console.log("[health] pm2 unavailable");
    return;
  }
  try {
    const processes = JSON.parse(output);
    const app = processes.find((item) => item.name === appName);
    if (!app) {
      console.log(`[health] pm2 app ${appName} not found`);
      return;
    }
    console.log(`[health] pm2 ${appName}: status=${app.pm2_env?.status} rss=${formatBytes(app.monit?.memory ?? 0)} cpu=${app.monit?.cpu ?? 0}% restarts=${app.pm2_env?.restart_time ?? 0}`);
  } catch {
    console.log("[health] pm2 output could not be parsed");
  }
}

function printDataSizes(baseDir) {
  console.log("[health] data sizes:");
  for (const target of [
    baseDir,
    path.join(baseDir, "generation-jobs.json"),
    path.join(baseDir, "users.json"),
    path.join(baseDir, "recharge-orders.json"),
    path.join(baseDir, "feedback-reports.json"),
    path.join(baseDir, "style-library.json")
  ]) {
    if (!existsSync(target)) {
      console.log(`- ${path.relative(projectRoot, target) || target}: missing`);
      continue;
    }
    const stats = statSync(target);
    const bytes = stats.isDirectory() ? directorySize(target) : stats.size;
    console.log(`- ${path.relative(projectRoot, target) || target}: ${formatBytes(bytes)}`);
  }
}

function printRecentNginxErrors() {
  const errorLog = "/var/log/nginx/error.log";
  if (!existsSync(errorLog)) return;
  try {
    const lines = readFileSync(errorLog, "utf8").trim().split("\n").slice(-20);
    if (lines.length) {
      console.log("[health] recent nginx errors:");
      lines.forEach((line) => console.log(line));
    }
  } catch {
    console.log("[health] nginx error log not readable");
  }
}

function directorySize(directory) {
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sum + directorySize(entryPath);
    if (entry.isFile()) return sum + statSync(entryPath).size;
    return sum;
  }, 0);
}

function runCommand(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
