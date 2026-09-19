export type OrderItemInput = { productId: number; quantity: number };
export type ProductSnapshotSource = { id: number; name: string; price: number; isActive: boolean };

const QUANTITY_FIELD_PREFIX = "qty_";

/** Reads `qty_<productId>` form fields, skipping blank and zero quantities. */
export function parseOrderItemFields(entries: Iterable<[string, FormDataEntryValue]>): OrderItemInput[] {
  const items: OrderItemInput[] = [];
  for (const [name, value] of entries) {
    if (!name.startsWith(QUANTITY_FIELD_PREFIX)) continue;
    const raw = String(value).trim();
    if (!raw || Number(raw) === 0) continue;
    items.push({ productId: Number(name.slice(QUANTITY_FIELD_PREFIX.length)), quantity: Number(raw) });
  }
  return items;
}

/** Requires at least one item, valid ids, positive integer quantities, and no repeated product. */
export function validateOrderItems(items: OrderItemInput[]) {
  if (!items.length) throw new Error("Pilih minimal satu product.");
  const seenProductIds = new Set<number>();
  for (const item of items) {
    if (!Number.isInteger(item.productId) || item.productId < 1) throw new Error("Product tidak valid.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error("Jumlah product wajib valid.");
    if (seenProductIds.has(item.productId)) throw new Error("Product tidak boleh duplikat.");
    seenProductIds.add(item.productId);
  }
  return items;
}

/** Copies the current name and price of each requested product so later edits never change the order. */
export function resolveOrderItems(items: OrderItemInput[], products: ProductSnapshotSource[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  return items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product || !product.isActive) throw new Error("Product tidak ditemukan atau sudah nonaktif.");
    return { productId: product.id, productName: product.name, unitPrice: product.price, quantity: item.quantity };
  });
}

export function calculateOrderTotal(items: { unitPrice: number; quantity: number }[], isRealTransaction = true) {
  if (!isRealTransaction) return 0;
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}
