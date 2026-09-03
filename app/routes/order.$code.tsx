import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { MediaGallery } from "~/components/MediaGallery";
import { getPublicOrder } from "~/services/reports.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const order = await getPublicOrder(params.code || "");
  if (!order) throw new Response("Order tidak ditemukan", { status: 404 });
  return json(order);
}

export default function PublicOrderPage() {
  const order = useLoaderData<typeof loader>();
  return <main className="min-h-screen bg-[#f7f3ed] px-6 py-12 text-[#25231f]"><div className="mx-auto max-w-4xl"><div className="mb-10"><p className="eyebrow">POOSEFILM</p><h1 className="mt-3 font-display text-5xl">Hasil foto kamu.</h1><p className="mt-3 text-sm text-[#84796c]">Kode order <span className="font-semibold text-[#25231f]">{order.code}</span></p></div>{order.files.length ? <MediaGallery code={order.code} files={order.files} /> : <section className="rounded-2xl border border-dashed border-[#d9d0c4] bg-white p-12 text-center"><p className="font-display text-3xl">File sedang disiapkan.</p><p className="mt-3 text-sm leading-6 text-[#84796c]">Staff kami sedang mengunggah hasil foto/video kamu. Coba buka kembali link ini beberapa saat lagi.</p></section>}<p className="mt-10 text-center text-xs text-[#a09587]">Poosefilm by PooseBox</p></div></main>;
}
