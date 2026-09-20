import { isProductKind, type ProductKind } from "~/utils/product-kind";

export type OrderLine = { productId: number; quantity: number };

/** Appends the product with quantity 1, or adds 1 to its existing line. */
export function addOrderLine(lines: OrderLine[], productId: number): OrderLine[] {
  if (lines.some((line) => line.productId === productId)) {
    return lines.map((line) => (line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line));
  }
  return [...lines, { productId, quantity: 1 }];
}

/** Sets a line's quantity, floored and clamped to at least 1; a line is only removed with removeOrderLine. */
export function setOrderLineQuantity(lines: OrderLine[], productId: number, quantity: number): OrderLine[] {
  const next = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
  return lines.map((line) => (line.productId === productId ? { ...line, quantity: next } : line));
}

export function removeOrderLine(lines: OrderLine[], productId: number): OrderLine[] {
  return lines.filter((line) => line.productId !== productId);
}

type PickerProduct = { name: string; description: string | null; kind: ProductKind };

/** Filters products for the picker popup; an unknown kind means all kinds, and the input order is kept. */
export function filterPickerProducts<T extends PickerProduct>(products: T[], { q, kind }: { q: string; kind: string }): T[] {
  const search = q.trim().toLowerCase();
  return products.filter((product) => {
    if (isProductKind(kind) && product.kind !== kind) return false;
    if (!search) return true;
    return product.name.toLowerCase().includes(search) || (product.description ?? "").toLowerCase().includes(search);
  });
}
