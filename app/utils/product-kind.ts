export const PRODUCT_KINDS = ["PRINT", "MERCH"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = { PRINT: "Cetak", MERCH: "Merch" };

export const PRODUCT_KIND_PILL_CLASSES: Record<ProductKind, string> = {
  PRINT: "bg-[#f1ede6] text-[#62594f]",
  MERCH: "bg-sky-50 text-sky-700",
};

export function isProductKind(value: unknown): value is ProductKind {
  return PRODUCT_KINDS.includes(value as ProductKind);
}
