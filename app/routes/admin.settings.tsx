import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

import { requireSuperadmin } from "~/services/auth.server";
import { getPricePerPrint, getWhatsappTemplate, updatePricePerPrint, updateWhatsappTemplate, validateWhatsappTemplate } from "~/services/settings.server";
import { validatePricePerPrint } from "~/services/users.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperadmin(request);
  const price = await getPricePerPrint();
  const whatsappTemplate = await getWhatsappTemplate();
  return json({ price: Number(price), whatsappTemplate });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperadmin(request);
  const formData = await request.formData();
  try {
    if (String(formData.get("intent")) === "whatsapp-template") {
      await updateWhatsappTemplate(validateWhatsappTemplate(String(formData.get("whatsappTemplate") || "")));
      return json({ success: "Template WhatsApp berhasil disimpan." });
    }
    const price = validatePricePerPrint(String(formData.get("price") || ""));
    await updatePricePerPrint(price);
    return json({ success: "Harga berhasil disimpan." });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menyimpan harga." }, { status: 400 });
  }
}

export default function SettingsPage() {
  const { price, whatsappTemplate } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const error = actionData && "error" in actionData ? actionData.error : null;
  const success = actionData && "success" in actionData ? actionData.success : null;
  return <div className="space-y-6"><div><p className="eyebrow">SUPERADMIN</p><h1 className="page-title">Settings</h1><p className="page-subtitle">Konfigurasi harga dan pesan WhatsApp untuk customer.</p></div><section className="max-w-xl rounded-2xl border border-[#e6ded2] bg-white p-6"><h2 className="section-title">Harga per cetak</h2><Form method="post" className="mt-5 flex flex-wrap items-end gap-3"><label className="field-label flex-1">Harga (Rupiah)<input className="field-input" type="number" name="price" min="1" step="1" defaultValue={price} required /></label><button className="button-primary" type="submit">Simpan</button></Form>{error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}{success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}</section><section className="max-w-2xl rounded-2xl border border-[#e6ded2] bg-white p-6"><h2 className="section-title">Template pesan WhatsApp</h2><p className="mt-2 text-sm leading-6 text-[#84796c]">Gunakan {"{customerName}"}, {"{orderCode}"}, dan {"{link}"}. Placeholder {"{link}"} wajib ada.</p><Form method="post" className="mt-5 space-y-4"><input type="hidden" name="intent" value="whatsapp-template" /><textarea className="field-input min-h-40 resize-y" name="whatsappTemplate" defaultValue={whatsappTemplate} rows={7} required /><button className="button-primary" type="submit">Simpan template</button></Form>{error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}{success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}</section></div>;
}
