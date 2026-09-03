import { json, type ActionFunctionArgs } from "@remix-run/node";

import { requireUser } from "~/services/auth.server";
import { completeOrderFile } from "~/services/order-files.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  try {
    const body = await request.json();
    const file = await completeOrderFile({ orderCode: params.code || "", key: String(body.key || ""), originalName: String(body.originalName || ""), contentType: String(body.contentType || ""), sizeBytes: Number(body.sizeBytes) }, user);
    return json({ file: { id: file.id, originalName: file.originalName, mediaType: file.mediaType, sizeBytes: Number(file.sizeBytes) } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menyimpan file." }, { status: 400 });
  }
}
