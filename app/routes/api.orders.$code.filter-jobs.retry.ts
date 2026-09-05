import { json, type ActionFunctionArgs } from "@remix-run/node";

import { requireUser } from "~/services/auth.server";
import { retryFilterRenderJobs } from "~/services/filter-render-jobs.server";
import { getOrderByCode } from "~/services/orders.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method tidak diizinkan." }, { status: 405 });
  await requireUser(request);
  const code = params.code || "";
  const order = await getOrderByCode(code);
  if (!order) return json({ error: "Order tidak ditemukan." }, { status: 404 });
  try {
    return json(await retryFilterRenderJobs(order.id));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal mengulang proses filter." }, { status: 400 });
  }
}
