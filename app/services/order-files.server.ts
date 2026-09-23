import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

import type { AuthUser } from "~/services/auth.server";
import { getOrderByCode } from "~/services/orders.server";
import { enqueueImageRenderJob, refreshOrderFilterStatus } from "~/services/filter-render-jobs.server";
import { prisma } from "~/services/prisma.server";
import { assertObjectExists, createPresignedPutUrl, deleteObjectIfPresent, getObjectBuffer, putObject } from "~/services/r2.server";
import { serializeOrderMedia } from "~/utils/media";
import { buildFfmpegArguments, toMp4FileName } from "~/utils/video-transcode";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const imageLimit = Number(process.env.MAX_IMAGE_BYTES || 25 * 1024 * 1024);
const videoLimit = Number(process.env.MAX_VIDEO_BYTES || 500 * 1024 * 1024);
const execFileAsync = promisify(execFile);

export function sanitizeFilename(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file";
}

export function buildOrderStorageKey(orderCode: string, originalName: string, id: string = randomUUID()) {
  const safeCode = orderCode.replace(/[^a-zA-Z0-9_-]/g, "");
  return `orders/${safeCode}/${id}-${sanitizeFilename(originalName)}`;
}

export function validateMediaInput(input: { originalName: string; contentType: string; sizeBytes: number }) {
  if (!input.originalName.trim() || !Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) throw new Error("Metadata file tidak valid.");
  if (IMAGE_TYPES.has(input.contentType)) {
    if (input.sizeBytes > imageLimit) throw new Error("Ukuran gambar maksimal 25 MB.");
    return { mediaType: "IMAGE" as const };
  }
  if (VIDEO_TYPES.has(input.contentType)) {
    if (input.sizeBytes > videoLimit) throw new Error("Ukuran video maksimal 500 MB.");
    return { mediaType: "VIDEO" as const };
  }
  throw new Error("Format file tidak didukung.");
}

function assertStaff(user: AuthUser) {
  if (!user.isActive) throw new Error("User tidak aktif.");
}

export function getOrderStatusAfterFileDeletion(status: "WAITING_UPLOAD" | "PROCESSING_FILTER" | "READY" | "DELIVERED", remainingFileCount: number) {
  return (status === "READY" || status === "PROCESSING_FILTER") && remainingFileCount === 0 ? "WAITING_UPLOAD" : status;
}

export async function createPresignedUpload(input: { orderCode: string; originalName: string; contentType: string; sizeBytes: number }, user: AuthUser) {
  assertStaff(user);
  const order = await getOrderByCode(input.orderCode);
  if (!order) throw new Error("Order tidak ditemukan.");
  const media = validateMediaInput(input);
  const key = buildOrderStorageKey(order.code, input.originalName);
  const signed = await createPresignedPutUrl({ key, contentType: input.contentType });
  return { ...signed, key, mediaType: media.mediaType };
}

function isMissingFfmpegError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT");
}

