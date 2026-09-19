import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { generatePublicOrderCode } from '~/utils/public-code';
import { parseOptionalFilterPackageId, serializeReceiptOrder, validateOrderInput } from '~/services/orders.server';

describe('order creation', () => {
  it('generates a human-readable random public code', () => {
    const code = generatePublicOrderCode(
      new Date('2026-09-03T10:00:00Z'),
      new Uint8Array([1, 2, 3, 4])
    );
    expect(code).toMatch(/^PB260903-[A-F0-9]{8}$/);
  });

  it('validates customer details and items', () => {
    expect(
      validateOrderInput({
        customerName: ' Husein ',
        whatsapp: '081234',
        items: [{ productId: 1, quantity: 2 }],
      })
    ).toEqual({
      customerName: 'Husein',
      whatsapp: '081234',
      items: [{ productId: 1, quantity: 2 }],
    });
    expect(() =>
      validateOrderInput({ customerName: '', whatsapp: '081234', items: [{ productId: 1, quantity: 1 }] })
    ).toThrow();
    expect(() =>
      validateOrderInput({ customerName: 'Husein', whatsapp: '081234', items: [] })
    ).toThrow('Pilih minimal satu product.');
  });

  it('rejects a WhatsApp number with no digits', () => {
    expect(() =>
      validateOrderInput({ customerName: 'Husein', whatsapp: '-', items: [{ productId: 1, quantity: 1 }] })
    ).toThrow();
  });

  it('serializes an order with its item lines for the receipt', () => {
    expect(
      serializeReceiptOrder({
        code: 'PB260919-AAAA1111',
        createdAt: new Date('2026-09-19T03:00:00Z'),
        customerName: 'Husein',
        whatsapp: '081234',
        isRealTransaction: true,
        totalAmount: 385000,
        items: [
          { id: 1, productName: 'Cabinet', quantity: 3, unitPrice: 95000 },
          { id: 2, productName: 'Strip 2 pose', quantity: 2, unitPrice: 50000 },
        ],
      })
    ).toEqual({
      code: 'PB260919-AAAA1111',
      createdAt: '2026-09-19T03:00:00.000Z',
      customerName: 'Husein',
      whatsapp: '081234',
      isRealTransaction: true,
      totalAmount: 385000,
      items: [
        { id: 1, productName: 'Cabinet', quantity: 3, unitPrice: 95000 },
        { id: 2, productName: 'Strip 2 pose', quantity: 2, unitPrice: 50000 },
      ],
    });
  });

  it('converts Decimal amounts to plain numbers for the receipt', () => {
    const serialized = serializeReceiptOrder({
      code: 'PB260919-BBBB2222',
      createdAt: new Date('2026-09-19T03:00:00Z'),
      customerName: 'Husein',
      whatsapp: '081234',
      isRealTransaction: true,
      totalAmount: new Prisma.Decimal('95000.00'),
      items: [{ id: 1, productName: 'Cabinet', quantity: 1, unitPrice: new Prisma.Decimal('95000.00') }],
    });
    expect(serialized.totalAmount).toBe(95000);
    expect(serialized.items[0].unitPrice).toBe(95000);
  });

  it('normalizes an optional filter package selection from form data', () => {
    expect(parseOptionalFilterPackageId(undefined)).toBeUndefined();
    expect(parseOptionalFilterPackageId('')).toBeUndefined();
    expect(parseOptionalFilterPackageId('12')).toBe(12);
    expect(() => parseOptionalFilterPackageId('not-a-package')).toThrow();
  });
});
