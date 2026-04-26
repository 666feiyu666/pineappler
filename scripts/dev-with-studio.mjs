import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";

const children = new Map();
const watchers = [];
let shuttingDown = false;
let restartTimer = null;

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env
  });

  children.set(name, { command, args, child });

  child.on("exit", (code, signal) => {
    const current = children.get(name);
    if (!current || current.child !== child) {
      return;
    }

    if (signal === "SIGTERM" || shuttingDown) {
      children.delete(name);
      return;
    }

    if (code === 0) {
      children.delete(name);
      return;
    }

    console.error(`${name} exited with code ${code}`);
    shutdown(code ?? 1);
  });

  return child;
}

function stop(name) {
  const entry = children.get(name);
  if (!entry || entry.child.killed) {
    return;
  }
  entry.child.kill("SIGTERM");
}

function restart(name) {
  const entry = children.get(name);
  if (!entry) {
    return;
  }
  stop(name);
  start(name, entry.command, entry.args);
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const watcher of watchers) {
    watcher.close();
  }

  for (const { child } of children.values()) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(code), 100);
}

function scheduleStudioRestart(filePath) {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log(`Restarting studio-server after change in ${filePath}`);
    restart("studio-server");
  }, 120);
}

function watchStudioBackend() {
  const scriptsDir = path.join(process.cwd(), "scripts");
  const watcher = watch(scriptsDir, { recursive: true }, (_eventType, fileName) => {
    if (!fileName || !fileName.endsWith(".mjs")) {
      return;
    }
    scheduleStudioRestart(path.join("scripts", fileName));
  });
  watchers.push(watcher);
}

start("studio-server", process.execPath, ["./scripts/studio-server.mjs"]);
start("astro", process.execPath, ["./node_modules/astro/astro.js", "dev"]);
watchStudioBackend();

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
