import { Prisma } from "@prisma/client";

import type { AuthUser } from "~/services/auth.server";
import { canAccessSuperadmin } from "~/services/auth.server";
import { getActiveFilterPackages } from "~/services/filter-packages.server";
import { canDeliverOrder } from "~/services/filter-render-jobs.server";
import { prisma } from "~/services/prisma.server";
import { listProducts } from "~/services/products.server";
import { deleteObjectIfPresent } from "~/services/r2.server";
import { buildOrderSnapshot } from "~/utils/order-invariants";
import { resolveOrderItems, validateOrderItems, type OrderItemInput } from "~/utils/order-items";
import { generatePublicOrderCode } from "~/utils/public-code";
import { normalizeWhatsappNumber } from "~/utils/whatsapp";

function validateContactInput(input: { customerName: string; whatsapp: string }) {
  const customerName = input.customerName.trim();
  const whatsapp = input.whatsapp.trim();
  if (!customerName) throw new Error("Nama wajib diisi.");
  if (!normalizeWhatsappNumber(whatsapp)) throw new Error("Nomor WhatsApp harus berisi angka yang valid.");
  return { customerName, whatsapp };
}

export function validateOrderInput(input: { customerName: string; whatsapp: string; items: OrderItemInput[] }) {
  const { customerName, whatsapp } = validateContactInput(input);
  return { customerName, whatsapp, items: validateOrderItems(input.items) };
}

export function parseOptionalFilterPackageId(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  const id = Number(normalized);
  if (!Number.isInteger(id) || id < 1) throw new Error("Paket filter tidak valid.");
  return id;
}

export async function createOrder(input: { customerName: string; whatsapp: string; items: OrderItemInput[]; isRealTransaction?: boolean; marketingConsent?: boolean; filterPackageId?: number }, createdById: number) {
  const details = validateOrderInput(input);
  const items = resolveOrderItems(details.items, await listProducts());
  const snapshot = buildOrderSnapshot({ items, isRealTransaction: input.isRealTransaction !== false });
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
          totalAmount: snapshot.totalAmount,
          isRealTransaction: snapshot.isRealTransaction,
          marketingConsent: input.marketingConsent === true,
          filterPackageId: selectedPackage?.id,
          paymentMethod: snapshot.paymentMethod,
          paymentStatus: snapshot.paymentStatus,
          status: snapshot.status,
          createdById,
          items: { create: items },
          ...(selectedPackage ? { filterSnapshots: { create: selectedPackage.snapshots.map((filter) => ({ filterTemplateId: filter.filterId, filterName: filter.filterName, filterCss: filter.css, sortOrder: filter.sortOrder })) } } : {}),
        },
        include: { files: true, filterSnapshots: true, items: { orderBy: { id: "asc" } } },
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
    include: { files: { include: { filterSnapshot: true, renderJob: { select: { status: true, lastError: true } } }, orderBy: { sortOrder: "asc" } }, filterSnapshots: { orderBy: { sortOrder: "asc" } }, filterPackage: true, items: { orderBy: { id: "asc" } } },
  });
}

export function serializeReceiptOrder(order: { code: string; createdAt: Date; customerName: string; whatsapp: string; isRealTransaction: boolean; totalAmount: Prisma.Decimal | number; items: Array<{ id: number; productName: string; quantity: number; unitPrice: Prisma.Decimal | number }> }) {
  return {
    code: order.code,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customerName,
    whatsapp: order.whatsapp,
    isRealTransaction: order.isRealTransaction,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({ id: item.id, productName: item.productName, quantity: item.quantity, unitPrice: Number(item.unitPrice) })),
  };
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
