import { Link } from "@remix-run/react";
import { FaInstagram } from "react-icons/fa";

type ReceiptItem = { id: number; productName: string; quantity: number; unitPrice: number };
type ReceiptOrder = { code: string; createdAt: string; customerName: string; whatsapp: string; isRealTransaction: boolean; totalAmount: number; items: ReceiptItem[] };

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function Receipt({ order, qrDataUrl }: { order: ReceiptOrder; qrDataUrl: string }) {
  return (
    <section className="receipt-area rounded-2xl border border-[#e6ded2] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">BUKTI PEMBAYARAN</p>
          <h2 className="mt-2 font-display text-3xl">Poosefilm</h2>
          <p className="mt-1 text-xs text-[#968b7e]">{new Date(order.createdAt).toLocaleString("id-ID")}</p>
        </div>
        <img className="h-36 w-36" src={qrDataUrl} alt={`QR order ${order.code}`} />
      </div>
      <div className="my-6 border-t border-dashed border-[#d9d0c4]" />
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-[#84796c]">Kode order</dt><dd className="font-semibold">{order.code}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-[#84796c]">Customer</dt><dd className="font-semibold">{order.customerName}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-[#84796c]">WhatsApp</dt><dd>{order.whatsapp}</dd></div>
        {order.items.map((item) => <div key={item.id} className="flex justify-between gap-4"><dt className="text-[#84796c]">{item.productName} x {item.quantity}</dt><dd>{order.isRealTransaction ? rupiah.format(item.unitPrice * item.quantity) : null}</dd></div>)}
        <div className="flex justify-between gap-4 border-t border-[#eee7df] pt-3 text-base"><dt className="font-semibold">Total dibayar</dt><dd className="font-bold">{rupiah.format(order.totalAmount)}</dd></div>
      </dl>
      <p className="mt-6 text-center text-xs leading-5 text-[#968b7e]">Scan QR ini setelah file foto/video selesai diunggah untuk membuka halaman download.</p>
      <div className="mt-4 flex justify-center gap-4 text-xs text-[#84796c]">
        <span aria-label="Instagram @poosebox.id" className="flex items-center gap-1.5"><FaInstagram aria-hidden="true" size={14} />@poosebox.id</span>
        <span aria-label="Instagram @poosefilm.id" className="flex items-center gap-1.5"><FaInstagram aria-hidden="true" size={14} />@poosefilm.id</span>
      </div>
      <div className="mt-5 flex gap-3 print:hidden"><button className="button-primary" type="button" onClick={() => window.print()}>Cetak struk</button><Link className="button-secondary" to="/admin/queue">Ke antrian upload</Link></div>
    </section>
  );
}
