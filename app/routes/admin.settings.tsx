import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

import { requireSuperadmin } from "~/services/auth.server";
import { getPricePerPrint, updatePricePerPrint } from "~/services/settings.server";
import { validatePricePerPrint } from "~/services/users.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperadmin(request);
  const price = await getPricePerPrint();
  return json({ price: Number(price) });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperadmin(request);
  const formData = await request.formData();
  try {
    const price = validatePricePerPrint(String(formData.get("price") || ""));
    await updatePricePerPrint(price);
    return json({ success: "Harga berhasil disimpan." });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menyimpan harga." }, { status: 400 });
  }
}

export default function SettingsPage() {
  const { price } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const error = actionData && "error" in actionData ? actionData.error : null;
  const success = actionData && "success" in actionData ? actionData.success : null;
  return <div className="space-y-6"><div><p className="eyebrow">SUPERADMIN</p><h1 className="page-title">Settings</h1><p className="page-subtitle">Konfigurasi yang memengaruhi transaksi baru.</p></div><section className="max-w-xl rounded-2xl border border-[#e6ded2] bg-white p-6"><h2 className="section-title">Harga per cetak</h2><Form method="post" className="mt-5 flex flex-wrap items-end gap-3"><label className="field-label flex-1">Harga (Rupiah)<input className="field-input" type="number" name="price" min="1" step="1" defaultValue={price} required /></label><button className="button-primary" type="submit">Simpan</button></Form>{error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}{success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}</section></div>;
}
