import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
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

import { ProductPickerModal } from '~/components/ProductPickerModal';
import { Receipt } from '~/components/Receipt';
import { requireUser } from '~/services/auth.server';
import { createOrder, parseOptionalFilterPackageId, serializeReceiptOrder } from '~/services/orders.server';
import { getActiveFilterPackages } from '~/services/filter-packages.server';
import { listActiveProducts } from '~/services/products.server';
import { calculateOrderTotal, countPrintQuantity, parseOrderItemFields } from '~/utils/order-items';
import { addOrderLine, removeOrderLine, setOrderLineQuantity, type OrderLine } from '~/utils/order-lines';
import { PRODUCT_KIND_LABELS, PRODUCT_KIND_PILL_CLASSES } from '~/utils/product-kind';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [products, filterPackages] = await Promise.all([listActiveProducts(), getActiveFilterPackages()]);
  return json({
    products,
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
        items: parseOrderItemFields(formData.entries()),
        isRealTransaction: formData.get('isRealTransaction') === 'on',
        marketingConsent: formData.get('marketingConsent') === 'on',
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
      order: serializeReceiptOrder(order),
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
  const { products, filterPackages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isRealTransaction, setIsRealTransaction] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const order = actionData && 'order' in actionData ? actionData.order : null;
  const qrDataUrl =
    actionData && 'qrDataUrl' in actionData ? actionData.qrDataUrl : null;
  const error = actionData && 'error' in actionData ? actionData.error : null;
  const productsById = new Map(products.map((product) => [product.id, product]));
  const orderLines = lines.flatMap((line) => {
    const product = productsById.get(line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  const items = orderLines.map(({ product, quantity }) => ({
    unitPrice: product.price,
    quantity,
    productKind: product.kind,
  }));
  const printQuantity = countPrintQuantity(items);
  const defaultFilterPackageId = filterPackages.find((filterPackage) => filterPackage.isDefault)?.id;
  const closePicker = useCallback(() => setPickerOpen(false), []);
  useEffect(() => {
    if (order?.code) {
      setLines([]);
      setPickerOpen(false);
      setIsRealTransaction(true);
      setMarketingConsent(false);
    }
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
            <label className="field-label sm:col-span-2">
              Nomor WhatsApp
              <input
                className="field-input"
                name="whatsapp"
                placeholder="08xxxxxxxxxx"
                required
              />
            </label>
            <fieldset className="min-w-0 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <legend className="field-label">Product</legend>
                <button
                  className="button-secondary text-xs"
                  type="button"
                  onClick={() => setPickerOpen(true)}
                >
                  + Tambah product
                </button>
              </div>
              {orderLines.length ? (
                <div className="mt-2 divide-y divide-[#eee7df] rounded-xl border border-[#e6ded2]">
                  {orderLines.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-4"
                    >
                      <input
                        type="hidden"
                        name={`qty_${product.id}`}
                        value={quantity}
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {product.name}
                          <span className={`status-pill ${PRODUCT_KIND_PILL_CLASSES[product.kind]}`}>
                            {PRODUCT_KIND_LABELS[product.kind]}
                          </span>
                        </p>
                        <p className="text-xs text-[#968b7e]">
                          {rupiah.format(product.price)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <button
                            className="button-secondary !px-3 !py-2"
                            type="button"
                            aria-label={`Kurangi ${product.name}`}
                            disabled={quantity <= 1}
                            onClick={() =>
                              setLines((current) =>
                                setOrderLineQuantity(current, product.id, quantity - 1)
                              )
                            }
                          >
                            -
                          </button>
                          <input
                            className="field-input !mt-0 w-16 text-center"
                            type="number"
                            min="1"
                            step="1"
                            value={quantity}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) =>
                              setLines((current) =>
                                setOrderLineQuantity(current, product.id, Number(event.target.value))
                              )
                            }
                            aria-label={`Jumlah ${product.name}`}
                          />
                          <button
                            className="button-secondary !px-3 !py-2"
                            type="button"
                            aria-label={`Tambah jumlah ${product.name}`}
                            onClick={() =>
                              setLines((current) =>
                                setOrderLineQuantity(current, product.id, quantity + 1)
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                        <p className="w-28 text-right text-sm font-semibold">
                          {rupiah.format(product.price * quantity)}
                        </p>
                        <button
                          className="text-xs font-semibold text-[#a34e43]"
                          type="button"
                          aria-label={`Hapus ${product.name}`}
                          onClick={() =>
                            setLines((current) => removeOrderLine(current, product.id))
                          }
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-[#d9d0c4] p-4 text-sm text-[#968b7e]">
                  {products.length
                    ? 'Belum ada product. Klik + Tambah product.'
                    : 'Belum ada product aktif. Minta superadmin menambahkannya di halaman Produk.'}
                </p>
              )}
            </fieldset>
            <label className="field-label sm:col-span-2">
              Paket filter
              <select className="field-input" name="filterPackageId" defaultValue={defaultFilterPackageId ? String(defaultFilterPackageId) : ''}>
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
              <input className="h-4 w-4 accent-[#25231f]" type="checkbox" name="marketingConsent" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} />
              <span><span className="block text-sm font-semibold">Boleh di-share ke sosmed Poosefilm</span><span className="mt-1 block text-xs text-[#84796c]">Customer setuju fotonya dipakai untuk promosi di media sosial Poosefilm.</span></span>
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
                {rupiah.format(calculateOrderTotal(items, isRealTransaction))}
              </p>
              <p className="mt-1 text-xs text-[#968b7e]">
                {printQuantity} cetak
              </p>
            </div>
            <button
              className="button-primary"
              type="submit"
              disabled={navigation.state === 'submitting' || orderLines.length === 0}
            >
              {navigation.state === 'submitting'
                ? 'Memproses...'
                : 'Proses pembayaran'}
            </button>
          </div>
          {orderLines.length === 0 ? (
            <p className="mt-4 text-sm text-[#968b7e]">
              Tambah minimal satu product.
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        </Form>
        {pickerOpen ? (
          <ProductPickerModal
            products={products}
            lines={lines}
            onAdd={(productId) =>
              setLines((current) => addOrderLine(current, productId))
            }
            onClose={closePicker}
          />
        ) : null}
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
