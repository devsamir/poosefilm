import { json, type ActionFunctionArgs } from "@remix-run/node";

import { requireUser } from "~/services/auth.server";
import { createPresignedUpload } from "~/services/order-files.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  try {
    const body = await request.json();
    return json(await createPresignedUpload({ orderCode: params.code || "", originalName: String(body.originalName || ""), contentType: String(body.contentType || ""), sizeBytes: Number(body.sizeBytes) }, user));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menyiapkan upload." }, { status: 400 });
  }
}
