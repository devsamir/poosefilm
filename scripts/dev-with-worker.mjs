import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const spawnOptions = { stdio: "inherit", shell: process.platform === "win32" };
const webProcess = spawn(npmCommand, ["run", "dev:web", "--", ...process.argv.slice(2)], spawnOptions);
const workerProcess = spawn(npmCommand, ["run", "worker"], spawnOptions);
let shuttingDown = false;

function stopProcesses(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  webProcess.kill("SIGTERM");
  workerProcess.kill("SIGTERM");
  process.exitCode = exitCode;
}

process.once("SIGINT", () => stopProcesses());
process.once("SIGTERM", () => stopProcesses());

webProcess.once("exit", (code) => {
  if (!shuttingDown) stopProcesses(code || 0);
});

workerProcess.once("exit", (code) => {
  if (!shuttingDown) {
    console.error(`Filter worker berhenti saat development (exit code ${code ?? "unknown"}).`);
    stopProcesses(code || 1);
  }
});
