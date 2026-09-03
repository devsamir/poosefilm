import { json, type ActionFunctionArgs } from "@remix-run/node";

import { requireUser } from "~/services/auth.server";
import { deleteOrderFile } from "~/services/order-files.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (request.method !== "DELETE") return json({ error: "Method tidak didukung." }, { status: 405 });
  try {
    await deleteOrderFile(params.code || "", Number(params.fileId), user);
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menghapus file." }, { status: 400 });
  }
}
