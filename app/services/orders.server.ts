import { Prisma } from "@prisma/client";

import { prisma } from "~/services/prisma.server";
import { getPricePerPrint } from "~/services/settings.server";
import { buildOrderSnapshot } from "~/utils/order-invariants";
import { generatePublicOrderCode } from "~/utils/public-code";

export function validateOrderInput(input: { customerName: string; whatsapp: string; quantity: string }) {
  const customerName = input.customerName.trim();
  const whatsapp = input.whatsapp.trim();
  const quantity = Number(input.quantity);
  if (!customerName || !whatsapp || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Nama, nomor WhatsApp, dan jumlah cetak wajib valid.");
  }
  return { customerName, whatsapp, quantity };
}

export async function createOrder(input: { customerName: string; whatsapp: string; quantity: string }, createdById: number) {
  const details = validateOrderInput(input);
  const price = Number(await getPricePerPrint());
  const snapshot = buildOrderSnapshot({ quantity: details.quantity, unitPrice: price });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.order.create({
        data: {
          code: generatePublicOrderCode(),
          customerName: details.customerName,
          whatsapp: details.whatsapp,
          quantity: details.quantity,
          unitPrice: snapshot.unitPrice,
          totalAmount: snapshot.totalAmount,
          paymentMethod: snapshot.paymentMethod,
          paymentStatus: snapshot.paymentStatus,
          status: snapshot.status,
          createdById,
        },
        include: { files: true },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 4) throw error;
    }
  }
  throw new Error("Gagal membuat kode order unik.");
}

export async function getOrderByCode(code: string) {
  return prisma.order.findUnique({
    where: { code },
    include: { files: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function markOrderDelivered(id: number) {
  const order = await prisma.order.findUnique({ where: { id }, include: { _count: { select: { files: true } } } });
  if (!order) throw new Error("Order tidak ditemukan.");
  if (!order._count.files) throw new Error("Order belum memiliki file.");
  return prisma.order.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
}
