export type OrderSnapshotInput = {
  quantity: number;
  unitPrice: number;
  isRealTransaction?: boolean;
};

export function buildOrderSnapshot({ quantity, unitPrice, isRealTransaction = true }: OrderSnapshotInput) {
  return {
    unitPrice,
    totalAmount: isRealTransaction ? quantity * unitPrice : 0,
    isRealTransaction,
    paymentMethod: "CASH" as const,
    paymentStatus: "PAID" as const,
    status: "WAITING_UPLOAD" as const,
  };
}
