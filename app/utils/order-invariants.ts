import { calculateOrderTotal } from "~/utils/order-items";

export type OrderSnapshotInput = {
  items: { unitPrice: number; quantity: number }[];
  isRealTransaction?: boolean;
};

export function buildOrderSnapshot({ items, isRealTransaction = true }: OrderSnapshotInput) {
  return {
    totalAmount: calculateOrderTotal(items, isRealTransaction),
    isRealTransaction,
    paymentMethod: "CASH" as const,
    paymentStatus: "PAID" as const,
    status: "WAITING_UPLOAD" as const,
  };
}
