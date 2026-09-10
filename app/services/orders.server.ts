import { Prisma } from "@prisma/client";

import type { AuthUser } from "~/services/auth.server";
import { canAccessSuperadmin } from "~/services/auth.server";
import { getActiveFilterPackages } from "~/services/filter-packages.server";
import { canDeliverOrder } from "~/services/filter-render-jobs.server";
import { prisma } from "~/services/prisma.server";
import { deleteObjectIfPresent } from "~/services/r2.server";
import { getPricePerPrint } from "~/services/settings.server";
import { buildOrderSnapshot } from "~/utils/order-invariants";
import { generatePublicOrderCode } from "~/utils/public-code";
import { normalizeWhatsappNumber } from "~/utils/whatsapp";

function validateContactInput(input: { customerName: string; whatsapp: string }) {
  const customerName = input.customerName.trim();
  const whatsapp = input.whatsapp.trim();
  if (!customerName) throw new Error("Nama wajib diisi.");
  if (!normalizeWhatsappNumber(whatsapp)) throw new Error("Nomor WhatsApp harus berisi angka yang valid.");
  return { customerName, whatsapp };
}

export function validateOrderInput(input: { customerName: string; whatsapp: string; quantity: string }) {
  const { customerName, whatsapp } = validateContactInput(input);
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Jumlah cetak wajib valid.");
  }
  return { customerName, whatsapp, quantity };
}

export function parseOptionalFilterPackageId(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  const id = Number(normalized);
  if (!Number.isInteger(id) || id < 1) throw new Error("Paket filter tidak valid.");
  return id;
}

export async function createOrder(input: { customerName: string; whatsapp: string; quantity: string; isRealTransaction?: boolean; filterPackageId?: number }, createdById: number) {
  const details = validateOrderInput(input);
  const price = Number(await getPricePerPrint());
  const snapshot = buildOrderSnapshot({ quantity: details.quantity, unitPrice: price, isRealTransaction: input.isRealTransaction !== false });
  const selectedPackage = input.filterPackageId
    ? (await getActiveFilterPackages()).find((filterPackage) => filterPackage.id === input.filterPackageId)
    : undefined;
  if (input.filterPackageId && !selectedPackage) throw new Error("Paket filter tidak ditemukan atau sudah nonaktif.");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => transaction.order.create({
        data: {
          code: generatePublicOrderCode(),
          customerName: details.customerName,
          whatsapp: details.whatsapp,
          quantity: details.quantity,
          unitPrice: snapshot.unitPrice,
          totalAmount: snapshot.totalAmount,
          isRealTransaction: snapshot.isRealTransaction,
          filterPackageId: selectedPackage?.id,
          paymentMethod: snapshot.paymentMethod,
          paymentStatus: snapshot.paymentStatus,
          status: snapshot.status,
          createdById,
          ...(selectedPackage ? { filterSnapshots: { create: selectedPackage.snapshots.map((filter) => ({ filterTemplateId: filter.filterId, filterName: filter.filterName, filterCss: filter.css, sortOrder: filter.sortOrder })) } } : {}),
        },
        include: { files: true, filterSnapshots: true },
      }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 4) throw error;
    }
  }
  throw new Error("Gagal membuat kode order unik.");
}

export async function getOrderByCode(code: string) {
  return prisma.order.findUnique({
    where: { code },
    include: { files: { include: { filterSnapshot: true, renderJob: { select: { status: true, lastError: true } } }, orderBy: { sortOrder: "asc" } }, filterSnapshots: { orderBy: { sortOrder: "asc" } }, filterPackage: true },
  });
}

export async function markOrderDelivered(id: number) {
  const order = await prisma.order.findUnique({ where: { id }, include: { _count: { select: { files: true } } } });
  if (!order) throw new Error("Order tidak ditemukan.");
  if (!order._count.files) throw new Error("Order belum memiliki file.");
  if (!(await canDeliverOrder(id))) throw new Error("Filter masih diproses atau gagal. Tunggu sampai selesai sebelum menandai order.");
  return prisma.order.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
}

export async function updateOrderContact(id: number, input: { customerName: string; whatsapp: string }) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error("Order tidak ditemukan.");
  const details = validateContactInput(input);
  return prisma.order.update({ where: { id }, data: { customerName: details.customerName, whatsapp: details.whatsapp } });
}

export async function deleteDeliveredOrder(id: number, user: AuthUser) {
  if (!canAccessSuperadmin(user)) throw new Error("Hanya superadmin yang dapat menghapus riwayat.");
  const order = await prisma.order.findUnique({ where: { id }, include: { files: true } });
  if (!order) throw new Error("Order tidak ditemukan.");
  if (order.status !== "DELIVERED") throw new Error("Hanya order selesai yang dapat dihapus dari riwayat.");

  await prisma.order.delete({ where: { id: order.id } });
  for (const file of order.files) await deleteObjectIfPresent(file.storageKey);
  return { deletedOrderId: order.id, deletedFileCount: order.files.length };
}
