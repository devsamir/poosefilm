import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

import { getOrderByCode } from "~/services/orders.server";
import { createPresignedGetUrl } from "~/services/r2.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const order = await getOrderByCode(params.code || "");
  const fileId = Number(params.fileId);
  const file = order?.files.find((candidate) => candidate.id === fileId);
  if (!file) throw new Response("File tidak ditemukan", { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return redirect(await createPresignedGetUrl({ key: file.storageKey, contentType: file.contentType, originalName: file.originalName, download }));
}
