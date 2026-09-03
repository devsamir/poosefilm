import bcrypt from "bcryptjs";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, pricePerPrint: 95000 },
  });

  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@poosefilm.id" },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { name: existingAdmin.name || "Admin", role: "SUPERADMIN" },
    });
  } else {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!initialPassword) throw new Error("INITIAL_ADMIN_PASSWORD wajib diisi saat membuat admin pertama.");
    await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@poosefilm.id",
        passwordHash: await bcrypt.hash(initialPassword, 12),
        role: "SUPERADMIN",
        isActive: true,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
