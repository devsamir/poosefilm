import { prisma } from "~/services/prisma.server";

export async function getPricePerPrint() {
  const setting = await prisma.appSetting.findUnique({ where: { id: 1 } });
  return setting?.pricePerPrint ?? 95000;
}

export async function updatePricePerPrint(value: number) {
  return prisma.appSetting.upsert({
    where: { id: 1 },
    update: { pricePerPrint: value },
    create: { id: 1, pricePerPrint: value },
  });
}
