import { getOrderByCode } from "~/services/orders.server";
import { prisma } from "~/services/prisma.server";
import { serializeOrderMedia } from "~/utils/media";

export function buildPublicFileDownloadPath(code: string, fileId: number) {
  return `/api/order/${code}/file/${fileId}/download`;
}

export function serializePublicOrder(order: { code: string; status: string; files: Array<{ id: number; originalName: string; contentType: string; mediaType: string; sizeBytes: bigint }> }) {
  return { code: order.code, status: order.status, files: serializeOrderMedia(order.code, order.files) };
}

export async function getPublicOrder(code: string) {
  const order = await getOrderByCode(code);
  return order ? serializePublicOrder(order) : null;
}

export async function listDeliveredOrders(query: string) {
  const search = query.trim();
  const orders = await prisma.order.findMany({ where: { status: "DELIVERED", ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { customerName: { contains: search, mode: "insensitive" } }, { whatsapp: { contains: search } }] } : {}) }, include: { _count: { select: { files: true } }, files: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" } });
  return orders.map((order) => ({ ...order, files: serializeOrderMedia(order.code, order.files) }));
}

function getDateRange(date: string) {
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) throw new Error("Tanggal tidak valid.");
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getDailySummary(date: string) {
  const { start, end } = getDateRange(date);
  const where = { createdAt: { gte: start, lt: end } };
  const [orders, delivered, waiting, totals] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, status: "DELIVERED" } }),
    prisma.order.count({ where: { ...where, status: { in: ["WAITING_UPLOAD", "READY"] } } }),
    prisma.order.aggregate({ where, _sum: { quantity: true, totalAmount: true } }),
  ]);
  return { date, totalOrders: orders, totalPrints: totals._sum.quantity || 0, revenue: Number(totals._sum.totalAmount || 0), delivered, waiting };
}