async function transcodeWebmToMp4(input: { orderId: number; orderCode: string; sourceKey: string; originalName: string; sortOrder: number; orderStatus: "WAITING_UPLOAD" | "PROCESSING_FILTER" | "READY" | "DELIVERED" }) {
  const temporaryDirectory = await mkdtemp(`${tmpdir()}/poosefilm-video-`);
  const inputPath = `${temporaryDirectory}/input.webm`;
  const outputPath = `${temporaryDirectory}/output.mp4`;
  const outputKey = buildOrderStorageKey(input.orderCode, toMp4FileName(input.originalName));

  try {
    await writeFile(inputPath, await getObjectBuffer(input.sourceKey));
    try {
      await execFileAsync(process.env.FFMPEG_PATH || "ffmpeg", buildFfmpegArguments(inputPath, outputPath), { maxBuffer: 10 * 1024 * 1024, windowsHide: true });
    } catch (error) {
      if (isMissingFfmpegError(error)) throw new Error("FFmpeg belum terpasang atau tidak ada di PATH server.");
      throw new Error("Video gagal dikonversi ke MP4.");
    }

    const outputBody = await readFile(outputPath);
    await putObject({ key: outputKey, body: outputBody, contentType: "video/mp4" });
    try {
        const file = await prisma.$transaction(async (transaction) => {
          const finalFile = await transaction.orderFile.create({ data: { orderId: input.orderId, originalName: toMp4FileName(input.originalName), storageKey: outputKey, contentType: "video/mp4", mediaType: "VIDEO", sizeBytes: BigInt(outputBody.byteLength), sortOrder: input.sortOrder } });
          if (input.orderStatus === "WAITING_UPLOAD") await transaction.order.update({ where: { id: input.orderId }, data: { status: "READY" } });
          return finalFile;
        });
      try {
        await deleteObjectIfPresent(input.sourceKey);
      } catch (error) {
        console.error("Gagal membersihkan video WebM sementara dari R2:", error);
      }
      return file;
    } catch (error) {
      await deleteObjectIfPresent(outputKey);
      throw error;
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function completeOrderFile(input: { orderCode: string; key: string; originalName: string; contentType: string; sizeBytes: number }, user: AuthUser) {
  assertStaff(user);
  const order = await getOrderByCode(input.orderCode);
  if (!order) throw new Error("Order tidak ditemukan.");
  if (!input.key.startsWith(`orders/${order.code}/`)) throw new Error("Storage key tidak sesuai order.");
  const media = validateMediaInput(input);
  await assertObjectExists(input.key);
  if (input.contentType === "video/webm") return transcodeWebmToMp4({ orderId: order.id, orderCode: order.code, sourceKey: input.key, originalName: input.originalName, sortOrder: order.files.length, orderStatus: order.status });
  const file = await prisma.orderFile.create({ data: { orderId: order.id, originalName: input.originalName.trim(), storageKey: input.key, contentType: input.contentType, mediaType: media.mediaType, sizeBytes: BigInt(input.sizeBytes), sortOrder: order.files.length } });
  if (media.mediaType === "IMAGE" && order.filterSnapshots.length) {
    await enqueueImageRenderJob(file.id);
  } else if (order.status === "WAITING_UPLOAD") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "READY" } });
  }
  return file;
}

export async function deleteOrderFile(orderCode: string, fileId: number, user: AuthUser) {
  assertStaff(user);
  const file = await prisma.orderFile.findFirst({ where: { id: fileId, order: { code: orderCode } }, include: { order: { select: { status: true } }, variants: { select: { storageKey: true } } } });
  if (!file) throw new Error("File tidak ditemukan.");
  if (file.variantKind === "FILTERED") throw new Error("Hasil filter otomatis dihapus bersama file original.");
  await prisma.$transaction(async (transaction) => {
    await transaction.orderFile.delete({ where: { id: file.id } });
    const remainingFileCount = await transaction.orderFile.count({ where: { orderId: file.orderId } });
    const nextStatus = getOrderStatusAfterFileDeletion(file.order.status, remainingFileCount);
    if (nextStatus !== file.order.status) await transaction.order.update({ where: { id: file.orderId }, data: { status: nextStatus } });
  });
  await refreshOrderFilterStatus(file.orderId);
  for (const storageKey of [file.storageKey, ...file.variants.map((variant) => variant.storageKey)]) await deleteObjectIfPresent(storageKey);
}

export async function listWaitingOrders(query: string) {
  const search = query.trim();
  const orders = await prisma.order.findMany({ where: { status: { in: ["WAITING_UPLOAD", "PROCESSING_FILTER", "READY"] }, ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { customerName: { contains: search, mode: "insensitive" } }, { whatsapp: { contains: search } }] } : {}) }, include: { _count: { select: { files: true } }, files: { include: { filterSnapshot: true, renderJob: { select: { status: true, lastError: true } } }, orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "asc" } });
  return orders.map((order) => ({ ...order, filterProcessing: order.files.some((file) => file.renderJob && file.renderJob.status !== "COMPLETED"), filterFailed: order.files.some((file) => file.renderJob?.status === "FAILED"), files: serializeOrderMedia(order.code, order.files) }));
}

export async function markOrderReadyIfFilesExist(orderId: number) {
  const fileCount = await prisma.orderFile.count({ where: { orderId } });
  if (!fileCount) throw new Error("Order belum memiliki file.");
  return prisma.order.update({ where: { id: orderId }, data: { status: "READY" } });
}
