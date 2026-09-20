import QRCode from "qrcode";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { Receipt } from "~/components/Receipt";
import { requireUser } from "~/services/auth.server";
import { getOrderByCode, serializeReceiptOrder } from "~/services/orders.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const order = await getOrderByCode(params.code || "");
  if (!order) throw new Response("Not found", { status: 404 });
  const baseUrl = process.env.PUBLIC_ORDER_BASE_URL || "http://localhost:3000";
  return json({ order: serializeReceiptOrder(order), qrDataUrl: await QRCode.toDataURL(`${baseUrl}/order/${order.code}`, { margin: 1, width: 220 }) });
}

export default function ReceiptPage() {
  const data = useLoaderData<typeof loader>();
  return <div className="mx-auto max-w-md"><Receipt order={data.order} qrDataUrl={data.qrDataUrl} /></div>;
}
