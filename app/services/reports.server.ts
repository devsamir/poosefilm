import { Prisma } from "@prisma/client";

import { getOrderByCode } from "~/services/orders.server";
import { sanitizeFilename } from "~/services/order-files.server";
import { prisma } from "~/services/prisma.server";
import { serializeOrderMedia } from "~/utils/media";

export function buildPublicFileDownloadPath(code: string, fileId: number) {
  return `/api/order/${code}/file/${fileId}/download`;
}

export function serializePublicOrder(order: { code: string; status: string; files: Array<{ id: number; originalName: string; contentType: string; mediaType: string; sizeBytes: bigint; variantKind?: string; filterSnapshot?: { filterName: string } | null; renderJob?: { status: string } | null }> }) {
  return { code: order.code, status: order.status, files: order.status === "PROCESSING_FILTER" ? [] : serializeOrderMedia(order.code, order.files) };
}

export async function getPublicOrder(code: string) {
  const order = await getOrderByCode(code);
  return order ? serializePublicOrder(order) : null;
}

export function getHistoryPagination(requestedPage: number, pageSize: number, totalCount = 0) {
  const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 12;
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedPageSize));
  const normalizedRequestedPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const page = Math.min(normalizedRequestedPage, totalPages);
  return { page, pageSize: normalizedPageSize, totalPages, skip: (page - 1) * normalizedPageSize };
}

export function buildDeliveredOrdersWhere(search: string, dateRange?: { start: Date; end: Date }, consentOnly?: boolean) {
  return {
    status: "DELIVERED" as const,
    ...(dateRange ? { createdAt: { gte: dateRange.start, lt: dateRange.end } } : {}),
    ...(consentOnly ? { marketingConsent: true } : {}),
    ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" as const } }, { customerName: { contains: search, mode: "insensitive" as const } }, { whatsapp: { contains: search } }] } : {}),
  };
}

export async function listDeliveredOrders(query: string, requestedPage = 1, pageSize = 12, consentOnly = false) {
  const where = buildDeliveredOrdersWhere(query.trim(), undefined, consentOnly);
  const total = await prisma.order.count({ where });
  const pagination = getHistoryPagination(requestedPage, pageSize, total);
  const orders = await prisma.order.findMany({ where, include: { _count: { select: { files: true } }, files: { include: { filterSnapshot: true, renderJob: { select: { status: true, lastError: true } } }, orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.pageSize });
  return { orders: orders.map((order) => ({ ...order, files: serializeOrderMedia(order.code, order.files) })), total, pagination };
}

export async function listDeliveredOrdersInRange(start: Date, end: Date, query: string) {
  const where = buildDeliveredOrdersWhere(query.trim(), { start, end });
  return prisma.order.findMany({
    where,
    select: { code: true, customerName: true, files: { select: { id: true, originalName: true, storageKey: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

const HISTORY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseHistoryDateRange(from: string, to: string) {
  if (!HISTORY_DATE_PATTERN.test(from) || !HISTORY_DATE_PATTERN.test(to)) throw new Error("Rentang tanggal tidak valid.");
  const start = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(toDate.getTime()) || start.getTime() > toDate.getTime()) throw new Error("Rentang tanggal tidak valid.");
  if (toDateOnlyString(start) !== from || toDateOnlyString(toDate) !== to) throw new Error("Rentang tanggal tidak valid.");
  const end = new Date(toDate);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function buildHistoryZipFilename(from: string, to: string) {
  return `riwayat_${from}_${to}.zip`;
}

export function buildHistoryZipEntryName(orderCode: string, customerName: string, fileId: number, originalName: string) {
  return `${orderCode}_${sanitizeFilename(customerName)}/${fileId}-${sanitizeFilename(originalName)}`;
}

export async function listSummaryFilterOptions() {
  const select = { id: true, name: true };
  const orderBy = { name: "asc" } as const;
  const [products, filterPackages] = await Promise.all([
    prisma.product.findMany({ select, orderBy }),
    prisma.filterPackage.findMany({ select, orderBy }),
  ]);
  return { products, filterPackages };
}

type OrderSummaryFilters = {
  range: { start: Date; end: Date };
  productId?: number;
  filterPackageId?: number | null;
};

export async function getOrderSummary({ range, productId, filterPackageId }: OrderSummaryFilters) {
  const orderScope = {
    createdAt: { gte: range.start, lt: range.end },
    ...(filterPackageId !== undefined ? { filterPackageId } : {}),
  };
  const itemOrder = { ...orderScope, isRealTransaction: true };

  return prisma.$transaction(async (transaction) => {
    const orderGroups = await transaction.order.groupBy({
      by: ["isRealTransaction", "status"],
      where: { ...orderScope, ...(productId !== undefined ? { items: { some: { productId } } } : {}) },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const summary = { totalOrders: 0, realOrders: 0, freeOrders: 0, delivered: 0, waiting: 0 };
    let orderRevenue = new Prisma.Decimal(0);

    for (const group of orderGroups) {
      const count = group._count._all;
      summary.totalOrders += count;
      if (group.isRealTransaction) {
        summary.realOrders += count;
        orderRevenue = orderRevenue.plus(group._sum.totalAmount ?? 0);
      } else {
        summary.freeOrders += count;
      }
      if (group.status === "DELIVERED") summary.delivered += count;
      if (group.status === "WAITING_UPLOAD" || group.status === "PROCESSING_FILTER" || group.status === "READY") {
        summary.waiting += count;
      }
    }

    if (productId === undefined) {
      const prints = await transaction.orderItem.aggregate({
        where: { productKind: "PRINT", order: itemOrder },
        _sum: { quantity: true },
      });
      return { ...summary, totalPrints: prints._sum.quantity ?? 0, revenue: orderRevenue.toNumber() };
    }

    const itemGroups = await transaction.orderItem.groupBy({
      by: ["productKind", "unitPrice"],
      where: { productId, order: itemOrder },
      _sum: { quantity: true },
    });
    let totalPrints = 0;
    let productRevenue = new Prisma.Decimal(0);
    for (const group of itemGroups) {
      const quantity = group._sum.quantity ?? 0;
      if (group.productKind === "PRINT") totalPrints += quantity;
      productRevenue = productRevenue.plus(group.unitPrice.times(quantity));
    }
    return { ...summary, totalPrints, revenue: productRevenue.toNumber() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
