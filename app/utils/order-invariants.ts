export type OrderSnapshotInput = {
  quantity: number;
  unitPrice: number;
};

export function buildOrderSnapshot({ quantity, unitPrice }: OrderSnapshotInput) {
  return {
    unitPrice,
    totalAmount: quantity * unitPrice,
    paymentMethod: "CASH" as const,
    paymentStatus: "PAID" as const,
    status: "WAITING_UPLOAD" as const,
  };
}
