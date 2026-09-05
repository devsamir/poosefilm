import { hostname } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { claimNextRenderJob, processFilterRenderJob } from "~/services/filter-render-jobs.server";

const pollIntervalMs = Number(process.env.FILTER_WORKER_POLL_MS || 2_000);
const workerId = `${hostname()}-${process.pid}`;
let stopping = false;

process.once("SIGTERM", () => { stopping = true; });
process.once("SIGINT", () => { stopping = true; });

console.info(`Filter render worker started: ${workerId}`);

function waitForNextPoll() {
  return new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

export async function runFilterRenderWorker() {
  while (!stopping) {
    const job = await claimNextRenderJob(workerId);
    if (!job) {
      await waitForNextPoll();
      continue;
    }
    try {
      console.info(`Filter render job claimed: ${job.id}`);
      const result = await processFilterRenderJob(job.id);
      console.info(`Filter render job completed: ${job.id} (${result.createdFileCount} variants)`);
    } catch (error) {
      console.error(`Filter render job failed: ${job.id}`, error);
    }
  }
  console.info(`Filter render worker stopping: ${workerId}`);
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  void runFilterRenderWorker().catch((error) => {
    console.error("Filter render worker berhenti:", error);
    process.exitCode = 1;
  });
}
