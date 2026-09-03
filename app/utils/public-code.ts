import { randomBytes as nodeRandomBytes } from "node:crypto";

export function generatePublicOrderCode(now = new Date(), bytes: Uint8Array = nodeRandomBytes(4)) {
  const date = now.toISOString().slice(2, 10).replaceAll("-", "");
  const suffix = Buffer.from(bytes).toString("hex").toUpperCase().padEnd(8, "0").slice(0, 8);
  return `PB${date}-${suffix}`;
}
