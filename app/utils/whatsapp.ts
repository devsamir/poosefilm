export function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export function buildWhatsAppUrl(input: { template: string; customerName: string; orderCode: string; whatsapp: string; publicBaseUrl: string }) {
  const normalized = normalizeWhatsappNumber(input.whatsapp);
  if (!normalized) return null;
  const link = `${input.publicBaseUrl.replace(/\/+$/, "")}/order/${encodeURIComponent(input.orderCode)}`;
  const message = input.template
    .replaceAll("{customerName}", input.customerName)
    .replaceAll("{orderCode}", input.orderCode)
    .replaceAll("{link}", link);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
