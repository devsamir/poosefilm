import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from '@remix-run/react';

import { Receipt } from '~/components/Receipt';
import { requireUser } from '~/services/auth.server';
import { createOrder, parseOptionalFilterPackageId } from '~/services/orders.server';
import { getActiveFilterPackages } from '~/services/filter-packages.server';
import { getPricePerPrint } from '~/services/settings.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [price, filterPackages] = await Promise.all([getPricePerPrint(), getActiveFilterPackages()]);
  return json({
    price: Number(price),
    filterPackages,
    publicBaseUrl: process.env.PUBLIC_ORDER_BASE_URL || 'http://localhost:3000',
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  try {
    const order = await createOrder(
      {
        customerName: String(formData.get('customerName') || ''),
        whatsapp: String(formData.get('whatsapp') || ''),
        quantity: String(formData.get('quantity') || ''),
        isRealTransaction: formData.get('isRealTransaction') === 'on',
        filterPackageId: parseOptionalFilterPackageId(String(formData.get('filterPackageId') || '')),
      },
      user.id
    );
    const publicBaseUrl =
      process.env.PUBLIC_ORDER_BASE_URL || 'http://localhost:3000';
    const qrDataUrl = await QRCode.toDataURL(
      `${publicBaseUrl}/order/${order.code}`,
      { margin: 1, width: 220 }
    );
    return json({
      order: {
        code: order.code,
        createdAt: order.createdAt.toISOString(),
        customerName: order.customerName,
        whatsapp: order.whatsapp,
        quantity: order.quantity,
        totalAmount: Number(order.totalAmount),
      },
      qrDataUrl,
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'Gagal membuat order.',
      },
      { status: 400 }
    );
  }
}

export default function CashierPage() {
  const { price, filterPackages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [quantity, setQuantity] = useState(1);
  const [isRealTransaction, setIsRealTransaction] = useState(true);
  const order = actionData && 'order' in actionData ? actionData.order : null;
  const qrDataUrl =
    actionData && 'qrDataUrl' in actionData ? actionData.qrDataUrl : null;
  const error = actionData && 'error' in actionData ? actionData.error : null;
  useEffect(() => {
    if (order?.code) setIsRealTransaction(true);
  }, [order?.code]);
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div>
        <p className="eyebrow">KASIR</p>
        <h1 className="page-title">Buat order baru</h1>
        <p className="page-subtitle">
          Terima pembayaran cash, lalu cetak QR untuk customer.
        </p>
        <Form
          key={order?.code || 'new'}
          method="post"
          className="mt-8 rounded-2xl border border-[#e6ded2] bg-white p-6"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field-label sm:col-span-2">
              Nama customer
              <input
                className="field-input"
                name="customerName"
                placeholder="Contoh: Husein"
                required
              />
            </label>
            <label className="field-label">
              Nomor WhatsApp
              <input
                className="field-input"
                name="whatsapp"
                placeholder="08xxxxxxxxxx"
                required
              />
            </label>
            <label className="field-label">
              Jumlah cetak
              <input
                className="field-input"
                name="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number(event.target.value) || 1))
                }
                required
              />
            </label>
            <label className="field-label sm:col-span-2">
              Paket filter
              <select className="field-input" name="filterPackageId" defaultValue="">
                <option value="">Original saja</option>
                {filterPackages.map((filterPackage) => (
                  <option key={filterPackage.id} value={filterPackage.id}>
                    {filterPackage.name} ({filterPackage.filters.length} filter)
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-[#968b7e]">Setiap filter dibuat dari original, tidak berantai.</span>
            </label>
            <label className="flex items-center gap-3 self-end rounded-xl border border-[#e6ded2] p-4 sm:col-span-2">
              <input className="h-4 w-4 accent-[#25231f]" type="checkbox" name="isRealTransaction" checked={isRealTransaction} onChange={(event) => setIsRealTransaction(event.target.checked)} />
              <span><span className="block text-sm font-semibold">Transaksi real</span><span className="mt-1 block text-xs text-[#84796c]">Matikan untuk order test/free dan total menjadi Rp0.</span></span>
            </label>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#eee7df] pt-5">
            <div>
              <p className="text-xs text-[#968b7e]">Total bayar</p>
              <p className="text-lg font-semibold">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  maximumFractionDigits: 0,
                }).format(isRealTransaction ? price * quantity : 0)}
              </p>
              <p className="mt-1 text-xs text-[#968b7e]">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  maximumFractionDigits: 0,
                }).format(price)}{' '}
                / cetak
              </p>
            </div>
            <button
              className="button-primary"
              type="submit"
              disabled={navigation.state === 'submitting'}
            >
              {navigation.state === 'submitting'
                ? 'Memproses...'
                : 'Proses pembayaran'}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        </Form>
      </div>
      {order && qrDataUrl ? (
        <Receipt order={order} qrDataUrl={qrDataUrl} />
      ) : (
        <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-[#d9d0c4] p-8 text-center text-sm leading-6 text-[#968b7e]">
          Receipt akan muncul di sini setelah pembayaran diproses.
        </div>
      )}
    </div>
  );
}
