import { type LoaderFunctionArgs } from "@remix-run/node";
import archiver, { type Archiver } from "archiver";
import { Readable } from "node:stream";

import { requireUser } from "~/services/auth.server";
import { getObjectStream } from "~/services/r2.server";
import { buildHistoryZipEntryName, buildHistoryZipFilename, listDeliveredOrdersInRange, parseHistoryDateRange } from "~/services/reports.server";

type HistoryOrder = Awaited<ReturnType<typeof listDeliveredOrdersInRange>>[number];

async function appendHistoryFiles(archive: Archiver, orders: HistoryOrder[]) {
  for (const order of orders) {
    for (const file of order.files) {
      try {
        const stream = await getObjectStream(file.storageKey);
        archive.append(stream, { name: buildHistoryZipEntryName(order.code, order.customerName, file.id, file.originalName) });
      } catch (error) {
        console.warn(`Lewati file yang gagal di-stream: ${order.code} - ${file.originalName}`, error);
      }
    }
  }
  await archive.finalize();
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const query = url.searchParams.get("q") || "";

  let range: { start: Date; end: Date };
  try {
    range = parseHistoryDateRange(from, to);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Rentang tanggal tidak valid.", { status: 400 });
  }

  const orders = await listDeliveredOrdersInRange(range.start, range.end, query);
  if (!orders.length) return new Response("Tidak ada riwayat pada rentang tanggal ini.", { status: 400 });

  const archive = archiver("zip");
  archive.on("error", (error) => {
    console.warn("Gagal membuat ZIP riwayat", error);
  });

  appendHistoryFiles(archive, orders).catch((error) => console.warn("Gagal membuat ZIP riwayat", error));

  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${buildHistoryZipFilename(from, to)}"`,
    },
  });
}
