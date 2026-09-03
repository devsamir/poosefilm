import { describe, expect, it } from 'vitest';

import { generatePublicOrderCode } from '~/utils/public-code';
import { validateOrderInput } from '~/services/orders.server';

describe('order creation', () => {
  it('generates a human-readable random public code', () => {
    const code = generatePublicOrderCode(
      new Date('2026-09-03T10:00:00Z'),
      new Uint8Array([1, 2, 3, 4])
    );
    expect(code).toMatch(/^PB260903-[A-F0-9]{8}$/);
  });

  it('validates customer details and quantity', () => {
    expect(
      validateOrderInput({
        customerName: ' Husein ',
        whatsapp: '081234',
        quantity: '2',
      })
    ).toEqual({
      customerName: 'Husein',
      whatsapp: '081234',
      quantity: 2,
    });
    expect(() =>
      validateOrderInput({
        customerName: '',
        whatsapp: '081234',
        quantity: '1',
      })
    ).toThrow();
    expect(() =>
      validateOrderInput({
        customerName: 'Husein',
        whatsapp: '081234',
        quantity: '0',
      })
    ).toThrow();
  });
});
