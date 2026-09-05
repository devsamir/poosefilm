import { prisma } from "~/services/prisma.server";
import { getObjectBuffer, putObject } from "~/services/r2.server";
import { buildDerivedFilterStorageKey, getRetryDelayMs, shouldRenderFilters } from "~/utils/filter-jobs";
import { renderFilteredImage } from "~/services/filter-processor.server";

const leaseDurationMs = 10 * 60 * 1000;
const maxAttempts = Number(process.env.FILTER_RENDER_MAX_ATTEMPTS || 5);

export async function enqueueImageRenderJob(sourceFileId: number) {
  return prisma.$transaction(async (transaction) => {
    const sourceFile = await transaction.orderFile.findUnique({ where: { id: sourceFileId }, include: { order: { select: { id: true, code: true, status: true, filterSnapshots: { orderBy: { sortOrder: "asc" } } } } } });
    if (!sourceFile || !shouldRenderFilters(sourceFile.mediaType, sourceFile.order.filterSnapshots.length)) return null;
    const existingJob = await transaction.filterRenderJob.findUnique({ where: { sourceFileId } });
    if (existingJob) return existingJob;
    const job = await transaction.filterRenderJob.create({ data: { sourceFileId } });
    if (sourceFile.order.status !== "PROCESSING_FILTER") await transaction.order.update({ where: { id: sourceFile.order.id }, data: { status: "PROCESSING_FILTER" } });
    return job;
  });
}

export async function claimNextRenderJob(workerId: string) {
  const staleAt = new Date(Date.now() - leaseDurationMs);
  await prisma.filterRenderJob.updateMany({ where: { status: "PROCESSING", lockedAt: { lt: staleAt } }, data: { status: "PENDING", lockedAt: null, lockedBy: null, availableAt: new Date() } });
  const candidate = await prisma.filterRenderJob.findFirst({ where: { status: "PENDING", availableAt: { lte: new Date() } }, orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }] });
  if (!candidate) return null;
  const claimed = await prisma.filterRenderJob.updateMany({ where: { id: candidate.id, status: "PENDING" }, data: { status: "PROCESSING", lockedAt: new Date(), lockedBy: workerId, attemptCount: { increment: 1 } } });
  if (!claimed.count) return null;
  return prisma.filterRenderJob.findUnique({ where: { id: candidate.id } });
}

async function markJobFailed(jobId: number, error: unknown) {
  const job = await prisma.filterRenderJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const message = error instanceof Error ? error.message : "Filter gagal diproses.";
  const exhausted = job.attemptCount >= maxAttempts;
  await prisma.filterRenderJob.update({ where: { id: jobId }, data: { status: exhausted ? "FAILED" : "PENDING", availableAt: exhausted ? job.availableAt : new Date(Date.now() + getRetryDelayMs(job.attemptCount)), lockedAt: null, lockedBy: null, lastError: message } });
}

async function markJobCompleted(jobId: number, orderId: number) {
  await prisma.filterRenderJob.update({ where: { id: jobId }, data: { status: "COMPLETED", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null } });
  await refreshOrderFilterStatus(orderId);
}

export async function processFilterRenderJob(jobId: number) {
  const job = await prisma.filterRenderJob.findUnique({ where: { id: jobId }, include: { sourceFile: { include: { order: { select: { id: true, code: true }, } } } } });
  if (!job) throw new Error("Render job tidak ditemukan.");
  const snapshots = await prisma.orderFilterSnapshot.findMany({ where: { orderId: job.sourceFile.order.id }, orderBy: { sortOrder: "asc" } });
  try {
    const sourceBuffer = await getObjectBuffer(job.sourceFile.storageKey);
    const sourceName = job.sourceFile.originalName.replace(/\.[^.]+$/, "");
    for (const snapshot of snapshots) {
      const body = await renderFilteredImage({ sourceBuffer, filterCss: snapshot.filterCss });
      const storageKey = buildDerivedFilterStorageKey(job.sourceFile.order.code, job.sourceFile.id, snapshot.id);
      await putObject({ key: storageKey, body, contentType: "image/jpeg" });
      await prisma.orderFile.upsert({
        where: { sourceFileId_filterSnapshotId: { sourceFileId: job.sourceFile.id, filterSnapshotId: snapshot.id } },
        create: { orderId: job.sourceFile.order.id, originalName: `${sourceName} - ${snapshot.filterName}.jpg`, storageKey, contentType: "image/jpeg", mediaType: "IMAGE", variantKind: "FILTERED", sourceFileId: job.sourceFile.id, filterSnapshotId: snapshot.id, sizeBytes: BigInt(body.byteLength), sortOrder: job.sourceFile.sortOrder * 100 + snapshot.sortOrder + 1 },
        update: { originalName: `${sourceName} - ${snapshot.filterName}.jpg`, storageKey, sizeBytes: BigInt(body.byteLength) },
      });
    }
    await markJobCompleted(job.id, job.sourceFile.order.id);
    return { jobId: job.id, createdFileCount: snapshots.length };
  } catch (error) {
    await markJobFailed(job.id, error);
    throw error;
  }
}

export async function refreshOrderFilterStatus(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { files: { include: { renderJob: { select: { status: true } } } } } });
  if (!order || !order.files.length) return order;
  const isReady = order.files.every((file) => !file.renderJob || file.renderJob.status === "COMPLETED");
  if (isReady && order.status === "PROCESSING_FILTER") return prisma.order.update({ where: { id: orderId }, data: { status: "READY" } });
  return order;
}

export async function getOrderProcessingState(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { files: { select: { renderJob: { select: { status: true, lastError: true } } } } } });
  if (!order) return null;
  const jobs = order.files.map((file) => file.renderJob).filter((job): job is NonNullable<typeof job> => Boolean(job));
  return { total: jobs.length, completed: jobs.filter((job) => job.status === "COMPLETED").length, failed: jobs.filter((job) => job.status === "FAILED").length, processing: jobs.filter((job) => job.status === "PROCESSING" || job.status === "PENDING").length, lastError: jobs.find((job) => job.lastError)?.lastError || null };
}

export async function canDeliverOrder(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { files: { select: { renderJob: { select: { status: true } } } } } });
  return Boolean(order?.files.length && order.files.every((file) => !file.renderJob || file.renderJob.status === "COMPLETED"));
}

export async function retryFilterRenderJobs(orderId: number) {
  const jobs = await prisma.filterRenderJob.findMany({ where: { sourceFile: { orderId }, status: "FAILED" }, select: { id: true } });
  if (!jobs.length) throw new Error("Tidak ada filter gagal yang perlu diulang.");
  await prisma.filterRenderJob.updateMany({ where: { id: { in: jobs.map((job) => job.id) } }, data: { status: "PENDING", attemptCount: 0, availableAt: new Date(), lastError: null, lockedAt: null, lockedBy: null } });
  await prisma.order.update({ where: { id: orderId }, data: { status: "PROCESSING_FILTER" } });
  return { retriedJobCount: jobs.length };
}
