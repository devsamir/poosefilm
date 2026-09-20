import { prisma } from "~/services/prisma.server";

export const DEFAULT_WHATSAPP_TEMPLATE = "Halo {customerName}, hasil foto/video kamu sudah siap. Silakan download melalui link berikut: {link}. Terima kasih sudah menggunakan Poosefilm.";
const WHATSAPP_PLACEHOLDERS = new Set(["customerName", "orderCode", "link"]);

export function validateWhatsappTemplate(template: string) {
  const value = template.trim();
  if (!value) throw new Error("Template WhatsApp wajib diisi.");
  if (!value.includes("{link}")) throw new Error("Template WhatsApp wajib memiliki placeholder {link}.");
  const placeholders = [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]);
  const unknownPlaceholder = placeholders.find((placeholder) => !WHATSAPP_PLACEHOLDERS.has(placeholder));
  if (unknownPlaceholder) throw new Error(`Placeholder WhatsApp tidak dikenal: {${unknownPlaceholder}}.`);
  return value;
}

export async function getWhatsappTemplate() {
  const setting = await prisma.appSetting.findUnique({ where: { id: 1 } });
  return setting?.whatsappTemplate ?? DEFAULT_WHATSAPP_TEMPLATE;
}

export async function updateWhatsappTemplate(value: string) {
  return prisma.appSetting.upsert({
    where: { id: 1 },
    update: { whatsappTemplate: value },
    create: { id: 1, whatsappTemplate: value },
  });
}
