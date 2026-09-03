export function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) throw new Error("Nomor WhatsApp tidak valid.");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export function buildWhatsAppUrl(input: { template: string; customerName: string; orderCode: string; whatsapp: string; publicBaseUrl: string }) {
  const link = `${input.publicBaseUrl.replace(/\/+$/, "")}/order/${encodeURIComponent(input.orderCode)}`;
  const message = input.template
    .replaceAll("{customerName}", input.customerName)
    .replaceAll("{orderCode}", input.orderCode)
    .replaceAll("{link}", link);
  return `https://wa.me/${normalizeWhatsappNumber(input.whatsapp)}?text=${encodeURIComponent(message)}`;
}
