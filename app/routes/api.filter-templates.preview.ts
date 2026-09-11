import { type ActionFunctionArgs } from "@remix-run/node";
import sharp from "sharp";

import { requireSuperadmin } from "~/services/auth.server";
import { renderFilteredImage } from "~/services/filter-processor.server";

const PREVIEW_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PREVIEW_IMAGE_LIMIT = 10 * 1024 * 1024;
const MAX_PREVIEW_DIMENSION = 4000;

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperadmin(request);
  const formData = await request.formData();
  const image = formData.get("image");
  const css = String(formData.get("css") || "");

  if (!(image instanceof File) || !PREVIEW_IMAGE_TYPES.has(image.type) || image.size < 1 || image.size > PREVIEW_IMAGE_LIMIT) {
    return new Response("Foto sample tidak valid. Gunakan JPG, PNG, atau WebP maksimal 10 MB.", { status: 400 });
  }

  try {
    const uploadedBuffer = Buffer.from(await image.arrayBuffer());
    const metadata = await sharp(uploadedBuffer).metadata();
    const sourceBuffer = (metadata.width || 0) > MAX_PREVIEW_DIMENSION || (metadata.height || 0) > MAX_PREVIEW_DIMENSION
      ? await sharp(uploadedBuffer).resize(MAX_PREVIEW_DIMENSION, MAX_PREVIEW_DIMENSION, { fit: "inside" }).toBuffer()
      : uploadedBuffer;
    const rendered = await renderFilteredImage({ sourceBuffer, filterCss: css });
    return new Response(rendered, { headers: { "Content-Type": "image/jpeg" } });
  } catch (error) {
    console.warn("Gagal membuat preview filter", error);
    return new Response("Gagal memproses foto sample.", { status: 400 });
  }
}
