import { spawn } from "node:child_process";

const children = [];

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env
  });

  child.on("exit", (code, signal) => {
    if (signal || code === 0) {
      return;
    }
    console.error(`${name} exited with code ${code}`);
    shutdown(code ?? 1);
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 100);
}

start("studio-server", process.execPath, ["./scripts/studio-server.mjs"]);
start("astro", process.execPath, ["./node_modules/astro/astro.js", "dev"]);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
